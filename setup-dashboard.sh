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
#   ./setup-dashboard.sh --update       # update an existing install (git or zip), keep data, no start
#
# Exit codes: 0 ok · 2 no node · 3 node too old · 4 clone failed · 5 install failed
set -u

REPO="https://github.com/marama03/godsleye-outreach.git"
DIR="${HOME}/Godsleye/dashboard"
START=1
UPDATE=0
CHANGED=0
ZIP_URL="${GODSLEYE_ZIP_URL:-https://github.com/marama03/godsleye-outreach/archive/refs/heads/main.zip}"

while [ $# -gt 0 ]; do
  case "$1" in
    --dir) DIR="$2"; shift 2 ;;
    --no-start) START=0; shift ;;
    --update) UPDATE=1; START=0; shift ;;
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
  BEFORE="$(git -C "$DIR" rev-parse HEAD 2>/dev/null)"
  git -C "$DIR" pull --ff-only --quiet || echo "Could not update (offline or local changes); continuing with what is here."
  AFTER="$(git -C "$DIR" rev-parse HEAD 2>/dev/null)"
  if [ "$BEFORE" != "$AFTER" ]; then
    echo "What changed:"; git -C "$DIR" log --oneline "$BEFORE..$AFTER" | head -20
    CHANGED=1
  else
    echo "Already on the latest version."
  fi
elif [ -d "$DIR/app" ]; then
  # Installed from the zip (no .git). Download the latest archive, replace everything
  # except app/data (the user's own data and settings), and keep a copy of the old app.
  echo "Zip install - updating from the latest archive; your data stays."
  TMP="$(mktemp -d)"
  if ! curl -fsSL --max-time 120 "$ZIP_URL" -o "$TMP/new.zip"; then
    echo "Could not download the update (offline?). Nothing was changed."
    rm -rf "$TMP"; exit 4
  fi
  if command -v unzip >/dev/null 2>&1; then unzip -q "$TMP/new.zip" -d "$TMP/x"
  elif command -v tar >/dev/null 2>&1; then mkdir -p "$TMP/x" && tar -xf "$TMP/new.zip" -C "$TMP/x"
  else echo "Need unzip or tar to update a zip install."; rm -rf "$TMP"; exit 4; fi
  SRC="$(find "$TMP/x" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
  if [ -z "$SRC" ] || [ ! -d "$SRC/app" ]; then
    echo "The downloaded archive did not look right. Nothing was changed."
    rm -rf "$TMP"; exit 4
  fi
  OLDSUM="$(cat "$DIR/app/package.json" "$DIR/app/package-lock.json" 2>/dev/null | cksum)"
  BACKUP="$DIR/.previous-app"
  rm -rf "$BACKUP"; mkdir -p "$BACKUP"
  mv "$DIR/app/data" "$TMP/data" 2>/dev/null
  mv "$DIR/app/node_modules" "$TMP/node_modules" 2>/dev/null
  cp -R "$DIR/app/." "$BACKUP/" 2>/dev/null
  rm -rf "$DIR/app"
  cp -R "$SRC/app" "$DIR/app"
  [ -d "$TMP/data" ] && { rm -rf "$DIR/app/data"; mv "$TMP/data" "$DIR/app/data"; }
  NEWSUM="$(cat "$DIR/app/package.json" "$DIR/app/package-lock.json" 2>/dev/null | cksum)"
  if [ "$OLDSUM" = "$NEWSUM" ] && [ -d "$TMP/node_modules" ]; then mv "$TMP/node_modules" "$DIR/app/node_modules"; fi
  # Never overwrite the running script (bash reads it as it goes) or the folder's own README and LICENSE.
  for f in "$SRC"/*; do
    case "$(basename "$f")" in app|README.md|LICENSE|setup-dashboard.sh) continue ;; esac
    cp -R "$f" "$DIR/"
  done
  rm -rf "$TMP"
  echo "Updated. The previous copy of the app is in $BACKUP if anything looks wrong."
  CHANGED=1
elif [ -e "$DIR" ]; then
  echo "$DIR exists but is not a dashboard folder. Move it aside and run again."
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
if [ ! -d node_modules ] || [ "$CHANGED" -eq 1 ]; then
  npm install --no-audit --no-fund || { echo "Install failed — usually no internet."; exit 5; }
  if [ "$CHANGED" -eq 1 ]; then
    # The screen is built output (web/dist). A replaced app has none until it is rebuilt.
    npm run build >/dev/null 2>&1 || { echo "Could not rebuild the screen. Run: cd \"$DIR/app\" && npm run build"; exit 5; }
    echo "Screen rebuilt."
  fi
else
  echo "Already installed."
fi

step "4/4  Ready"
if [ "$CHANGED" -eq 1 ]; then
  echo "Updated. If the dashboard was running, restart it to use the new version (your data is untouched)."
fi
echo "Dashboard folder: $DIR"
echo "Data and settings: $DIR/app/data"
echo "Start it any time with:  cd \"$DIR\" && ./start.sh"
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
