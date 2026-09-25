# Launch checklist

Everything that has to happen outside the codebase. Ordered by what blocks what.

Run all `vercel` commands from the repo root — running them from `~` is why they
failed before:

```bash
cd /Users/rahulmanghnani/Downloads/drinkeden
npx vercel login    # the token expired; do this once
```

---

## 1. Credentials — four integrations wired but switched off

Each degrades safely today. None of them silently corrupts anything, but two
would make the app misbehave in production.

### R2 — object storage · **do this first**

Without it, uploads write to Vercel's ephemeral disk and **every shared photo
disappears within minutes.**

1. Cloudflare dashboard → **R2** → *Create bucket* → name it `drinkedinn-uploads`
2. **R2 → Manage R2 API Tokens** → *Create API token*, Object Read & Write
3. Bucket → **Settings → Public access** → enable an `r2.dev` domain, or connect
   `media.drinkedinn.com`

```bash
npx vercel env add R2_ACCOUNT_ID production
npx vercel env add R2_BUCKET production
npx vercel env add R2_ACCESS_KEY_ID production
npx vercel env add R2_SECRET_ACCESS_KEY production
npx vercel env add R2_PUBLIC_BASE production
```

Verify: upload a photo from the app, wait ten minutes, reload the feed. If it's
still there, R2 is live.

### SMTP — transactional email

Without it, verification links and digests are written to the server log and
never sent, so **nobody can verify their email**.

Any provider works (Resend, Postmark, SendGrid, SES).

```bash
npx vercel env add SMTP_HOST production
npx vercel env add SMTP_PORT production
npx vercel env add SMTP_USER production
npx vercel env add SMTP_PASS production
npx vercel env add MAIL_FROM production
```

**Then add SPF, DKIM and DMARC records** on `drinkedinn.app`. Without them your
verification mail lands in spam and the sign-up funnel quietly dies. Your
provider gives you the exact records.

### Age assurance — required before selling any brand placement

`AGE_PROVIDER` currently defaults to `stub`, which auto-passes. It **throws at
boot under `NODE_ENV=production`** rather than shipping a bypass, so this must be
set before a production deploy.

Pick a provider (Yoti, Persona, Veriff, Stripe Identity), then:

```bash
npx vercel env add AGE_PROVIDER production
npx vercel env add AGE_PROVIDER_KEY production
npx vercel env add AGE_WEBHOOK_SECRET production
```

One integration point remains in `server/lib/ageAssurance.js` — `createSession()`
needs the vendor's request shape from their current docs. The contract it must
satisfy is documented above the function.

### Expo access token — native push (optional)

expo.dev → Account Settings → Access Tokens.

```bash
npx vercel env add EXPO_ACCESS_TOKEN production
```

---

## 2. Mobile build

```bash
cd mobile
npm install -g eas-cli      # `npx eas` fails: the package is eas-cli, the binary is eas
eas login                   # free Expo account
eas build:configure         # writes the projectId the push code reads
```

Then:

```bash
eas build --profile preview --platform all      # installable test build
eas build --profile production --platform all   # store build
```

`eas.json` already defines development, preview and production profiles.
Fill in `ascAppId` and `appleTeamId` under `submit` when you have them.

**Accounts you'll need:** Apple Developer Program ($99/yr) and Google Play
Console ($25 once). Both take a day or two to approve — start them now, they're
the longest lead time on this list.

---

## 3. Store submission

Copy lives in `STORE_LISTING.md` — name, description, keywords, categories,
age rating answers, review notes and the data-safety table.

- [ ] Create a **fresh reviewer account** and put the credentials in the review notes.
      Apple rejects apps they can't log into.
- [ ] Screenshots per the guidance in `STORE_LISTING.md` — no visible
      intoxication, no volume, nobody who reads as under 25.
- [ ] Declare **18+ / Mature 17+**. Under-rating gets you removed.
- [ ] Category **Social Networking**, not Food & Drink.
- [ ] Complete the data-safety form honestly — Google cross-checks it against
      observed traffic, and a mismatch is a suspension.

---

## 4. Still open, and not a code problem

**Trademark opinion.** Still the largest unresolved risk. The hospitality
repositioning materially improved the position — "Inn" now has an independent
meaning, the comparison is gone from all copy, and the blue chip is gone from the
branding. A clearance opinion before you spend on growth is a few hundred dollars
against the cost of a forced rebrand.

**Legal review of the policies.** The privacy policy, terms and guidelines are
accurate to what the app does, but liability, governing law and jurisdiction need
a qualified read.

**Grievance Officer** — required by India's IT Rules 2021 if you operate there.
A name and contact on the legal pages.

---

## What is already done

| | |
|---|---|
| Security | Keychain tokens, JWT revocation, login lockout, per-country age gate, biometric lock |
| Safety | Content filter, reporting, mutual blocking, admin review queue |
| Compliance | Account deletion, live legal pages, jurisdiction rules, ad eligibility gate |
| Reliability | 97 tests, CI on every push, grouped error reporting with secret scrubbing |
| Product | iOS + Android app, ranked feed, push, analytics, brand-ads model |
