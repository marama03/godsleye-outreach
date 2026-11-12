import { promises as fs } from "node:fs";
// Express API. All JSON. No PUT/PATCH/DELETE on events, ever (R2).
import express, { type Request, type Response, type NextFunction } from "express";
import path from "node:path";
import { existsSync } from "node:fs";
import {
  loadDb,
  DATA_DIR,
  loadConfig,
  saveConfig,
  withLock,
  saveCampaigns,
  saveEvents,
  saveLeads,
  touchedPaths,
  readDossier,
  PROJECT_ROOT,
} from "./store.js";
import { sheetConfigured, syncFromSheet, pushLeadToSheet, bridgeToday, bridgeAct } from "./sheet.js";
import { counters, todayQueue, scoutRows, ledger, chainKey, chainFor, workday } from "./queries.js";
import { registerLive } from "./live.js";
import { seedDemo, resetDemo } from "./demo.js";
import { refuseReason, undoRefusal } from "./rules.js";
import { todayYmd } from "../shared/dates.js";
import { campaignIdFor, newEventId, sha256Hex, variantFor } from "../shared/hash.js";
import { EVENT_KINDS, type Campaign, type EventKind, type LedgerEvent } from "../shared/types.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<i>$1</i>");

/** A small, safe markdown-to-HTML for dossiers: headings, bullets, bold, italics, paragraphs. */
function dossierPage(md: string): string {
  const out: string[] = [];
  let list = false;
  const closeList = () => { if (list) { out.push("</ul>"); list = false; } };
  for (const raw of md.split("\n")) {
    const line = raw.trimEnd();
    if (/^#{1,3} /.test(line)) { closeList(); const lvl = line.match(/^#+/)![0].length; out.push(`<h${lvl}>${inline(line.replace(/^#+ /, ""))}</h${lvl}>`); }
    else if (/^[-*] /.test(line)) { if (!list) { out.push("<ul>"); list = true; } out.push(`<li>${inline(line.slice(2))}</li>`); }
    else if (line === "") closeList();
    else { closeList(); out.push(`<p>${inline(line)}</p>`); }
  }
  closeList();
  const title = esc((md.split("\n").find((l) => l.startsWith("#")) ?? "Dossier").replace(/^#+ /, ""));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font:16px/1.55 system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;color:#1c1917}h1{font-size:1.6rem}h2{font-size:1.1rem;margin-top:1.6rem;border-bottom:1px solid #e7e5e4;padding-bottom:.2rem}li{margin:.25rem 0}</style></head><body>${out.join("\n")}</body></html>`;
}

function bad(res: Response, msg: string, code = 400) {
  return res.status(code).json({ error: msg });
}

function asyncRoute(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
}

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "256kb" }));
  registerLive(app);

  // Block any mutation verb on events, explicitly, so the ledger is append-only by construction.
  app.all(["/api/events", "/api/events/*"], (req, res, next) => {
    if (["PUT", "PATCH", "DELETE"].includes(req.method)) {
      return res.status(405).json({ error: "events are append-only (R2)" });
    }
    next();
  });

  app.get("/api/health", asyncRoute(async (_req, res) => {
    const db = await loadDb();
    res.json({
      ok: true,
      campaign_count: db.campaigns.length,
      lead_count: db.leads.length,
      event_count: db.events.length,
    });
  }));

  app.get("/api/chains", asyncRoute(async (_req, res) => {
    const db = await loadDb();
    res.json(
      Object.entries(db.chains).map(([key, ch]) => ({
        key,
        chain_id: key.split("@")[0],
        version: Number(key.split("@")[1]),
        steps: ch.steps.length,
        offsets: ch.steps.map((s) => s.offset_days),
      })),
    );
  }));

  app.get("/api/campaigns", asyncRoute(async (_req, res) => {
    const db = await loadDb();
    res.json(db.campaigns);
  }));

  app.post("/api/campaigns", asyncRoute(async (req, res) => {
    const b = req.body ?? {};
    const name = String(b.name ?? "").trim();
    const icp_sentence = String(b.icp_sentence ?? "").trim();
    const chain_id = String(b.chain_id ?? "").trim();
    const chain_version = Number(b.chain_version);
    const daily_cap = Number(b.daily_cap ?? 10);
    const start_date = String(b.start_date ?? todayYmd());
    if (!name) return bad(res, "name required");
    if (!icp_sentence || icp_sentence.length > 200) return bad(res, "icp_sentence required, max 200 chars");
    if (!chain_id || !Number.isInteger(chain_version)) return bad(res, "chain_id and chain_version required");
    if (!Number.isInteger(daily_cap) || daily_cap < 1) return bad(res, "daily_cap must be a positive integer");
    if (!DATE_RE.test(start_date)) return bad(res, "start_date must be YYYY-MM-DD");

    const out = await withLock(async () => {
      const db = await loadDb();
      if (!db.chains[`${chain_id}@${chain_version}`]) throw Object.assign(new Error("unknown chain"), { status: 400 });
      let id = campaignIdFor(name);
      if (db.campaigns.some((c) => c.id === id)) id = `${id}-${db.campaigns.length + 1}`;
      const now = new Date().toISOString();
      const campaign: Campaign = {
        id,
        name,
        icp_sentence,
        chain_id,
        chain_version,
        daily_cap,
        start_date,
        created_at: now,
        status: "active",
      };
      const evt: LedgerEvent = {
        event_id: newEventId(),
        ts_utc: now,
        campaign_id: id,
        lead_id: null,
        kind: "campaign_created",
        step: null,
        variant: null,
        body_hash: null,
        idempotency_key: `idk_campaign_${id}`,
        corrects_event_id: null,
        payload: { name, chain: `${chain_id}@${chain_version}`, daily_cap, start_date },
      };
      db.campaigns.push(campaign);
      db.events.push(evt);
      await saveCampaigns(db.campaigns);
      await saveEvents(db.events);
      return { campaign, event: evt };
    });
    res.status(201).json(out);
  }));

  // Delete a campaign with everything in it (its leads and events). A copy is kept in data/deleted/ so it can be restored.
  app.delete("/api/campaigns/:id", asyncRoute(async (req, res) => {
    const id = String(req.params.id);
    const confirm = String(req.body?.confirm ?? "");
    const out = await withLock(async () => {
      const db = await loadDb();
      const c = db.campaigns.find((x) => x.id === id);
      if (!c) return { status: 404, body: { error: "campaign not found" } };
      if (confirm.trim() !== c.name) return { status: 400, body: { error: "type the campaign name exactly to confirm" } };
      const leads = db.leads.filter((l) => l.campaign_id === id);
      const events = db.events.filter((e) => e.campaign_id === id);
      const dir = path.join(DATA_DIR, "deleted");
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, `${id}-${Date.now()}.json`), JSON.stringify({ campaign: c, leads, events }, null, 2));
      await saveCampaigns(db.campaigns.filter((x) => x.id !== id));
      await saveLeads(db.leads.filter((l) => l.campaign_id !== id));
      await saveEvents(db.events.filter((e) => e.campaign_id !== id));
      return { status: 200, body: { ok: true, removed: { campaign: c.name, leads: leads.length, events: events.length } } };
    });
    res.status(out.status).json(out.body);
  }));

  app.post("/api/demo", asyncRoute(async (req, res) => {
    if (req.body?.reset === true) {
      const r = await withLock(() => resetDemo());
      return res.status(201).json({ created: true, reset: true, ...r });
    }
    const r = await withLock(() => seedDemo());
    res.status(r.created ? 201 : 200).json(r);
  }));

  app.get("/api/campaigns/:id", asyncRoute(async (req, res) => {
    const db = await loadDb();
    const c = db.campaigns.find((x) => x.id === req.params.id);
    if (!c) return bad(res, "campaign not found", 404);
    const today = String(req.query.date ?? todayYmd());
    res.json({ campaign: c, chain_key: chainKey(c), counters: counters(db, c, today), today });
  }));

  app.get("/api/scout", asyncRoute(async (req, res) => {
    const db = await loadDb();
    const c = db.campaigns.find((x) => x.id === String(req.query.campaign ?? ""));
    if (!c) return bad(res, "campaign not found", 404);
    const today = String(req.query.date ?? todayYmd());
    res.json({ campaign_id: c.id, icp_sentence: c.icp_sentence, rows: scoutRows(db, c, today) });
  }));

  app.post("/api/events", asyncRoute(async (req, res) => {
    const b = req.body ?? {};
    const campaign_id = String(b.campaign_id ?? "");
    const lead_id = b.lead_id == null ? null : String(b.lead_id);
    const kind = String(b.kind ?? "") as EventKind;
    const idempotency_key = String(b.idempotency_key ?? "").trim();
    const step = b.step == null ? null : Number(b.step);
    const body_text = b.body_text == null ? null : String(b.body_text);
    const payload = b.payload && typeof b.payload === "object" ? b.payload : null;

    if (!idempotency_key) return bad(res, "idempotency_key required");
    if (!EVENT_KINDS.includes(kind)) return bad(res, `kind must be one of ${EVENT_KINDS.join("|")}`);
    if (kind === "undo") return bad(res, "use POST /api/undo/:event_id");
    if (kind === "campaign_created") return bad(res, "use POST /api/campaigns");
    if (!lead_id) return bad(res, "lead_id required");
    if (step !== null && (!Number.isInteger(step) || step < 1 || step > 10)) return bad(res, "step must be 1..10");

    const out = await withLock(async () => {
      const db = await loadDb();
      const dup = db.events.find((e) => e.idempotency_key === idempotency_key);
      if (dup) return { status: 200, body: { duplicate: true, existing_event_id: dup.event_id } };

      const c = db.campaigns.find((x) => x.id === campaign_id);
      if (!c) return { status: 404, body: { error: "campaign not found" } };
      const lead = db.leads.find((l) => l.lead_id === lead_id && l.campaign_id === campaign_id);
      if (!lead) return { status: 404, body: { error: "lead not found in campaign" } };

      const refusal = refuseReason(lead, chainFor(db, c), db.events.filter((e) => e.lead_id === lead_id), kind, step, payload);
      if (refusal) return { status: 400, body: { error: refusal } };

      const now = new Date().toISOString();
      const evt: LedgerEvent = {
        event_id: newEventId(),
        ts_utc: now,
        campaign_id,
        lead_id,
        kind,
        step: kind === "sent" || kind === "skipped" ? step : step,
        variant: kind === "sent" || kind === "skipped" ? variantFor(lead_id) : null,
        body_hash: body_text != null ? sha256Hex(body_text) : null,
        idempotency_key,
        corrects_event_id: b.corrects_event_id ? String(b.corrects_event_id) : null,
        payload,
      };
      db.events.push(evt);

      // Lead facts (not derived state) that the event establishes:
      let leadsDirty = false;
      if (kind === "invite_sent" && !lead.invited_at) { lead.invited_at = now; leadsDirty = true; }
      if (kind === "accepted" && !lead.accepted_at) {
        lead.accepted_at = now;
        if (!lead.invited_at) lead.invited_at = now;
        leadsDirty = true;
      }
      if (kind === "withdrawn" && !lead.withdrawn_at) { lead.withdrawn_at = now; leadsDirty = true; }
      if (kind === "not_a_fit") { lead.do_not_contact = true; leadsDirty = true; }
      if (kind === "replied" && lead.reply_status !== "waiting_on_me") { lead.reply_status = "waiting_on_me"; leadsDirty = true; }
      if (kind === "sent" && lead.reply_status === "waiting_on_me") { lead.reply_status = "replied"; leadsDirty = true; }

      await saveEvents(db.events);
      if (leadsDirty) await saveLeads(db.leads);
      if (leadsDirty && (kind === "invite_sent" || kind === "accepted")) void pushLeadToSheet(lead, kind === "accepted" ? { "Research Status": "queued" } : {});
      return { status: 201, body: { duplicate: false, event: evt } };
    });
    res.status(out.status).json(out.body);
  }));

  app.post("/api/undo/:event_id", asyncRoute(async (req, res) => {
    const target = req.params.event_id;
    const out = await withLock(async () => {
      const db = await loadDb();
      const orig = db.events.find((e) => e.event_id === target);
      if (!orig) return { status: 404, body: { error: "event not found" } };
      if (orig.kind === "undo" || orig.kind === "campaign_created") return { status: 400, body: { error: `cannot undo a ${orig.kind} event` } };
      const key = `idk_undo_${target}`;
      const dup = db.events.find((e) => e.idempotency_key === key);
      if (dup) return { status: 200, body: { duplicate: true, existing_event_id: dup.event_id } };
      const undoBlock = undoRefusal(orig, db.events.filter((e) => e.lead_id === orig.lead_id));
      if (undoBlock) return { status: 400, body: { error: undoBlock } };
      const now = new Date().toISOString();
      const evt: LedgerEvent = {
        event_id: newEventId(),
        ts_utc: now,
        campaign_id: orig.campaign_id,
        lead_id: orig.lead_id,
        kind: "undo",
        step: orig.step,
        variant: orig.variant,
        body_hash: null,
        idempotency_key: key,
        corrects_event_id: target,
        payload: { undid_kind: orig.kind },
      };
      db.events.push(evt);

      // Reverse lead facts the original established, if nothing else re-established them.
      const lead = db.leads.find((l) => l.lead_id === orig.lead_id);
      let leadsDirty = false;
      if (lead) {
        const others = db.events.filter((e) => e.lead_id === lead.lead_id && e.event_id !== target && e.kind === orig.kind);
        if (orig.kind === "invite_sent" && others.length === 0 && !lead.accepted_at) { lead.invited_at = null; leadsDirty = true; }
        if (orig.kind === "accepted" && others.length === 0) { lead.accepted_at = null; leadsDirty = true; }
        if (orig.kind === "withdrawn" && others.length === 0) { lead.withdrawn_at = null; leadsDirty = true; }
        if (orig.kind === "not_a_fit" && others.length === 0) { lead.do_not_contact = false; leadsDirty = true; }
        if (orig.kind === "replied" && others.length === 0) { lead.reply_status = "none"; leadsDirty = true; }
      }
      await saveEvents(db.events);
      if (leadsDirty) await saveLeads(db.leads);
      return { status: 201, body: { duplicate: false, event: evt } };
    });
    res.status(out.status).json(out.body);
  }));

  app.get("/api/today", asyncRoute(async (req, res) => {
    const db = await loadDb();
    const c = db.campaigns.find((x) => x.id === String(req.query.campaign ?? ""));
    if (!c) return bad(res, "campaign not found", 404);
    const date = String(req.query.date ?? todayYmd());
    if (!DATE_RE.test(date)) return bad(res, "date must be YYYY-MM-DD");
    res.json(todayQueue(db, c, date));
  }));

  app.get("/api/workday", asyncRoute(async (req, res) => {
    const db = await loadDb();
    const c = db.campaigns.find((x) => x.id === String(req.query.campaign ?? ""));
    if (!c) return bad(res, "campaign not found", 404);
    const date = String(req.query.date ?? todayYmd());
    if (!DATE_RE.test(date)) return bad(res, "date must be YYYY-MM-DD");
    res.json(workday(db, c, date));
  }));

  app.get("/api/ledger", asyncRoute(async (req, res) => {
    const db = await loadDb();
    const c = db.campaigns.find((x) => x.id === String(req.query.campaign ?? ""));
    if (!c) return bad(res, "campaign not found", 404);
    const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 50) || 50));
    const today = String(req.query.date ?? todayYmd());
    res.json(ledger(db, c, today, limit));
  }));

  app.get("/api/dossier", asyncRoute(async (req, res) => {
    const rel = String(req.query.path ?? "");
    const md = await readDossier(rel);
    if (md == null) return bad(res, "dossier not found", 404);
    // A browser opening the link gets a readable page; anything else (an agent) gets the raw markdown.
    if (String(req.headers.accept ?? "").includes("text/html")) return res.type("html").send(dossierPage(md));
    res.type("text/markdown; charset=utf-8").send(md);
  }));

  // Which sheet is this dashboard paired with? An agent keeps data/config.json; the owner may also paste the link here.
  app.get("/api/config", asyncRoute(async (_req, res) => {
    const c = await loadConfig();
    res.json({ connected: !!c.sheet_url, sheet_url: c.sheet_url ?? null, sheet_title: c.sheet_title ?? null, connected_at: c.connected_at ?? null, last_synced_at: c.last_synced_at ?? null });
  }));

  app.post("/api/config", asyncRoute(async (req, res) => {
    const url = String(req.body?.sheet_url ?? "").trim();
    if (url === "") {
      await withLock(async () => { const c = await loadConfig(); delete c.sheet_url; delete c.sheet_title; delete c.connected_at; delete c.last_synced_at; await saveConfig(c); });
      return res.json({ ok: true, connected: false });
    }
    if (!/^https:\/\/docs\.google\.com\/spreadsheets\/d\/[A-Za-z0-9_-]{20,}/.test(url)) return bad(res, "that does not look like a Google Sheets link (https://docs.google.com/spreadsheets/d/...)");
    const title = String(req.body?.sheet_title ?? "").trim().slice(0, 120);
    await withLock(async () => {
      const c = await loadConfig();
      const changed = c.sheet_url !== url;
      c.sheet_url = url;
      if (title) c.sheet_title = title;
      if (changed) { c.connected_at = new Date().toISOString(); delete c.last_synced_at; }
      await saveConfig(c);
    });
    res.json({ ok: true, connected: true });
  }));

  app.get("/api/sheet/status", (_req, res) => {
    res.json({ configured: sheetConfigured() });
  });

  // Send-tracking: the sheet is the source of truth for Messages due. The server only relays.
  app.get("/api/sheet/today", asyncRoute(async (req, res) => {
    if (!sheetConfigured()) return bad(res, "sheet bridge not configured", 409);
    const date = req.query.date ? String(req.query.date) : undefined;
    if (date && !DATE_RE.test(date)) return bad(res, "date must be YYYY-MM-DD");
    res.json(await bridgeToday(date));
  }));

  app.post("/api/sheet/act", asyncRoute(async (req, res) => {
    if (!sheetConfigured()) return bad(res, "sheet bridge not configured", 409);
    const b = req.body ?? {};
    if (!b.contact_id || !b.request_id && b.action !== "variants") return bad(res, "contact_id and request_id required");
    res.json(await bridgeAct(b));
  }));

  app.post("/api/sheet/sync", asyncRoute(async (req, res) => {
    if (!sheetConfigured()) return bad(res, "sheet bridge not configured (set SHEET_BRIDGE_URL and SHEET_BRIDGE_TOKEN)", 409);
    const campaign = String(req.body?.campaign_id ?? req.query.campaign ?? "");
    if (!campaign) return bad(res, "campaign_id required");
    res.json(await syncFromSheet(campaign));
  }));

  app.get("/api/touched", (_req, res) => {
    res.json({ project_root: PROJECT_ROOT, paths: touchedPaths() });
  });

  // Serve the built web bundle if present (npm run build && npm start).
  const dist = path.join(PROJECT_ROOT, "web", "dist");
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api/")) return next();
      res.sendFile(path.join(dist, "index.html"));
    });
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err?.status ?? 500;
    res.status(status).json({ error: err?.message ?? "internal error", ...(err?.code === "chain_missing" ? { code: "chain_missing" } : {}) });
  });

  return app;
}
