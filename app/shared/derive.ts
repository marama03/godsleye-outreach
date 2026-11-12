// deriveLeadState: the ONE WRITER of next_due_date (R1). Pure. No I/O.
// Every screen and endpoint calls this; nothing it returns is ever persisted (R6).
import type { Chain, Lead, LeadState, LedgerEvent, Stage } from "./types.js";
import { addDays, diffDays, rollWeekend, ymdFromIso } from "./dates.js";
import { variantFor } from "./variant.js";

/**
 * Apply undo semantics: an event is "live" unless some later "undo" row has
 * corrects_event_id pointing at it. Original rows always remain on disk (R2);
 * this only decides which rows count toward state.
 */
export function liveEvents(events: LedgerEvent[]): LedgerEvent[] {
  const undone = new Set<string>();
  for (const e of events) {
    if (e.kind === "undo" && e.corrects_event_id) undone.add(e.corrects_event_id);
  }
  return events.filter((e) => e.kind !== "undo" && !undone.has(e.event_id));
}

function byTs(a: LedgerEvent, b: LedgerEvent): number {
  return a.ts_utc < b.ts_utc ? -1 : a.ts_utc > b.ts_utc ? 1 : 0;
}

export function deriveLeadState(
  lead: Lead,
  chain: Chain,
  allEvents: LedgerEvent[],
  todayYmd: string,
): LeadState {
  const mine = liveEvents(allEvents.filter((e) => e.lead_id === lead.lead_id)).sort(byTs);

  const sent = mine.filter((e) => e.kind === "sent");
  const current_step = sent.reduce((m, e) => Math.max(m, e.step ?? 0), 0);
  const lastSent = sent.length ? sent[sent.length - 1] : null;
  const lastReply = [...mine].reverse().find((e) => e.kind === "replied") ?? null;
  const lastEvent = mine.length ? mine[mine.length - 1] : null;

  const invited = !!lead.invited_at || mine.some((e) => e.kind === "invite_sent");
  const accepted = !!lead.accepted_at || mine.some((e) => e.kind === "accepted");
  const withdrawn =
    !!lead.withdrawn_at || mine.some((e) => e.kind === "withdrawn" || e.kind === "not_a_fit");
  const booked = mine.some((e) => e.kind === "replied" && e.payload?.["booked"] === true);
  const replied = !!lastReply;

  // waiting_on_me: last event is a reply with no "sent" after it
  const waiting_on_me =
    !!lastReply && (!lastSent || lastSent.ts_utc < lastReply.ts_utc) && lastEvent?.kind === "replied";

  let stage: Stage;
  if (withdrawn) stage = "withdrawn";
  else if (booked) stage = "booked";
  else if (replied) stage = "replied";
  else if (current_step > 0) stage = "in_sequence";
  else if (accepted) stage = "accepted";
  else if (invited) stage = "invited";
  else stage = "found";

  // R7 hard stop, R9 reply stops the sequence, withdrawn/not_a_fit exit.
  const eligible = !lead.do_not_contact && !withdrawn && !replied && accepted;

  const maxStep = chain.steps.length;
  const next_step = eligible && current_step < maxStep ? current_step + 1 : null;

  // R1 + R4: next_due_date = anchor + offset(next_step), rolled off weekends.
  // Anchor: the accepted date (step 1, offset 0) ... all offsets are measured from acceptance.
  // A "skipped" event for the next step pushes it one weekday; so does a sent with later offset.
  let next_due_date: string | null = null;
  if (next_step !== null) {
    const stepDef = chain.steps.find((s) => s.step === next_step)!;
    const anchorIso = lead.accepted_at ?? mine.find((e) => e.kind === "accepted")?.ts_utc ?? null;
    const anchorYmd = anchorIso ? ymdFromIso(anchorIso) : todayYmd;
    let due = addDays(anchorYmd, stepDef.offset_days);

    // never two steps on the same day: if step N-1 went out late, N is at least the next day
    if (lastSent) {
      const spaced = addDays(ymdFromIso(lastSent.ts_utc), 1);
      if (spaced > due) due = spaced;
    }

    // skips for this exact step push the due date one day past the skip, each time
    const skips = mine.filter((e) => e.kind === "skipped" && e.step === next_step);
    for (const s of skips) {
      const pushed = addDays(ymdFromIso(s.ts_utc), 1);
      if (pushed > due) due = pushed;
    }

    next_due_date = rollWeekend(due);
  }

  const days_since_touch = lastSent ? diffDays(ymdFromIso(lastSent.ts_utc), todayYmd) : null;

  return {
    stage,
    current_step,
    next_due_date,
    days_since_touch,
    waiting_on_me,
    variant_for_next: variantFor(lead.lead_id),
    eligible,
    next_step,
    last_touch_ts: lastSent?.ts_utc ?? null,
    last_reply_ts: lastReply?.ts_utc ?? null,
  };
}

/** Fill a template with lead fields. */
export function renderBody(template: string, lead: Lead): string {
  const first = lead.name.split(" ")[0];
  return template
    .replaceAll("{first}", first)
    .replaceAll("{name}", lead.name)
    .replaceAll("{company}", lead.company)
    .replaceAll("{title}", lead.title)
    .replaceAll("{segment}", lead.segment);
}
