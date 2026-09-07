# Running on Cloudflare

DrinkedInn runs as a single Cloudflare Worker: the Express API and the React SPA
are served from one deployment, with R2 for uploads and Turso for data.

```
                 Cloudflare Worker
                 ┌──────────────────────┐
   request ────► │ /api/*  → Express    │ ──► Turso  (HTTP)
                 │ /*      → ASSETS     │ ──► R2     (binding)
                 └──────────────────────┘
                          ▲
                   cron triggers
```

---

## Prerequisites

**Node 22.** Wrangler requires it. Node 22 is installed keg-only so your default
`node` is untouched — put it in front of PATH only when running wrangler:

```bash
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
```

Add that line to `~/.zshrc` if you'd rather not repeat it.

---

## First deploy

```bash
cd /Users/rahulmanghnani/Downloads/drinkeden
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"

npx wrangler login

# The SPA must be built first — the ASSETS binding uploads client/dist.
cd client && npx vite build && cd ..

npx wrangler deploy
```

### Secrets

Never in `wrangler.jsonc` — that file is committed. Use `wrangler secret put`:

```bash
npx wrangler secret put JWT_SECRET
npx wrangler secret put TURSO_DB_URL
npx wrangler secret put TURSO_DB_AUTH_TOKEN
npx wrangler secret put CRON_SECRET

# Mixed into every password hash. Generate with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npx wrangler secret put PASSWORD_PEPPER

# Email — Workers cannot do SMTP, so this must be an HTTP API key
npx wrangler secret put RESEND_API_KEY

# Age assurance
npx wrangler secret put AGE_PROVIDER
npx wrangler secret put AGE_PROVIDER_KEY
npx wrangler secret put AGE_WEBHOOK_SECRET

# Web push
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put VAPID_SUBJECT

# Native push (optional)
npx wrangler secret put EXPO_ACCESS_TOKEN
```

`R2_*` credentials are **not** needed — R2 is a native binding here.

### R2 bucket

```bash
npx wrangler r2 bucket create drinkedinn-uploads
```

Then in the dashboard: **R2 → drinkedinn-uploads → Settings → Public access**.
Enable an `r2.dev` domain or connect `media.drinkedinn.com`, and set that as
`R2_PUBLIC_BASE`.

### Custom domain

**Workers & Pages → drinkedinn → Settings → Domains & Routes → Add custom
domain.** Add `www.drinkedinn.com`, and a redirect rule sending the bare domain
to `www` — the app is pinned to `www` because the redirect otherwise drops the
`Authorization` header.

---

## Local development

Two options.

**Node** — fastest loop, works with a local SQLite file:

```bash
cd server && npm run dev
```

**Workers runtime** — use this before deploying anything non-trivial, since it
catches what Node cannot:

```bash
# Terminal 1: libsql over HTTP (the Workers client cannot open file: URLs)
~/.turso/sqld --http-listen-addr 127.0.0.1:8081 --db-path /tmp/sqld-data

# Terminal 2
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
npx wrangler dev --local
```

`.dev.vars` holds local secrets and is gitignored:

```
JWT_SECRET=local-secret-at-least-32-characters-long
TURSO_DB_URL=http://127.0.0.1:8081
```

Cron triggers don't fire automatically in dev. Trigger one by hand:

```bash
curl "http://localhost:8788/cdn-cgi/handler/scheduled?cron=0+16+*+*+*"
```

---

## Four things that behave differently here

These are the real incompatibilities, all solved but worth knowing about before
you change the affected code.

**1. `express.json()` is not used.** body-parser reaches `iconv-lite`, which
fails to bundle (`require_streams(...) is not a function`), and even with that
aliased its stream handling aborts every request against the Workers
`node:http` shim. `server/lib/jsonBody.js` replaces it. It is UTF-8 only and
does not gzip-decode — both fine here, but don't assume express.json semantics.

**2. `@libsql/client` is aliased to its `/web` build.** The default entry loads
a native binary. The web build speaks HTTP, so **`file:` database URLs do not
work on Workers** — hence sqld for local testing.

**3. Rate limiting is off on Workers.** Each isolate has its own memory, so an
in-process limiter protects nothing. Configure it at the edge instead:
**Security → WAF → Rate limiting rules**. A sensible pair:

| Path | Limit |
|---|---|
| `/api/auth/login` and `/api/auth/register` | 40 requests / 15 min / IP |
| `/api/*` | 1000 requests / 15 min / IP |

This is strictly better than the in-process version — it stops traffic before it
reaches your Worker at all.

**4. No startup hook.** `db.init()` runs lazily on the first API request per
isolate. It is all `CREATE TABLE IF NOT EXISTS`, so repeats are free, but apply
deliberate schema changes yourself rather than relying on a user request to do
it.

---

## CPU limits and password hashing

**This runs on the Workers free tier.**

It did not originally. Password hashing used bcrypt at cost 12, which is pure
JavaScript and burns roughly 230ms of CPU — the free tier allows 10ms, so every
login would have failed.

Hashing now uses PBKDF2 through WebCrypto, which runs as native code:

| | CPU |
|---|---|
| bcrypt cost 12 (before) | ~230ms |
| PBKDF2 100k via WebCrypto | ~11ms |

Measured end to end on the Workers runtime: **login round trip 73ms**, including
network, routing and the database query. The hashing itself is a fraction of it.

### The tradeoff, stated plainly

PBKDF2-HMAC-SHA256 at 100,000 iterations is **weaker than bcrypt cost 12** against
GPU cracking, and 100,000 is a hard ceiling — Cloudflare rejects more to stop
Workers being used for DoS.

That gap is closed with a **server-side pepper**: the password is HMAC'd with
`PASSWORD_PEPPER` — held in Workers secrets, never in the database — before
PBKDF2 runs. A stolen database is therefore not crackable at all without also
stealing the secret store, which is a stronger property than iteration count
alone.

```bash
# Generate once. Losing it invalidates every password in the database.
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npx wrangler secret put PASSWORD_PEPPER
```

Hashing **refuses to run in production without it**, rather than silently
falling back to an unpeppered hash.

### Existing accounts

Accounts hashed with bcrypt still verify, and are transparently upgraded to
PBKDF2 on their next successful login. Seeded demo accounts can be migrated
immediately, since their passwords are known:

```bash
PASSWORD_PEPPER=... TURSO_DB_URL=... node scripts/migratePasswords.js --dry-run
PASSWORD_PEPPER=... TURSO_DB_URL=... node scripts/migratePasswords.js
```

A real account still on bcrypt needs one login to migrate, and that single login
may exceed the free-tier CPU limit. If it does, reset the password instead.

### Free tier limits worth knowing

| | Free |
|---|---|
| Requests | 100,000/day |
| CPU per invocation | 10ms |
| Worker size | 3MB compressed (this bundle: ~1MB) |

## Cron

Defined in `wrangler.jsonc`:

| Schedule | Job |
|---|---|
| `0 16 * * *` | Lifecycle re-engagement digest |
| `0 */4 * * *` | Autopost for demo accounts |

---

## Rollback

Deployments are versioned:

```bash
npx wrangler deployments list
npx wrangler rollback [deployment-id]
```

Rollback is near-instant and does not touch the database — so a schema change is
the one thing a rollback cannot undo. Treat migrations as one-way.
