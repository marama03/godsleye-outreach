/**
 * Campaign Tracker sheet bridge (Google Apps Script).
 *
 * Setup (one time, ~2 minutes):
 *  1. Open your tracker Google Sheet -> Extensions -> Apps Script, paste this file.
 *  2. Project Settings -> Script properties -> add BRIDGE_TOKEN = any long random string.
 *  3. Run setupSheet() once (creates the Pipeline tab, headers and the Accepted? dropdown).
 *  4. Triggers -> add onSheetEdit, event source "From spreadsheet", event type "On edit".
 *  5. Deploy -> New deployment -> Web app -> Execute as: Me, Access: Anyone.
 *     Copy the /exec URL into the app's .env as SHEET_BRIDGE_URL, and the token as SHEET_BRIDGE_TOKEN.
 *
 * Contract: see sheet/SCHEMA.md. The sheet is the shared surface between the app,
 * the hosted monitor agent and the local research agent.
 */
var TAB = "Pipeline";
var HEADERS = [
  "Contact ID", "Full Name", "Title", "Company", "LinkedIn URL", "Segment", "Campaign",
  "Date Added", "Invited", "Invited At", "Accepted?", "Accepted At",
  "Research Status", "Research Started At", "Dossier URL", "Hook Theme", "Notes",
  /* Chief of Staff, 2026-11-09: send tracking (appended, never reordered). */
  "Variant", "Sent At", "Stage", "Next Due", "Follow-up At"
];

function setupSheet() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(TAB) || ss.insertSheet(TAB);
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight("bold");
  sh.setFrozenRows(1);
  var col = HEADERS.indexOf("Accepted?") + 1;
  sh.getRange(2, col, 1000, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(["Yes", "No"], true).build());
  var inv = HEADERS.indexOf("Invited") + 1;
  sh.getRange(2, inv, 1000, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(["Yes", "No"], true).build());
  var rs = HEADERS.indexOf("Research Status") + 1;
  sh.getRange(2, rs, 1000, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(["queued", "dispatched", "researching", "ready", "failed"], true).build());
}

