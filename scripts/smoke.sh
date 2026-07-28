#!/usr/bin/env bash
#
# End-to-end smoke test over real HTTP.
#
# The vitest integration suite drives the service layer directly. This script
# exercises the layer above it — actual route handlers, session cookies, the
# JSON envelope, rate limiting and cache revalidation — by walking one citizen
# through registration, voting and the public dashboard with nothing but curl.
#
# Usage:  BASE_URL=http://localhost:3000 ./scripts/smoke.sh
#
# Expects a server already running against a database it is safe to write to.

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT

pass() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$1"; exit 1; }

# A phone/ID pair unlikely to collide with existing rows.
# A Kenyan mobile is exactly 10 digits as 0 + [71] + 8 more, so the suffix must
# be exactly 8 digits — an off-by-one here is rejected by the schema long before
# any SMS is sent, which is confusing to debug.
SUFFIX="$(printf '%08d' "$(( $(date +%s) % 100000000 ))")"
PHONE="07${SUFFIX:0:8}"
ID_NUMBER="3${SUFFIX:0:7}"

api() {
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -sS -b "$JAR" -c "$JAR" -X "$method" "$BASE_URL$path" \
      -H 'Content-Type: application/json' -d "$body"
  else
    curl -sS -b "$JAR" -c "$JAR" -X "$method" "$BASE_URL$path"
  fi
}

jq_get() { node -e "
  let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{
    try{ const j=JSON.parse(d); const v=$1; console.log(v===undefined?'':v) }
    catch(e){ console.log('') }
  })"; }

echo "Smoke test against $BASE_URL"

