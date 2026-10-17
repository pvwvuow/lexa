#!/bin/bash
# Build the Lexa web app and publish it to https://pvwvuow.github.io
#
# The app is the same static export as the APK (NEXT_PUBLIC_APP_MODE=apk), so the
# dashboard looks and works exactly like the app. Site layout:
#   /          landing page with sign-up and sign-in (web-landing/)
#   /app/      the Lexa app (out/index.html)
#   /_next/, /texts/, /fonts/, ...  app files from out/ (absolute paths stay valid)
# Sign-in on the landing page stores the same Supabase session key as the app
# (lexa-sb-auth-v1), so the user arrives in /app/ already signed in.
#
# Run in the Z container:  bash scripts/build-pages.sh
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$PWD
SITE_REPO=${SITE_REPO:-pvwvuow/pvwvuow.github.io}

REMOTE=$(git remote get-url origin)
TOKEN=$(printf '%s' "$REMOTE" | sed -n 's#^https://\([^@]*\)@github\.com/.*#\1#p')
if [ -z "$TOKEN" ]; then echo "no GitHub token in the origin remote"; exit 1; fi

echo "[1/4] park API routes and build the static export"
rm -rf .api-parked
mv src/app/api .api-parked
trap 'if [ -d .api-parked ]; then rm -rf src/app/api; mv .api-parked src/app/api; echo "API restored"; fi' EXIT
rm -rf out
NEXT_PUBLIC_APP_MODE=apk NEXT_PUBLIC_WEB_STATIC=1 bun run build:apk
rm -rf src/app/api
mv .api-parked src/app/api
trap - EXIT
[ -f out/index.html ] || { echo "out/index.html missing"; exit 1; }

echo "[2/4] clone ${SITE_REPO}"
WORK=$(mktemp -d)
git clone --depth 1 "https://${TOKEN}@github.com/${SITE_REPO}.git" "$WORK/site"
cd "$WORK/site"
find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +

echo "[3/4] assemble the site"
cp -r "$ROOT/out/." .
mkdir -p app
mv index.html app/index.html
[ -f index.txt ] && mv index.txt app/index.txt
rm -f 404.html
cp -r "$ROOT/web-landing/." .
python3 "$ROOT/scripts/pages-patch.py" .
touch .nojekyll

echo "[4/4] publish"
VERSION=$(node -p "require('$ROOT/package.json').version")
git add -A
if git diff --cached --quiet; then echo "nothing changed"; exit 0; fi
git -c user.name="Lexa build" -c user.email="lexa@users.noreply.github.com" commit -q -m "site: Lexa web ${VERSION}"
git push -q origin HEAD:main
echo "PAGES_READY: https://pvwvuow.github.io/ (app at /app/) version ${VERSION}"
