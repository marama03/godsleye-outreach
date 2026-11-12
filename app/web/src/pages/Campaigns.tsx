import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { api } from "../lib/api";
import { useCampaign } from "../lib/campaign-context";

// The doorway: pick a campaign and land on its Today. The gear opens that campaign's management screen.
export default function Campaigns() {
  const { campaigns, activeId, setActiveId, refresh } = useCampaign();
  const nav = useNavigate();
  const [err, setErr] = useState<string | null>(null);
  const hasDemo = campaigns.some((c) => c.name.endsWith("(demo)"));

  const open = (id: string) => { setActiveId(id); nav("/today"); };
  const loadDemo = async () => {
    try { const r = await api.loadDemo(); setActiveId(r.campaign_id); await refresh(); nav("/today"); }
    catch (e: any) { setErr(String(e.message ?? e)); }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
      <p className="mt-1 text-sm text-brand-muted">Tap a campaign to open its Today. The gear is for its settings and delete.</p>

      <ul className="mt-5 space-y-3">
        {campaigns.map((c) => (
          <li key={c.id} className={`card flex items-stretch gap-2 p-0 ${c.id === activeId ? "ring-2 ring-brand-accent" : ""}`}>
            <button className="min-w-0 flex-1 p-4 text-left" onClick={() => open(c.id)}>
              <span className="block truncate text-lg font-bold">{c.name}</span>
              <span className="mt-0.5 block text-sm text-brand-muted">{c.icp_sentence}</span>
              <span className="mt-2 inline-block text-sm font-semibold text-brand-accent">Open Today →</span>
            </button>
            <Link to={`/campaigns/${c.id}`} aria-label={`Settings for ${c.name}`} title="Settings and delete" className="flex w-14 items-center justify-center rounded-r-xl border-l border-brand-border text-xl hover:bg-brand-surface">⚙</Link>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Link to="/campaigns/new" className="btn-primary w-full text-center sm:w-auto">New campaign</Link>
        {!hasDemo && <button className="btn-secondary w-full sm:w-auto" onClick={loadDemo}>Load the demo</button>}
      </div>
      {err && <p className="mt-3 text-sm text-brand-danger">{err}</p>}
    </div>
  );
}
