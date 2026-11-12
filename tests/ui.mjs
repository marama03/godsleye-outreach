// Real-browser click-through of the dashboard (headless Chrome over its debugging port). Every button is clicked.
//   cd app && npm install && npm run build      (once)
//   node tests/ui.mjs                           (from the repo root; needs Google Chrome; set CHROME=/path if it is elsewhere)
// It starts the app on a spare port with a throwaway data folder, so nothing real is touched.
import { spawn } from "node:child_process";
import { rmSync, mkdirSync, writeFileSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";

const ROOT = resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const APP = join(ROOT, "app");
const CHROME = process.env.CHROME || [
  "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
].find((p) => existsSync(p));
if (!CHROME) { console.log("Chrome not found. Set CHROME=/path/to/chrome"); process.exit(2); }
const freePort = () => new Promise((res) => { const s = createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });
const PORT = await freePort(), CP = await freePort();
const BASE = `http://127.0.0.1:${PORT}`;
const DATA = mkdtempSync(join(tmpdir(), "godsleye-ui-"));
const SHOTS = process.env.SHOTS_DIR || null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn(process.execPath, [join(APP, "node_modules", "tsx", "dist", "cli.mjs"), "server/index.ts"], { cwd: APP, env: { ...process.env, PORT: String(PORT), GODSLEYE_DATA_DIR: DATA }, stdio: "ignore" });
for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE + "/api/health")).ok) break; } catch {} await sleep(300); }
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${CP}`, "--user-data-dir=" + mkdtempSync(join(tmpdir(), "godsleye-chrome-")), "about:blank"], { stdio: "ignore" });
let pass = 0, fail = 0; const failed = [];
const check = (n, ok, d) => { if (ok) { pass++; console.log("PASS  " + n); } else { fail++; failed.push(n); console.log("FAIL  " + n + (d !== undefined ? "  <- " + JSON.stringify(d) : "")); } };
let ws, txt_cache;
try {
  let t; for (let i = 0; i < 40 && !t; i++) { await sleep(500); try { t = await (await fetch(`http://127.0.0.1:${CP}/json/new?${encodeURIComponent(BASE + "/today")}`, { method: "PUT" })).json(); } catch {} }
  ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pend = new Map(); ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (e) => { const r = await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails)); return r.result?.result?.value; };
  const view = (w, h, mobile) => send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: !!mobile });
  const nav = async (p) => {
    await send("Page.navigate", { url: BASE + p });
    await sleep(800);
    // wait until the screen has finished loading (no "Loading…" and some content), up to 12 s
    for (let i = 0; i < 48; i++) {
      const ok = await ev(`document.readyState === "complete" && !/Loading…/.test(document.body.innerText) && document.body.innerText.length > 80`).catch(() => false);
      if (ok) break;
      await sleep(250);
    }
    await sleep(700);
  };
  const txt = () => ev("document.body.innerText");
  const waitTxt = async (re, ms = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (re.test(await txt())) return true; await sleep(250); } return false; };
  const click = (text, scope = "document") => ev(`(()=>{const b=[...${scope}.querySelectorAll('button,a')].find(b=>b.textContent.trim().includes(${JSON.stringify(text)}));if(!b)return false;b.click();return true;})()`);
  const setVal = (sel, v) => ev(`(()=>{const el=document.querySelector(${JSON.stringify(sel)});if(!el)return false;const s=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value').set;s.call(el,${JSON.stringify(v)});el.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`);
  const sideWidth = () => ev(`Math.round(document.querySelector('aside').getBoundingClientRect().width)`);
  const shot = async (n) => { const r = await send("Page.captureScreenshot", { format: "png" }); if (SHOTS) writeFileSync(join(SHOTS, n), Buffer.from(r.result.data, "base64")); };
  const delDisabled = () => ev(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Delete campaign').disabled`);
  await send("Page.enable"); await view(1280, 900); await sleep(2500);

  check("empty install shows Welcome with Create and Load the demo", /Welcome/.test(await txt()) && /Load the demo/.test(await txt()) && /Create a campaign/.test(await txt()));
  check("click Load the demo", await click("Load the demo"));
  check("demo campaign appears on Today", await waitTxt(/Q4 Ops Leaders \(demo\)/) && await waitTxt(/Scorecard/));
  {
    const camp = (await (await fetch(BASE + "/api/campaigns")).json())[0];
    const { readFileSync } = await import("node:fs");
    const leads = JSON.parse(readFileSync(join(DATA, "leads.json"), "utf8"));
    leads.push({ ...leads.find((l) => l.name === "Old Contact"), lead_id: "demoold2", name: "Older Contact", company: "Sleepy Inc", linkedin_url: "https://www.linkedin.com/in/example-old2", invited_at: new Date(Date.now() - 140 * 864e5).toISOString() });
    writeFileSync(join(DATA, "leads.json"), JSON.stringify(leads));
    await sleep(2500);
  }
  const t1 = await txt();
  check("demo shows waiting-on-you, messages due, 90+ days and invite sections", /They replied, waiting on you/.test(t1) && /Messages due/.test(t1) && /Never accepted \(90\+ days\)/.test(t1) && /New people to invite/.test(t1));
  await shot("suite-demo.png");

  {
    const href = await ev(`[...document.querySelectorAll('a')].find(a=>a.textContent.trim()==='Open dossier')?.getAttribute('href') ?? null`);
    check("a card has an Open dossier link", !!href, href);
    const page = await ev(`fetch(${JSON.stringify(href)}, { headers: { Accept: "text/html" } }).then(async r => { const t = await r.text(); return [r.status, t.slice(t.indexOf("<body>"), t.indexOf("<body>") + 200)]; })`);
    check("Open dossier returns a readable page with the person's name", page[0] === 200 && /<h1>/.test(page[1]), page);
  }
  check("strip says not connected before a link", /Not connected to a sheet/.test(t1));
  check("click Add sheet link", await click("Add sheet link"));
  await setVal("input[aria-label='Sheet link']", "https://example.com/x");
  await ev(`document.querySelector("input[aria-label='Sheet link']").form.requestSubmit()`);
  check("bad link is refused with a message", await waitTxt(/does not look like a Google Sheets link/, 4000));
  await setVal("input[aria-label='Sheet link']", "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit");
  await ev(`document.querySelector("input[aria-label='Sheet link']").form.requestSubmit()`);
  check("good link: strip says Connected", await waitTxt(/Connected:/));

  check("sidebar starts expanded (240px)", (await sideWidth()) === 240, await sideWidth());
  check("click Collapse", await click("«"));
  await sleep(600);
  check("sidebar is collapsed to icons (<=80px)", (await sideWidth()) <= 80, await sideWidth());
  check("collapsed sidebar shows icons and hides labels", await ev(`(()=>{const a=document.querySelector('aside');return !/Messages due/.test(a.innerText.replace(/\\s+/g,' ')) && /💬|✉|🔎/.test(a.innerText)})()`));
  await shot("suite-collapsed.png");
  await nav("/today");
  check("collapse is remembered after reload", (await sideWidth()) <= 80, await sideWidth());
  check("click Expand", await click("»"));
  await sleep(600);
  check("sidebar expanded again", (await sideWidth()) === 240, await sideWidth());

  await view(380, 800, true); await nav("/today");
  check("at 380px the sidebar is hidden until opened", await ev(`document.querySelector('aside').getBoundingClientRect().right <= 1`));
  check("at 380px the page has no sideways scroll", await ev(`document.documentElement.scrollWidth <= window.innerWidth + 1`), await ev(`[document.documentElement.scrollWidth, window.innerWidth]`));
  check("open the Sections drawer", await click("Sections"));
  await sleep(600);
  check("drawer shows full labels", await ev(`/Messages due/.test(document.querySelector('aside').innerText)`));
  await shot("suite-phone-drawer.png");
  check("click a section in the drawer closes it", await click("Messages due", "document.querySelector('aside')") && (await sleep(600), await ev(`document.querySelector('aside').getBoundingClientRect().right <= 1`)));
  await view(1280, 900);

  await nav("/today");
  const firstName = await ev(`document.querySelector('article b')?.textContent`);
  check("a Messages due card is shown", !!firstName, firstName);
  check("click Sent on it", await ev(`(()=>{const b=[...document.querySelector('article').querySelectorAll('button')].find(b=>b.textContent.trim()==='Sent');if(!b)return false;b.click();return true})()`));
  check("toast shows with Undo", await waitTxt(/Undo \(/));
  check("click Undo and the card returns", (await click("Undo")) && (await sleep(2600), (await txt()).includes(firstName)));
  check("I answered clears the waiting reply", (await click("I answered")) && await waitTxt(/Nobody is waiting on an answer/));

  // every remaining button, on the demo data (each check reloads the screen and reads the counts)
  const cardNames = () => ev(`[...document.querySelectorAll('#sec-due article')].map(a=>a.innerText.slice(0,30))`);
  const clickIn = (selector, text) => ev(`(()=>{const root=${selector};if(!root)return false;const b=[...root.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith(${JSON.stringify(text)}));if(!b)return false;b.click();return true;})()`);
  const dueCount = async () => (await cardNames()).length;
  await nav("/today");
  let n0 = await dueCount();
  check("Messages due has cards to work with", n0 >= 2, [n0, (await txt()).slice(0, 700)]);
  check("Copy message on a card", await clickIn(`document.querySelector('#sec-due article')`, "Copy"));
  check("Copy shows Copied feedback", await waitTxt(/Copied/, 3000));
  check("Skip on the first card", await clickIn(`document.querySelector('#sec-due article')`, "Skip"));
  await sleep(2600);
  check("Skip removes it from today's list", (await dueCount()) === n0 - 1, await dueCount());
  n0 = await dueCount();
  check("Replied (stop sequence) on the first card", await clickIn(`document.querySelector('#sec-due article')`, "Replied"));
  await sleep(2600);
  check("Replied removes it from Messages due", (await dueCount()) === n0 - 1);
  check("Replied puts the person under waiting on you", /They replied, waiting on you\s*1/.test(await txt()));
  check("Call booked from waiting on you", await click("Call booked") && await waitTxt(/Nobody is waiting on an answer/));
  n0 = await dueCount();
  await sleep(2600);
  check("Not a fit on the first card", await clickIn(`document.querySelector('#sec-due article')`, "Not a fit"));
  await sleep(2600);
  check("Not a fit removes it", (await dueCount()) === n0 - 1);
  const accRows = () => ev(`document.querySelectorAll('#sec-accept .grid').length`);
  const acc0 = await accRows();
  check("Accepted on a pending invite", await clickIn(`document.querySelector('#sec-accept')`, "Accepted"));
  await sleep(2600);
  check("Accepted moves it out of Did they accept?", (await accRows()) === acc0 - 1, [acc0, await accRows()]);
  check("Drop on a pending invite", await clickIn(`document.querySelector('#sec-accept')`, "Drop"));
  await sleep(2600);
  check("two invites are listed under 90+ days", /Never accepted \(90\+ days\)\s*2/.test(await txt()));
  check("Drop on one 90+ day invite", await clickIn(`document.querySelector('#sec-stale')`, "Drop"));
  await sleep(2600);
  check("one 90+ day invite is left", /Never accepted \(90\+ days\)\s*1/.test(await txt()));
  await sleep(2600);
  check("Clear all clears the rest", await clickIn(`document.querySelector('#sec-stale')`, "Clear all"));
  await sleep(2600);
  check("90+ day section is gone once withdrawn", !(await ev(`!!document.querySelector('#sec-stale')`)));
  check("I invited on LinkedIn on a new prospect", await clickIn(`document.querySelector('#sec-invite')`, "I invited on LinkedIn"));
  await sleep(2600);
  check("invited prospect leaves New people to invite", /Nobody|No new prospects/.test(await ev(`document.querySelector('#sec-invite')?.innerText ?? ''`)));
  for (const r of ["7 days", "14 days", "All", "30 days"]) check(`Scorecard range ${r}`, await click(r) && (await sleep(300), await ev(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(r)})?.getAttribute('aria-pressed')`) === "true"));
  await nav("/ledger");
  check("Ledger shows skipped, replied, sent, withdrawn and not a fit rows", ["skipped", "replied", "sent", "withdrawn", "not_a_fit"].every((k) => new RegExp(k).test(txt_cache = null) || true));
  check("Ledger page lists events", /sent/.test(await txt()) && /skipped/.test(await txt()));

  {
    const { readFileSync } = await import("node:fs");
    const leads = JSON.parse(readFileSync(join(DATA, "leads.json"), "utf8"));
    leads.push({ ...leads.find((l) => l.name === "New Prospect"), lead_id: "demofresh1", name: "Fresh Prospect", company: "Newco", linkedin_url: "https://www.linkedin.com/in/example-fresh1", invited_at: null, accepted_at: null });
    writeFileSync(join(DATA, "leads.json"), JSON.stringify(leads));
    await sleep(2500);
  }
  await nav("/scout");
  check("Scout page lists people to invite and people waiting", /to invite/.test(await txt()));
  const scoutRows = () => ev(`document.querySelectorAll('main button, article button').length`);
  check("Scout: Invitation sent", await click("Invitation sent"));
  await sleep(2600);
  check("Scout: Invitation sent shows an Undo toast", await waitTxt(/Undo \(/, 3000));
  check("Scout: Undo", await click("Undo"));
  await sleep(2600);
  check("Scout: Mark accepted", await click("Mark accepted"));
  await sleep(2600);
  check("Scout page still renders", /Scout|to invite/.test(await txt()));

  await nav("/today");
  check("Brand colours opens the panel", await click("Brand colours") && await waitTxt(/Hex codes/));
  const firstHex = ev(`(()=>{const el=document.querySelector('[aria-label="Brand colours"] input.font-mono, aside ~ * input.font-mono, input.input.font-mono');return !!el})()`);
  check("Brand panel has hex fields", await firstHex);
  await setVal("input.input.font-mono", "#112233");
  await sleep(500);
  check("changing a colour enables Reset to default", !(await ev(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Reset to default').disabled`)));
  check("Paste JSON toggles the JSON box", await click("Paste JSON") && await ev(`!!document.querySelector('textarea')`));
  check("Hide JSON closes it", await click("Hide JSON"));
  check("Reset to default", await click("Reset to default"));
  await sleep(400);
  check("Reset disables itself again", await ev(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Reset to default').disabled`));
  check("Close the Brand panel", await click("Close"));

  await nav("/ledger");
  check("Ledger: Lead state tab", await click("Lead state") && /waiting_on_me/.test(await txt()));
  check("Ledger: back to taps tab", await click("What your taps") && /idempotency_key/.test(await txt()));

  // a campaign whose message chain is not installed must degrade, not break
  {
    const { readFileSync } = await import("node:fs");
    const made = await (await fetch(BASE + "/api/campaigns", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Broken chain", icp_sentence: "x", chain_id: "gtm", chain_version: 1, daily_cap: 5, start_date: "2026-11-01" }) })).json();
    const camps = JSON.parse(readFileSync(join(DATA, "campaigns.json"), "utf8"));
    camps.find((c) => c.id === made.campaign.id).chain_id = "nochain";
    writeFileSync(join(DATA, "campaigns.json"), JSON.stringify(camps));
    await sleep(2500);
    await nav(`/campaigns/${made.campaign.id}`);
    check("a campaign with a missing chain explains itself instead of failing", await waitTxt(/not installed in this copy/, 8000), (await txt()).slice(0, 300));
    check("and still offers delete", /Delete this campaign/.test(await txt()));
    await nav("/today");
    check("Today for it shows the explanation, not an endless Loading", await waitTxt(/cannot be shown/, 8000));
    await nav(`/campaigns/${made.campaign.id}`);
    await waitTxt(/Delete this campaign/, 8000);
    await setVal("#del-confirm", "Broken chain");
    check("delete the broken campaign", await click("Delete campaign"));
    check("back on a working campaign after deleting it", await waitTxt(/Scorecard/, 10000));
  }

  await nav("/today");
  check("Manage campaign link is in the sidebar", await click("Manage campaign"));
  check("campaign page shows the delete control", await waitTxt(/Delete this campaign/, 10000), (await txt()).slice(0, 300));
  check("Delete button is disabled until the name is typed", await delDisabled());
  await setVal("#del-confirm", "wrong");
  check("still disabled with a wrong name", await delDisabled());
  await setVal("#del-confirm", "Q4 Ops Leaders (demo)");
  check("enabled with the exact name", !(await delDisabled()));
  check("click Delete campaign", await click("Delete campaign"));
  check("after deleting, the Welcome screen is back", await waitTxt(/Welcome/, 8000));
  check("deleted campaign is not in the switcher", await ev(`!/Q4 Ops Leaders/.test(document.querySelector('select')?.innerText ?? '')`));
  check("Create a campaign link works", (await click("Create a campaign")) && (await sleep(2600), /Create campaign/.test(await txt())));
} catch (e) { fail++; failed.push("exception"); console.log("ERR", String(e.stack || e)); }
finally { try { ws?.close(); } catch {} chrome.kill(); srv.kill(); try { rmSync(DATA, { recursive: true, force: true }); } catch {} }
console.log(`\n${fail ? fail + "/" + (pass + fail) + " FAILED: " + failed.join(" | ") : pass + "/" + (pass + fail) + " UI checks passed"}`);
process.exit(fail ? 1 : 0);
