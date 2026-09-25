#!/usr/bin/env bash
# Full Cloudflare deploy, in the order that actually works.
#
#   1. build the SPA      -- the ASSETS binding uploads client/dist, so a stale
#                            or missing build ships a stale or missing site
#   2. sync the schema    -- the Worker no longer applies DDL itself and cannot
#                            (50-subrequest cap; see CLOUDFLARE.md). A deploy
#                            that adds a table without this step ships code
#                            that queries a table which does not exist.
#   3. deploy
#   4. smoke test         -- proves the thing that is live actually serves
#
# Usage:  bash scripts/deploy.sh            # dry-run the schema step
#         bash scripts/deploy.sh --apply    # apply schema changes, then deploy

set -euo pipefail
cd "$(dirname "$0")/.."

APPLY=""
[ "${1:-}" = "--apply" ] && APPLY="--apply"

# wrangler needs Node >= 22; the shell default on this machine is 20.
if [ -x /opt/homebrew/opt/node@22/bin/node ]; then
  export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
fi
case "$(node -v)" in
  v2[2-9].*|v[3-9][0-9].*) ;;
  *) echo "wrangler needs Node >= 22, found $(node -v)"; exit 1 ;;
esac
echo "node $(node -v)"

echo
echo "── 1/4  building SPA ─────────────────────────────────────────"
npm run build --prefix client

echo
echo "── 2/4  schema ───────────────────────────────────────────────"
node scripts/sync-schema.js $APPLY
if [ -z "$APPLY" ]; then
  echo
  echo "   ^ dry run. If a plan is listed above, re-run as:"
  echo "     bash scripts/deploy.sh --apply"
fi

echo
echo "── 3/4  deploying ────────────────────────────────────────────"
npx wrangler deploy

echo
echo "── 4/4  smoke test ───────────────────────────────────────────"
W="${SMOKE_URL:-https://drinkedinn.madasales15.workers.dev}"
fail=0
# NB: the local is called `route`, not `path`. In zsh `path` is tied to the
# PATH array, so `local path=...` silently destroys command lookup inside the
# function and every curl call fails with "command not found".
check() { # check <route> <expected-status> <expected-content-type-substring>
  local route="$1" want="$2" ctype="$3"
  local out code ct
  out=$(curl -s -o /dev/null -w '%{http_code} %{content_type}' --max-time 25 "$W$route")
  code="${out%% *}"; ct="${out#* }"
  if [ "$code" = "$want" ] && [[ "$ct" == *"$ctype"* ]]; then
    printf '  ok    %-26s %s %s\n' "$route" "$code" "$ct"
  else
    printf '  FAIL  %-26s got %s %s (want %s %s)\n' "$route" "$code" "$ct" "$want" "$ctype"
    fail=1
  fi
}
check "/api/health?deep=0"    200 "application/json"
check "/api/health"           200 "application/json"   # 503 here means the DB is unreachable
check "/api/places"           401 "application/json"   # must be JSON 401, not an HTML page
check "/"                     200 "text/html"
check "/explore"              200 "text/html"          # client route survives a hard refresh
check "/missing-asset-xyz.js" 404 "text/plain"         # a missing asset must NOT return HTML

echo
if [ "$fail" = 0 ]; then echo "all smoke checks passed"; else echo "SMOKE TEST FAILED"; exit 1; fi
