// Thin fetch wrapper. Only talks to /api on the same origin (proxied to 8787 in dev).
import type { Campaign, LedgerEvent, LeadState } from "../../../shared/types";

export interface Counters {
  invited: number;
  accepted: number;
  docs_ready: number;
  due_today: number;
}

export interface CampaignResponse {
  campaign: Campaign;
  chain_key: string;
  counters: Counters;
  today: string;
}

export interface ScoutRow {
  lead_id: string;
  name: string;
  title: string;
  company: string;
  segment: string;
  linkedin_url: string;
  proposed_variant: "A" | "B";
  invited: boolean;
  invited_at: string | null;
  stage: string;
}

export interface TodayCard {
  lead_id: string;
  name: string;
  title: string;
  company: string;
  segment: string;
  linkedin_url: string;
  dossier_path: string | null;
  step: number;
  total_steps: number;
  variant: "A" | "B";
  offset_days: number;
  angle: string;
  days_since_touch: number | null;
  due_date: string;
  body: string;
  stage: string;
}

export interface WaitingRow {
  lead_id: string;
  name: string;
  company: string;
  replied_at: string;
  days_waiting: number;
}

export interface TodayResponse {
  date: string;
  daily_cap: number;
  cards: TodayCard[];
  overflow_count: number;
  overflow_rolls_to: string | null;
  waiting_on_you: WaitingRow[];
  stale_replies: number;
  sent_this_week: number;
  next_due: string | null;
  all_clear: boolean;
}

export interface PersonRow {
  lead_id: string;
  name: string;
  title: string;
  company: string;
  segment: string;
  linkedin_url: string;
  invited_at: string | null;
  accepted_at: string | null;
  dossier_path: string | null;
}

export interface WorkdayResponse extends TodayResponse {
  to_invite: PersonRow[];
  awaiting: PersonRow[];
  researching: PersonRow[];
  invited_today: number;
  stale_invites: (PersonRow & { days_invited: number })[];
  scorecard: Record<"7" | "14" | "30" | "all", { invited: number; accepted: number; messaged: number; replied: number; booked: number }>;
  campaign: { id: string; name: string; icp_sentence: string };
}

export interface SheetVariant { Variant: string; Stage: string; Body: string }
export interface SheetDueRow {
  "Contact ID": string;
  "Full Name": string;
  Title?: string;
  Company?: string;
  "LinkedIn URL"?: string;
  "Dossier URL"?: string;
  "Hook Theme"?: string;
  Stage: "to_send" | "day4" | "day10";
  "Next Due"?: string;
  Variants: SheetVariant[];
}
export interface SheetActResult {
  ok: boolean;
  conflict?: boolean;
  idempotent?: boolean;
  error?: string;
  stage?: string;
  row?: Record<string, string>;
}

export type LedgerEventRow = LedgerEvent & { lead_name: string };
export type LedgerLeadRow = LeadState & { lead_id: string; name: string; company: string; title: string; linkedin_url: string; dossier_path: string | null; do_not_contact: boolean };

export interface LedgerResponse {
  events: LedgerEventRow[];
  leads: LedgerLeadRow[];
  total_events: number;
}

export interface ChainSummary {
  key: string;
  chain_id: string;
  version: number;
  steps: number;
  offsets: number[];
}

async function j<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* noop */
  }
  if (!res.ok) {
    const e: any = new Error(data?.error ?? `${res.status} ${res.statusText}`);
    e.code = data?.code;
    e.campaign = data?.campaign;
    throw e;
  }
  return data as T;
}

