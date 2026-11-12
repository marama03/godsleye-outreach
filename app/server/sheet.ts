// Google Sheet bridge client. The sheet (via an Apps Script web app, see sheet/Code.gs) is the shared
// surface with the hosted monitor agent and the research agent. Entirely optional: with
// SHEET_BRIDGE_URL unset the app behaves exactly as before and makes no network calls.
import { leadIdFor, newEventId } from "../shared/hash.js";
import type { Lead, LedgerEvent } from "../shared/types.js";
import { loadDb, saveEvents, saveLeads, withLock } from "./store.js";

export interface SheetRow {
  "Contact ID"?: string;
  "Full Name"?: string;
  Title?: string;
  Company?: string;
  "LinkedIn URL"?: string;
  Segment?: string;
  Campaign?: string;
  Invited?: string;
  "Invited At"?: string;
  "Accepted?"?: string;
  "Accepted At"?: string;
  "Research Status"?: string;
  "Dossier URL"?: string;
  "Hook Theme"?: string;
  Notes?: string;
  [k: string]: unknown;
}

export function sheetConfigured(): boolean {
  return !!process.env.SHEET_BRIDGE_URL && !!process.env.SHEET_BRIDGE_TOKEN;
}

async function bridgeGet(): Promise<SheetRow[]> {
  const url = new URL(process.env.SHEET_BRIDGE_URL!);
  url.searchParams.set("token", process.env.SHEET_BRIDGE_TOKEN!);
  const res = await fetch(url, { redirect: "follow" });
  const j: any = await parseBridge(res);
  if (j.error) throw Object.assign(new Error(`sheet bridge: ${j.error}`), { status: 502 });
  return j.rows as SheetRow[];
}

async function bridgePost(action: "append" | "update", rows: SheetRow[]): Promise<void> {
  const res = await fetch(process.env.SHEET_BRIDGE_URL!, {
    method: "POST",
    redirect: "follow",
    headers: { "content-type": "text/plain" }, // text/plain avoids a CORS preflight on Apps Script
    body: JSON.stringify({ token: process.env.SHEET_BRIDGE_TOKEN, action, rows }),
  });
  const j: any = await parseBridge(res);
  if (j.error || j.ok === false) throw Object.assign(new Error(`sheet bridge: ${j.error ?? "request failed"}`), { status: 502 });
  if (Array.isArray(j.skipped) && j.skipped.length) console.warn("[sheet] bridge skipped rows (no match / unknown columns):", j.skipped.join(", "));
}

/** Apps Script returns an HTML error page on a hard failure; surface that as a clear error, not a JSON parse crash. */
async function parseBridge(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw Object.assign(new Error(`sheet bridge returned non-JSON (HTTP ${res.status}). Check the web app deployment is set to "Anyone" and the URL ends in /exec.`), { status: 502 });
  }
}

const yes = (v: unknown) => String(v ?? "").trim().toLowerCase() === "yes";
const iso = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export interface SyncResult {
  rows: number;
  created: number;
  invited: number;
  accepted: number;
  dossiers: number;
  queued: number;
}

