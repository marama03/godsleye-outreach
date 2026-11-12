// Shared data model. Four JSON files. No derived values stored. (R6)

export type CampaignStatus = "active" | "paused" | "done";

export interface Campaign {
  id: string; // cmp_<yyyymmdd>_<slug>
  name: string;
  icp_sentence: string;
  chain_id: string;
  chain_version: number;
  daily_cap: number;
  start_date: string; // YYYY-MM-DD
  created_at: string; // ISO UTC
  status: CampaignStatus;
}

export interface ChainStep {
  step: number; // 1..10
  offset_days: number;
  angle: string;
  template: string;
  variant_a: string;
  variant_b: string;
}

export interface Chain {
  steps: ChainStep[];
}

/** keyed by "<chain_id>@<version>" */
export type ChainsFile = Record<string, Chain>;

export type ReplyStatus = "none" | "replied" | "waiting_on_me";

export interface Lead {
  lead_id: string; // first 12 chars of sha256(linkedin_url)
  campaign_id: string;
  is_demo: boolean;
  name: string;
  title: string;
  company: string;
  linkedin_url: string;
  segment: string;
  invited_at: string | null;
  accepted_at: string | null;
  withdrawn_at: string | null;
  do_not_contact: boolean;
  dossier_path: string | null;
  reply_status: ReplyStatus;
}

export type EventKind =
  | "campaign_created"
  | "invite_sent"
  | "accepted"
  | "dossier_ready"
  | "sent"
  | "replied"
  | "skipped"
  | "not_a_fit"
  | "withdrawn"
  | "undo"
  | "correction";

export const EVENT_KINDS: EventKind[] = [
  "campaign_created",
  "invite_sent",
  "accepted",
  "dossier_ready",
  "sent",
  "replied",
  "skipped",
  "not_a_fit",
  "withdrawn",
  "undo",
  "correction",
];

export interface LedgerEvent {
  event_id: string;
  ts_utc: string; // ISO 8601 with Z
  campaign_id: string;
  lead_id: string | null;
  kind: EventKind;
  step: number | null;
  variant: "A" | "B" | null;
  body_hash: string | null;
  idempotency_key: string;
  corrects_event_id: string | null;
  payload: Record<string, unknown> | null;
}

export type Stage =
  | "found"
  | "invited"
  | "accepted"
  | "in_sequence"
  | "replied"
  | "booked"
  | "withdrawn";

/** Output of deriveLeadState. Never persisted. */
export interface LeadState {
  stage: Stage;
  current_step: number;
  next_due_date: string | null; // YYYY-MM-DD
  days_since_touch: number | null;
  waiting_on_me: boolean;
  variant_for_next: "A" | "B";
  /** convenience: whether the lead should ever appear in a queue */
  eligible: boolean;
  /** step that would be sent next (current_step + 1), or null if none */
  next_step: number | null;
  last_touch_ts: string | null;
  last_reply_ts: string | null;
}
