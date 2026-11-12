import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, newIdempotencyKey, type ScoutRow } from "../lib/api";
import { useCampaign } from "../lib/campaign-context";
import { useToast } from "../lib/toast";

export default function Scout() {
  const { active } = useCampaign();
  const toast = useToast();
  const [rows, setRows] = useState<ScoutRow[]>([]);
  const [icp, setIcp] = useState("");
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  // one idempotency key per (lead, action) intent — a double-tap reuses it, so it writes one row
  const [sheetOn, setSheetOn] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const keys = useRef(new Map<string, string>());

  const load = async () => {
    if (!active) return;
    const d = await api.scout(active.id);
    setRows(d.rows);
    setIcp(d.icp_sentence);
  };

  useEffect(() => {
    api.sheetStatus().then((r) => setSheetOn(r.configured)).catch(() => undefined);
  }, []);

  async function syncSheet() {
    if (!active) return;
    setSyncing(true);
    try {
      const r = await api.sheetSync(active.id);
      toast.show({ text: `Sheet synced · ${r.created} new, ${r.accepted} accepted, ${r.dossiers} dossiers, ${r.queued} in research`, ttlMs: 4000 });
      await load();
    } catch (e: any) {
      toast.show({ text: e.message ?? String(e), ttlMs: 4000 });
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    load().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  async function act(lead: ScoutRow, kind: "invite_sent" | "accepted") {
    if (!active) return;
    const k = `${lead.lead_id}:${kind}`;
    if (!keys.current.has(k)) keys.current.set(k, newIdempotencyKey());
    setBusy((b) => ({ ...b, [k]: true }));
    try {
      const out = await api.postEvent({ campaign_id: active.id, lead_id: lead.lead_id, kind, idempotency_key: keys.current.get(k)! });
      if (out.duplicate) {
        toast.show({ text: "Already logged — one row, not two.", ttlMs: 2500 });
      } else if (kind === "invite_sent") {
        const id = out.event!.event_id;
        toast.show({ text: `Invitation logged · ${lead.name}`, actionLabel: "Undo", ttlMs: 5000, onAction: async () => { await api.undo(id); keys.current.delete(k); await load(); } });
      } else {
        toast.show({ text: `Accepted · ${lead.name} is now in sequence`, ttlMs: 3000 });
      }
      await load();
    } catch (e: any) {
      toast.show({ text: e.message ?? String(e), ttlMs: 4000 });
    } finally {
      setBusy((b) => ({ ...b, [k]: false }));
    }
  }

  if (!active) return <p className="text-brand-muted">No campaign yet. <Link className="underline" to="/campaigns/new">Create one.</Link></p>;

  const uninvited = rows.filter((r) => !r.invited);
  const invited = rows.filter((r) => r.invited);

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Scout</h1>
          <p className="mt-1 text-sm text-brand-muted">Leads in <span className="font-mono">{active.id}</span> matching: <em>{icp}</em></p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-brand-muted">{uninvited.length} to invite · {invited.length} waiting on acceptance</span>
          {sheetOn && <button className="btn-secondary" disabled={syncing} onClick={syncSheet}>{syncing ? "Syncing…" : "Sync sheet"}</button>}
        </div>
      </div>

      <div className="mt-4 rounded-md border border-brand-accent bg-brand-accent-soft px-4 py-3 text-sm font-medium text-brand-ink">
        Sending on LinkedIn stays manual. This app only records it.
      </div>

      <div className="card mt-4 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-brand-surface text-left text-xs uppercase tracking-wide text-brand-muted">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Company</th>
              <th className="px-4 py-2">Segment</th>
              <th className="px-4 py-2">Variant</th>
              <th className="px-4 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-brand-muted">Nothing left to invite in this campaign.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.lead_id} className={`border-t border-brand-border ${r.invited ? "bg-brand-surface text-brand-muted" : ""}`}>
                <td className="px-4 py-3 font-medium">
                  <a href={r.linkedin_url} target="_blank" rel="noreferrer" className={`hover:underline ${r.invited ? "" : "text-brand-ink"}`}>{r.name}</a>
                </td>
                <td className="px-4 py-3">{r.title}</td>
                <td className="px-4 py-3">{r.company}</td>
                <td className="px-4 py-3">{r.segment}</td>
                <td className="px-4 py-3"><span className={`pill ${r.proposed_variant === "A" ? "bg-brand-primary-soft text-brand-primary" : "bg-brand-accent-soft text-brand-accent"}`}>Variant {r.proposed_variant}</span></td>
                <td className="px-4 py-3 text-right">
                  {r.invited ? (
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs">Invited {r.invited_at ? new Date(r.invited_at).toLocaleDateString() : ""}</span>
                      <button className="btn-secondary" disabled={busy[`${r.lead_id}:accepted`]} onClick={() => act(r, "accepted")}>Mark accepted</button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      <button className="btn-ghost" disabled={busy[`${r.lead_id}:accepted`]} onClick={() => act(r, "accepted")}>Mark accepted</button>
                      <button className="btn-primary" disabled={busy[`${r.lead_id}:invite_sent`]} onClick={() => act(r, "invite_sent")}>Invitation sent</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-brand-muted">Variant is assigned by hash of the LinkedIn URL. Adding leads later never reshuffles A/B.</p>
    </div>
  );
}