/** Pull the sheet into the ledger. Idempotent: every event carries a deterministic key. */
export async function syncFromSheet(campaignId: string, rowsOverride?: SheetRow[]): Promise<SyncResult> {
  const rows = rowsOverride ?? (await bridgeGet());
  return withLock(async () => {
    const db = await loadDb();
    if (!db.campaigns.some((c) => c.id === campaignId)) throw Object.assign(new Error("campaign not found"), { status: 404 });
    const out: SyncResult = { rows: rows.length, created: 0, invited: 0, accepted: 0, dossiers: 0, queued: 0 };
    let leadsDirty = false;
    let eventsDirty = false;
    const keys = new Set(db.events.map((e) => e.idempotency_key));

    const emit = (lead: Lead, kind: LedgerEvent["kind"], ts: string, payload: Record<string, unknown>) => {
      const key = `idk_sheet_${kind}_${lead.lead_id}`;
      if (keys.has(key)) return false;
      keys.add(key);
      db.events.push({
        event_id: newEventId(), ts_utc: ts, campaign_id: campaignId, lead_id: lead.lead_id, kind,
        step: null, variant: null, body_hash: null, idempotency_key: key, corrects_event_id: null,
        payload: { source: "sheet", ...payload },
      });
      eventsDirty = true;
      return true;
    };

    for (const r of rows) {
      const url = String(r["LinkedIn URL"] ?? "").trim();
      if (!url) continue;
      const id = leadIdFor(url);
      let lead = db.leads.find((l) => l.lead_id === id && l.campaign_id === campaignId);
      if (!lead) {
        lead = {
          lead_id: id, campaign_id: campaignId, is_demo: false,
          name: String(r["Full Name"] ?? "").trim() || url,
          title: String(r.Title ?? ""), company: String(r.Company ?? ""), linkedin_url: url,
          segment: String(r.Segment ?? ""), invited_at: null, accepted_at: null, withdrawn_at: null,
          do_not_contact: false, dossier_path: null, reply_status: "none",
        };
        db.leads.push(lead);
        out.created++;
        leadsDirty = true;
      }
      if (yes(r.Invited) && !lead.invited_at) {
        lead.invited_at = iso(r["Invited At"]) ?? new Date().toISOString();
        if (emit(lead, "invite_sent", lead.invited_at, {})) out.invited++;
        leadsDirty = true;
      }
      if (yes(r["Accepted?"]) && !lead.accepted_at) {
        lead.accepted_at = iso(r["Accepted At"]) ?? new Date().toISOString();
        if (!lead.invited_at) lead.invited_at = lead.accepted_at;
        if (emit(lead, "accepted", lead.accepted_at, {})) out.accepted++;
        leadsDirty = true;
      }
      const status = String(r["Research Status"] ?? "").trim();
      if (status === "queued" || status === "dispatched" || status === "researching") out.queued++;
      const dossier = String(r["Dossier URL"] ?? "").trim();
      if (status === "ready" && dossier && lead.dossier_path !== dossier) {
        lead.dossier_path = dossier;
        if (emit(lead, "dossier_ready", new Date().toISOString(), { hook: String(r["Hook Theme"] ?? "") })) out.dossiers++;
        leadsDirty = true;
      }
    }
    if (eventsDirty) await saveEvents(db.events);
    if (leadsDirty) await saveLeads(db.leads);
    return out;
  });
}

/** Best-effort push of one lead's facts back to the sheet. Never throws into a request. */
export async function pushLeadToSheet(lead: Lead, extra: SheetRow = {}): Promise<void> {
  if (!sheetConfigured()) return;
  try {
    const row: SheetRow = {
      "Contact ID": lead.lead_id, "Full Name": lead.name, Title: lead.title, Company: lead.company,
      "LinkedIn URL": lead.linkedin_url, Segment: lead.segment, ...extra,
    };
    if (lead.invited_at) { row.Invited = "Yes"; row["Invited At"] = lead.invited_at; }
    if (lead.accepted_at) { row["Accepted?"] = "Yes"; row["Accepted At"] = lead.accepted_at; }
    await bridgePost("update", [row]);
  } catch (err) {
    console.warn("[sheet] push failed:", (err as Error).message);
  }
}

export async function appendProspects(rows: SheetRow[]): Promise<void> {
  await bridgePost("append", rows);
}

// ---- send-tracking contract (Today screen): the sheet owns Stage / Next Due / Variant ----
export interface SheetVariant { Variant: string; Stage: string; Body: string }
export interface SheetTodayRow extends SheetRow {
  Stage?: string;
  "Next Due"?: string;
  Variants?: SheetVariant[];
}

export async function bridgeToday(date?: string): Promise<{ date: string; count: number; rows: SheetTodayRow[] }> {
  const url = new URL(process.env.SHEET_BRIDGE_URL!);
  url.searchParams.set("token", process.env.SHEET_BRIDGE_TOKEN!);
  url.searchParams.set("view", "today");
  if (date) url.searchParams.set("date", date);
  const res = await fetch(url, { redirect: "follow" });
  const j: any = await parseBridge(res);
  if (j.error) throw Object.assign(new Error(`sheet bridge: ${j.error}`), { status: 502 });
  return j;
}

const ACTIONS = new Set(["mark_sent", "undo", "skip", "replied", "variants"]);
/** Pass a send-tracking action through. Conflicts come back as normal JSON (ok:false, conflict:true), never thrown. */
export async function bridgeAct(payload: Record<string, unknown>): Promise<any> {
  if (!ACTIONS.has(String(payload.action))) throw Object.assign(new Error("bad_action"), { status: 400 });
  const res = await fetch(process.env.SHEET_BRIDGE_URL!, {
    method: "POST",
    redirect: "follow",
    headers: { "content-type": "text/plain" },
    body: JSON.stringify({ ...payload, token: process.env.SHEET_BRIDGE_TOKEN }),
  });
  return parseBridge(res);
}