/** Installable on-edit trigger. Accepted? = Yes stamps the date and queues research. */
function onSheetEdit(e) {
  var sh = e.range.getSheet();
  if (sh.getName() !== TAB || e.range.getRow() < 2) return;
  var accCol = HEADERS.indexOf("Accepted?") + 1;
  var invCol = HEADERS.indexOf("Invited") + 1;
  var row = e.range.getRow();
  if (e.range.getColumn() === invCol && String(e.value) === "Yes") {
    var invAt = sh.getRange(row, HEADERS.indexOf("Invited At") + 1);
    if (!invAt.getValue()) invAt.setValue(new Date().toISOString());
  }
  if (e.range.getColumn() === accCol && String(e.value) === "Yes") {
    var at = sh.getRange(row, HEADERS.indexOf("Accepted At") + 1);
    if (!at.getValue()) at.setValue(new Date().toISOString());
    var st = sh.getRange(row, HEADERS.indexOf("Research Status") + 1);
    if (!st.getValue()) st.setValue("queued");
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function authed_(token) {
  var want = PropertiesService.getScriptProperties().getProperty("BRIDGE_TOKEN");
  return want && token === want;
}
function rows_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(TAB);
  var vals = sh.getDataRange().getValues();
  var head = vals[0];
  return vals.slice(1).filter(function (r) { return r[0] || r[4]; }).map(function (r) {
    var o = {};
    head.forEach(function (h, i) { o[h] = r[i] instanceof Date ? r[i].toISOString() : r[i]; });
    return o;
  });
}

function doGet(e) {
  // GET ?token=...[&status=queued]  ->  {rows:[...]} ; optional status filter on Research Status
  if (!authed_(e.parameter.token)) return json_({ error: "unauthorized" });
  /* Chief of Staff, 2026-11-09: two read views for the Today screen. */
  if (e.parameter.view === "today") return json_(viewToday_(e.parameter.date));
  if (e.parameter.view === "messages") return json_(viewMessages_(e.parameter.contact_id));
  var rows = rows_();
  if (e.parameter.status) rows = rows.filter(function (r) { return String(r["Research Status"]) === e.parameter.status; });
  return json_({ rows: rows });
}

/** POST body: {token, action: "append"|"update", rows:[...]} (update matches on Contact ID). */
function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: "bad_json" }); }
  if (!authed_(body.token)) return json_({ error: "unauthorized" });
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    /* Chief of Staff, 2026-11-09: send-tracking actions and action whitelist. */
    var guard = guardAction_(body);
    if (guard) return json_(guard);
    prepareUpdate_(body);

    var sh = SpreadsheetApp.getActive().getSheetByName(TAB);
    var vals = sh.getDataRange().getValues();
    var ids = {};
    var urls = {};
    for (var i = 1; i < vals.length; i++) {
      ids[vals[i][0]] = i + 1;
      urls[vals[i][HEADERS.indexOf("LinkedIn URL")]] = i + 1;
    }
    var touched = 0;
    (body.rows || []).forEach(function (r) {
      var rowNum = ids[r["Contact ID"]] || urls[r["LinkedIn URL"]];
      if (rowNum) {
        Object.keys(r).forEach(function (k) {
          var c = HEADERS.indexOf(k);
          if (c >= 0 && k !== "Contact ID" && r[k] !== undefined) sh.getRange(rowNum, c + 1).setValue(r[k]);
        });
        touched++;
      } else if (body.action === "append") {
        sh.appendRow(HEADERS.map(function (h) { return r[h] === undefined ? "" : r[h]; }));
        var newRow = sh.getLastRow();
        if (r["Contact ID"]) ids[r["Contact ID"]] = newRow; // later rows in this batch update instead of duplicating
        if (r["LinkedIn URL"]) urls[r["LinkedIn URL"]] = newRow;
        touched++;
      }
    });
    /* Chief of Staff, 2026-11-09: a row research just finished joins Today. */
    seedReadyStages_();
    return json_({ ok: true, touched: touched });
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------------- *
 * Appended by Chief of Staff for the demo wiring — not part of Claude Code's
 * original file. Run setupBridge() once; it does everything setupSheet() does,
 * plus mints the token in step 2 and installs the onSheetEdit trigger in
 * step 4 of the header comment, so you don't have to hand-type either.
 * ------------------------------------------------------------------------- */
function setupBridge() {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty("BRIDGE_TOKEN");
  if (!token) {
    token = Utilities.getUuid().replace(/-/g, "").slice(0, 24);
    props.setProperty("BRIDGE_TOKEN", token);
  }
  setupSheet();  // headers + dropdowns, from Claude Code's file
  setupTracking();  // Messages + Events tabs and the Stage dropdown

  var hasTrigger = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === "onSheetEdit";
  });
  if (!hasTrigger) {
    ScriptApp.newTrigger("onSheetEdit")
      .forSpreadsheet(SpreadsheetApp.getActive())
      .onEdit()
      .create();
  }

  Logger.log("BRIDGE TOKEN: " + token);
  Logger.log("Next: Deploy > New deployment > Web app > Execute as Me > Access Anyone.");
  return token;
}

/* ========================================================================= *
 *  SEND TRACKING  (Chief of Staff, 2026-11-09)                              *
 *                                                                          *
 *  Four facts per prospect, five columns after Notes:                      *
 *    Variant       which copy went out          "V2-9f3a" | "manual"        *
 *    Sent At       when the first message went  ISO 8601 UTC               *
 *    Stage         where in the sequence        to_send | day4 | day10 |    *
 *                                               day18 | day30 | day45 |     *
 *                                               done | replied              *
 *    Next Due      when this row is next due    YYYY-MM-DD, "" when done    *
 *    Follow-up At  when the latest follow-up    ISO 8601 UTC               *
 *                                                                          *
 *  The ladder runs to day 45. Every Next Due is counted from `Sent At`,    *
 *  the first send — never from the previous step — so a follow-up sent     *
 *  late does not push the rest of the sequence out. See LADDER below.      *
 *                                                                          *
 *  Variant text never lives on the lead row: it is a row in `Messages`,    *
 *  keyed (Contact ID, Variant). Every write also appends to `Events`, the   *
 *  append-only audit trail. Nothing here changes the 17 original columns.   *
 * ========================================================================= */
