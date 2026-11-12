#!/usr/bin/env bash
# God's L'Eye — one-step launcher.
# Double-click on macOS (this file is also shipped as start.command) or run ./start.sh in a terminal.
# It checks Node, installs the app once, starts it, and opens the dashboard in your browser.

set -u

cd "$(dirname "$0")" || exit 1
APP_DIR="app"
URL="http://127.0.0.1:5173"

say() { printf '%s\n' "$*"; }
fail() { say ""; say "$*"; say ""; read -r -p "Press Enter to close this window…" _; exit 1; }

say "God's L'Eye — starting up."

if ! command -v node >/dev/null 2>&1; then
  fail "Node.js is not installed. Install the LTS version from https://nodejs.org — it takes about two
minutes — then double-click this file again. Nothing else on your machine needs to change."
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "${NODE_MAJOR:-0}" -lt 20 ]; then
  fail "Node $(node -v) is too old. Install the LTS version from https://nodejs.org (20 or newer) and run this again."
fi

if [ ! -d "$APP_DIR" ]; then
  fail "The app folder is missing. Unzip the whole download and keep this launcher next to the app folder."
fi

if ! command -v npm >/dev/null 2>&1; then
  fail "npm is missing even though Node is installed. Reinstall Node from https://nodejs.org."
fi

cd "$APP_DIR" || exit 1

if [ ! -d node_modules ]; then
  say "First run: installing what the app needs. This happens once, and takes a minute or two."
  if ! npm install --no-audit --no-fund; then
    fail "The install failed, most often because there is no internet connection. Connect, then run this again."
  fi
fi

# Port 8787 is the API; if something else already has it, the app is probably already running.
if curl -s -o /dev/null --max-time 2 http://127.0.0.1:8787/api/health; then
  say "It is already running — opening the dashboard."
  ( sleep 1; command -v open >/dev/null 2>&1 && open "$URL" || true ) >/dev/null 2>&1 &
  say "Dashboard: $URL"
  say "You can close this window; the app keeps running until you close it or the terminal it lives in."
  exit 0
fi

say "Starting. Your browser will open in a few seconds."
say "Keep this window open while you work — closing it stops the dashboard."
say ""

( sleep 6; command -v open >/dev/null 2>&1 && open "$URL" >/dev/null 2>&1 || true ) &

npm run dev