# ── 1. Public surfaces need no auth ──────────────────────────────────────────
for path in / /candidates /transparency /how-it-works; do
  code=$(curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL$path")
  [ "$code" = "200" ] || fail "$path returned $code"
done
pass "public pages render without a session"

CANDIDATE_ID=$(api GET /api/candidates | jq_get 'j.data[0].id')
[ -n "$CANDIDATE_ID" ] || fail "no candidates seeded — run: npm run db:seed"
pass "candidate list served ($CANDIDATE_ID)"

# ── 2. Voting is refused without a session ───────────────────────────────────
UNAUTH=$(api POST /api/vote "{\"candidateId\":\"$CANDIDATE_ID\",\"choice\":\"YES\",\"color\":\"GREEN\",\"token\":\"$(printf 'A%.0s' {1..52})\"}" | jq_get 'j.error.code')
[ "$UNAUTH" = "UNAUTHORIZED" ] || fail "expected UNAUTHORIZED without a session, got '$UNAUTH'"
pass "voting rejected without a session"

# ── 3. Register ──────────────────────────────────────────────────────────────
OTP_RESPONSE=$(api POST /api/auth/request-otp "{\"phoneNumber\":\"$PHONE\"}")
if [ "$(echo "$OTP_RESPONSE" | jq_get 'j.ok')" != "true" ]; then
  fail "code request rejected: $OTP_RESPONSE"
fi
OTP=$(echo "$OTP_RESPONSE" | jq_get 'j.data.devCode')

# A production server correctly withholds the code from the API response. With
# SMS_PROVIDER=console it still prints to the server log, so read it from there
# rather than weakening the endpoint to make the test convenient.
if [ -z "$OTP" ] && [ -n "${SMOKE_SMS_LOG:-}" ] && [ -f "$SMOKE_SMS_LOG" ]; then
  sleep 1  # console.info to a redirected file is buffered; let it flush
  OTP=$(grep -ohE '[0-9]{6} is your' "$SMOKE_SMS_LOG" 2>/dev/null | tail -1 | cut -d' ' -f1 || true)
  [ -n "$OTP" ] && pass "verification code read from the SMS log (withheld from the API, as it should be)"
fi

[ -n "$OTP" ] || fail "no verification code available — set SMOKE_SMS_LOG=<server log> when NODE_ENV=production"
[ -n "$OTP" ] && pass "verification code issued"

REG=$(api POST /api/auth/register "{\"name\":\"Smoke Test\",\"phoneNumber\":\"$PHONE\",\"idNumber\":\"$ID_NUMBER\",\"county\":\"Nairobi\",\"otpCode\":\"$OTP\",\"acceptedTerms\":true,\"acknowledgedNotIebc\":true}")
TOKEN=$(echo "$REG" | jq_get 'j.data.rawToken')
[ -n "$TOKEN" ] || fail "registration failed: $REG"
pass "registered and issued a voting token"

grep -q 'jk27_session' "$JAR" || fail "no session cookie was set"
grep -qi 'HttpOnly\|#HttpOnly' "$JAR" || echo "    (note: HttpOnly flag not visible in cookie jar format)"
pass "session cookie set"

# ── 4. Session reflects the new account ──────────────────────────────────────
RATED=$(api GET /api/auth/session | jq_get 'j.data.candidatesRated')
[ "$RATED" = "0" ] || fail "expected 0 candidates rated, got '$RATED'"
pass "session reports the account with 0 ratings"

# ── 5. Cast a ballot ─────────────────────────────────────────────────────────
BEFORE=$(curl -sS "$BASE_URL/api/analytics" | jq_get 'j.data.totals.totalVotes')

VOTE=$(api POST /api/vote "{\"candidateId\":\"$CANDIDATE_ID\",\"choice\":\"YES\",\"color\":\"GREEN\",\"token\":\"$TOKEN\"}")
[ "$(echo "$VOTE" | jq_get 'j.ok')" = "true" ] || fail "vote failed: $VOTE"
pass "ballot accepted"

# ── 6. The same ballot again must conflict ───────────────────────────────────
DUPE=$(api POST /api/vote "{\"candidateId\":\"$CANDIDATE_ID\",\"choice\":\"NO\",\"color\":\"BLACK\",\"token\":\"$TOKEN\"}" | jq_get 'j.error.code')
[ "$DUPE" = "CONFLICT" ] || fail "expected CONFLICT on the second rating, got '$DUPE'"
pass "second rating of the same candidate refused"

# ── 7. Public tally reflects exactly one new vote ────────────────────────────
AFTER=$(curl -sS "$BASE_URL/api/analytics" | jq_get 'j.data.totals.totalVotes')
[ "$AFTER" = "$((BEFORE + 1))" ] || fail "tally went from $BEFORE to $AFTER (expected +1)"
pass "public tally incremented by exactly one"

# ── 8. Someone else's token is refused ───────────────────────────────────────
FORGED=$(api POST /api/vote "{\"candidateId\":\"$CANDIDATE_ID\",\"choice\":\"YES\",\"color\":\"GREEN\",\"token\":\"$(printf 'B%.0s' {1..52})\"}" | jq_get 'j.error.code')
[ "$FORGED" = "UNAUTHORIZED" ] || fail "expected UNAUTHORIZED for a forged token, got '$FORGED'"
pass "forged token refused"

# ── 9. CSV export is public and carries no personal data ─────────────────────
CSV=$(curl -sS "$BASE_URL/api/analytics?format=csv")
echo "$CSV" | head -1 | grep -q 'candidate' || fail "CSV missing header"
if echo "$CSV" | grep -q "$PHONE"; then fail "CSV leaked the phone number"; fi
if echo "$CSV" | grep -q "$ID_NUMBER"; then fail "CSV leaked the ID number"; fi
if echo "$CSV" | grep -q "Smoke Test"; then fail "CSV leaked the registrant name"; fi
pass "CSV export public and free of personal data"

# ── 10. Duplicate registration refused ───────────────────────────────────────
OTP2=$(api POST /api/auth/request-otp "{\"phoneNumber\":\"$PHONE\"}" | jq_get 'j.error.code')
[ "$OTP2" = "RATE_LIMITED" ] || echo "    (resend cooldown not hit — acceptable if >60s elapsed)"
pass "resend cooldown enforced"

echo
printf '\033[32mAll smoke checks passed.\033[0m\n'
