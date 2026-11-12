// Read-side queries. Everything here is computed from the four ledgers at request time (R6).
import type { Db } from "./store.js";
import type { Campaign, Chain, Lead, LeadState, LedgerEvent } from "../shared/types.js";
import { deriveLeadState, liveEvents, renderBody } from "../shared/derive.js";
import { diffDays, nextWeekdayAfter, addDays, ymdFromIso } from "../shared/dates.js";

export function chainKey(c: Campaign): string {
  return `${c.chain_id}@${c.chain_version}`;
}

/** A campaign whose message chain is not installed in this copy. Answered as 409, and the screens say so instead of failing. */
export class ChainMissingError extends Error {
  status = 409;
  code = "chain_missing";
  campaign?: { id: string; name: string };
  constructor(key: string, campaign?: { id: string; name: string }) {
    super(`This campaign uses the message chain ${key}, which is not installed in this copy of the dashboard.`);
    this.campaign = campaign;
  }
}

export function chainFor(db: Db, c: Campaign): Chain {
  const ch = db.chains[chainKey(c)];
  if (!ch) throw new ChainMissingError(chainKey(c), { id: c.id, name: c.name });
  return ch;
}

export function campaignLeads(db: Db, campaignId: string): Lead[] {
  return db.leads.filter((l) => l.campaign_id === campaignId);
}

export function campaignEvents(db: Db, campaignId: string): LedgerEvent[] {
  return db.events.filter((e) => e.campaign_id === campaignId);
}

export interface LeadWithState {
  lead: Lead;
  state: LeadState;
}

export function statesFor(db: Db, c: Campaign, today: string): LeadWithState[] {
  const chain = chainFor(db, c);
  const evs = campaignEvents(db, c.id);
  return campaignLeads(db, c.id).map((lead) => ({
    lead,
    state: deriveLeadState(lead, chain, evs, today),
  }));
}

// ---------- counters ----------
export function counters(db: Db, c: Campaign, today: string) {
  const rows = statesFor(db, c, today);
  const live = liveEvents(campaignEvents(db, c.id));
  const invited = rows.filter((r) => r.lead.invited_at || live.some((e) => e.lead_id === r.lead.lead_id && e.kind === "invite_sent")).length;
  const accepted = rows.filter((r) => r.lead.accepted_at || live.some((e) => e.lead_id === r.lead.lead_id && e.kind === "accepted")).length;
  const docs_ready = rows.filter((r) => !!r.lead.dossier_path).length;
  const noDossier = new Set(rows.filter((r) => r.state.stage === "accepted" && !r.lead.dossier_path && !r.lead.do_not_contact).map((r) => r.lead.lead_id));
  const due_today = todayQueue(db, c, today).cards.filter((x) => !noDossier.has(x.lead_id)).length; // same rule as workday(): researching people are not due yet
  return { invited, accepted, docs_ready, due_today };
}

// ---------- today ----------
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

export interface TodayResult {
  date: string;
  daily_cap: number;
  cards: TodayCard[];
  overflow_count: number;
  overflow_rolls_to: string | null;
  waiting_on_you: WaitingRow[];
  stale_replies: number; // waiting 3+ days
  sent_this_week: number;
  next_due: string | null; // after today, when nothing is due today
  all_clear: boolean;
}

function weekStart(today: string): string {
  // Monday-start week
  const d = new Date(today + "T12:00:00");
  const dow = d.getDay(); // 0 Sun
  const back = dow === 0 ? 6 : dow - 1;
  return addDays(today, -back);
}

