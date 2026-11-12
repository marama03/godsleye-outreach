// Local-store contract of the dashboard: no sheet, no token, no Google.
// Two synthetic leads are written straight into a throwaway data folder (the way an agent on the same
// machine would), then the buttons are driven through the real server: sent, skip, undo, a double-click,
// and a server restart with the state surviving.
//
//   node tests/local-app.mjs        (from the repo root, after `cd app && npm install`)

import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";

const ROOT = resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const APP = join(ROOT, "app");
const DATA = mkdtempSync(join(tmpdir(), "godsleye-local-"));
mkdirSync(join(DATA, "dossiers"));

let pass = 0, fail = 0;
const failed = [];
function check(name, ok, detail) {
  if (ok) { pass++; console.log("PASS  " + name); }
  else { fail++; failed.push(name); console.log("FAIL  " + name + (detail !== undefined ? "  <- " + JSON.stringify(detail) : "")); }
}

function freePort() {
  return new Promise((res, rej) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); });
    s.on("error", rej);
  });
}

let proc = null, base = "";
async function start() {
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  const env = { ...process.env, PORT: String(port), GODSLEYE_DATA_DIR: DATA };
  delete env.SHEET_BRIDGE_URL; delete env.SHEET_BRIDGE_TOKEN;
  const tsx = join(APP, "node_modules", "tsx", "dist", "cli.mjs");
  proc = spawn(process.execPath, [tsx, "server/index.ts"], { cwd: APP, env, stdio: "ignore" });
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(base + "/api/health"); if (r.ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("server did not start");
}
async function stop() {
  if (!proc) return;
  const p = proc; proc = null;
  await new Promise((r) => { p.once("exit", r); p.kill(); setTimeout(r, 3000); });
}
const get = async (p) => (await fetch(base + p)).json();
const post = async (p, body) => { const r = await fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; };

const utcDay = (off = 0) => new Date(Date.now() + off * 864e5).toISOString().slice(0, 10);
const iso = (off) => new Date(Date.now() + off * 864e5).toISOString();

try {
  await start();

  // 1. fresh store: the built-in chain exists, a campaign can be created, no sheet is configured
  check("health ok on an empty store", (await get("/api/health")).ok === true);
  const chains = await get("/api/chains");
  check("built-in gtm@1 chain is available on a fresh clone", chains.some((c) => c.chain_id === "gtm" && c.version === 1 && c.steps === 10), chains);
  check("sheet bridge is not configured", (await get("/api/sheet/status")).configured === false);
  const cr = await post("/api/campaigns", { name: "Local test", icp_sentence: "Founders who still run their own marketing", chain_id: "gtm", chain_version: 1, daily_cap: 10, start_date: utcDay(-5) });
  check("campaign created", cr.status === 201, cr);
  const cid = cr.body.campaign.id;

  // 2. two synthetic leads, as an agent on the same machine would write them
  const mk = (n, url) => ({ lead_id: url, campaign_id: cid, is_demo: true, name: n, title: "Founder", company: n + " Co", linkedin_url: "https://example.invalid/in/" + url, segment: "test", invited_at: iso(-5), accepted_at: iso(-4), withdrawn_at: null, do_not_contact: false, dossier_path: null, reply_status: "none" });
  await stop();
  writeFileSync(join(DATA, "leads.json"), JSON.stringify([mk("Ada", "ada000000001"), mk("Bo", "bo0000000002")], null, 2));
  await start();

  let today = await get(`/api/today?campaign=${cid}`);
  check("both leads are due today", today.cards.length === 2, today.cards.map((c) => c.name));
  const ada = today.cards.find((c) => c.name === "Ada"), bo = today.cards.find((c) => c.name === "Bo");
  check("card shows step 1 of 10 with a body", ada && ada.step === 1 && ada.total_steps === 10 && ada.body.length > 20, ada && { step: ada.step, total: ada.total_steps });

  // 3. mark sent
  const sentBody = { campaign_id: cid, lead_id: ada.lead_id, kind: "sent", step: ada.step, body_text: ada.body, idempotency_key: "t-sent-ada-1" };
  const s1 = await post("/api/events", sentBody);
  check("mark sent is recorded", s1.status === 201 && s1.body.duplicate === false, s1);
  today = await get(`/api/today?campaign=${cid}`);
  check("sent lead leaves today's queue", !today.cards.some((c) => c.name === "Ada") && today.cards.some((c) => c.name === "Bo"));

  // 4. double-click: the same key is a no-op, not a second send
  const s2 = await post("/api/events", sentBody);
  check("double-click is idempotent", s2.status === 200 && s2.body.duplicate === true, s2);
  const led = await get(`/api/ledger?campaign=${cid}`);
  const evs = Array.isArray(led) ? led : (led.events ?? led.rows ?? []);
  check("ledger holds exactly one sent event for Ada", evs.filter((e) => e.kind === "sent" && e.lead_id === ada.lead_id).length === 1, evs.length);

  // 5. skip
  const sk = await post("/api/events", { campaign_id: cid, lead_id: bo.lead_id, kind: "skipped", step: bo.step, idempotency_key: "t-skip-bo-1" });
  check("skip is recorded", sk.status === 201, sk);
  today = await get(`/api/today?campaign=${cid}`);
  check("skipped lead leaves today's queue", !today.cards.some((c) => c.name === "Bo"), today.cards.map((c) => c.name));

  // 6. undo the send, twice
  const u1 = await post(`/api/undo/${s1.body.event.event_id}`, {});
  check("undo of the send is recorded", u1.status === 201, u1);
  const u2 = await post(`/api/undo/${s1.body.event.event_id}`, {});
  check("double undo is idempotent", u2.status === 200 && u2.body.duplicate === true, u2);
  today = await get(`/api/today?campaign=${cid}`);
  check("undone lead is back in today's queue at step 1", today.cards.some((c) => c.name === "Ada" && c.step === 1), today.cards.map((c) => [c.name, c.step]));

  // 7. mark sent again, then restart the server: state must survive
  const s3 = await post("/api/events", { campaign_id: cid, lead_id: ada.lead_id, kind: "sent", step: 1, body_text: ada.body, idempotency_key: "t-sent-ada-2" });
  check("re-send after undo is recorded", s3.status === 201, s3);
  const before = JSON.stringify(await get(`/api/today?campaign=${cid}`));
  const evCountBefore = (await get("/api/health")).event_count;
  await stop();
  await start();
  check("event count survives a restart", (await get("/api/health")).event_count === evCountBefore);
  check("today's queue is identical after a restart", JSON.stringify(await get(`/api/today?campaign=${cid}`)) === before);
  const s4 = await post("/api/events", { campaign_id: cid, lead_id: ada.lead_id, kind: "sent", step: 1, body_text: ada.body, idempotency_key: "t-sent-ada-2" });
  check("idempotency keys survive a restart (replayed click is a no-op)", s4.status === 200 && s4.body.duplicate === true, s4);
  const files = ["campaigns.json", "leads.json", "events.json"].every((f) => { try { JSON.parse(readFileSync(join(DATA, f), "utf8")); return true; } catch { return false; } });
  check("data files are valid JSON on disk", files);
} catch (e) {
  check("test run completed without an exception", false, String(e && e.stack || e));
} finally {
  await stop();
  try { rmSync(DATA, { recursive: true, force: true }); } catch {}
}

console.log(`\n${fail ? fail + "/" + (pass + fail) + " FAILED: " + failed.join(", ") : pass + "/" + (pass + fail) + " checks passed"}`);
process.exit(fail ? 1 : 0);
