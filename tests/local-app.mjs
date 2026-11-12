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

  // 6b. live updates: a write into the data folder (an agent on the same machine) is pushed to the browser
  {
    const ctl = new AbortController();
    const res = await fetch(base + "/api/changes", { signal: ctl.signal });
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let pendingRead = null;
    const waitEvent = async (name, ms) => {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) {
        if (buf.includes("event: " + name)) return true;
        if (!pendingRead) pendingRead = reader.read().then((r) => { pendingRead = null; if (r.value) buf += dec.decode(r.value); });
        await Promise.race([pendingRead, new Promise((r) => setTimeout(r, 400))]);
      }
      return false;
    };
    check("live stream says hello", await waitEvent("hello", 4000));
    buf = "";
    await new Promise((r) => setTimeout(r, 1200));
    const cur = JSON.parse(readFileSync(join(DATA, "leads.json"), "utf8"));
    writeFileSync(join(DATA, "leads.json"), JSON.stringify([...cur, mk("Cy", "cy0000000003")], null, 2));
    check("a data-folder write is pushed as a change event (no refresh button needed)", await waitEvent("change", 6000), buf);
    ctl.abort();
    writeFileSync(join(DATA, "leads.json"), JSON.stringify(cur, null, 2));
  }

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
  // 8. replies, answers, booked calls, scorecard, stale invites
  {
    const cur = JSON.parse(readFileSync(join(DATA, "leads.json"), "utf8"));
    const old = { ...mk("Old Invite", "ol0000000005"), accepted_at: null, invited_at: iso(-120) };
    writeFileSync(join(DATA, "leads.json"), JSON.stringify([...cur, old, mk("Eve", "ev0000000006"), mk("Flo", "fl0000000007")], null, 2));
    const wd = async () => get(`/api/workday?campaign=${cid}`);
    let w = await wd();
    check("a 120-day-old invite is listed under 90+ days", w.stale_invites.some((p) => p.name === "Old Invite" && p.days_invited >= 119), w.stale_invites);
    await post("/api/events", { campaign_id: cid, lead_id: "ol0000000005", kind: "withdrawn", idempotency_key: "t-wd-1" });
    w = await wd();
    check("withdrawn invite leaves the 90+ list", !w.stale_invites.some((p) => p.name === "Old Invite"));
    await post("/api/events", { campaign_id: cid, lead_id: "ev0000000006", kind: "replied", idempotency_key: "t-rep-eve" });
    await post("/api/events", { campaign_id: cid, lead_id: "fl0000000007", kind: "replied", idempotency_key: "t-rep-flo" });
    w = await wd();
    check("replied leads show as waiting on you", ["Eve", "Flo"].every((n) => w.waiting_on_you.some((r) => r.name === n)), w.waiting_on_you.map((r) => r.name));
    const ans = await post("/api/events", { campaign_id: cid, lead_id: "ev0000000006", kind: "sent", payload: { answered: true }, idempotency_key: "t-ans-eve" });
    w = await wd();
    check("I answered clears the lead from waiting", !w.waiting_on_you.some((r) => r.name === "Eve") && w.waiting_on_you.some((r) => r.name === "Flo"));
    await post(`/api/undo/${ans.body.event.event_id}`, {});
    w = await wd();
    check("undoing the answer puts the lead back", w.waiting_on_you.some((r) => r.name === "Eve"));
    await post("/api/events", { campaign_id: cid, lead_id: "fl0000000007", kind: "sent", payload: { answered: true, booked: true }, idempotency_key: "t-book-flo" });
    w = await wd();
    const led2 = await get(`/api/ledger?campaign=${cid}`);
    const flo = (led2.leads ?? []).find((l) => l.name === "Flo");
    check("Call booked clears waiting and sets stage booked", !w.waiting_on_you.some((r) => r.name === "Flo") && flo && flo.stage === "booked", flo && flo.stage);
    const all = w.scorecard.all;
    check("scorecard counts the funnel (5 invited, 4 accepted, 1 messaged, 2 replied, 1 booked)", all.invited === 5 && all.accepted === 4 && all.messaged === 1 && all.replied === 2 && all.booked === 1, all);
    check("scorecard 7-day range is a subset of all time", Object.keys(all).every((k) => w.scorecard["7"][k] <= all[k]), w.scorecard["7"]);
  }

  // 9. the sheet-link strip: config.json is the one place the dashboard keeps its sheet link
  {
    check("not connected before a link is given", (await get("/api/config")).connected === false);
    const bad = await post("/api/config", { sheet_url: "https://example.com/not-a-sheet" });
    check("a non-sheet link is refused", bad.status === 400, bad);
    const url = "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit";
    const ok = await post("/api/config", { sheet_url: url });
    check("a Google Sheets link is saved", ok.status === 200 && ok.body.connected === true, ok);
    const cfg = await get("/api/config");
    check("config reports the link and a connected time", cfg.connected && cfg.sheet_url === url && !!cfg.connected_at, cfg);
    writeFileSync(join(DATA, "config.json"), JSON.stringify({ sheet_url: url, sheet_title: "Pipeline", connected_at: cfg.connected_at, last_synced_at: "2026-11-12T12:03:00Z" }));
    const cfg2 = await get("/api/config");
    check("an agent's edit to config.json is read (title, last synced)", cfg2.sheet_title === "Pipeline" && cfg2.last_synced_at === "2026-11-12T12:03:00Z", cfg2);
    const off = await post("/api/config", { sheet_url: "" });
    check("clearing the link disconnects", off.status === 200 && (await get("/api/config")).connected === false);
  }

  // 10. demo campaign and delete campaign
  {
    const before = await get("/api/campaigns");
    const d1 = await post("/api/demo", {});
    check("Load the demo creates the demo campaign", d1.status === 201 && d1.body.created === true, d1);
    const d2 = await post("/api/demo", {});
    check("loading the demo twice does not duplicate it", d2.status === 200 && d2.body.created === false && d2.body.campaign_id === d1.body.campaign_id, d2);
    const demoId = d1.body.campaign_id;
    const wdDemo = await get(`/api/workday?campaign=${demoId}`);
    check("demo shows cards, a waiting reply, stale invite and a scorecard", wdDemo.cards.length >= 1 && wdDemo.waiting_on_you.length === 1 && wdDemo.stale_invites.length === 1 && wdDemo.scorecard.all.booked === 1, { cards: wdDemo.cards.length, waiting: wdDemo.waiting_on_you.length, stale: wdDemo.stale_invites.length, sc: wdDemo.scorecard.all });
    const demoName = (await get("/api/campaigns")).find((c) => c.id === demoId).name;
    const w1 = await fetch(base + `/api/campaigns/${demoId}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: "nope" }) });
    check("delete without the exact name is refused", w1.status === 400);
    check("refused delete changed nothing", (await get("/api/campaigns")).some((c) => c.id === demoId));
    const leadsBefore = JSON.parse(readFileSync(join(DATA, "leads.json"), "utf8")).filter((l) => l.campaign_id !== demoId).length;
    const w2 = await fetch(base + `/api/campaigns/${demoId}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: demoName }) });
    const w2b = await w2.json();
    check("delete with the exact name works and reports what went", w2.status === 200 && w2b.removed.leads === 10 && w2b.removed.events >= 7, w2b);
    const after = await get("/api/campaigns");
    check("deleted campaign is gone and the others are untouched", !after.some((c) => c.id === demoId) && after.length === before.length, after.map((c) => c.name));
    const leadsAfter = JSON.parse(readFileSync(join(DATA, "leads.json"), "utf8"));
    check("other campaigns' leads are untouched", leadsAfter.filter((l) => l.campaign_id !== demoId).length === leadsBefore && !leadsAfter.some((l) => l.campaign_id === demoId));
    const evAfter = JSON.parse(readFileSync(join(DATA, "events.json"), "utf8"));
    check("deleted campaign's events are gone", !evAfter.some((e) => e.campaign_id === demoId));
    const { readdirSync } = await import("node:fs");
    check("a restorable copy is kept in data/deleted", readdirSync(join(DATA, "deleted")).some((f) => f.startsWith(demoId)));
    const w3 = await fetch(base + `/api/campaigns/${demoId}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: demoName }) });
    check("deleting twice is a clean 404", w3.status === 404);
  }

  // 11. impossible sequences are refused with a reason (the sync agent and the sheet write through the same API)
  {
    const c2 = await post("/api/campaigns", { name: "Rules test", icp_sentence: "x", chain_id: "gtm", chain_version: 1, daily_cap: 10, start_date: utcDay(-5) });
    const rid = c2.body.campaign.id;
    const base0 = { campaign_id: rid, is_demo: true, title: "T", company: "Co", segment: "t", withdrawn_at: null, do_not_contact: false, dossier_path: "x.md", reply_status: "none" };
    const lf = { ...base0, lead_id: "r_found", name: "Found", linkedin_url: "https://example.invalid/f", invited_at: null, accepted_at: null };
    const li = { ...base0, lead_id: "r_inv", name: "Invited", linkedin_url: "https://example.invalid/i", invited_at: iso(-3), accepted_at: null };
    const la = { ...base0, lead_id: "r_acc", name: "Accepted", linkedin_url: "https://example.invalid/a", invited_at: iso(-6), accepted_at: iso(-5) };
    const cur = JSON.parse(readFileSync(join(DATA, "leads.json"), "utf8"));
    writeFileSync(join(DATA, "leads.json"), JSON.stringify([...cur, lf, li, la], null, 2));
    const ev = (lead_id, kind, extra = {}, key) => post("/api/events", { campaign_id: rid, lead_id, kind, idempotency_key: key ?? `rules-${lead_id}-${kind}-${JSON.stringify(extra)}`, ...extra });
    const refused = async (name, r) => check(name, r.status === 400 && typeof r.body.error === "string" && r.body.error.length > 10, r);
    await refused("sent on a never-invited lead is refused", await ev("r_found", "sent", { step: 1 }));
    await refused("skipped step 7 on a fresh lead is refused", await ev("r_found", "skipped", { step: 7 }));
    await refused("a reply from a never-invited lead is refused", await ev("r_found", "replied"));
    await refused("withdrawing a never-invited lead is refused", await ev("r_found", "withdrawn"));
    await refused("an answer with no reply waiting is refused", await ev("r_acc", "sent", { payload: { answered: true } }));
    await refused("sent on an invited-but-not-accepted lead is refused", await ev("r_inv", "sent", { step: 1 }));
    await refused("a withdrawn-after-accept makes no sense and is refused", await ev("r_acc", "withdrawn"));
    await refused("step 2 before step 1 is refused", await ev("r_acc", "sent", { step: 2 }));
    check("step 1 on an accepted lead is allowed", (await ev("r_acc", "sent", { step: 1 })).status === 201);
    await refused("step 1 a second time (new key) is refused", await ev("r_acc", "sent", { step: 1 }, "rules-again"));
    await refused("skipping an already-sent step is refused", await ev("r_acc", "skipped", { step: 1 }));
    check("skipping the next step is allowed", (await ev("r_acc", "skipped", { step: 2 })).status === 201);
    // undo guard
    const ia = await ev("r_inv", "accepted");
    check("accepting an invited lead is allowed", ia.status === 201);
    const sa = await ev("r_inv", "sent", { step: 1 });
    check("then step 1 is allowed", sa.status === 201);
    const uBad = await post(`/api/undo/${ia.body.event.event_id}`, {});
    check("undoing the accept while a send is logged is refused", uBad.status === 400 && /later action/.test(uBad.body.error), uBad);
    check("undoing the newest action is allowed", (await post(`/api/undo/${sa.body.event.event_id}`, {})).status === 201);
    check("then undoing the accept is allowed", (await post(`/api/undo/${ia.body.event.event_id}`, {})).status === 201);
    // a campaign whose chain is not installed
    const camps = JSON.parse(readFileSync(join(DATA, "campaigns.json"), "utf8"));
    camps.find((c) => c.id === rid).chain_id = "nochain";
    writeFileSync(join(DATA, "campaigns.json"), JSON.stringify(camps, null, 2));
    const g1 = await fetch(base + `/api/campaigns/${rid}`);
    const g1b = await g1.json();
    check("a missing chain is a clear 409, not a 500", g1.status === 409 && g1b.code === "chain_missing" && /not installed/.test(g1b.error), g1b);
    check("today and workday say the same", (await fetch(base + `/api/today?campaign=${rid}`)).status === 409 && (await fetch(base + `/api/workday?campaign=${rid}`)).status === 409);
    check("the campaign list still works", (await get("/api/campaigns")).some((c) => c.id === rid));
    const dl = await fetch(base + `/api/campaigns/${rid}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: "Rules test" }) });
    check("and such a campaign can still be deleted", dl.status === 200);
  }

  // 12. demo dossiers open, and the demo can be reset
  {
    const d = await post("/api/demo", {});
    const demoId = d.body.campaign_id;
    const wd = await get(`/api/workday?campaign=${demoId}`);
    const people = [...wd.cards, ...wd.researching.filter((r) => r.dossier_path)];
    const withDossier = wd.cards.filter((c) => c.dossier_path);
    check("every demo person who is due has a dossier link", withDossier.length === wd.cards.length && wd.cards.length >= 1, { cards: wd.cards.length, withDossier: withDossier.length });
    let allOk = true; const bad = [];
    for (const f of ["demoa1.md", "demob2.md", "democ3.md", "demod4.md", "demoe5.md"]) {
      const r = await fetch(base + `/api/dossier?path=${f}`);
      const t = await r.text();
      if (r.status !== 200 || t.length < 500 || !/## Why now/.test(t) || !/## Cautions/.test(t)) { allOk = false; bad.push([f, r.status, t.length]); }
    }
    check("all five demo dossiers open and are real briefs (who, why now, angle, cautions)", allOk, bad);
    {
      const paths = [...new Set([...wd.cards, ...wd.researching, ...wd.waiting_on_you].map((c) => c.dossier_path).filter(Boolean))];
      let ok = paths.length >= 3; const miss = [];
      for (const pth of paths) { const r = await fetch(base + `/api/dossier?path=${encodeURIComponent(pth)}`); if (r.status !== 200 || !/^data\/dossiers\/demo\w+\.md$/.test(pth)) { ok = false; miss.push([pth, r.status]); } }
      check("every dossier_path the demo stores (data/dossiers/<id>.md) opens with 200", ok, { paths, miss });
    }
    const html = await fetch(base + "/api/dossier?path=demoa1.md", { headers: { accept: "text/html" } });
    const ht = await html.text();
    check("a browser gets a readable page, not a download", html.status === 200 && /text\/html/.test(html.headers.get("content-type")) && /<h1>Dana Whitfield/.test(ht) && /<li>/.test(ht), html.headers.get("content-type"));
    const esc = await fetch(base + "/api/dossier?path=../leads.json");
    check("a dossier path cannot escape the dossiers folder", esc.status === 404);
    // work on the demo, then reset it
    await post("/api/events", { campaign_id: demoId, lead_id: wd.cards[0].lead_id, kind: "skipped", step: wd.cards[0].step, idempotency_key: "demo-reset-skip" });
    const wd2 = await get(`/api/workday?campaign=${demoId}`);
    check("a click on the demo changes it", wd2.cards.length === wd.cards.length - 1, [wd.cards.length, wd2.cards.length]);
    const rs = await post("/api/demo", { reset: true });
    check("Reset demo answers 201 with the campaign", rs.status === 201 && rs.body.campaign_id === demoId, rs);
    const wd3 = await get(`/api/workday?campaign=${demoId}`);
    check("after the reset the demo is back to its starting state", wd3.cards.length === wd.cards.length && wd3.waiting_on_you.length === 1, [wd3.cards.length, wd3.waiting_on_you.length]);
    check("only one demo campaign exists after a reset", (await get("/api/campaigns")).filter((c) => /\(demo\)$/.test(c.name)).length === 1);
    const campsKeep = await get("/api/campaigns");
    check("other campaigns survive a reset", campsKeep.some((c) => c.name === "Local test"));
  }

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