var TRACK = ["Variant", "Sent At", "Stage", "Next Due", "Follow-up At"];
var MESSAGES_TAB = "Messages";
var EVENTS_TAB = "Events";
var MESSAGES_HEADERS = ["Contact ID", "Stage", "Variant", "Body", "Created At"];
var EVENTS_HEADERS = ["Event ID", "At", "Contact ID", "Action", "From Stage", "To Stage",
                      "Variant", "Request ID", "Undo Of", "Prior State"];
/**
 * The follow-up ladder, in order (Chief of Staff, 2026-11-12 — v4, 45 days).
 * `offset` is days after `Sent At`, the first send, for the NEXT step; it is
 * never counted from the previous step, so a follow-up sent late shortens the
 * gap to the one after it instead of shifting the whole sequence. `offset: null`
 * ends the ladder. The stage names are copy intents: day4 gentle nudge, day10
 * second nudge, day18 the call ask, day30 re-engage with something new, day45
 * the last touch. Stage order here is the Today screen's sort order.
 */
var LADDER = [
  { stage: "to_send", next: "day4",  offset: 4 },
  { stage: "day4",    next: "day10", offset: 10 },
  { stage: "day10",   next: "day18", offset: 18 },
  { stage: "day18",   next: "day30", offset: 30 },
  { stage: "day30",   next: "day45", offset: 45 },
  { stage: "day45",   next: "done",  offset: null }
];
/** Open rungs only: done and replied are terminal and never queue. */
var STAGE_ORDER = { to_send: 0, day4: 1, day10: 2, day18: 3, day30: 4, day45: 5 };
var STAGE_VALUES = ["to_send", "day4", "day10", "day18", "day30", "day45", "done", "replied"];
var TRACK_ACTIONS = ["mark_sent", "undo", "skip", "replied", "variants"];
var ALL_ACTIONS = ["append", "update"].concat(TRACK_ACTIONS);

/** The ladder row for a stage, or null when the stage is not a rung. */
function rungOf_(stage) {
  for (var i = 0; i < LADDER.length; i++) if (LADDER[i].stage === stage) return LADDER[i];
  return null;
}

/** Creates the two side tabs and the Stage dropdown. Safe to run repeatedly. */
function setupTracking() {
  var ss = SpreadsheetApp.getActive();
  var msg = ss.getSheetByName(MESSAGES_TAB) || ss.insertSheet(MESSAGES_TAB);
  msg.getRange(1, 1, 1, MESSAGES_HEADERS.length).setValues([MESSAGES_HEADERS]).setFontWeight("bold");
  msg.setFrozenRows(1);
  var ev = ss.getSheetByName(EVENTS_TAB) || ss.insertSheet(EVENTS_TAB);
  ev.getRange(1, 1, 1, EVENTS_HEADERS.length).setValues([EVENTS_HEADERS]).setFontWeight("bold");
  ev.setFrozenRows(1);
  var sh = ss.getSheetByName(TAB);
  var st = HEADERS.indexOf("Stage") + 1;
  sh.getRange(2, st, 1000, 1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(STAGE_VALUES, true).build());
}

