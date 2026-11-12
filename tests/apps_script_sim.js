// Runs the real sheet/Code.gs against a stubbed Apps Script API.
// Two modes:
//   node apps_script_sim.js                     -> self-test, exit 0/1
//   node apps_script_sim.js --serve 8911        -> HTTP stand-in for the /exec URL,
//                                                  seeded empty; the e2e harness drives it
// The script under test is the deliverable itself, not a reimplementation.
const fs = require("fs");
const path = require("path");
const http = require("http");
const crypto = require("crypto");

const SCRIPT = process.env.GS_FILE ||
  path.join(__dirname, "..", "sheet", "Code.gs");
const TZ = "UTC";

/* ------------------------------------------------ fake spreadsheet ---- */
function makeSheet(name) {
  const data = []; // array of rows, each array of cells
  const sheet = {
    _name: name,
    _data: data,
    _frozen: 0,
    _validations: 0,
    _validationLists: [],
    getName: () => name,
    getLastRow: () => {
      let last = 0;
      data.forEach((r, i) => { if (r && r.some((c) => c !== "" && c !== undefined && c !== null)) last = i + 1; });
      return last;
    },
    getLastColumn: () => Math.max(0, ...data.map((r) => (r ? r.length : 0))),
    setFrozenRows(n) { this._frozen = n; },
    getRange(row, col, nRows = 1, nCols = 1) {
      const sh = this;
      const ensure = (r) => { while (data.length < r) data.push([]); };
      const rng = {
        getValues() {
          const out = [];
          for (let i = 0; i < nRows; i++) {
            const r = (data[row - 1 + i] || []).slice(col - 1, col - 1 + nCols);
            while (r.length < nCols) r.push("");
            out.push(r);
          }
          return out;
        },
        setValues(vals) {
          for (let i = 0; i < vals.length; i++) {
            ensure(row + i);
            const r = data[row - 1 + i];
            for (let c = 0; c < vals[i].length; c++) {
              while (r.length < col - 1 + c + 1) r.push("");
              r[col - 1 + c] = vals[i][c];
            }
          }
          return rng;
        },
        setValue(v) { return rng.setValues([[v]]); },
        getValue() { return (data[row - 1] || [])[col - 1] || ""; },
        setFontWeight() { return rng; },
        setDataValidation(v) {
          sh._validations += 1;
          sh._validationLists.push((v && v._list) ? v._list.slice() : []);
          return rng;
        },
      };
      return rng;
    },
    getDataRange() {
      const rows = Math.max(data.length, 1);
      const cols = Math.max(1, this.getLastColumn());
      return this.getRange(1, 1, rows, cols);
    },
    appendRow(vals) { data.push(vals.slice()); },
  };
  return sheet;
}

const sheets = { Pipeline: makeSheet("Pipeline") };
const props = {};
const logs = [];
const triggers = [];
const ss = {
  getSheetByName: (n) => sheets[n] || null,
  insertSheet: (n) => (sheets[n] = makeSheet(n)),
  getSheets: () => Object.values(sheets),
  getSpreadsheetTimeZone: () => TZ,
  toast: () => {},
};

global.SpreadsheetApp = {
  getActive: () => ss,
  getActiveSpreadsheet: () => ss,
  newDataValidation: () => ({
    requireValueInList: (list) => {
      const rule = { _list: list || [] };
      rule.setAllowInvalid = () => rule;
      rule.build = () => rule;
      return rule;
    },
  }),
};
global.PropertiesService = {
  getScriptProperties: () => ({
    getProperty: (k) => (props[k] === undefined ? null : props[k]),
    setProperty: (k, v) => { props[k] = v; },
  }),
};
global.ContentService = {
  MimeType: { JSON: "application/json" },
  createTextOutput: (s) => ({ _s: s, setMimeType() { return this; }, getContent() { return this._s; } }),
};
global.LockService = { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) };
global.ScriptApp = {
  getProjectTriggers: () => triggers,
  newTrigger: (fn) => ({ forSpreadsheet: () => ({ onEdit: () => ({ create: () => triggers.push({ fn, getHandlerFunction: () => fn }) }) }) }),
};
global.Logger = { log: (m) => logs.push(m) };

function formatDate(date, tz, pattern) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz || "UTC", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(date).reduce((a, p) => (a[p.type] = p.value, a), {});
  return pattern
    .replace(/yyyy/g, parts.year)
    .replace(/MM/g, parts.month)
    .replace(/dd/g, parts.day)
    .replace(/HH/g, parts.hour === "24" ? "00" : parts.hour)
    .replace(/mm/g, parts.minute);
}

