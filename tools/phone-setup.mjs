#!/usr/bin/env node
// phone-setup — give the running dashboard a private Tailscale address, so a phone can open it
// and add it to the home screen.
//
//   node tools/phone-setup.mjs              check everything, create the address, verify it, print the link
//   node tools/phone-setup.mjs --install    also install Tailscale (winget / brew) when it is missing
//   node tools/phone-setup.mjs --off        remove the address again
//   Options: --port 8787 (the dashboard, default 8787)   --https 8446 (the public-facing tailnet port)
//
// It only ever uses `tailscale serve` (tailnet-private). It never uses `tailscale funnel` (public internet).
// Exit codes: 0 done · 1 failed · 3 dashboard not reachable · 4 Tailscale missing · 5 Tailscale not signed in.
//
// What it cannot do: sign in to Tailscale, or put the phone on the same account. Those are the person's taps.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d; };
const has = (n) => argv.includes(`--${n}`);
const APP_PORT = flag("port", process.env.PORT || "8787");
let HTTPS_PORT = Number(flag("https", "8446"));
const isWin = process.platform === "win32";

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", shell: false, ...opts });
  return { code: r.status ?? 1, out: (r.stdout ?? "") + (r.stderr ?? ""), err: r.error };
}
function say(s) { console.log(s); }
function fail(code, s) { console.error(s); process.exit(code); }

// ---- 1. find tailscale
function findTailscale() {
  const candidates = isWin
    ? ["tailscale", "C:\\Program Files\\Tailscale\\tailscale.exe"]
    : ["tailscale", "/Applications/Tailscale.app/Contents/MacOS/Tailscale", "/usr/local/bin/tailscale", "/opt/homebrew/bin/tailscale"];
  for (const c of candidates) {
    if (c.includes("\\") || c.startsWith("/")) { if (!existsSync(c)) continue; }
    const r = run(c, ["version"]);
    if (r.code === 0) return c;
  }
  return null;
}
let TS = findTailscale();
if (!TS) {
  if (!has("install")) fail(4, "Tailscale is not installed. Re-run with --install to install it (winget on Windows, brew on Mac), or get it from https://tailscale.com/download");
  say("Installing Tailscale…");
  const r = isWin
    ? run("winget", ["install", "--id", "Tailscale.Tailscale", "-e", "--accept-package-agreements", "--accept-source-agreements"], { stdio: "inherit" })
    : run("brew", ["install", "--cask", "tailscale"], { stdio: "inherit" });
  if (r.code !== 0) fail(4, "The install did not finish. Install Tailscale from https://tailscale.com/download and re-run this.");
  TS = findTailscale();
  if (!TS) fail(4, "Tailscale installed but the command is not found yet. Open a new terminal and re-run this.");
}

// ---- --off
if (has("off")) {
  const r = run(TS, ["serve", `--https=${HTTPS_PORT}`, "off"]);
  fail(r.code, r.code === 0 ? `Removed the private address on port ${HTTPS_PORT}.` : r.out.trim());
}

// ---- 2. dashboard reachable, and built (a phone needs the built version, not the dev server)
let health;
try { health = await fetch(`http://127.0.0.1:${APP_PORT}/api/health`).then((r) => r.json()); }
catch { fail(3, `The dashboard is not answering on port ${APP_PORT}. Start it first (cd app && npm run build && npm start), then re-run.`); }
const page = await fetch(`http://127.0.0.1:${APP_PORT}/`).then((r) => r.text()).catch(() => "");
if (!/<div id="root"|<script/.test(page)) fail(1, `The server on ${APP_PORT} has no built page. Run: cd app && npm run build, restart npm start, and re-run this.`);
say(`Dashboard is up on port ${APP_PORT} (${health.campaign_count ?? "?"} campaigns).`);

// ---- 3. signed in?
const st = run(TS, ["status", "--json"]);
let js = null;
try { js = JSON.parse(st.out); } catch {}
if (!js || js.BackendState !== "Running") {
  say(`Tailscale is not signed in (state: ${js?.BackendState ?? "unknown"}).`);
  const up = run(TS, ["up", "--timeout=5s"]);
  const url = (up.out.match(/https:\/\/login\.tailscale\.com\/\S+/) ?? [])[0];
  fail(5, url ? `Open this link and sign in, then re-run this command:\n${url}` : "Open the Tailscale app, sign in, then re-run this command.");
}
const dns = (js.Self?.DNSName ?? "").replace(/\.$/, "");
if (!dns) fail(1, "Tailscale is running but has no machine name yet. Enable MagicDNS and HTTPS in the Tailscale admin console (login.tailscale.com/admin/dns), then re-run.");

// ---- 4. create the private address (try a few ports so we never clobber something else)
const serveJson = (() => { try { return JSON.parse(run(TS, ["serve", "status", "--json"]).out); } catch { return {}; } })();
const used = new Set(Object.keys(serveJson.Web ?? {}).map((k) => Number(k.split(":").pop())));
const target = `http://127.0.0.1:${APP_PORT}`;
const existing = serveJson.Web?.[`${dns}:${HTTPS_PORT}`]?.Handlers?.["/"]?.Proxy;
if (!(existing && existing.replace(/\/$/, "") === target)) {
  let tries = 0;
  while (used.has(HTTPS_PORT) && tries++ < 10) HTTPS_PORT++;
  const r = run(TS, ["serve", "--bg", `--https=${HTTPS_PORT}`, target]);
  if (r.code !== 0) fail(1, `tailscale serve failed:\n${r.out.trim()}\nIf it says HTTPS is not enabled, turn on HTTPS in the Tailscale admin console (login.tailscale.com/admin/dns) and re-run.`);
}
const link = `https://${dns}:${HTTPS_PORT}`;

// ---- 5. prove it answers over the tailnet
let ok = false;
for (let i = 0; i < 6 && !ok; i++) {
  try { const r = await fetch(`${link}/api/health`, { signal: AbortSignal.timeout(5000) }); ok = r.ok; } catch {}
  if (!ok) await new Promise((r) => setTimeout(r, 2000));
}
if (!ok) fail(1, `The address was created but did not answer yet: ${link}\nCheck 'tailscale serve status' and that HTTPS certificates are enabled for the tailnet.`);

say(`\nPrivate address is live and answering: ${link}`);
say("Only devices signed in to this Tailscale account can open it.");
say("\nFor the person (phone):");
say("  1. Install the Tailscale app on the phone and sign in to the same account.");
say("  2. Open the link above in Safari (iPhone) or Chrome (Android).");
say("  3. iPhone: Share, then Add to Home Screen. Android: menu, then Install app.");
say("\nIt works while this computer is on and the dashboard is running. Remove it with: node tools/phone-setup.mjs --off");