/* ---------------------------------------------------------------- utils -- */
function sheetOr_(name, headers) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}
function tz_() { return SpreadsheetApp.getActive().getSpreadsheetTimeZone() || "UTC"; }
function dayOf_(date) { return Utilities.formatDate(date, tz_(), "yyyy-MM-dd"); }
function today_() { return dayOf_(new Date()); }
/** Calendar arithmetic on a plain date string — never across a timezone. */
function plusDays_(day, n) {
  var p = String(day).split("-");
  var d = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])));
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function hash4_(text) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8);
  var hex = "";
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i] < 0 ? bytes[i] + 256 : bytes[i];
    hex += ("0" + b.toString(16)).slice(-2);
  }
  return hex.slice(0, 4);
}
function variantId_(slot, body) { return "V" + slot + "-" + hash4_(body); }
function isVariantId_(v) { return /^V[1-9]-[0-9a-f]{4}$/.test(String(v)); }
function iso_(v) {
  if (!v) return "";
  var d = v instanceof Date ? v : new Date(String(v));
  return isNaN(d.getTime()) ? "" : d.toISOString();
}
/** Effective stage: the column, or `to_send` for a row research has finished. */
function stageOf_(row) {
  var s = String(row["Stage"] || "").trim();
  if (s) return s;
  return String(row["Research Status"] || "").trim() === "ready" ? "to_send" : "";
}
function rowOf_(sh, contactId) {
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === String(contactId)) {
      var o = {};
      vals[0].forEach(function (h, j) { o[h] = vals[i][j] instanceof Date ? vals[i][j].toISOString() : vals[i][j]; });
      return { row: i + 1, data: o };
    }
  }
  return null;
}
function stateOf_(data) {
  var s = {};
  TRACK.forEach(function (h) { s[h] = data[h] === undefined ? "" : data[h]; });
  return s;
}
/** One setValues on the contiguous 5-cell band: the row is never half-written. */
function writeState_(sh, rowNum, state) {
  var c0 = HEADERS.indexOf(TRACK[0]) + 1;
  var merged = {};
  var cur = {};
  var vals = sh.getRange(rowNum, c0, 1, TRACK.length).getValues()[0];
  TRACK.forEach(function (h, i) { cur[h] = vals[i] === undefined ? "" : vals[i]; });
  TRACK.forEach(function (h) { merged[h] = state[h] === undefined ? cur[h] : state[h]; });
  sh.getRange(rowNum, c0, 1, TRACK.length)
    .setValues([TRACK.map(function (h) { return merged[h] === undefined ? "" : merged[h]; })]);
  return merged;
}
function appendEvent_(contactId, action, fromStage, toStage, variant, requestId, undoOf, prior) {
  var ev = sheetOr_(EVENTS_TAB, EVENTS_HEADERS);
  ev.appendRow([Utilities.getUuid().slice(0, 8), new Date().toISOString(), contactId, action,
    fromStage || "", toStage || "", variant || "", requestId || "", undoOf || "",
    JSON.stringify(prior || {})]);
}
function eventRows_() {
  var ev = sheetOr_(EVENTS_TAB, EVENTS_HEADERS);
  var vals = ev.getDataRange().getValues();
  if (vals.length < 2) return [];
  return vals.slice(1).filter(function (r) { return r[0] || r[2]; }).map(function (r) {
    var o = {};
    EVENTS_HEADERS.forEach(function (h, i) { o[h] = r[i] instanceof Date ? r[i].toISOString() : r[i]; });
    return o;
  });
}
function seenRequest_(requestId, contactId) {
  if (!requestId) return null;
  var hit = null;
  eventRows_().forEach(function (e) {
    if (String(e["Request ID"]) === String(requestId) && String(e["Contact ID"]) === String(contactId)) hit = e;
  });
  return hit;
}
/** Newest event for this contact that is neither an undo nor already undone. */
function lastUndoableEvent_(contactId) {
  var all = eventRows_();
  var undone = {};
  all.forEach(function (e) { if (e["Undo Of"]) undone[String(e["Undo Of"])] = true; });
  for (var i = all.length - 1; i >= 0; i--) {
    var e = all[i];
    if (String(e["Contact ID"]) !== String(contactId)) continue;
    if (String(e["Action"]) === "undo") continue;
    if (undone[String(e["Event ID"])]) continue;
    return e;
  }
  return null;
}
function messagesOf_(contactId) {
  var sh = sheetOr_(MESSAGES_TAB, MESSAGES_HEADERS);
  var vals = sh.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) !== String(contactId)) continue;
    out.push({ Variant: vals[i][2], Stage: vals[i][1], Body: vals[i][3], "Created At": vals[i][4] });
  }
  return out;
}
function upsertMessage_(contactId, stage, variant, body) {
  var sh = sheetOr_(MESSAGES_TAB, MESSAGES_HEADERS);
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === String(contactId) && String(vals[i][2]) === String(variant)) {
      sh.getRange(i + 1, 1, 1, MESSAGES_HEADERS.length).setValues([[contactId, stage, variant, body, vals[i][4] || new Date().toISOString()]]);
      return;
    }
  }
  sh.appendRow([contactId, stage, variant, body, new Date().toISOString()]);
}

