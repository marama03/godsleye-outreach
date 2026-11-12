// The gtm@1 chain. 10 steps, offsets 0,3,7,12,18,25,33,42,52,63.
// FROZEN once a campaign references it. To change copy, copy to gtm@2 — never edit in place.
import type { Chain } from "./types.js";

export const GTM_V1: Chain = {
  steps: [
    {
      step: 1,
      offset_days: 0,
      angle: "Thanks + one specific observation",
      template: "warm_open",
      variant_a:
        "Hi {first}, thanks for connecting. I noticed {company} is hiring across marketing right now — curious whether that's a growth push or a rebuild after churn? No pitch, genuinely asking.",
      variant_b:
        "{first}, appreciate the connect. Quick one: {company} looks like it's scaling marketing again. Is there someone owning pipeline end-to-end yet, or is it still split across a few people?",
    },
    {
      step: 2,
      offset_days: 3,
      angle: "Share one useful artefact, zero ask",
      template: "give_first",
      variant_a:
        "{first}, one thing that might be useful: a one-page checklist I use to audit a B2B marketing stack before changing anything. Happy to send it if helpful — no strings.",
      variant_b:
        "Hey {first}, I wrote up the five questions I ask every founder before touching their funnel. Short read. Want me to paste it here?",
    },
    {
      step: 3,
      offset_days: 7,
      angle: "Pattern from a similar company",
      template: "pattern",
      variant_a:
        "{first}, saw a company a lot like {company} last quarter: strong product, pipeline flat, three agencies pointing at each other. Fixing the owner, not the channels, moved the number. Does that ring any bells?",
      variant_b:
        "A pattern I keep seeing in {segment}: the first marketing hire is a doer, not an owner, and the founder stays the de facto CMO. Is that where {company} is, or past it?",
    },
    {
      step: 4,
      offset_days: 12,
      angle: "Light question about their quarter",
      template: "quarter_q",
      variant_a:
        "{first}, out of curiosity — what's the one marketing number you'd most like to move before quarter end?",
      variant_b:
        "Quick curiosity, {first}: if marketing at {company} could only fix one thing this quarter, what would it be?",
    },
    {
      step: 5,
      offset_days: 18,
      angle: "Soft offer: 20-minute teardown",
      template: "soft_offer",
      variant_a:
        "{first}, if useful, I do a 20-minute teardown of a company's funnel — what's working, what's noise. No deck, no follow-up pressure. Worth a slot next week?",
      variant_b:
        "Open offer, {first}: 20 minutes, I'll walk through {company}'s public funnel and tell you the two things I'd change first. If it's not useful, you've lost 20 minutes.",
    },
    {
      step: 6,
      offset_days: 25,
      angle: "Proof point",
      template: "proof",
      variant_a:
        "{first}, context on who I am: last engagement, a {segment} firm, pipeline went from founder-led to repeatable in 90 days with one fractional lead and no new headcount. Happy to share the before/after.",
      variant_b:
        "For context, {first}: I run marketing fractionally for 2–3 companies at a time. Most recent: {segment}, 90 days, pipeline up 2x, no agency spend added. Can show the numbers.",
    },
    {
      step: 7,
      offset_days: 33,
      angle: "Reframe: cost of waiting",
      template: "cost_of_wait",
      variant_a:
        "{first}, honest question — what does another quarter of marketing-by-committee cost {company}? Usually it's one hire's salary in missed pipeline. Happy to be wrong.",
      variant_b:
        "{first}, a lot of founders I talk to delay the marketing owner hire until Series A. The ones who don't tend to raise on better numbers. Where does {company} sit on that?",
    },
    {
      step: 8,
      offset_days: 42,
      angle: "Direct ask",
      template: "direct_ask",
      variant_a:
        "{first}, I'll be direct: I think {company} is a fit for a fractional marketing lead and I'd like to be considered. 20 minutes to find out either way?",
      variant_b:
        "Straight ask, {first}: would it be worth a 20-minute call to see if a fractional marketing lead makes sense for {company} this quarter?",
    },
    {
      step: 9,
      offset_days: 52,
      angle: "Low-pressure check-in",
      template: "checkin",
      variant_a:
        "{first}, no pressure at all — if the timing's wrong, just say so and I'll stop. If it's right-ish, I'm around.",
      variant_b:
        "Checking in once more, {first}. Two-word reply is fine: 'not now' or 'let's talk'. Either way I appreciate the connect.",
    },
    {
      step: 10,
      offset_days: 63,
      angle: "Graceful close",
      template: "close",
      variant_a:
        "{first}, I'll close the loop here. If marketing at {company} ever needs an owner rather than another vendor, you know where I am. Wishing you a strong quarter.",
      variant_b:
        "Last note from me, {first}. Door's open whenever {company} is ready for a marketing lead. Good luck with the quarter.",
    },
  ],
};
