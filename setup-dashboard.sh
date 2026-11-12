#!/usr/bin/env bash
# God's L'Eye — dashboard setup, run BY AN AGENT on the user's machine.
#
# The person says one sentence ("set up the dashboard") and their agent runs this.
# It is idempotent: safe to run on a fresh machine, and safe to run again later to
# update or restart. It never asks a question and never needs a password.
#
# Usage:
#   ./setup-dashboard.sh                # install/update in ~/Godsleye and start it
#   ./setup-dashboard.sh --dir <path>   # somewhere else
#   ./setup-dashboard.sh --no-start     # install/update only
#
# Exit codes: 0 ok · 2 no node · 3 node too old · 4 clone failed · 5 install failed
set -u

REPO="https://github.com/marama03/godsleye-outreach.git"
DIR="${HOME}/Godsleye/dashboard"
START=1

while [ $# -gt 0 ]; do
  case "$1" in
    --dir) DIR="$2"; shift 2 ;;
    --no-start) START=0; shift ;;
    *) echo "unknown option: $1" >&2; exit 1 ;;
  esac
done

step() { printf '\n== %s\n' "$*"; }

step "1/4  Checking Node"
if ! command -v node >/dev/null 2>&1; then
  echo "Node is not installed. Install the LTS build from https://nodejs.org (20 or newer), then run this again."
  exit 2
fi
MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "${MAJOR:-0}" -lt 20 ]; then
  echo "Node $(node -v) is too old; 20 or newer is needed."
  exit 3
fi
echo "Node $(node -v) — fine."

step "2/4  Getting the dashboard into ${DIR}"
mkdir -p "$(dirname "$DIR")"
if [ -d "$DIR/.git" ]; then
  echo "Already there — updating."
  git -C "$DIR" pull --ff-only --quiet || echo "Could not update (offline or local changes); continuing with what is here."
elif [ -e "$DIR" ]; then
  echo "$DIR exists and is not a checkout. Move it aside and run again."
  exit 4
else
  if ! git clone --depth 1 --quiet "$REPO" "$DIR"; then
    echo "Clone failed — usually no internet. Connect and run this again."
    exit 4
  fi
  echo "Cloned."
fi

step "3/4  Installing what the app needs (once; a minute or two)"
cd "$DIR/app" || exit 4
if [ ! -d node_modules ]; then
  npm install --no-audit --no-fund || { echo "Install failed — usually no internet."; exit 5; }
else
  echo "Already installed."
fi

step "4/4  Ready"
echo "Dashboard folder: $DIR"
echo "Data and settings: $DIR/app/data"
echo "Start it any time with:  cd \"$DIR/app\" && npm run dev"
echo "Then open:               http://127.0.0.1:5173"

if [ "$START" -eq 1 ]; then
  if curl -s -o /dev/null --max-time 2 http://127.0.0.1:8787/api/health; then
    echo "It is already running — open http://127.0.0.1:5173"
  else
    echo ""
    echo "Starting it now. Leave this running; Ctrl-C stops the dashboard."
    exec npm run dev
  fi
fi
