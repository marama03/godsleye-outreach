// Optional demo campaign: invented people only, dates relative to today. Loaded on request ("Load the demo"),
// never automatically, and removable with Delete campaign. Every demo person who is ready for a message has a
// dossier, because the dossier is the part of the system people remember.
import { promises as fs } from "node:fs";
import path from "node:path";
import { DATA_DIR, DOSSIER_DIR, loadDb, saveCampaigns, saveEvents, saveLeads } from "./store.js";
import { campaignIdFor, newEventId, sha256Hex, variantFor } from "../shared/hash.js";
import type { Campaign, Lead, LedgerEvent } from "../shared/types.js";

export const DEMO_NAME = "Q4 Ops Leaders (demo)";

const DOSSIERS: Record<string, string> = {
  a1: `# Dana Whitfield, Owner, Whitfield HVAC

*Invented for the demo. Nobody here is real.*

## Who she is
Second-generation owner of a 38-person heating and cooling company in a mid-sized Pennsylvania market. Took over from her father in 2019. Posts on LinkedIn about hiring technicians and about the shortage of apprentices.

## What the company does
Residential and light-commercial HVAC: installs, seasonal tune-ups, emergency repair. About $6M a year, roughly 70% repeat customers from maintenance plans.

## Why now
- Posted two weeks ago that she is hiring three technicians and a dispatcher.
- Her website still lists a phone number as the only way to book.
- Heating season is starting, which is when missed calls cost the most.

## Angle for the first message
Lead with the hiring post. The honest question is whether the hiring is growth or a rebuild after churn. No pitch.

## Hook theme
Hiring tax: every extra hire is overhead she carries before it pays off.

## Cautions
- Do not mention her father or the handover; she has not written about it publicly.
- Do not quote revenue figures. They are an estimate.
`,
  b2: `# Marcus Oyelaran, Founder, Oyelaran Advisory

*Invented for the demo. Nobody here is real.*

## Who he is
Former operations executive turned fractional COO for owner-led service firms. Certified EOS implementer. Speaks at regional business forums.

## What the company does
Runs 90-day operating-rhythm projects for companies between $5M and $30M. Mostly referral business; takes on about six clients a year.

## Why now
- Published a post last week on why owners become the bottleneck at around 40 people.
- His referral partners are accountants and bankers, the same circle we want to reach.

## Angle for the first message
He is a partner, not a buyer. Open with a specific point from his bottleneck post and ask how he handles the follow-through that comes after the workshop.

## Hook theme
Referral relationship: we make his clients' hand-offs less manual, which makes him look good.

## Cautions
- Do not pitch him as a client. Partner tone only.
- He is cautious about tools; keep it to one sentence about what we do.
`,
  c3: `# Priya Raman, Managing Partner, Raman Dental Group

*Invented for the demo. Nobody here is real.*

## Who she is
Dentist and managing partner of a four-location practice group. Runs the business side herself; there is no practice manager above the office managers.

## What the company does
General and cosmetic dentistry across four offices, about 55 staff. Roughly $7.5M a year.

## Why now
- Opened a fourth office in September.
- A review on her Google profile mentions a long wait to get an appointment.
- She replied to our first message within three days.

## Angle for the reply
She asked how this would work for a practice. Answer with one concrete example (recall and reactivation of lapsed patients) and offer a short call.

## Hook theme
Owner as bottleneck: she is doing scheduling, hiring and marketing herself.

## Cautions
- Do not mention patient data. Keep it about process.
- She prefers email to phone for the first call.
`,
  d4: `# Tom Becker, Owner, Becker Plumbing

*Invented for the demo. Nobody here is real.*

## Who he is
Master plumber who built a 22-person company. Active in a local trade association. Writes short, plain posts.

## What the company does
Residential service and repair plus new-construction rough-ins. About $4.5M a year.

## Why now
- Won a regional "best of" award last month.
- Posted that his dispatcher is out on leave and calls are piling up.

## Angle for the first message
Congratulate the award in one line, then ask how calls are being covered while the dispatcher is out.

## Hook theme
Lead response: slow answers cost jobs, and it is easy to measure.

## Cautions
- He distrusts anything that sounds like a sales system. Keep the tone plain.
- Do not mention AI in the first message.
`,
  e5: `# Ellen Park, Partner, Park & Co CPAs

*Invented for the demo. Nobody here is real.*

## Who she is
Partner at a ten-person accounting firm that serves owner-managed businesses. Regularly refers clients who need operational help.

## What the company does
Tax, bookkeeping and advisory for small and mid-sized firms. Referral-driven.

## Why now
- Shared an article about owners who outgrow their bookkeeping.
- Her firm hosts a quarterly breakfast for client owners.

## Angle for the first message
She is a partner. Ask what she sees go wrong most often for owners at $5M to $10M, and offer to share what we see from the sales side.

## Hook theme
Referral relationship.

## Cautions
- Do not offer a referral fee in writing; many accountants cannot accept one.
- Keep it to two short paragraphs.
`,
};