/* --------------------------------------------------------------- writes -- */
function guardAction_(body) {
  if (ALL_ACTIONS.indexOf(body.action) < 0) return { ok: false, error: "bad_action", action: body.action };
  if (TRACK_ACTIONS.indexOf(body.action) < 0) return null;
  var out = handleTracking_(body);
  out.today = today_();  // the spreadsheet's own idea of today, for the app's clock
  return out;
}

/** Strips client writes to the 5 tracking columns: sequence state has one writer. */
function prepareUpdate_(body) {
  if (body.action !== "update" || !body.rows) return;
  body.rows.forEach(function (r) {
    TRACK.forEach(function (h) { if (r[h] !== undefined) delete r[h]; });
  });
}

/** A prospect whose research just came back joins the Today queue. */
function seedReadyStages_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(TAB);
  var cStage = HEADERS.indexOf("Stage") + 1;
  var cRes = HEADERS.indexOf("Research Status") + 1;
  var last = sh.getLastRow();
  if (last < 2) return;
  var vals = sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][cRes - 1] || "").trim() === "ready" &&
        String(vals[i][cStage - 1] || "").trim() === "") {
      sh.getRange(i + 2, cStage).setValue("to_send");
    }
  }
}

function conflict_(data, stage, expect) {
  return { ok: false, conflict: true, stage: stage, expect_stage: expect, row: stateOf_(data) };
}