export function todayQueue(db: Db, c: Campaign, today: string): TodayResult {
  const chain = chainFor(db, c);
  const rows = statesFor(db, c, today);

  // R7 first: do_not_contact never enters any queue.
  const contactable = rows.filter((r) => !r.lead.do_not_contact);

  // R9: replied -> not in Today, surfaces in Waiting strip.
  const waiting_on_you: WaitingRow[] = contactable
    .filter((r) => r.state.waiting_on_me && r.state.last_reply_ts)
    .map((r) => ({
      lead_id: r.lead.lead_id,
      name: r.lead.name,
      company: r.lead.company,
      replied_at: r.state.last_reply_ts!,
      days_waiting: diffDays(ymdFromIso(r.state.last_reply_ts!), today),
    }))
    .sort((a, b) => b.days_waiting - a.days_waiting);

  const stale_replies = waiting_on_you.filter((w) => w.days_waiting >= 3).length;

  // Due = eligible, has a next step, and next_due_date <= today (overdue counts as due).
  const due = contactable
    .filter((r) => r.state.eligible && r.state.next_step !== null && r.state.next_due_date !== null && r.state.next_due_date <= today)
    .sort((a, b) => {
      const da = a.state.days_since_touch ?? -1;
      const dbb = b.state.days_since_touch ?? -1;
      if (dbb !== da) return dbb - da; // days_since_touch desc
      return a.state.next_due_date!.localeCompare(b.state.next_due_date!); // older due first
    });

  // The daily number is a target, not a limit: everyone due is shown, oldest first.
  const capped = due;
  const overflow_count = due.length - capped.length;

  const cards: TodayCard[] = capped.map((r) => {
    const stepDef = chain.steps.find((s) => s.step === r.state.next_step!)!;
    const variant = r.state.variant_for_next;
    const tmpl = variant === "A" ? stepDef.variant_a : stepDef.variant_b;
    return {
      lead_id: r.lead.lead_id,
      name: r.lead.name,
      title: r.lead.title,
      company: r.lead.company,
      segment: r.lead.segment,
      linkedin_url: r.lead.linkedin_url,
      dossier_path: r.lead.dossier_path,
      step: stepDef.step,
      total_steps: chain.steps.length,
      variant,
      offset_days: stepDef.offset_days,
      angle: stepDef.angle,
      days_since_touch: r.state.days_since_touch,
      due_date: r.state.next_due_date!,
      body: renderBody(tmpl, r.lead),
      stage: r.state.stage,
    };
  });

  // sent this week (live sent events since Monday)
  const ws = weekStart(today);
  const sent_this_week = liveEvents(campaignEvents(db, c.id)).filter(
    (e) => e.kind === "sent" && ymdFromIso(e.ts_utc) >= ws && ymdFromIso(e.ts_utc) <= today,
  ).length;

  // next due strictly after today
  const future = contactable
    .filter((r) => r.state.eligible && r.state.next_due_date && r.state.next_due_date > today)
    .map((r) => r.state.next_due_date!)
    .sort();
  let next_due: string | null = future[0] ?? null;
  if (overflow_count > 0) {
    const roll = nextWeekdayAfter(today);
    next_due = next_due && next_due < roll ? next_due : roll;
  }

  return {
    date: today,
    daily_cap: c.daily_cap,
    cards,
    overflow_count,
    overflow_rolls_to: overflow_count > 0 ? nextWeekdayAfter(today) : null,
    waiting_on_you,
    stale_replies,
    sent_this_week,
    next_due,
    all_clear: cards.length === 0,
  };
}

// ---------- scout ----------
export function scoutRows(db: Db, c: Campaign, today: string) {
  const rows = statesFor(db, c, today);
  const live = liveEvents(campaignEvents(db, c.id));
  return rows
    .filter((r) => !r.lead.do_not_contact)
    .filter((r) => r.state.stage === "found" || r.state.stage === "invited")
    .map((r) => {
      const inviteEvt = live.find((e) => e.lead_id === r.lead.lead_id && e.kind === "invite_sent");
      return {
        lead_id: r.lead.lead_id,
        name: r.lead.name,
        title: r.lead.title,
        company: r.lead.company,
        segment: r.lead.segment,
        linkedin_url: r.lead.linkedin_url,
        proposed_variant: r.state.variant_for_next,
        invited: r.state.stage === "invited",
        invited_at: r.lead.invited_at ?? inviteEvt?.ts_utc ?? null,
        stage: r.state.stage,
      };
    });
}

// ---------- ledger ----------
export function ledger(db: Db, c: Campaign, today: string, limit: number) {
  const evs = campaignEvents(db, c.id)
    .slice()
    .sort((a, b) => (a.ts_utc < b.ts_utc ? 1 : a.ts_utc > b.ts_utc ? -1 : 0))
    .slice(0, limit);
  const names = new Map(db.leads.map((l) => [l.lead_id, l.name] as const));
  const events = evs.map((e) => ({ ...e, lead_name: e.lead_id ? names.get(e.lead_id) ?? e.lead_id : "—" }));
  const leads = statesFor(db, c, today).map((r) => ({
    lead_id: r.lead.lead_id,
    name: r.lead.name,
    company: r.lead.company,
    title: r.lead.title,
    linkedin_url: r.lead.linkedin_url,
    dossier_path: r.lead.dossier_path,
    do_not_contact: r.lead.do_not_contact,
    ...r.state,
  }));
  return { events, leads, total_events: campaignEvents(db, c.id).length };
}