export async function seedDemo(): Promise<{ created: boolean; campaign_id: string }> {
  const db = await loadDb();
  const existing = db.campaigns.find((c) => c.name === DEMO_NAME);
  if (existing) {
    // keep the dossiers present even if the folder was cleared
    await writeDossiers(existing.id, db.leads.filter((l) => l.campaign_id === existing.id));
    return { created: false, campaign_id: existing.id };
  }

  const now = Date.now();
  const iso = (d: number) => new Date(now + d * 864e5).toISOString();
  const day = (d: number) => iso(d).slice(0, 10);
  const id = campaignIdFor(DEMO_NAME);
  const campaign: Campaign = {
    id, name: DEMO_NAME, icp_sentence: "Owners of $5M-$50M service businesses", chain_id: "gtm", chain_version: 2,
    daily_cap: 10, start_date: day(-14), created_at: iso(-14), status: "active",
  };
  const mk = (n: string, u: string, title: string, co: string, o: Partial<Lead> = {}): Lead => ({
    lead_id: `demo${u}`, campaign_id: id, is_demo: true, name: n, title, company: co,
    linkedin_url: `https://www.linkedin.com/in/example-${u}`, segment: "client",
    invited_at: iso(-9), accepted_at: iso(-7), withdrawn_at: null, do_not_contact: false,
    dossier_path: DOSSIERS[u] ? `data/dossiers/demo${u}.md` : null, reply_status: "none", ...o,
  });
  const leads: Lead[] = [
    mk("Dana Whitfield", "a1", "Owner", "Whitfield HVAC"),
    mk("Marcus Oyelaran", "b2", "Founder", "Oyelaran Advisory", { segment: "partner" }),
    mk("Priya Raman", "c3", "Managing Partner", "Raman Dental Group"),
    mk("Tom Becker", "d4", "Owner", "Becker Plumbing"),
    mk("Ellen Park", "e5", "Partner", "Park & Co CPAs", { segment: "partner" }),
    mk("Jo Alvarez", "f6", "Owner", "Alvarez Roofing", { dossier_path: null, accepted_at: iso(-1) }),
    mk("Sam Reed", "g7", "CEO", "Reed Staffing", { accepted_at: null, dossier_path: null, invited_at: iso(-3) }),
    mk("Rita Cole", "j0", "Owner", "Cole Home Services", { accepted_at: null, dossier_path: null, invited_at: iso(-5) }),
    mk("Old Contact", "h8", "Owner", "Dormant LLC", { accepted_at: null, dossier_path: null, invited_at: iso(-110) }),
    mk("New Prospect", "i9", "Principal", "Harbor Law", { invited_at: null, accepted_at: null, dossier_path: null }),
  ];
  const events: LedgerEvent[] = [];
  const ev = (lead: Lead, kind: LedgerEvent["kind"], daysAgo: number, extra: Partial<LedgerEvent> = {}) => {
    events.push({
      event_id: newEventId(), ts_utc: iso(-daysAgo), campaign_id: id, lead_id: lead.lead_id, kind, step: null,
      variant: kind === "sent" ? variantFor(lead.lead_id) : null, body_hash: kind === "sent" ? sha256Hex(`demo ${lead.lead_id}`) : null,
      idempotency_key: `demo_${lead.lead_id}_${kind}_${daysAgo}_${events.length}`, corrects_event_id: null, payload: null, ...extra,
    });
  };
  events.push({ event_id: newEventId(), ts_utc: iso(-14), campaign_id: id, lead_id: null, kind: "campaign_created", step: null, variant: null, body_hash: null, idempotency_key: `idk_campaign_${id}`, corrects_event_id: null, payload: { name: DEMO_NAME, chain: "gtm@2", daily_cap: 10, start_date: day(-14) } });
  const by = (u: string) => leads.find((l) => l.lead_id === `demo${u}`)!;
  ev(by("d4"), "sent", 4, { step: 1 });
  ev(by("e5"), "sent", 5, { step: 1 });
  ev(by("c3"), "sent", 3, { step: 1 }); ev(by("c3"), "replied", 0);
  ev(by("b2"), "sent", 6, { step: 1 }); ev(by("b2"), "replied", 4); ev(by("b2"), "sent", 3, { payload: { answered: true, booked: true } });

  await writeDossiers(id, leads);
  await saveCampaigns([...db.campaigns, campaign]);
  await saveLeads([...db.leads, ...leads]);
  await saveEvents([...db.events, ...events]);
  return { created: true, campaign_id: id };
}

async function writeDossiers(_campaignId: string, leads: Lead[]): Promise<void> {
  await fs.mkdir(DOSSIER_DIR, { recursive: true });
  for (const l of leads) {
    const key = l.lead_id.replace(/^demo/, "");
    if (l.dossier_path && DOSSIERS[key]) await fs.writeFile(path.join(DOSSIER_DIR, path.basename(l.dossier_path)), DOSSIERS[key]);
  }
}

/** Remove the demo campaign (a copy goes to data/deleted/) and load it fresh, so every demo starts from the same state. */
export async function resetDemo(): Promise<{ campaign_id: string }> {
  const db = await loadDb();
  const old = db.campaigns.find((c) => c.name === DEMO_NAME);
  if (old) {
    const leads = db.leads.filter((l) => l.campaign_id === old.id);
    const events = db.events.filter((e) => e.campaign_id === old.id);
    const dir = path.join(DATA_DIR, "deleted");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${old.id}-${Date.now()}.json`), JSON.stringify({ campaign: old, leads, events }, null, 2));
    await saveCampaigns(db.campaigns.filter((c) => c.id !== old.id));
    await saveLeads(db.leads.filter((l) => l.campaign_id !== old.id));
    await saveEvents(db.events.filter((e) => e.campaign_id !== old.id));
  }
  const r = await seedDemo();
  return { campaign_id: r.campaign_id };
}
