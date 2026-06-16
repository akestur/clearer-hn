#!/usr/bin/env bash
# Package an extension-only zip for the Chrome Web Store dashboard.
# Includes only the files Chrome loads — no repo meta, tests, or node_modules.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist
rm -f dist/pretty-hn.zip
zip -rq dist/clearer-hn.zip manifest.json content popup icons \
  -x "*.DS_Store" "content/refined.css" "content/apple.css"
echo "Wrote dist/clearer-hn.zip"
unzip -l dist/clearer-hn.zip