// ---------- workday (the single Today screen) ----------
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

function personRow(l: Lead): PersonRow {
  return {
    lead_id: l.lead_id, name: l.name, title: l.title, company: l.company, segment: l.segment,
    linkedin_url: l.linkedin_url, invited_at: l.invited_at, accepted_at: l.accepted_at, dossier_path: l.dossier_path,
  };
}

export interface ScoreRange { invited: number; accepted: number; messaged: number; replied: number; booked: number }

/** Funnel counts for the last 7, 14, 30 days and all time, computed from the ledger and lead facts (nothing stored). */
function scorecard(db: Db, c: Campaign, today: string): Record<"7" | "14" | "30" | "all", ScoreRange> {
  const live = liveEvents(campaignEvents(db, c.id));
  const leads = campaignLeads(db, c.id);
  const firstTs = (leadId: string, kinds: string[], pred?: (e: LedgerEvent) => boolean) =>
    live.filter((e) => e.lead_id === leadId && kinds.includes(e.kind) && (!pred || pred(e))).map((e) => e.ts_utc).sort()[0] ?? null;
  const rows = leads.map((l) => {
    const inv = [l.invited_at, firstTs(l.lead_id, ["invite_sent"])].filter(Boolean).sort()[0] ?? null;
    const acc = [l.accepted_at, firstTs(l.lead_id, ["accepted"])].filter(Boolean).sort()[0] ?? null;
    const msg = firstTs(l.lead_id, ["sent"], (e) => e.step !== null);
    const rep = firstTs(l.lead_id, ["replied"]);
    const book = firstTs(l.lead_id, ["replied", "sent"], (e) => e.payload?.["booked"] === true);
    return { inv, acc, msg, rep, book };
  });
  const within = (iso: string | null, days: number | null) => !!iso && (days === null || diffDays(ymdFromIso(iso), today) <= days - 1);
  const mk = (days: number | null): ScoreRange => ({
    invited: rows.filter((r) => within(r.inv, days)).length,
    accepted: rows.filter((r) => within(r.acc, days)).length,
    messaged: rows.filter((r) => within(r.msg, days)).length,
    replied: rows.filter((r) => within(r.rep, days)).length,
    booked: rows.filter((r) => within(r.book, days)).length,
  });
  return { "7": mk(7), "14": mk(14), "30": mk(30), all: mk(null) };
}

/** Everything the one-screen Today needs. Accepted leads without a dossier wait in `researching`, not in `cards`. */
export function workday(db: Db, c: Campaign, today: string) {
  const t = todayQueue(db, c, today);
  const rows = statesFor(db, c, today).filter((r) => !r.lead.do_not_contact);
  const researching = rows.filter((r) => r.state.stage === "accepted" && !r.lead.dossier_path).map((r) => personRow(r.lead));
  const researchingIds = new Set(researching.map((r) => r.lead_id));
  const to_invite = rows.filter((r) => r.state.stage === "found").map((r) => personRow(r.lead));
  const awaiting = rows.filter((r) => r.state.stage === "invited").map((r) => personRow(r.lead));
  const invitedToday = liveEvents(campaignEvents(db, c.id)).filter((e) => e.kind === "invite_sent" && ymdFromIso(e.ts_utc) === today).length;
  return {
    ...t,
    cards: t.cards.filter((x) => !researchingIds.has(x.lead_id)),
    to_invite,
    awaiting,
    researching,
    invited_today: invitedToday,
    stale_invites: awaiting
      .map((p) => ({ ...p, days_invited: p.invited_at ? diffDays(ymdFromIso(p.invited_at), today) : 0 }))
      .filter((p) => p.days_invited >= 90)
      .sort((a, b) => b.days_invited - a.days_invited),
    scorecard: scorecard(db, c, today),
    campaign: { id: c.id, name: c.name, icp_sentence: c.icp_sentence },
  };
}
