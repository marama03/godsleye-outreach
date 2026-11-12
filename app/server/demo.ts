// Optional demo campaign: invented people only, dates relative to today. Loaded on request ("Load the demo"),
// never automatically, and removable with Delete campaign.
import { promises as fs } from "node:fs";
import path from "node:path";
import { DOSSIER_DIR, loadDb, saveCampaigns, saveEvents, saveLeads } from "./store.js";
import { campaignIdFor, newEventId, sha256Hex, variantFor } from "../shared/hash.js";
import type { Campaign, Lead, LedgerEvent } from "../shared/types.js";

export const DEMO_NAME = "Q4 Service Owners (demo)";

export async function seedDemo(): Promise<{ created: boolean; campaign_id: string }> {
  const db = await loadDb();
  const existing = db.campaigns.find((c) => c.name === DEMO_NAME);
  if (existing) return { created: false, campaign_id: existing.id };

  const now = Date.now();
  const iso = (d: number) => new Date(now + d * 864e5).toISOString();
  const day = (d: number) => iso(d).slice(0, 10);
  const id = campaignIdFor(DEMO_NAME);
  const campaign: Campaign = {
    id, name: DEMO_NAME, icp_sentence: "Owners of $5M-$50M service businesses", chain_id: "gtm", chain_version: 1,
    daily_cap: 10, start_date: day(-14), created_at: iso(-14), status: "active",
  };
  const mk = (n: string, u: string, title: string, co: string, o: Partial<Lead> = {}): Lead => ({
    lead_id: `demo${u}`, campaign_id: id, is_demo: true, name: n, title, company: co,
    linkedin_url: `https://www.linkedin.com/in/example-${u}`, segment: "client",
    invited_at: iso(-9), accepted_at: iso(-7), withdrawn_at: null, do_not_contact: false,
    dossier_path: `demo${u}.md`, reply_status: "none", ...o,
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
  events.push({ event_id: newEventId(), ts_utc: iso(-14), campaign_id: id, lead_id: null, kind: "campaign_created", step: null, variant: null, body_hash: null, idempotency_key: `idk_campaign_${id}`, corrects_event_id: null, payload: { name: DEMO_NAME, chain: "gtm@1", daily_cap: 10, start_date: day(-14) } });
  const by = (u: string) => leads.find((l) => l.lead_id === `demo${u}`)!;
  ev(by("d4"), "sent", 4, { step: 1 });
  ev(by("e5"), "sent", 5, { step: 1 });
  ev(by("c3"), "sent", 3, { step: 1 }); ev(by("c3"), "replied", 0);
  ev(by("b2"), "sent", 6, { step: 1 }); ev(by("b2"), "replied", 4); ev(by("b2"), "sent", 3, { payload: { answered: true, booked: true } });

  await fs.mkdir(DOSSIER_DIR, { recursive: true });
  for (const l of leads) if (l.dossier_path) await fs.writeFile(path.join(DOSSIER_DIR, l.dossier_path), `# ${l.name}, ${l.company}\n\nInvented demo dossier. Nothing here is real.\n`);
  await saveCampaigns([...db.campaigns, campaign]);
  await saveLeads([...db.leads, ...leads]);
  await saveEvents([...db.events, ...events]);
  return { created: true, campaign_id: id };
}