global.Utilities = {
  getUuid: () => crypto.randomUUID(),
  formatDate,
  DigestAlgorithm: { SHA_256: "SHA_256" },
  Charset: { UTF_8: "UTF_8" },
  computeDigest: (_algo, text) => Array.from(crypto.createHash("sha256").update(String(text), "utf8").digest())
    .map((b) => (b > 127 ? b - 256 : b)),
};

/* ------------------------------------------------ load the real file --- */
const src = fs.readFileSync(SCRIPT, "utf8");
const mod = { exports: {} };
new Function("module", "exports", src + "\n;module.exports={doGet,doPost,onSheetEdit,setupSheet," +
  "setupBridge,setupTracking,HEADERS,TRACK,MESSAGES_HEADERS,EVENTS_HEADERS};")(mod, (mod.exports = {}));
const api = mod.exports;

const POST = (obj) => JSON.parse(api.doPost({ postData: { contents: JSON.stringify(obj) } }).getContent());
const GET = (params) => JSON.parse(api.doGet({ parameter: params }).getContent());
const token = () => props.BRIDGE_TOKEN;
const pipelineRow = (cid) => GET({ token: token() }).rows.find((r) => String(r["Contact ID"]) === String(cid)) || {};
const events = () => {
  const sh = sheets.Events;
  if (!sh) return [];
  const v = sh.getDataRange().getValues();
  return v.slice(1).filter((r) => r[0] || r[2]).map((r) => {
    const o = {};
    api.EVENTS_HEADERS.forEach((h, i) => (o[h] = r[i]));
    return o;
  });
};

/* ------------------------------------------------ self-test ------------ */
let pass = 0, fail = 0;
function check(label, cond, detail) {
  if (cond) { pass++; console.log("PASS  " + label); }
  else { fail++; console.log("FAIL  " + label + (detail !== undefined ? "  <- " + JSON.stringify(detail) : "")); }
}

