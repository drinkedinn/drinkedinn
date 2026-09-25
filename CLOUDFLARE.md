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
| **Subrequests per invocation** | **50** |
| Worker size | 3MB compressed (this bundle: ~1MB) |

The subrequest cap is the one that actually bit us, and it is the least
obvious, so it gets its own section below.

## The 50-subrequest cap, and why the database schema is applied by hand

**Every database query is a subrequest.** Turso is reached over HTTP, so
`db.get`, `db.all`, `db.run` and `db.exec` each cost one of the 50 an
invocation is allowed. (`db.exec` uses `executeMultiple`, so an entire
multi-statement SQL string costs one — that distinction matters a lot below.)
Outbound `fetch` — Resend, webhooks, LLM providers — also counts. The R2
binding does **not**; it is a native binding, not HTTP.

Exceeding the cap throws:

```
Too many subrequests by single Worker invocation.
```

### What this broke

`server/worker.js` used to call `db.init()` on the first request of each
isolate, reasoning that `CREATE TABLE IF NOT EXISTS` is free to repeat. On Node
it is. Here, a full `init()` measures **76 subrequests** — 70 `executeMultiple`
plus 6 `execute`. Most of that is the migrations loop, which runs
`await exec(sql)` once per `ALTER TABLE` because each one needs its own
try/catch to swallow "duplicate column". That is 43 separate round trips that
cannot be merged into one `executeMultiple` without losing the per-statement
error handling that makes them idempotent.

So `init()` was killed 26 statements short on every cold isolate. Two
consequences, the second much worse than the first:

1. **The schema was left half-applied.** `places` and `admin_roles` (early,
   inside a batched block) existed. `blocked_users`, `age_checks`,
   `analytics_events`, `device_tokens`, `error_reports` and `error_occurrences`
   (later) did not — so the block feature, which Google Play requires of any
   UGC app, returned 500.

2. **It ran before the route handler and spent the entire budget.** The failure
   was caught and logged, so the request continued — with zero subrequests
   left. Every `/api` call then died on its first real query. The symptom was a
   database that looked completely down, while `/api/health?deep=0`, which
   touches nothing, cheerfully returned 200. Nothing in the error pointed at
   the real cause.

### How it works now

The Worker never runs DDL. Schema is applied deliberately, from Node, where no
such limit exists:

```bash
node scripts/sync-schema.js           # dry run — print the plan, change nothing
node scripts/sync-schema.js --apply   # execute it
```

That script does **not** simply call `init()`, because `init()` is not only
DDL. It also loops every user forcing `onboarded = 1` and overwriting the
`drinks` column with a canned demo preset, and it seeds demo groups,
challenges and private messages — and only the first of those seed blocks
honours `SKIP_DEMO_SEED`. Instead it builds the canonical schema in a throwaway
local database, diffs it against the target, and applies only the additive
difference (`CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE ADD COLUMN`). It
asserts row counts are unchanged before and after, and exits non-zero if they
move.

**Run it before any deploy that adds a table or column.** Nothing else will.

### Writing handlers that stay under the cap

Fifty is generous for a normal request and very tight for a loop. The shape to
avoid is one query per row:

```js
for (const row of rows) await db.run('...', [row.id]);   // N subrequests
```

Prefer a single statement with `IN (...)`, a JOIN, or a subselect. Where a loop
is unavoidable, bound it explicitly with a `LIMIT` well under 45 and remember
the fixed cost every authenticated request already pays in middleware before
the handler body starts.

## Scheduled jobs

**The lifecycle digest must be called in a loop until it says it is done.**

`GET /api/jobs/lifecycle` no longer processes every eligible member in one
call. It cannot: each member who receives a digest costs about four
subrequests (two digest queries, one Resend call, one UPDATE), and an
invocation only gets 50. The old behaviour needed ~801 and died partway
through, having mailed some people and not others.

It now processes 10 members per invocation on Workers and returns
`remaining: true` when it stopped early. Keep calling until that is false:

```bash
while true; do
  r=$(curl -s "https://www.drinkedinn.com/api/jobs/lifecycle?key=$CRON_SECRET")
  echo "$r"
  [ "$(echo "$r" | jq -r .remaining)" = "true" ] || break
done
```

No cursor is needed — a member who has been mailed gets `last_digest_date` set,
and the next invocation's query excludes them.



**Cron triggers are disabled.** The Workers free plan allows 5 per *account*,
and this account already uses them on other Workers. Attempting to add more
fails the trigger step of every deploy.

