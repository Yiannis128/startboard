#!/usr/bin/env bash
#
# Uploads and publishes the extension to the Chrome Web Store.
#
# Usage:  scripts/publish-webstore.sh <zip>
#
# Reads two variables from the environment, supplied as CI secrets:
#   CHROME_EXTENSION_ID          item id from the Web Store dashboard URL
#   CHROME_SERVICE_ACCOUNT_KEY   the service account key JSON, verbatim
#
# The service account needs no IAM roles. What grants it access is adding its
# address under Account in the Web Store dashboard, and a publisher can hold
# only one, so that slot belongs to this script.
#
# https://developer.chrome.com/docs/webstore/service-accounts

set -euo pipefail

zip=${1:?usage: publish-webstore.sh <zip>}
[ -f "$zip" ] || { echo "No such file: $zip" >&2; exit 1; }

for name in CHROME_EXTENSION_ID CHROME_SERVICE_ACCOUNT_KEY; do
  if [ -z "${!name:-}" ]; then
    echo "$name is not set; cannot publish to the Web Store." >&2
    exit 1
  fi
done

email=$(printf '%s' "$CHROME_SERVICE_ACCOUNT_KEY" | jq -r '.client_email // empty')
if [ -z "$email" ]; then
  echo "CHROME_SERVICE_ACCOUNT_KEY is not a service account key JSON." >&2
  exit 1
fi

# openssl signs from a file, so the key touches the disk however this is
# written; keep it to a private one that goes away with the script.
keyfile=$(mktemp)
trap 'rm -f "$keyfile"' EXIT
chmod 600 "$keyfile"
printf '%s' "$CHROME_SERVICE_ACCOUNT_KEY" | jq -r '.private_key // empty' > "$keyfile"
if [ ! -s "$keyfile" ]; then
  echo "CHROME_SERVICE_ACCOUNT_KEY has no private_key." >&2
  exit 1
fi

# base64url: base64 with two characters swapped and the padding dropped.
b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }

now=$(date +%s)
header=$(printf '{"alg":"RS256","typ":"JWT"}' | b64url)
claims=$(printf '{"iss":"%s","scope":"%s","aud":"%s","iat":%s,"exp":%s}' \
  "$email" \
  https://www.googleapis.com/auth/chromewebstore \
  https://oauth2.googleapis.com/token \
  "$now" "$((now + 3600))" | b64url)
signature=$(printf '%s.%s' "$header" "$claims" \
  | openssl dgst -sha256 -sign "$keyfile" -binary | b64url)

# Failures here come back as a body, not a status, and carry no token, so the
# whole response is safe to print and is the only clue to what went wrong.
response=$(curl -sS -X POST https://oauth2.googleapis.com/token \
  --data-urlencode grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer \
  -d "assertion=$header.$claims.$signature")

token=$(printf '%s' "$response" | jq -r '.access_token // empty')
if [ -z "$token" ]; then
  echo "Could not exchange the service account key for an access token." >&2
  printf '%s\n' "$response" >&2
  exit 1
fi

api() {
  curl -sS -H "Authorization: Bearer $token" -H "x-goog-api-version: 2" "$@"
}

# Both endpoints answer 200 with a failure payload, so the body decides the
# outcome, not the status code.
upload=$(api -T "$zip" \
  "https://www.googleapis.com/upload/chromewebstore/v1.1/items/$CHROME_EXTENSION_ID")

echo "Upload response: $upload"
if [ "$(echo "$upload" | jq -r '.uploadState // empty')" != "SUCCESS" ]; then
  echo "Web Store upload failed." >&2
  exit 1
fi

publish=$(api -X POST -H "Content-Length: 0" \
  "https://www.googleapis.com/chromewebstore/v1.1/items/$CHROME_EXTENSION_ID/publish")

echo "Publish response: $publish"
if echo "$publish" | jq -e '.error // empty' >/dev/null; then
  echo "Web Store publish failed." >&2
  exit 1
fi

echo "Published. Google review can take several days before it goes live."
