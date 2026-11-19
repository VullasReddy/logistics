#!/bin/sh
# TTC Fleet360 - one-command start for Mac / Linux (needs Node.js only)
cd "$(dirname "$0")"
for d in backend frontend local-runner; do
  [ -d "$d/node_modules" ] || (echo "Installing $d..." && cd "$d" && npm install)
done
cd local-runner && node run-local.js
