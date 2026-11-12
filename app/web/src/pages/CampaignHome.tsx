import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, type CampaignResponse, fmtWeekdayDate } from "../lib/api";
import { useCampaign } from "../lib/campaign-context";

function TargetEditor({ id, value }: { id: string; value: number }) {
  const { refresh } = useCampaign();
  const [v, setV] = useState(String(value));
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <input aria-label="Daily invite target" type="number" min={0} className="input w-20" value={v} onChange={(e) => { setV(e.target.value); setMsg(null); }} />
      <button className="btn-secondary" disabled={String(value) === v} onClick={async () => { try { await api.setTarget(id, Number(v)); await refresh(); setMsg("Saved"); } catch (e: any) { setMsg(e.message ?? "Could not save"); } }}>Save</button>
      <span className="text-xs text-brand-muted">{msg ?? (value === 0 ? "no target" : "a goal, never a limit")}</span>
    </span>
  );
}

function Counter({ label, value, to }: { label: string; value: number; to?: string }) {
  const inner = (
    <div className="card flex flex-col items-start p-5">
      <span className="text-4xl font-bold sm:text-5xl tabular-nums tracking-tight">{value}</span>
      <span className="mt-2 text-sm font-medium text-brand-muted">{label}</span>
    </div>
  );
  return to ? <Link to={to} className="block hover:opacity-90">{inner}</Link> : inner;
}

function DeleteZone({ id, name, leadCount }: { id: string; name: string; leadCount: number | null }) {
  const { refresh } = useCampaign();
  const nav = useNavigate();
  const [confirmText, setConfirmText] = useState("");
  const [delErr, setDelErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  return (
    <section className="card mt-10 border-brand-danger p-5" aria-label="Delete campaign">
      <h2 className="text-lg font-bold">Delete this campaign</h2>
      <p className="mt-1 text-sm text-brand-muted">
        Removes <b>{name}</b> with {leadCount === null ? "all its leads" : `its ${leadCount} leads`} and all their history. Other campaigns are not touched. A copy is kept in <code className="font-mono">data/deleted/</code> so it can be restored by hand.
      </p>
      <form
        className="mt-3 flex flex-wrap items-center gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setDeleting(true); setDelErr(null);
          try { await api.deleteCampaign(id, confirmText); await refresh(); nav("/today"); }
          catch (err: any) { setDelErr(err.message ?? String(err)); }
          finally { setDeleting(false); }
        }}
      >
        <label className="sr-only" htmlFor="del-confirm">Type the campaign name to confirm</label>
        <input id="del-confirm" className="input min-w-0 flex-1" placeholder={`Type “${name}” to confirm`} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
        <button className="btn-danger" disabled={deleting || confirmText.trim() !== name}>{deleting ? "Deleting…" : "Delete campaign"}</button>
      </form>
      {delErr && <p className="mt-2 text-sm text-brand-danger">{delErr}</p>}
    </section>
  );
}

function BrokenCampaign({ id, message, campaign }: { id: string; message: string; campaign?: { id: string; name: string } | null }) {
  const { campaigns } = useCampaign();
  // The error itself names the campaign, so deleting never depends on the cached list being fresh.
  const c = campaign ?? campaigns.find((x) => x.id === id);
  return (
    <div>
      <div className="card p-6">
        <h1 className="text-2xl font-bold tracking-tight">{c?.name ?? id}</h1>
        <p className="mt-2 text-brand-danger">{message}</p>
        <p className="mt-2 text-sm text-brand-muted">Nothing was changed. The other campaigns still work.</p>
      </div>
      {c && <DeleteZone id={c.id} name={c.name} leadCount={null} />}
    </div>
  );
}

export default function CampaignHome() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const { setActiveId, refresh } = useCampaign();
  const [resetting, setResetting] = useState(false);
  const [data, setData] = useState<CampaignResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [errCampaign, setErrCampaign] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    setActiveId(id);
    let alive = true;
    const load = () => api.campaign(id).then((d) => alive && setData(d)).catch((e) => { if (alive) { setErr(e.message); setErrCampaign(e.campaign ?? null); } });
    load();
    const iv = window.setInterval(load, 3000);
    return () => {
      alive = false;
      window.clearInterval(iv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (err) return <BrokenCampaign id={id ?? ""} message={err} campaign={errCampaign} />;
  if (!data) return <p className="text-brand-muted">Loading…</p>;
  const c = data.campaign;
  const justCreated = sp.get("created") === "1";

  return (
    <div>
      {justCreated && (
        <div className="mb-4 rounded-md border border-brand-ok bg-brand-ok-soft px-4 py-3 text-sm text-brand-ink">
          Created. One campaign row, one <code className="font-mono">campaign_created</code> event.
        </div>
      )}
      <div className="card p-4 sm:p-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-2xl font-bold tracking-tight">{c.name}</h1>
              <span className={`pill ${c.status === "active" ? "bg-brand-ok-soft text-brand-ok" : "bg-brand-surface text-brand-ink"}`}>{c.status}</span>
            </div>
            <p className="mt-2 max-w-2xl text-brand-ink">{c.icp_sentence}</p>
            <dl className="mt-4 grid grid-cols-1 gap-y-2 text-sm sm:grid-cols-3 sm:gap-x-8">
              <div><dt className="label">Chain</dt><dd className="font-mono">{data.chain_key}</dd></div>
              <div><dt className="label">Start date</dt><dd>{fmtWeekdayDate(c.start_date)}</dd></div>
              <div><dt className="label">Daily invite target</dt><dd><TargetEditor id={c.id} value={c.daily_cap} /></dd></div>
            </dl>
          </div>
          <div className="w-full min-w-0 sm:w-auto sm:max-w-[16rem] sm:shrink-0 sm:text-right">
            <span className="label">campaign_id</span>
            <code title="Tap to copy" onClick={() => navigator.clipboard?.writeText(c.id)} className="block cursor-pointer truncate rounded-md border border-brand-border bg-brand-surface px-3 py-2 font-mono text-sm font-semibold">{c.id}</code>
            <p className="mt-1 text-xs text-brand-muted">stamped on every lead and event</p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Counter label="Invites sent" value={data.counters.invited} to="/scout" />
        <Counter label="Accepted" value={data.counters.accepted} />
        <Counter label="Docs ready" value={data.counters.docs_ready} />
        <Counter label="Due today" value={data.counters.due_today} to="/today" />
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/today" className="btn-primary">Open Today</Link>
        <Link to="/scout" className="btn-secondary">Open Scout</Link>
        <Link to="/ledger" className="btn-ghost">Ledger</Link>
      </div>
      <p className="mt-4 text-xs text-brand-muted">All four counters are computed from the event ledger on every load. None of them is stored.</p>

      {c.name.endsWith("(demo)") && (
        <section className="card mt-8 p-5" aria-label="Reset demo">
          <h2 className="text-lg font-bold">Reset the demo</h2>
          <p className="mt-1 text-sm text-brand-muted">Puts this demo back to its starting state, with the dossiers, so every run begins the same way. Your other campaigns are not touched.</p>
          <button className="btn-secondary mt-3" disabled={resetting} onClick={async () => { setResetting(true); try { const r = await api.resetDemo(); setActiveId(r.campaign_id); await refresh(); } finally { setResetting(false); } }}>{resetting ? "Resetting…" : "Reset demo"}</button>
        </section>
      )}
      <DeleteZone id={c.id} name={c.name} leadCount={data.counters.invited} />
    </div>
  );
}
