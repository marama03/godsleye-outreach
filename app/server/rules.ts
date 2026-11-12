// What an event may follow. The screens only offer legal actions, but the sync agent and the sheet write
// through the same API, so the server refuses impossible sequences and says what is missing.
import type { Chain, Lead, LedgerEvent } from "../shared/types.js";
import { liveEvents } from "../shared/derive.js";

export function refuseReason(lead: Lead, chain: Chain, allEventsForLead: LedgerEvent[], kind: string, step: number | null, _payload: Record<string, unknown> | null): string | null {
  const live = liveEvents(allEventsForLead).sort((a, b) => (a.ts_utc < b.ts_utc ? -1 : 1));
  const invited = !!lead.invited_at || live.some((e) => e.kind === "invite_sent");
  const accepted = !!lead.accepted_at || live.some((e) => e.kind === "accepted");
  const withdrawn = !!lead.withdrawn_at || live.some((e) => e.kind === "withdrawn");
  const sentSteps = live.filter((e) => e.kind === "sent" && e.step !== null).map((e) => e.step as number);
  const currentStep = sentSteps.length ? Math.max(...sentSteps) : 0;
  const lastReply = [...live].reverse().find((e) => e.kind === "replied") ?? null;
  const lastSent = [...live].reverse().find((e) => e.kind === "sent") ?? null;
  const waiting = !!lastReply && (!lastSent || lastSent.ts_utc < lastReply.ts_utc) && live[live.length - 1]?.kind === "replied";

  if (kind === "invite_sent") {
    if (withdrawn) return "this invitation was dropped; it cannot be logged as sent";
    return null;
  }
  if (kind === "accepted") {
    if (withdrawn) return "this invitation was dropped; it cannot be accepted";
    if (!invited) return "this person was never invited, so there is no invitation to accept; log the invitation first";
    return null;
  }
  if (kind === "sent" || kind === "skipped") {
    if (kind === "sent" && step === null) {
      // an answer to their reply
      if (!waiting) return "there is no reply waiting on an answer for this person";
      return null;
    }
    if (!accepted) return invited ? "they have not accepted yet; messages start after acceptance (log it as accepted first)" : "this person was never invited or accepted; log the invitation first";
    if (lead.do_not_contact) return "this person is marked do not contact";
    if (withdrawn) return "this invitation was dropped";
    if (step === null) return "step is required";
    if (lastReply && kind === "skipped") return "they replied; the sequence has stopped";
    if (kind === "sent" && lastReply && !live.some((e) => e.kind === "sent" && e.ts_utc > lastReply.ts_utc)) return "they replied; answer them (I answered) instead of sending the next step";
    const next = currentStep + 1;
    if (step !== next) return `step ${step} is out of order: the next step for this person is ${next}${next > chain.steps.length ? " (the chain is finished)" : ""}`;
    if (step > chain.steps.length) return `the chain has only ${chain.steps.length} steps`;
    return null;
  }
  if (kind === "replied") {
    if (!invited && !accepted) return "this person was never invited or accepted, so there can be no reply";
    return null;
  }
  if (kind === "withdrawn") {
    if (accepted) return "they accepted; an accepted connection cannot be a dropped invitation";
    if (!invited) return "this person was never invited, so there is nothing to drop";
    return null;
  }
  return null;
}

/** Undo only the newest live event of a lead; an older one may have later actions that depend on it. */
export function undoRefusal(target: LedgerEvent, allEventsForLead: LedgerEvent[]): string | null {
  const live = liveEvents(allEventsForLead);
  const later = live.filter((e) => e.event_id !== target.event_id && (e.ts_utc > target.ts_utc || (e.ts_utc === target.ts_utc && e.event_id > target.event_id)) && e.kind !== "campaign_created");
  if (later.length) return `a later action for this person is already logged (${later[0].kind}); undo that one first`;
  return null;
}
