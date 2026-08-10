#!/usr/bin/env bash
#
# Uploads and publishes the extension to the Chrome Web Store.
#
# Usage:  scripts/publish-webstore.sh <zip>
#
# Reads four variables from the environment, supplied as CI secrets:
#   CHROME_EXTENSION_ID    item id from the Web Store dashboard URL
#   CHROME_CLIENT_ID       OAuth client id
#   CHROME_CLIENT_SECRET   OAuth client secret
#   CHROME_REFRESH_TOKEN   refresh token for that client
#
# https://developer.chrome.com/docs/webstore/using-api

set -euo pipefail

zip=${1:?usage: publish-webstore.sh <zip>}
[ -f "$zip" ] || { echo "No such file: $zip" >&2; exit 1; }

for name in CHROME_EXTENSION_ID CHROME_CLIENT_ID CHROME_CLIENT_SECRET CHROME_REFRESH_TOKEN; do
  if [ -z "${!name:-}" ]; then
    echo "$name is not set; cannot publish to the Web Store." >&2
    exit 1
  fi
done

token=$(curl -sS -X POST https://oauth2.googleapis.com/token \
  -d "client_id=$CHROME_CLIENT_ID" \
  -d "client_secret=$CHROME_CLIENT_SECRET" \
  -d "refresh_token=$CHROME_REFRESH_TOKEN" \
  -d grant_type=refresh_token | jq -r '.access_token // empty')

if [ -z "$token" ]; then
  echo "Could not exchange the refresh token for an access token." >&2
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
