#!/usr/bin/env bash
# Push the production secrets into the Cloudflare Worker.
#
# Reads .env.production (pulled from the Vercel project `drinkeden`, which is
# where the live credentials actually live -- NOT drinkedinn-rk24, which has
# none). Values are piped straight into `wrangler secret put` and are never
# echoed, logged or written anywhere else.
#
# PASSWORD_PEPPER is the one secret that is GENERATED here rather than copied:
# Vercel never had one. That is safe because lib/password.js verify() checks
# isLegacyBcrypt(stored) FIRST and calls bcrypt.compare() without the pepper,
# so every existing account keeps working. Only new PBKDF2 hashes use it.
#
#   IMPORTANT: run this ONCE. Re-running regenerates the pepper, which would
#   lock out every account created after the first run.
#
# Usage:  bash scripts/set-worker-secrets.sh

set -euo pipefail
cd "$(dirname "$0")/.."

# wrangler needs Node >= 22; the shell default here is 20.
if [ -x /opt/homebrew/opt/node@22/bin/node ]; then
  export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
fi
NODE_V="$(node -v)"
case "$NODE_V" in
  v2[2-9].*|v[3-9][0-9].*) ;;
  *) echo "wrangler needs Node >= 22, found $NODE_V"; echo "try: brew link --overwrite node@22"; exit 1 ;;
esac
echo "node $NODE_V"

ENV_FILE=.env.production
[ -f "$ENV_FILE" ] || { echo "missing $ENV_FILE -- run: npx vercel env pull $ENV_FILE --environment=production"; exit 1; }

# Read one key's value without sourcing the file (values contain '=' and quotes).
val() {
  sed -n "s/^$1=//p" "$ENV_FILE" | head -1 | sed -e 's/^"//' -e 's/"$//'
}

put() {  # put NAME VALUE
  local name="$1" value="$2"
  if [ -z "$value" ]; then
    echo "  SKIP  $name  (absent from $ENV_FILE)"
    return
  fi
  printf '%s' "$value" | npx wrangler secret put "$name" >/dev/null 2>&1 \
    && echo "  set   $name" \
    || { echo "  FAIL  $name"; return 1; }
}

echo
echo "Copying from Vercel project 'drinkeden':"
put TURSO_DB_URL        "$(val TURSO_DB_URL)"
put TURSO_DB_AUTH_TOKEN "$(val TURSO_DB_AUTH_TOKEN)"
put JWT_SECRET          "$(val JWT_SECRET)"
put CRON_SECRET         "$(val CRON_SECRET)"
put VAPID_PUBLIC_KEY    "$(val VAPID_PUBLIC_KEY)"
put VAPID_PRIVATE_KEY   "$(val VAPID_PRIVATE_KEY)"
put VAPID_SUBJECT       "$(val VAPID_SUBJECT)"

echo
echo "Generated fresh (Vercel had none):"
put PASSWORD_PEPPER "$(openssl rand -hex 32)"

echo
echo "Now on the Worker:"
npx wrangler secret list 2>/dev/null | grep -oE '"name": "[^"]+"' | sed 's/"name": /  /'
echo
echo "Next:  npx wrangler deploy"
