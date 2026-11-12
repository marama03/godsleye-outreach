import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type ChainSummary } from "../lib/api";
import { useCampaign } from "../lib/campaign-context";

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function NewCampaign() {
  const nav = useNavigate();
  const { refresh, setActiveId } = useCampaign();
  const [chains, setChains] = useState<ChainSummary[]>([]);
  const [name, setName] = useState("");
  const [icp, setIcp] = useState("");
  const [chainKey, setChainKey] = useState("");
  const [cap, setCap] = useState(10);
  const [start, setStart] = useState(todayYmd());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.chains().then((c) => {
      setChains(c);
      if (c.length && !chainKey) setChainKey(c[0].key);
    }).catch((e) => setErr(String(e.message ?? e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = chains.find((c) => c.key === chainKey);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    setErr(null);
    try {
      const out = await api.createCampaign({
        name,
        icp_sentence: icp,
        chain_id: selected.chain_id,
        chain_version: selected.version,
        daily_cap: cap,
        start_date: start,
      });
      await refresh();
      setActiveId(out.campaign.id);
      nav(`/campaigns/${out.campaign.id}?created=1`);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">New campaign</h1>
      <p className="mt-1 text-sm text-brand-muted">
        A campaign is a tag. Every lead and every event created under it carries this campaign_id, so two campaigns can never mix.
      </p>

      <form onSubmit={submit} className="card mt-6 space-y-5 p-6">
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Q4 — Fractional Marketing Leads" />
        </div>
        <div>
          <label className="label" htmlFor="icp">ICP sentence <span className="font-normal normal-case text-brand-muted">(one line, {icp.length}/200)</span></label>
          <input
            id="icp"
            className="input"
            value={icp}
            maxLength={200}
            onChange={(e) => setIcp(e.target.value.replace(/\n/g, " "))}
            required
            placeholder="Seed-to-Series-A B2B founders who still run marketing themselves…"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="chain">Chain @ version</label>
            <select id="chain" className="input" value={chainKey} onChange={(e) => setChainKey(e.target.value)} required>
              {chains.map((c) => (
                <option key={c.key} value={c.key}>{c.key} · {c.steps} steps</option>
              ))}
            </select>
            {selected && <p className="mt-1 text-xs text-brand-muted">offsets {selected.offsets.join(", ")} · frozen after create</p>}
          </div>
          <div>
            <label className="label" htmlFor="cap">Daily invite target (0 = none)</label>
            <input id="cap" type="number" min={0} className="input" value={cap} onChange={(e) => setCap(Number(e.target.value))} required />
          </div>
          <div>
            <label className="label" htmlFor="start">Start date</label>
            <input id="start" type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} required />
          </div>
        </div>
        {err && <p className="rounded-md border border-brand-danger bg-brand-danger-soft px-3 py-2 text-sm text-brand-danger">{err}</p>}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="text-xs text-brand-muted sm:max-w-xs">Create writes one campaign row and one <code className="font-mono">campaign_created</code> event. Nothing else.</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button className="btn-primary w-full sm:w-auto" disabled={busy || !selected}>{busy ? "Creating…" : "Create campaign"}</button>
          <button type="button" className="btn-secondary w-full sm:w-auto" onClick={async () => { try { const r = await api.loadDemo(); setActiveId(r.campaign_id); await refresh(); nav("/today"); } catch (e: any) { setErr(String(e.message ?? e)); } }}>Load the demo instead</button>
          </div>
        </div>
      </form>
    </div>
  );
}