The work runs over HTTP instead. `/api/jobs/lifecycle` already exists and is
authenticated with `CRON_SECRET`, so any external scheduler can call it:

```
GET https://<your-domain>/api/jobs/lifecycle?key=<CRON_SECRET>
```

Use GitHub Actions, cron-job.org, or any scheduler you already run. Daily at
16:00 UTC matches the original schedule.

Verify without sending anything:

```bash
curl "https://<your-domain>/api/jobs/lifecycle?key=<CRON_SECRET>&dryRun=1"
```

To go back to native cron, free a slot or move to Workers Paid, then uncomment
the `triggers` block in `wrangler.jsonc`.

---

## Leaving Vercel — the cutover

The app is deployed to Workers, but `drinkedinn.com` still serves the old
Vercel build. DNS is already in Cloudflare and proxied (`cf-ray` on every
response); it is proxying *to* Vercel (`x-vercel-id`). So this is a routing
change, not a migration.

**Order matters.** Each step leaves the site working. Do not skip ahead — step
3 points real traffic at the Worker, and a Worker with no secrets cannot
authenticate anyone.

### 1. Set the secrets (the Worker currently has none)

`wrangler secret list` returns `[]` today. Three of the four values already
exist in Vercel and must be REUSED:

```bash
npx vercel env pull .env.production   # gitignored; read the values, do not commit
```

| Secret | Where it comes from |
|---|---|
| `TURSO_DB_URL` | Copy from Vercel — a different database means an empty app |
| `TURSO_DB_AUTH_TOKEN` | Copy from Vercel |
| `JWT_SECRET` | Copy from Vercel to keep everyone signed in; a new one logs every session out |
| `PASSWORD_PEPPER` | **Generate new.** It does not exist in Vercel |

A new pepper is safe: production passwords are bcrypt from before the pepper
existed, and `lib/password.js` checks for legacy bcrypt *first* and compares
without the pepper. Existing logins keep working and upgrade to peppered
PBKDF2 on next sign-in. Store the value somewhere permanent — losing it makes
every password hashed after that point unverifiable.

```bash
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
npx wrangler secret put TURSO_DB_URL
npx wrangler secret put TURSO_DB_AUTH_TOKEN
npx wrangler secret put JWT_SECRET
npx wrangler secret put PASSWORD_PEPPER
```

### 2. Prove the Worker actually works before sending traffic to it

```bash
curl https://drinkedinn.madasales15.workers.dev/api/health
```

Must report `"status":"ok"` and `"db":"ok"`. While it says `degraded`, the
secrets are not right and the cutover would take the site down.

Then sign in against the workers.dev URL with a real account. If that fails,
stop — the domain change will not fix it.

### 3. Point the domain at the Worker

**Workers & Pages → drinkedinn → Settings → Domains & Routes → Add custom
domain** → `www.drinkedinn.com`. Cloudflare rewrites the DNS record itself.

Add a redirect rule sending the bare domain to `www` (Rules → Redirect Rules,
301, preserving path and query). The apex must not serve the app directly: a
307 across hosts drops the `Authorization` header, which is the reason the web
client is pinned to `www`.

Then uncomment the `routes` block in `wrangler.jsonc` so the binding lives in
the repo rather than only in dashboard state.

### 4. Point the mobile app back at the domain

`mobile/src/api.js` targets the workers.dev URL. Once the domain serves the
Worker, change `ORIGIN` back to `https://www.drinkedinn.com` — one line, and
the comment above it explains why it was moved.

### 5. Disconnect Vercel

Three Vercel projects are still attached to the GitHub repo and **fail on
every push**: `drinkeden`, `drinkedinn`, `drinkedinn-rk24`. Red checks that
never mean anything train you to ignore the ones that do.

Vercel dashboard → each project → Settings → Git → Disconnect. Keep the
projects for a week in case of rollback, then delete them.

Do NOT delete the Turso database — the Worker uses the same one.

### What breaks if you do this out of order

- Domain before secrets → the site 401s every authenticated request
- New `JWT_SECRET` → everyone is signed out (annoying, not damaging)
- New `TURSO_DB_URL` → an empty app; the real data is still in the old database
- Apex serving the app directly → `Authorization` dropped on redirect, endless
  sign-in loop

---

## Rollback

Deployments are versioned:

```bash
npx wrangler deployments list
npx wrangler rollback [deployment-id]
```

Rollback is near-instant and does not touch the database — so a schema change is
the one thing a rollback cannot undo. Treat migrations as one-way.
