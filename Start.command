#!/bin/zsh
cd -- "${0:A:h}"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js fehlt. Bitte BearingTrackerPro.html direkt öffnen."
  read -k 1
  exit 1
fi
node scripts/serve.mjs