function handleTracking_(body) {
  var sh = SpreadsheetApp.getActive().getSheetByName(TAB);
  var found = rowOf_(sh, body.contact_id);
  if (!found) return { ok: false, error: "no_row", contact_id: body.contact_id };
  var data = found.data;
  var cur = stateOf_(data);

  if (body.action === "variants") {
    var out = [];
    (body.variants || []).forEach(function (v) {
      var body_ = String(v.body || "");
      if (!v.slot || !body_) return;
      var id = variantId_(v.slot, body_);
      upsertMessage_(body.contact_id, v.stage || "to_send", id, body_);
      out.push(id);
    });
    if (!out.length) return { ok: false, error: "bad_payload", detail: "no variants with slot + body" };
    return { ok: true, action: "variants", contact_id: body.contact_id, variants: out };
  }

  var hit = seenRequest_(body.request_id, body.contact_id);
  if (hit) return { ok: true, action: body.action, contact_id: body.contact_id, idempotent: true, row: cur };

  var stage = stageOf_(data);
  if (body.expect_stage === undefined || body.expect_stage === null || body.expect_stage === "") {
    return { ok: false, error: "bad_payload", detail: "expect_stage is required" };
  }
  if (String(body.expect_stage) !== String(stage)) return conflict_(data, stage, body.expect_stage);

  var prior = { Variant: cur["Variant"], "Sent At": cur["Sent At"], Stage: cur["Stage"],
                "Next Due": cur["Next Due"], "Follow-up At": cur["Follow-up At"] };
  var next = null;

  if (body.action === "mark_sent") {
    var now = new Date();
    var stamp = now.toISOString();
    var rung = rungOf_(stage);
    /* done, replied, or anything not on the ladder is not a rung you can send from. */
    if (!rung) return conflict_(data, stage, body.expect_stage);
    if (stage === "to_send") {
      /* The first send: the only place a variant is chosen and recorded. Later
       * rungs leave Variant alone — it names the copy that opened the thread. */
      var v = String(body.variant || "").trim();
      if (v && v !== "manual" && !isVariantId_(v)) {
        return { ok: false, error: "bad_payload", detail: "variant must be V<n>-<4hex>, manual, or omitted=manual" };
      }
      if (v && v !== "manual") {
        var known = messagesOf_(body.contact_id);
        var hitIds = known.map(function (m) { return String(m.Variant); });
        if (hitIds.length && hitIds.indexOf(v) < 0) {
          return { ok: false, error: "bad_payload", detail: "variant " + v + " is not stored for this contact" };
        }
      }
      next = { "Variant": v || "manual", "Sent At": stamp,
               "Stage": rung.next, "Next Due": plusDays_(dayOf_(now), rung.offset) };
    } else {
      /* A follow-up. Every due date is Sent At + this rung's offset, so a late
       * send does not move the rungs below it. */
      var sent = iso_(cur["Sent At"]);
      if (!sent) return { ok: false, error: "bad_state", detail: stage + " without Sent At" };
      next = { "Stage": rung.next, "Follow-up At": stamp,
               "Next Due": rung.offset === null ? "" : plusDays_(dayOf_(new Date(sent)), rung.offset) };
    }
  } else if (body.action === "skip") {
    // Skip is a one-day snooze, not a permanent drop: the row is back tomorrow.
    if (!rungOf_(stage)) return conflict_(data, stage, body.expect_stage);
    next = { "Stage": stage, "Next Due": plusDays_(today_(), 1) };
  } else if (body.action === "replied") {
    next = { "Stage": "replied", "Next Due": "" };
  } else if (body.action === "undo") {
    var ev = lastUndoableEvent_(body.contact_id);
    if (!ev) return { ok: false, error: "nothing_to_undo", contact_id: body.contact_id };
    var back;
    try { back = JSON.parse(ev["Prior State"] || "{}"); } catch (err) { back = {}; }
    var restored = writeState_(sh, found.row, back);
    appendEvent_(body.contact_id, "undo", stage, restored["Stage"],
      restored["Variant"], body.request_id, ev["Event ID"], prior);
    return { ok: true, action: "undo", contact_id: body.contact_id, row: restored, undone: ev["Event ID"] };
  }

  var after = writeState_(sh, found.row, next);
  appendEvent_(body.contact_id, body.action, stage, after["Stage"],
    after["Variant"], body.request_id, "", prior);
  return { ok: true, action: body.action, contact_id: body.contact_id, row: after };
}

/* ---------------------------------------------------------------- reads -- */
/** Today: accepted + researched rows whose message is due, newest work first. */
function viewToday_(date) {
  var day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today_();
  var rows = rows_().filter(function (r) {
    if (String(r["Research Status"] || "").trim() !== "ready") return false;
    var st = stageOf_(r);
    if (!(st in STAGE_ORDER)) return false;
    var due = String(r["Next Due"] || "").trim();
    return !due || due <= day;
  });
  rows.sort(function (a, b) {
    var sa = STAGE_ORDER[stageOf_(a)], sb = STAGE_ORDER[stageOf_(b)];
    if (sa !== sb) return sa - sb;
    var da = String(a["Next Due"] || "").trim() || "0000-00-00";
    var db = String(b["Next Due"] || "").trim() || "0000-00-00";
    if (da !== db) return da < db ? -1 : 1;
    var na = String(a["Full Name"] || "").toLowerCase(), nb = String(b["Full Name"] || "").toLowerCase();
    if (na !== nb) return na < nb ? -1 : 1;
    return String(a["Contact ID"] || "") < String(b["Contact ID"] || "") ? -1 : 1;
  });
  rows.forEach(function (r) { r["Variants"] = messagesOf_(r["Contact ID"]); });
  return { date: day, count: rows.length, rows: rows };
}

function viewMessages_(contactId) {
  return { contact_id: contactId || "", rows: contactId ? messagesOf_(contactId) : [] };
}
/* ===================== end of Chief of Staff additions ==================== */
