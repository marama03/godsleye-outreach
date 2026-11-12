import { useEffect, useRef, useState } from "react";
import LoadProblem from "../lib/LoadProblem";
import { Link } from "react-router-dom";
import { api, fmtLocal, shortHash, type LedgerResponse } from "../lib/api";
import { useCampaign } from "../lib/campaign-context";

const KIND_STYLE: Record<string, string> = {
  campaign_created: "text-brand-highlight",
  invite_sent: "text-brand-cream",
  accepted: "text-emerald-300",
  dossier_ready: "text-emerald-200",
  sent: "text-brand-on-navy font-semibold",
  replied: "text-brand-accent",
  skipped: "text-brand-navy-muted",
  not_a_fit: "text-brand-primary",
  withdrawn: "text-brand-primary",
  undo: "text-brand-highlight",
  correction: "text-brand-highlight",
};

export default function Ledger() {
  const { active } = useCampaign();
  const [data, setData] = useState<LedgerResponse | null>(null);
  const [tab, setTab] = useState<"taps" | "state">("taps");
  const seen = useRef<Set<string>>(new Set());
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    const load = async () => {
      let d;
      try {
        d = await api.ledger(active.id, 50);
        setLoadErr(null);
      } catch (e: any) {
        if (alive) setLoadErr(e?.message ?? String(e));
        return;
      }
      if (!alive) return;
      const newIds = d.events.map((e) => e.event_id).filter((id) => !seen.current.has(id));
      const first = seen.current.size === 0;
      d.events.forEach((e) => seen.current.add(e.event_id));
      setData(d);
      if (!first && newIds.length) {
        setFresh((s) => new Set([...s, ...newIds]));
        window.setTimeout(() => setFresh((s) => { const n = new Set(s); newIds.forEach((id) => n.delete(id)); return n; }), 1700);
      }
    };
    load().catch(() => undefined);
    const iv = window.setInterval(() => load().catch(() => undefined), 1500);
    return () => { alive = false; window.clearInterval(iv); };
  }, [active?.id]);

  if (!active) return <p className="text-brand-muted">No campaign yet. <Link className="underline" to="/campaigns/new">Create one.</Link></p>;
  if (loadErr) return <LoadProblem message={loadErr} />;
  if (!data) return <p className="text-brand-muted">Loading…</p>;

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="-mx-4 -mb-6 rounded-t-2xl bg-brand-navy px-6 pb-10 pt-6 text-brand-on-navy shadow-2xl">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">The ledger</h1>
            <p className="mt-1 text-sm text-brand-navy-muted">
              <span className="font-mono">{active.id}</span> · {data.total_events} events on disk · append-only · every tap is one row
            </p>
          </div>
          <div className="flex rounded-md border border-brand-navy-soft p-0.5 text-sm">
            <button className={`rounded px-3 py-1 ${tab === "taps" ? "bg-brand-highlight text-brand-on-highlight" : "text-brand-on-navy/80"}`} onClick={() => setTab("taps")}>What your taps just did</button>
            <button className={`rounded px-3 py-1 ${tab === "state" ? "bg-brand-highlight text-brand-on-highlight" : "text-brand-on-navy/80"}`} onClick={() => setTab("state")}>Lead state (derived)</button>
          </div>
        </div>

        <section className={`mt-5 ${tab === "taps" ? "" : "hidden"}`}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-brand-navy-muted">events.json · newest first · last 50</h2>
          <div className="mt-2 overflow-x-auto rounded-lg border border-brand-navy-soft">
            <table className="w-full font-mono text-xs">
              <thead className="bg-brand-navy-soft/60 text-left text-brand-navy-muted">
                <tr>
                  <th className="px-3 py-2">ts ({tz})</th>
                  <th className="px-3 py-2">ts_utc</th>
                  <th className="px-3 py-2">lead</th>
                  <th className="px-3 py-2">kind</th>
                  <th className="px-3 py-2">step</th>
                  <th className="px-3 py-2">variant</th>
                  <th className="px-3 py-2">body_hash</th>
                  <th className="px-3 py-2">idempotency_key</th>
                  <th className="px-3 py-2">corrects</th>
                </tr>
              </thead>
              <tbody>
                {data.events.map((e) => (
                  <tr key={e.event_id} className={`border-t border-brand-navy-soft ${fresh.has(e.event_id) ? "animate-flashin" : ""}`}>
                    <td className="whitespace-nowrap px-3 py-1.5 text-brand-on-navy/80">{fmtLocal(e.ts_utc)}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-brand-navy-muted">{e.ts_utc}</td>
                    <td className="whitespace-nowrap px-3 py-1.5">{e.lead_name}</td>
                    <td className={`whitespace-nowrap px-3 py-1.5 ${KIND_STYLE[e.kind] ?? ""}`}>{e.kind}</td>
                    <td className="px-3 py-1.5 text-center">{e.step ?? "—"}</td>
                    <td className="px-3 py-1.5 text-center">{e.variant ?? "—"}</td>
                    <td className="px-3 py-1.5 text-brand-on-navy/80">{shortHash(e.body_hash)}</td>
                    <td className="px-3 py-1.5 text-brand-on-navy/80">{shortHash(e.idempotency_key)}</td>
                    <td className="px-3 py-1.5 text-brand-highlight">{e.corrects_event_id ? e.corrects_event_id.slice(0, 12) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`mt-5 ${tab === "state" ? "" : "hidden"}`}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-brand-navy-muted">Lead state · computed from the rows above on every load · stored nowhere</h2>
          <div className="mt-2 overflow-x-auto rounded-lg border border-brand-navy-soft">
            <table className="w-full font-mono text-xs">
              <thead className="bg-brand-navy-soft/60 text-left text-brand-navy-muted">
                <tr>
                  <th className="px-3 py-2">lead_id</th>
                  <th className="px-3 py-2">name</th>
                  <th className="px-3 py-2">stage</th>
                  <th className="px-3 py-2">current_step</th>
                  <th className="px-3 py-2">next_due_date</th>
                  <th className="px-3 py-2">days_since_touch</th>
                  <th className="px-3 py-2">waiting_on_me</th>
                  <th className="px-3 py-2">variant</th>
                  <th className="px-3 py-2">dnc</th>
                </tr>
              </thead>
              <tbody>
                {data.leads.map((l) => (
                  <tr key={l.lead_id} className="border-t border-brand-navy-soft">
                    <td className="px-3 py-1.5 text-brand-navy-muted">{l.lead_id}</td>
                    <td className="whitespace-nowrap px-3 py-1.5">{l.name}</td>
                    <td className="px-3 py-1.5">{l.stage}</td>
                    <td className="px-3 py-1.5 text-center">{l.current_step}</td>
                    <td className="px-3 py-1.5">{l.next_due_date ?? "—"}</td>
                    <td className="px-3 py-1.5 text-center">{l.days_since_touch ?? "—"}</td>
                    <td className="px-3 py-1.5 text-center">{l.waiting_on_me ? "yes" : "—"}</td>
                    <td className="px-3 py-1.5 text-center">{l.variant_for_next}</td>
                    <td className="px-3 py-1.5 text-center">{l.do_not_contact ? "STOP" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="mt-6 text-xs text-brand-navy-muted">
          Writes on top, computed state below, from the same four files. No update endpoint, no delete endpoint. Undo is a row that points at the row it corrects.
        </p>
      </div>
    </div>
  );
}
