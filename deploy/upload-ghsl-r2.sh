#!/usr/bin/env bash
# Upload the prepared GHSL tiles to a Cloudflare R2 bucket.
#
# The tiles are immutable once cut, so they are uploaded once with a long
# cache lifetime and the site fetches them across origins; the loader sniffs
# the gzip magic, so it does not matter whether R2 serves the .bin.gz raw or
# inflates it. Needs wrangler logged in to the account that owns the bucket:
#   npm install -g wrangler && wrangler login
#
# Usage: deploy/upload-ghsl-r2.sh <bucket> [public base URL]
#   deploy/upload-ghsl-r2.sh grid84-grids https://grids.example.org
# Then set the CORS rule (edit deploy/r2-cors.json with the site's origin first):
#   wrangler r2 bucket cors put <bucket> --file deploy/r2-cors.json
# And point the index at the bucket:
#   scripts/point-grids-at.py https://grids.example.org
set -euo pipefail
BUCKET="${1:?bucket name}"
BASE="${2:-}"
cd "$(dirname "$0")/.."
count=0
for meta in public/data/ghsl/popc_*.json; do
  name=$(basename "$meta" .json)
  wrangler r2 object put "$BUCKET/ghsl/$name.json" --file "$meta" --content-type application/json --cache-control "public, max-age=31536000, immutable" >/dev/null
  for tile in public/data/ghsl/"$name"/tiles/*.bin.gz; do
    key="ghsl/$name/tiles/$(basename "$tile")"
    wrangler r2 object put "$BUCKET/$key" --file "$tile" --content-type application/octet-stream --cache-control "public, max-age=31536000, immutable" >/dev/null
    count=$((count + 1))
    if (( count % 50 == 0 )); then echo "$count tiles"; fi
  done
  echo "uploaded $name"
done
echo "$count tiles uploaded to $BUCKET"
if [[ -n "$BASE" ]]; then echo "now: python3 scripts/point-grids-at.py $BASE"; fi
