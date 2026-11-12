#!/usr/bin/env node
// autostart — run the dashboard in the background at login and restart it if it stops.
//
//   node tools/autostart.mjs            install (Windows: a Scheduled Task; Mac: a launchd agent)
//   node tools/autostart.mjs --off      remove it
//   node tools/autostart.mjs --status   is it installed, and is the dashboard answering
//   Options: --port 8787   --data <folder>  (where the dashboard keeps its files; default: app/data)
//
// Without this the dashboard dies with the terminal window or a reboot, and any phone address stops working.

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d; };
const has = (n) => argv.includes(`--${n}`);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APP = join(ROOT, "app");
const PORT = flag("port", "8787");
const DATA = flag("data", "");
const NAME = "GodsLEye-Dashboard";
const isWin = process.platform === "win32";
const isMac = process.platform === "darwin";
const run = (c, a, o = {}) => { const r = spawnSync(c, a, { encoding: "utf8", ...o }); return { code: r.status ?? 1, out: (r.stdout ?? "") + (r.stderr ?? "") }; };
const say = (s) => console.log(s);

async function answering() {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/api/health`, { signal: AbortSignal.timeout(3000) }); return r.ok; } catch { return false; }
}

if (!existsSync(join(APP, "node_modules"))) { console.error("Run `npm install` in app/ first."); process.exit(1); }
if (!existsSync(join(APP, "web", "dist"))) say("Note: app/web/dist is missing. Run `npm run build` in app/ so the phone gets the built dashboard.");

const logDir = join(os.homedir(), ".godsleye"); mkdirSync(logDir, { recursive: true });
const log = join(logDir, "dashboard.log");

if (isWin) {
  const ps = (s) => run("powershell", ["-NoProfile", "-NonInteractive", "-Command", s]);
  if (has("status")) {
    const t = ps(`(Get-ScheduledTask -TaskName ${NAME} -ErrorAction SilentlyContinue | Select -Expand State)`).out.trim();
    say(`Autostart task: ${t || "not installed"}`); say(`Dashboard answering on ${PORT}: ${await answering() ? "yes" : "no"}`); process.exit(0);
  }
  if (has("off")) { ps(`Stop-ScheduledTask -TaskName ${NAME} -ErrorAction SilentlyContinue; Unregister-ScheduledTask -TaskName ${NAME} -Confirm:$false -ErrorAction SilentlyContinue`); say("Autostart removed."); process.exit(0); }
  const cmdFile = join(logDir, "run-dashboard.cmd");
  writeFileSync(cmdFile, `@echo off\r\ncd /d "${APP}"\r\nset PORT=${PORT}\r\n${DATA ? `set GODSLEYE_DATA_DIR=${DATA}\r\n` : ""}:loop\r\ncall npx tsx server/index.ts >> "${log}" 2>&1\r\ntimeout /t 3 /nobreak >nul\r\ngoto loop\r\n`);
  const script = `
$a = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c "${cmdFile}"'
$t = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$s = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName ${NAME} -Action $a -Trigger $t -Settings $s -Description "God's L'Eye dashboard (starts at login, restarts if it stops)" -Force | Out-Null
Write-Output registered`;
  const r = ps(script);
  if (!/registered/.test(r.out)) { console.error("Could not register the task:\n" + r.out); process.exit(1); }
  say("Autostart installed: the dashboard starts at login and restarts if it stops.");
  if (await answering()) say(`The dashboard is already answering on ${PORT}; it will be managed by the task from the next login.`);
  else { ps(`Start-ScheduledTask -TaskName ${NAME}`); for (let i = 0; i < 15 && !(await answering()); i++) await new Promise((r) => setTimeout(r, 1000)); say(`Dashboard answering on ${PORT}: ${await answering() ? "yes" : "NO. See " + log}`); }
} else if (isMac) {
  const plist = join(os.homedir(), "Library/LaunchAgents/com.godsleye.dashboard.plist");
  if (has("off")) { run("launchctl", ["unload", plist]); run("rm", ["-f", plist]); say("Autostart removed."); process.exit(0); }
  if (has("status")) { say(`Autostart: ${existsSync(plist) ? "installed" : "not installed"}`); say(`Dashboard answering on ${PORT}: ${await answering() ? "yes" : "no"}`); process.exit(0); }
  const npx = run("which", ["npx"]).out.trim() || "/usr/local/bin/npx";
  writeFileSync(plist, `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>\n<key>Label</key><string>com.godsleye.dashboard</string>\n<key>WorkingDirectory</key><string>${APP}</string>\n<key>ProgramArguments</key><array><string>${npx}</string><string>tsx</string><string>server/index.ts</string></array>\n<key>EnvironmentVariables</key><dict><key>PORT</key><string>${PORT}</string>${DATA ? `<key>GODSLEYE_DATA_DIR</key><string>${DATA}</string>` : ""}<key>PATH</key><string>${process.env.PATH}</string></dict>\n<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>\n<key>StandardOutPath</key><string>${log}</string><key>StandardErrorPath</key><string>${log}</string>\n</dict></plist>\n`);
  run("launchctl", ["unload", plist]); const r = run("launchctl", ["load", plist]);
  if (r.code !== 0) { console.error(r.out); process.exit(1); }
  say("Autostart installed: the dashboard starts at login and restarts if it stops.");
} else {
  console.error("Autostart is built for Windows and Mac. On Linux, run `npm start` under systemd or your process manager.");
  process.exit(1);
}