function selfTest() {
  api.setupBridge();
  check("setupBridge mints a token", !!token());
  check("setupBridge installs the on-edit trigger exactly once", triggers.length === 1, triggers.length);
  check("Pipeline header row == HEADERS", JSON.stringify(sheets.Pipeline._data[0]) === JSON.stringify(api.HEADERS),
    sheets.Pipeline._data[0]);
  check("Pipeline header is 17 + 5", api.HEADERS.length === 22, api.HEADERS.length);
  check("Messages tab created", !!sheets.Messages);
  check("Events tab created", !!sheets.Events);
  check("Stage dropdown installed", sheets.Pipeline._validations >= 4, sheets.Pipeline._validations);
  check("Stage dropdown lists all 6 rungs + done + replied",
    sheets.Pipeline._validationLists.some((l) => l.join(",") === "to_send,day4,day10,day18,day30,day45,done,replied"),
    sheets.Pipeline._validationLists);
  api.setupBridge();
  check("setupBridge is idempotent", triggers.length === 1 && !!token());

  check("GET without token refused", GET({}).error === "unauthorized");
  check("POST with wrong token refused", POST({ token: "nope", action: "append", rows: [] }).error === "unauthorized");

  // ---- fixtures --------------------------------------------------------
  const base = (cid, name, extra) => Object.assign({
    "Contact ID": cid, "Full Name": name, Title: "T", Company: "Co",
    "LinkedIn URL": "https://linkedin.com/in/" + cid, Segment: "demo", Campaign: "Demo",
    "Date Added": "2026-11-01T00:00:00Z", "Accepted?": "Yes", "Research Status": "ready",
  }, extra || {});
  const today = formatDate(new Date(), TZ, "yyyy-MM-dd");
  const minus = (n) => { const d = new Date(Date.now() - n * 86400000); return formatDate(d, TZ, "yyyy-MM-dd"); };
  const plus = (n) => { const d = new Date(Date.now() + n * 86400000); return formatDate(d, TZ, "yyyy-MM-dd"); };

  let out = POST({ token: token(), action: "append", rows: [
    base("cA", "Aaa Prospect"),
    base("cB", "Bbb Prospect"),
    base("cC", "Ccc Prospect", { Stage: "day4", "Sent At": new Date(Date.now() - 9 * 86400000).toISOString(), "Next Due": minus(5) }),
    base("cD", "Ddd Prospect", { Stage: "day10", "Sent At": new Date().toISOString(), "Next Due": plus(6) }),
    base("cE", "Eee Prospect", { Stage: "done", "Sent At": new Date().toISOString(), "Next Due": "" }),
    base("cF", "Fff Prospect", { "Research Status": "queued" }),
    base("cG", "Ggg Prospect", { Stage: "day18", "Sent At": new Date(Date.now() - 20 * 86400000).toISOString(), "Next Due": minus(2) }),
    base("cH", "Hhh Prospect", { Stage: "day45", "Sent At": new Date(Date.now() - 46 * 86400000).toISOString(), "Next Due": today }),
    base("cI", "Iii Prospect", { Stage: "replied", "Sent At": new Date(Date.now() - 12 * 86400000).toISOString(), "Next Due": "" }),
  ] });
  check("fixtures appended", out.ok === true && out.touched === 9, out);

  // ---- today view ------------------------------------------------------
  let tv = GET({ token: token(), view: "today", date: today });
  check("today = 5 rows (A,B to_send; C day4; G day18; H day45 due today)", tv.count === 5,
    tv.rows.map((r) => r["Contact ID"]));
  check("today order: stage rank, then due, then name",
    tv.rows.map((r) => r["Contact ID"]).join(",") === "cA,cB,cC,cG,cH",
    tv.rows.map((r) => r["Contact ID"]));
  check("future day10 excluded", !tv.rows.some((r) => r["Contact ID"] === "cD"));
  check("done excluded", !tv.rows.some((r) => r["Contact ID"] === "cE"));
  check("unresearched excluded", !tv.rows.some((r) => r["Contact ID"] === "cF"));
  check("replied excluded", !tv.rows.some((r) => r["Contact ID"] === "cI"));

  // ---- variants --------------------------------------------------------
  out = POST({ token: token(), action: "variants", contact_id: "cA", stage: "to_send",
    variants: [{ slot: 1, body: "Hi Aaa, saw your post on roofing." },
               { slot: 2, body: "Aaa — quick one about your hiring pipeline." },
               { slot: 3, body: "Aaa, one line: would 10 minutes help?" }] });
  check("variants stored, 3 ids", out.ok && out.variants.length === 3, out);
  check("variant id shape V<n>-4hex", /^V1-[0-9a-f]{4}$/.test(out.variants[0]), out.variants);
  const v2 = out.variants[1];
  const stored = GET({ token: token(), view: "messages", contact_id: "cA" });
  check("messages readable back", stored.rows.length === 3 && stored.rows[1].Body.includes("hiring pipeline"), stored.rows);
  check("today rows carry their variants", GET({ token: token(), view: "today", date: today }).rows[0].Variants.length === 3);

  // ---- mark sent, wrong variant rejected -------------------------------
  out = POST({ token: token(), action: "mark_sent", contact_id: "cA", expect_stage: "to_send",
    variant: "V9-dead", request_id: "r-q1" });
  check("unknown variant refused", out.ok === false && out.error === "bad_payload", out);

  // ---- the ladder: every rung forward, undo off each one -----------------
  const LADDER = [
    { from: "to_send", to: "day4", offset: 4 },
    { from: "day4", to: "day10", offset: 10 },
    { from: "day10", to: "day18", offset: 18 },
    { from: "day18", to: "day30", offset: 30 },
    { from: "day30", to: "day45", offset: 45 },
    { from: "day45", to: "done", offset: null },
  ];
  const dueFor = (offset) => {
    const d = new Date(pipelineRow("cA")["Sent At"]);
    return formatDate(new Date(d.getTime() + offset * 86400000), TZ, "yyyy-MM-dd");
  };

  out = POST({ token: token(), action: "mark_sent", contact_id: "cA", expect_stage: "to_send",
    variant: v2, request_id: "r-1" });
  check("mark sent -> day4", out.ok && out.row.Stage === "day4", out);
  check("variant recorded on the lead row", out.row.Variant === v2, out.row);
  check("sent at stamped", /^\d{4}-\d{2}-\d{2}T/.test(out.row["Sent At"]), out.row);
  check("next due = sent + 4 days", out.row["Next Due"] === dueFor(4), out.row["Next Due"]);
  const afterSent = pipelineRow("cA");
  check("row persisted on the sheet", afterSent.Stage === "day4" && afterSent.Variant === v2, afterSent);
  check("row left today", !GET({ token: token(), view: "today", date: today }).rows.some((r) => r["Contact ID"] === "cA"));

  // ---- double click: same click replayed -------------------------------
  out = POST({ token: token(), action: "mark_sent", contact_id: "cA", expect_stage: "to_send",
    variant: v2, request_id: "r-1" });
  check("replayed click is idempotent, not a second stamp",
    out.ok === true && out.idempotent === true && pipelineRow("cA").Stage === "day4", out);
  check("one mark_sent event only", events().filter((e) => e["Contact ID"] === "cA" && e.Action === "mark_sent").length === 1,
    events().filter((e) => e["Contact ID"] === "cA").length);

  // ---- double click: two clicks, same stale view -----------------------
  const before = pipelineRow("cA");
  out = POST({ token: token(), action: "mark_sent", contact_id: "cA", expect_stage: "to_send",
    variant: v2, request_id: "r-2" });
  check("second click from the stale view conflicts", out.ok === false && out.conflict === true, out);
  check("second click changes nothing", pipelineRow("cA")["Sent At"] === before["Sent At"], pipelineRow("cA"));

  // ---- undo ------------------------------------------------------------
  out = POST({ token: token(), action: "undo", contact_id: "cA", expect_stage: "day4", request_id: "r-3" });
  check("undo restores to_send", out.ok && out.row.Stage === "to_send", out);
  check("undo clears sent at / variant / next due",
    !out.row["Sent At"] && !out.row.Variant && !out.row["Next Due"], out.row);
  check("row is back in today", GET({ token: token(), view: "today", date: today }).rows.some((r) => r["Contact ID"] === "cA"));
  out = POST({ token: token(), action: "undo", contact_id: "cA", expect_stage: "day4", request_id: "r-4" });
  check("double-click undo does not step twice", out.ok === false && out.conflict === true &&
    pipelineRow("cA").Stage === "to_send", out);

  // ---- whole ladder on one row: wrong predecessor refused, advance, undo,
  //      re-advance; the last rung closes the row -------------------------
  let step = 0;
  for (const rung of LADDER) {
    step++;
    if (rung.from !== "to_send") {
      out = POST({ token: token(), action: "mark_sent", contact_id: "cA",
        expect_stage: "to_send", request_id: "r-wrong-" + step });
      check(rung.from + " refuses a write addressed to to_send",
        out.ok === false && out.conflict === true && out.stage === rung.from, out);
    }
    const cur = pipelineRow("cA");
    const sentAt = cur["Sent At"];
    const priorStage = cur.Stage, priorDue = cur["Next Due"] || "", priorFollow = cur["Follow-up At"] || "";
    out = POST({ token: token(), action: "mark_sent", contact_id: "cA", expect_stage: rung.from,
      variant: rung.from === "to_send" ? v2 : undefined, request_id: "r-walk-" + step });
    const wantDue = rung.offset === null ? "" : dueFor(rung.offset);
    check("mark_sent " + rung.from + " -> " + rung.to, out.ok && out.row.Stage === rung.to, out);
    check(rung.from + " -> " + rung.to + " next due " + (rung.offset === null ? "empty" : "sent+" + rung.offset),
      (out.row["Next Due"] || "") === wantDue, [out.row["Next Due"], wantDue]);
    if (rung.from !== "to_send") {
      /* same-millisecond clicks share a stamp; never assert strict inequality */
      check(rung.from + " stamps Follow-up At",
        !!out.row["Follow-up At"] && String(out.row["Follow-up At"]) >= String(priorFollow), out.row);
      check(rung.from + " leaves Sent At and Variant alone",
        pipelineRow("cA")["Sent At"] === sentAt && pipelineRow("cA").Variant === v2, pipelineRow("cA"));
    }
    out = POST({ token: token(), action: "undo", contact_id: "cA", expect_stage: rung.to, request_id: "r-undo-" + step });
    check("undo from " + rung.to + " returns to " + rung.from,
      out.ok && out.row.Stage === priorStage && (out.row["Next Due"] || "") === priorDue, out.row);
    if (rung.from !== "to_send") {
      check("undo from " + rung.to + " restores Follow-up At",
        (out.row["Follow-up At"] || "") === priorFollow, out.row);
    }
    out = POST({ token: token(), action: "mark_sent", contact_id: "cA", expect_stage: rung.from,
      variant: rung.from === "to_send" ? v2 : undefined, request_id: "r-again-" + step });
    check("re-advance " + rung.from + " -> " + rung.to, out.ok && out.row.Stage === rung.to, out);
  }
  check("the full 5-rung walk ends at done with no next due",
    pipelineRow("cA").Stage === "done" && !pipelineRow("cA")["Next Due"], pipelineRow("cA"));
  check("event trail carries one hop per rung", (function () {
    const rows = events().filter((e) => e["Contact ID"] === "cA" && e.Action === "mark_sent");
    return ["day4|day10", "day10|day18", "day18|day30", "day30|day45", "day45|done"].every((pair) => {
      const f = pair.split("|")[0], t = pair.split("|")[1];
      return rows.some((e) => e["From Stage"] === f && e["To Stage"] === t);
    }) && !!pipelineRow("cA")["Follow-up At"];
  })(), events().filter((e) => e["Contact ID"] === "cA"));

  // ---- skip ------------------------------------------------------------
  out = POST({ token: token(), action: "skip", contact_id: "cB", expect_stage: "to_send", request_id: "r-9" });
  check("skip -> back tomorrow", out.ok && out.row["Next Due"] === plus(1) && out.row.Stage === "to_send", out);
  check("skipped row is out of today", !GET({ token: token(), view: "today", date: today }).rows.some((r) => r["Contact ID"] === "cB"));
  check("skipped row is back on tomorrow's list",
    GET({ token: token(), view: "today", date: plus(1) }).rows.some((r) => r["Contact ID"] === "cB"));
  out = POST({ token: token(), action: "undo", contact_id: "cB", expect_stage: "to_send", request_id: "r-10" });
  check("undo skip -> due again today", out.ok && !out.row["Next Due"], out);

  // skip is a one-day snooze at every rung, not a drop
  for (const [cid_, st_] of [["cG", "day18"], ["cH", "day45"]]) {
    out = POST({ token: token(), action: "skip", contact_id: cid_, expect_stage: st_, request_id: "r-skip-" + cid_ });
    check("skip at " + st_ + " defers one day, same stage",
      out.ok && out.row.Stage === st_ && out.row["Next Due"] === plus(1), out);
    out = POST({ token: token(), action: "undo", contact_id: cid_, expect_stage: st_, request_id: "r-skips-" + cid_ });
    check("undo skip at " + st_ + " restores the original due date", out.ok && !!out.row["Next Due"], out);
  }

  // ---- replied ---------------------------------------------------------
  out = POST({ token: token(), action: "replied", contact_id: "cB", expect_stage: "to_send", request_id: "r-11" });
  check("replied stops the sequence", out.ok && out.row.Stage === "replied" && out.row["Next Due"] === "", out);
  check("replied row leaves today", !GET({ token: token(), view: "today", date: today }).rows.some((r) => r["Contact ID"] === "cB"));
  out = POST({ token: token(), action: "undo", contact_id: "cB", expect_stage: "replied", request_id: "r-12" });
  check("undo replied restores to_send", out.ok && out.row.Stage === "to_send", out);

  // replied is reachable from every rung, and undo puts the rung back
  const rungRows = [["rT", "to_send"], ["r4", "day4"], ["r10", "day10"],
                    ["r18", "day18"], ["r30", "day30"], ["r45", "day45"]];
  POST({ token: token(), action: "append", rows: rungRows.map(([k, st]) => base(k, "Reply " + k,
    st === "to_send" ? {} : { Stage: st, "Sent At": new Date(Date.now() - 12 * 86400000).toISOString(), "Next Due": plus(3) })) });
  rungRows.forEach(([k, st]) => {
    out = POST({ token: token(), action: "replied", contact_id: k, expect_stage: st, request_id: "r-rep-" + k });
    check("replied from " + st + " stops the sequence", out.ok && out.row.Stage === "replied" && out.row["Next Due"] === "", out);
    out = POST({ token: token(), action: "undo", contact_id: k, expect_stage: "replied", request_id: "r-repu-" + k });
    check("undo replied from " + st + " restores " + st, out.ok && out.row.Stage === st, out);
  });

  // ---- mark_sent on a finished row -------------------------------------
  out = POST({ token: token(), action: "mark_sent", contact_id: "cE", expect_stage: "done", request_id: "r-13" });
  check("mark sent on a done row conflicts", out.ok === false && out.conflict === true, out);

  // ---- generic update guard -------------------------------------------
  out = POST({ token: token(), action: "update", rows: [{ "Contact ID": "cC", Stage: "replied", "Sent At": "x" }] });
  check("generic update cannot write sequence state",
    pipelineRow("cC").Stage === "day4" && pipelineRow("cC")["Sent At"] !== "x", pipelineRow("cC"));

  out = POST({ token: token(), action: "update", rows: [{ "Contact ID": "cF", "Dossier URL": "https://d/1", "Research Status": "ready" }] });
  check("research ready seeds Stage=to_send", pipelineRow("cF").Stage === "to_send", pipelineRow("cF"));

  out = POST({ token: token(), action: "mark_snet", contact_id: "cA" });
  check("misspelled action refused", out.ok === false && out.error === "bad_action", out);

  out = POST({ token: token(), action: "mark_sent", contact_id: "ghost", expect_stage: "to_send", request_id: "r-x" });
  check("unknown contact refused", out.ok === false && out.error === "no_row", out);

  out = POST({ token: token(), action: "mark_sent", contact_id: "cB", variant: "manual" });
  check("missing expect_stage refused", out.ok === false && out.error === "bad_payload", out);

  out = POST({ token: token(), action: "mark_sent", contact_id: "cB", expect_stage: "to_send", request_id: "r-14" });
  check("mark sent without variant records manual", out.ok && out.row.Variant === "manual", out);

  // ---- legacy contract ------------------------------------------------
  check("GET ?status=ready filters", GET({ token: token(), status: "ready" }).rows.every((r) => r["Research Status"] === "ready"));
  out = POST({ token: token(), action: "update", rows: [{ "Contact ID": "nope" }] });
  check("unknown row skipped", out.ok && out.touched === 0, out);
  out = POST({ token: token(), action: "update", rows: [{ "LinkedIn URL": "https://linkedin.com/in/cC", "Hook Theme": "by url" }] });
  check("update falls back to LinkedIn URL", out.touched === 1 && pipelineRow("cC")["Hook Theme"] === "by url", out);
  out = POST({ token: token(), action: "update", rows: [{ "Hook Theme": "blank keys" }] });
  check("blank-key payload touches nothing", out.touched === 0, out);

  // on-edit hand tick
  const accCol = api.HEADERS.indexOf("Accepted?") + 1;
  const rowNum = 2;
  sheets.Pipeline._data[rowNum - 1][api.HEADERS.indexOf("Research Status")] = "";
  sheets.Pipeline._data[rowNum - 1][api.HEADERS.indexOf("Accepted At")] = "";
  api.onSheetEdit({ range: { getSheet: () => sheets.Pipeline, getRow: () => rowNum, getColumn: () => accCol }, value: "Yes" });
  check("onEdit Accepted?=Yes stamps and queues",
    !!sheets.Pipeline._data[rowNum - 1][api.HEADERS.indexOf("Accepted At")] &&
    sheets.Pipeline._data[rowNum - 1][api.HEADERS.indexOf("Research Status")] === "queued");

  // the date window is inclusive: a row due exactly on the asked day is in
  check("a row due on the asked day is included, one day earlier is not",
    GET({ token: token(), view: "today", date: plus(6) }).rows.some((r) => r["Contact ID"] === "cD") &&
    !GET({ token: token(), view: "today", date: plus(5) }).rows.some((r) => r["Contact ID"] === "cD"),
    GET({ token: token(), view: "today", date: plus(6) }).rows.map((r) => r["Contact ID"]));

  console.log(`\n${pass}/${pass + fail} checks passed`);
  return fail;
}

/* ------------------------------------------------ serve mode ---------- */
function serve(port) {
  if (process.env.BRIDGE_TOKEN) props.BRIDGE_TOKEN = process.env.BRIDGE_TOKEN;
  api.setupBridge();
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    const send = (o, code = 200) => {
      res.writeHead(code, { "Content-Type": "application/json" });
      res.end(JSON.stringify(o));
    };
    if (req.method === "GET") {
      const p = {};
      url.searchParams.forEach((v, k) => (p[k] = v));
      return send(JSON.parse(api.doGet({ parameter: p }).getContent()));
    }
    if (req.method !== "POST") return send({ error: "method" }, 405);
    let buf = "";
    req.on("data", (c) => (buf += c));
    req.on("end", () => {
      const out = JSON.parse(api.doPost({ postData: { contents: buf } }).getContent());
      send(out, out.error === "unauthorized" ? 401 : 200);
    });
  });
  server.listen(port, "127.0.0.1", () => console.log("sim bridge on " + port));
}

if (process.argv[2] === "--serve") serve(Number(process.argv[3] || 8911));
else process.exit(selfTest() ? 1 : 0);