export const api = {
  health: () => fetch("/api/health").then(j<{ ok: boolean; campaign_count: number; lead_count: number; event_count: number }>),
  chains: () => fetch("/api/chains").then(j<ChainSummary[]>),
  campaigns: () => fetch("/api/campaigns").then(j<Campaign[]>),
  campaign: (id: string) => fetch(`/api/campaigns/${encodeURIComponent(id)}`).then(j<CampaignResponse>),
  createCampaign: (body: {
    name: string;
    icp_sentence: string;
    chain_id: string;
    chain_version: number;
    daily_cap: number;
    start_date: string;
  }) =>
    fetch("/api/campaigns", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(
      j<{ campaign: Campaign; event: LedgerEvent }>,
    ),
  sheetSync: (campaign_id: string) =>
    fetch("/api/sheet/sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ campaign_id }) }).then(
      j<{ rows: number; created: number; invited: number; accepted: number; dossiers: number; queued: number }>,
    ),
  sheetToday: (date?: string) =>
    fetch(`/api/sheet/today${date ? `?date=${encodeURIComponent(date)}` : ""}`).then(j<{ date: string; count: number; rows: SheetDueRow[] }>),
  sheetAct: (body: { action: "mark_sent" | "undo" | "skip" | "replied"; contact_id: string; expect_stage: string; request_id: string; variant?: string }) =>
    fetch("/api/sheet/act", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(j<SheetActResult>),
  /** Store a user-edited option: the bridge hashes the body and returns its id, which mark_sent then names. */
  sheetStoreVariant: (body: { contact_id: string; stage: string; slot: number; text: string }) =>
    fetch("/api/sheet/act", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "variants", contact_id: body.contact_id, stage: body.stage, variants: [{ slot: body.slot, body: body.text, stage: body.stage }] }),
    }).then(j<{ ok: boolean; error?: string; variants?: string[] }>),
  setTarget: (id: string, daily_cap: number) =>
    fetch(`/api/campaigns/${encodeURIComponent(id)}/target`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ daily_cap }) }).then(j<{ ok: boolean; daily_cap: number }>),
  deleteCampaign: (id: string, confirm: string) =>
    fetch(`/api/campaigns/${encodeURIComponent(id)}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm }) }).then(j<{ ok: boolean; removed: { campaign: string; leads: number; events: number } }>),
  loadDemo: () => fetch("/api/demo", { method: "POST" }).then(j<{ created: boolean; campaign_id: string }>),
  resetDemo: () => fetch("/api/demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reset: true }) }).then(j<{ created: boolean; campaign_id: string }>),
  config: () => fetch("/api/config").then(j<{ connected: boolean; sheet_url: string | null; sheet_title: string | null; connected_at: string | null; last_synced_at: string | null }>),
  setSheetUrl: (sheet_url: string) =>
    fetch("/api/config", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sheet_url }) }).then(j<{ ok: boolean; connected: boolean }>),
  sheetStatus: () => fetch("/api/sheet/status").then(j<{ configured: boolean }>),
  scout: (campaign: string) =>
    fetch(`/api/scout?campaign=${encodeURIComponent(campaign)}`).then(j<{ campaign_id: string; icp_sentence: string; rows: ScoutRow[] }>),
  workday: (campaign: string, date?: string) => fetch(`/api/workday?campaign=${encodeURIComponent(campaign)}${date ? `&date=${encodeURIComponent(date)}` : ""}`).then(j<WorkdayResponse>),
  today: (campaign: string) => fetch(`/api/today?campaign=${encodeURIComponent(campaign)}`).then(j<TodayResponse>),
  ledger: (campaign: string, limit = 50) =>
    fetch(`/api/ledger?campaign=${encodeURIComponent(campaign)}&limit=${limit}`).then(j<LedgerResponse>),
  postEvent: (body: {
    campaign_id: string;
    lead_id: string;
    kind: string;
    step?: number;
    body_text?: string;
    payload?: Record<string, unknown>;
    idempotency_key: string;
  }) =>
    fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(
      j<{ duplicate: boolean; event?: LedgerEvent; existing_event_id?: string }>,
    ),
  undo: (eventId: string) =>
    fetch(`/api/undo/${encodeURIComponent(eventId)}`, { method: "POST" }).then(j<{ duplicate: boolean; event?: LedgerEvent }>),
  dossierUrl: (path: string) => (/^https?:\/\//.test(path) ? path : `/api/dossier?path=${encodeURIComponent(path)}`),
};

/** Fresh idempotency key per user intent (generated once per tap, reused on retry). */
export function newIdempotencyKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return "idk_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function shortHash(s: string | null | undefined, n = 8): string {
  return s ? s.slice(0, n) : "—";
}

export function fmtLocal(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function fmtWeekdayDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 12).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}
