// The one-screen Today, laid out like God's L'Eye: big title, two stat tiles, a live sync line,
// then folding sections. Sending on LinkedIn stays manual; every button here only records it.
import { useLive } from "../lib/live";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { api, fmtWeekdayDate, newIdempotencyKey, type PersonRow, type SheetDueRow, type TodayCard, type WorkdayResponse } from "../lib/api";
import { useCampaign } from "../lib/campaign-context";
import { useToast } from "../lib/toast";
import { useSide } from "../lib/Shell";

type CardExit = "sent" | "replied" | "skipped" | "not_a_fit";

function Section({ id, title, count, children, defaultOpen = true }: { id: string; title: string; count: number | string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section id={`sec-${id}`} className="scroll-mt-4">
      <button
        className="mb-2.5 mt-8 flex w-full items-center gap-2.5 rounded-lg text-left font-display text-lg font-extrabold"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <i className={`inline-block h-2 w-2 border-b-[2.5px] border-r-[2.5px] border-current opacity-70 transition-transform ${open ? "rotate-45" : "-rotate-45"}`} aria-hidden />
        <span>{title}</span>
        <span className="rounded-full bg-brand-navy px-2.5 py-0.5 font-sans text-xs font-extrabold text-brand-on-navy">{count}</span>
      </button>
      {open && <div>{children}</div>}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="px-0.5 py-1.5 text-sm text-brand-muted">{children}</p>;
}

export default function Workday() {
  const { active } = useCampaign();
  const toast = useToast();
  const side = useSide();
  const [data, setData] = useState<WorkdayResponse | null>(null);
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const [sheetOn, setSheetOn] = useState(false);
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const keys = useRef(new Map<string, string>());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [last, setLast] = useState<{ label: string; name: string; contact_id: string; stage_after: string } | null>(null);
  const [sheetRows, setSheetRows] = useState<SheetDueRow[] | null>(null);
  const [conn, setConn] = useState<Awaited<ReturnType<typeof api.config>> | null>(null);
  const [editing, setEditing] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const [range, setRange] = useState<"7" | "14" | "30" | "all">(() => (localStorage.getItem("tracker.scoreRange") as "7" | "14" | "30" | "all") || "30");
  const [edits, setEdits] = useState<Record<string, string>>({}); // "<contact>:<variant>" -> edited text
  const dateParam = () => new URLSearchParams(window.location.search).get("date") ?? undefined;

  const loadSheet = useCallback(async () => {
    try {
      setSheetRows((await api.sheetToday(dateParam())).rows);
    } catch (e: any) {
      toast.show({ text: e.message ?? String(e), ttlMs: 4500 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    if (!active) return;
    // ?date=YYYY-MM-DD previews another day (demo use); omitted = today
    const d = new URLSearchParams(window.location.search).get("date") ?? undefined;
    setData(await api.workday(active.id, d));
  }, [active]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);
  useEffect(() => {
    api.sheetStatus().then((r) => setSheetOn(r.configured)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (sheetOn) loadSheet();
  }, [sheetOn, loadSheet]);

  // the screen follows the data folder; there is no refresh button
  const loadConn = useCallback(() => api.config().then(setConn).catch(() => undefined), []);
  useEffect(() => { loadConn(); }, [loadConn]);
  useLive(() => { load(); loadConn(); if (sheetOn) loadSheet(); });

  const sync = useCallback(async () => {
    if (!active) return;
    side.set({ syncing: true });
    try {
      const r = await api.sheetSync(active.id);
      setSyncedAt(new Date());
      toast.show({ text: `Sheet synced · ${r.created} new, ${r.accepted} accepted, ${r.dossiers} dossiers, ${r.queued} in research`, ttlMs: 4000 });
      await load();
      await loadSheet();
    } catch (e: any) {
      toast.show({ text: e.message ?? String(e), ttlMs: 4500 });
    } finally {
      side.set({ syncing: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, load]);

  // publish this screen's sections + meter to the sidebar
  useEffect(() => {
    if (!data) return;
    const dueCount = sheetOn ? sheetRows?.length ?? 0 : data.cards.length;
    side.set({
      sections: [
        { id: "waiting", label: "Waiting on you", count: data.waiting_on_you.length },
        { id: "due", label: "Messages due", count: dueCount },
        { id: "researching", label: "Researching", count: data.researching.length },
        { id: "accept", label: "Did they accept?", count: data.awaiting.length },
        { id: "invite", label: "New people to invite", count: data.to_invite.length },
      ],
      meter: { used: data.invited_today, cap: data.daily_cap },
      sync: sheetOn ? sync : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, sheetOn, sync, sheetRows]);
  useEffect(() => () => side.set({ sections: [], meter: null, refresh: null, sync: null }), []); // eslint-disable-line react-hooks/exhaustive-deps

  async function post(lead_id: string, kind: "invite_sent" | "accepted" | "withdrawn" | CardExit, step?: number, body?: string, doneText?: string, payload?: Record<string, unknown>) {
    if (!active) return;
    const k = `${lead_id}:${step ?? 0}:${kind}${payload?.booked ? ":booked" : ""}`;
    if (!keys.current.has(k)) keys.current.set(k, newIdempotencyKey());
    try {
      const out = await api.postEvent({ campaign_id: active.id, lead_id, kind, step, body_text: body, payload, idempotency_key: keys.current.get(k)! });
      if (out.duplicate) {
        toast.show({ text: "Already logged. One row, not two.", ttlMs: 2500 });
      } else {
        const id = out.event!.event_id;
        toast.show({
          text: doneText ?? "Logged",
          actionLabel: "Undo",
          ttlMs: 5000,
          onAction: async () => { await api.undo(id); keys.current.delete(k); await load(); },
        });
      }
      setLeaving((s) => new Set(s).add(lead_id));
      window.setTimeout(async () => {
        await load();
        setLeaving((s) => { const n = new Set(s); n.delete(lead_id); return n; });
      }, 320);
    } catch (e: any) {
      toast.show({ text: e.message ?? String(e), ttlMs: 4000 });
    }
  }

  async function undoLast(l: { name: string; contact_id: string; stage_after: string }) {
    try {
      const u = await api.sheetAct({ action: "undo", contact_id: l.contact_id, expect_stage: l.stage_after, request_id: newIdempotencyKey() });
      if (u.conflict) toast.show({ text: `Could not undo ${l.name}: the sheet row moved. Card refreshed, nothing was written.`, ttlMs: 4500 });
      else if (!u.ok) toast.show({ text: `Undo failed: ${u.error ?? "error"}`, ttlMs: 4500 });
      else { setLast(null); toast.show({ text: `Undone · ${l.name}`, ttlMs: 2000 }); }
    } catch (e: any) {
      toast.show({ text: e.message ?? String(e), ttlMs: 4500 });
    }
    await loadSheet();
  }

  async function sheetAct(row: SheetDueRow, action: "mark_sent" | "skip" | "replied", variant?: string, editedText?: string) {
    const cid = row["Contact ID"];
    if (busy.has(cid)) return; // one write per person at a time
    setBusy((s) => new Set(s).add(cid));
    try {
      let variantId = variant;
      if (action === "mark_sent" && editedText !== undefined) {
        // An edited option is stored first so the sheet keeps the exact words; mark_sent then names the returned id.
        if (editedText.trim() === "") variantId = "manual";
        else {
          const slot = Number(/^V(\d+)-/.exec(variant ?? "")?.[1] ?? 1);
          const st = await api.sheetStoreVariant({ contact_id: row["Contact ID"], stage: row.Stage, slot, text: editedText });
          if (!st.ok || !st.variants?.[0]) {
            toast.show({ text: `Could not save your edited message (${st.error ?? "no id returned"}). Nothing was marked sent.`, ttlMs: 5000 });
            return;
          }
          variantId = st.variants[0];
        }
      }
      const r = await api.sheetAct({ action, contact_id: row["Contact ID"], expect_stage: row.Stage, request_id: newIdempotencyKey(), variant: variantId });
      if (r.conflict) {
        toast.show({ text: `${row["Full Name"]} changed in the sheet. Card refreshed, nothing was written.`, ttlMs: 4000 });
      } else if (!r.ok) {
        toast.show({ text: `Sheet said: ${r.error ?? "error"}`, ttlMs: 4000 });
      } else {
        const label = action === "mark_sent" ? "Marked sent" : action === "skip" ? "Skipped until tomorrow" : "Marked replied";
        const entry = { label, name: row["Full Name"], contact_id: row["Contact ID"], stage_after: r.row?.Stage ?? "" };
        setLast(entry);
        toast.show({ text: `${label} · ${row["Full Name"]}`, actionLabel: "Undo", ttlMs: 6000, onAction: () => undoLast(entry) });
      }
    } catch (e: any) {
      toast.show({ text: e.message ?? String(e), ttlMs: 4500 });
    } finally {
      setBusy((s) => { const n = new Set(s); n.delete(cid); return n; });
    }
    await loadSheet();
  }

  async function copyBody(card: TodayCard) {
    try {
      await navigator.clipboard.writeText(card.body);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = card.body;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(card.lead_id);
    window.setTimeout(() => setCopied((c) => (c === card.lead_id ? null : c)), 1500);
  }

  if (!active) return <div className="px-6 py-10 text-brand-muted">No campaign yet. <Link className="underline" to="/campaigns/new">Create one.</Link></div>;
  if (!data) return <div className="px-6 py-10 text-brand-muted">Loading…</div>;

  const dueNow = sheetOn ? sheetRows?.length ?? 0 : data.cards.length;
  const personRow = (p: PersonRow, actions: ReactNode, note?: string) => (
    <div key={p.lead_id} className={`grid grid-cols-1 items-center gap-2 border-t border-brand-border py-2.5 first:border-t-0 sm:grid-cols-[1fr_auto] ${leaving.has(p.lead_id) ? "opacity-40" : ""}`}>
      <div>
        <b>{p.name}</b>
        <span className="block text-sm text-brand-muted">{[p.title, p.company, p.segment].filter(Boolean).join(" · ")}{note ? ` · ${note}` : ""}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
  const profile = (p: PersonRow) => <a className="btn-secondary" href={p.linkedin_url} target="_blank" rel="noreferrer">Open profile</a>;

  return (
    <div>
      <header className="px-5 pb-1 pt-7 lg:px-6">
        <div className="mx-auto max-w-[860px]">
          <h1 className="font-display text-4xl font-black tracking-tight lg:text-5xl">Today</h1>
          <p className="mt-1.5 text-sm text-brand-muted">{fmtWeekdayDate(data.date)} · {data.campaign.name} · <em>{data.campaign.icp_sentence}</em></p>
        </div>
      </header>

      <main className="px-5 pb-20 lg:px-6">
        <div className="mx-auto max-w-[860px]">
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-brand-navy px-4 py-4 text-brand-on-navy">
              <div className="font-display text-4xl font-black leading-none">{dueNow}</div>
              <div className="mt-1 text-sm font-semibold opacity-80">messages to send today</div>
            </div>
            <div className="rounded-2xl bg-brand-cream px-4 py-4 text-brand-on-cream">
              <div className="font-display text-4xl font-black leading-none">{data.researching.length + data.awaiting.length}</div>
              <div className="mt-1 text-sm font-semibold">in the pipeline ({data.awaiting.length} to accept, {data.researching.length} researching)</div>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-brand-border bg-brand-card px-3.5 py-3 text-sm">
            <span className={`mr-1.5 inline-block h-2 w-2 rounded-full align-middle ${conn?.connected ? "bg-green-500" : "bg-brand-accent"}`} aria-hidden />
            {conn?.connected ? (
              <>
                Connected: <a className="font-semibold underline" href={conn.sheet_url ?? "#"} target="_blank" rel="noreferrer">{conn.sheet_title ?? "your sheet"}</a>
                {conn.last_synced_at ? ` · last synced ${new Date(conn.last_synced_at).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}` : " · not synced yet"}
              </>
            ) : (
              <>Not connected to a sheet. Paste its link below, or give it to the Scout.</>
            )}
            {" "}
            <button className="btn-link" onClick={() => { setUrlDraft(conn?.sheet_url ?? ""); setEditing((e) => !e); }}>{conn?.connected ? "Change" : "Add sheet link"}</button>
            {editing && (
              <form className="mt-2 flex flex-wrap items-center gap-2" onSubmit={async (e) => {
                e.preventDefault();
                try { await api.setSheetUrl(urlDraft.trim()); setEditing(false); await loadConn(); toast.show({ text: urlDraft.trim() ? "Sheet link saved" : "Sheet link removed", ttlMs: 2500 }); }
                catch (err: any) { toast.show({ text: err.message ?? String(err), ttlMs: 4000 }); }
              }}>
                <input className="input min-w-0 flex-1" placeholder="https://docs.google.com/spreadsheets/d/…" value={urlDraft} onChange={(e) => setUrlDraft(e.target.value)} aria-label="Sheet link" />
                <button className="btn-primary" type="submit">Save</button>
              </form>
            )}
            <span className="mt-1 block text-xs text-brand-muted">The dashboard only stores the link. Your agent does the reading and writing, and sending on LinkedIn stays manual.</span>
          </div>

          {(() => {
            const sc = data.scorecard[range];
            const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "–");
            const tiles: [string, number, string][] = [
              ["Invited", sc.invited, ""],
              ["Accepted", sc.accepted, `${pct(sc.accepted, sc.invited)} of invited`],
              ["Messaged", sc.messaged, `${pct(sc.messaged, sc.accepted)} of accepted`],
              ["Replied", sc.replied, `${pct(sc.replied, sc.messaged)} of messaged`],
              ["Call booked", sc.booked, `${pct(sc.booked, sc.replied)} of replies`],
            ];
            return (
              <Section id="score" title="Scorecard" count={range === "all" ? "all time" : `${range} days`}>
                <div className="mb-2 flex gap-1.5" role="group" aria-label="Range">
                  {(["7", "14", "30", "all"] as const).map((r) => (
                    <button key={r} aria-pressed={range === r} className={range === r ? "btn-primary" : "btn-secondary"} onClick={() => { setRange(r); localStorage.setItem("tracker.scoreRange", r); }}>{r === "all" ? "All" : `${r} days`}</button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                  {tiles.map(([label, n, sub]) => (
                    <div key={label} className="card px-3 py-3">
                      <div className="font-display text-3xl font-black leading-none">{n}</div>
                      <div className="mt-1 text-sm font-semibold">{label}</div>
                      <div className="text-xs text-brand-muted">{sub || " "}</div>
                    </div>
                  ))}
                </div>
              </Section>
            );
          })()}

          <Section id="waiting" title="They replied, waiting on you" count={data.waiting_on_you.length}>
            {data.waiting_on_you.length === 0 ? <Empty>Nobody is waiting on an answer.</Empty> : (
              <div className="card p-4">
                {data.waiting_on_you.map((wr) => (
                  <div key={wr.lead_id} className={`grid grid-cols-1 items-center gap-2 border-t border-brand-border py-2.5 first:border-t-0 sm:grid-cols-[1fr_auto] ${leaving.has(wr.lead_id) ? "opacity-40" : ""}`}>
                    <div>
                      <b>{wr.name}</b>
                      <span className="block text-sm text-brand-muted">{wr.company} · replied {wr.days_waiting === 0 ? "today" : `${wr.days_waiting} day${wr.days_waiting === 1 ? "" : "s"} ago`}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button className="btn-primary" onClick={() => post(wr.lead_id, "sent", undefined, undefined, `Answer logged · ${wr.name}`, { answered: true })}>I answered</button>
                      <button className="btn-secondary" onClick={() => post(wr.lead_id, "sent", undefined, undefined, `Call booked · ${wr.name}`, { answered: true, booked: true })}>Call booked</button>
                      <button className="btn-ghost" onClick={() => post(wr.lead_id, "not_a_fit", undefined, undefined, `Marked not a fit · ${wr.name}`)}>Not a fit</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section id="due" title="Messages due" count={dueNow}>
            {sheetOn && last ? (
              <div className="mb-2.5 flex flex-wrap items-center gap-2 rounded-lg border border-brand-border bg-brand-card px-3 py-2 text-sm">
                <span className="text-brand-muted">Last action:</span>
                <b>{last.label} · {last.name}</b>
                <button className="btn-secondary ml-auto" onClick={() => undoLast(last)}>Undo</button>
                <button className="btn-link" onClick={() => setLast(null)} aria-label="Dismiss">Dismiss</button>
              </div>
            ) : null}
            {sheetOn ? (
              <SheetDue rows={sheetRows} edits={edits} setEdits={setEdits} onAct={sheetAct} busy={busy} date={data.date} />
            ) : data.cards.length === 0 ? (
              <div className="rounded-xl border-2 border-brand-ok bg-brand-ok-soft px-4 py-7 text-center">
                <div className="text-xl font-extrabold">Nothing due today</div>
                <p className="mt-1 text-sm text-brand-muted">
                  {data.sent_this_week} sent this week. Next due: {data.next_due ? <strong>{fmtWeekdayDate(data.next_due)}</strong> : "nothing scheduled"}.
                </p>
              </div>
            ) : (
              data.cards.map((card) => (
                <article key={card.lead_id} className={`card mb-2.5 p-4 transition-opacity ${leaving.has(card.lead_id) ? "opacity-30" : ""}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold">{card.name}</span>
                    <span className="pill bg-brand-navy text-brand-on-navy">step {card.step} of {card.total_steps}</span>
                    <span className={`pill ${card.variant === "A" ? "bg-brand-primary-soft text-brand-primary" : "bg-brand-accent-soft text-brand-accent"}`}>variant {card.variant}</span>
                    <span className="text-sm text-brand-muted">{card.title} at {card.company} · {card.days_since_touch == null ? "first message" : `${card.days_since_touch} days since last touch`}</span>
                  </div>
                  <div className="mt-1 text-xs text-brand-muted">{card.angle}</div>
                  <pre className="my-3 whitespace-pre-wrap rounded-md border-l-[3px] border-brand-accent bg-brand-surface px-3 py-2.5 font-sans text-[15px] leading-relaxed">{card.body}</pre>
                  <div className="flex flex-wrap items-center gap-2">
                    {card.dossier_path ? <a className="btn-secondary" href={api.dossierUrl(card.dossier_path)} target="_blank" rel="noreferrer">Open dossier</a> : null}
                    <a className="btn-secondary" href={card.linkedin_url} target="_blank" rel="noreferrer">Open profile</a>
                    <button className="btn-secondary" onClick={() => copyBody(card)}>{copied === card.lead_id ? "Copied" : "Copy message"}</button>
                    <button className="btn-primary" onClick={() => post(card.lead_id, "sent", card.step, card.body, `Sent logged · ${card.name}`)}>Sent</button>
                    <button className="btn-secondary" onClick={() => post(card.lead_id, "replied", card.step, undefined, `Reply logged · ${card.name}`)}>Replied (stop sequence)</button>
                    <button className="btn-ghost" onClick={() => post(card.lead_id, "skipped", card.step, undefined, `Skipped · ${card.name}`)}>Skip</button>
                    <button className="btn-danger" onClick={() => post(card.lead_id, "not_a_fit", card.step, undefined, `Marked not a fit · ${card.name}`)}>Not a fit</button>
                  </div>
                </article>
              ))
            )}
          </Section>

          <Section id="researching" title="Researching" count={data.researching.length}>
            {data.researching.length === 0 ? <Empty>Nobody waiting on research.</Empty> : (
              <div className="card p-4">
                <p className="text-sm text-brand-muted">Accepted. The research agent builds a dossier and your messages; each person moves up to Messages due when it is ready.</p>
                {data.researching.map((p) => personRow(p, profile(p), p.accepted_at ? `accepted ${fmtWeekdayDate(p.accepted_at.slice(0, 10))}` : undefined))}
              </div>
            )}
          </Section>

          <Section id="accept" title="Did they accept?" count={data.awaiting.length}>
            {data.awaiting.length === 0 ? <Empty>No pending invitations.</Empty> : (
              <div className="card p-4">
                {data.awaiting.map((p) => personRow(p, (
                  <>
                    {profile(p)}
                    <button className="btn-primary" onClick={() => post(p.lead_id, "accepted", undefined, undefined, `Accepted · ${p.name} goes to research`)}>Accepted</button>
                    <button className="btn-ghost" onClick={() => post(p.lead_id, "not_a_fit", undefined, undefined, `Marked not a fit · ${p.name}`)}>Drop</button>
                  </>
                ), p.invited_at ? `invited ${fmtWeekdayDate(p.invited_at.slice(0, 10))}` : undefined))}
              </div>
            )}
          </Section>

          {data.stale_invites.length > 0 && (
            <Section id="stale" title="Invites waiting 90+ days" count={data.stale_invites.length}>
              <div className="card p-4">
                <p className="mb-2 text-sm text-brand-muted">These never accepted. Withdraw each on LinkedIn (Manage invitations → Sent), then tell the dashboard so it stops tracking them.</p>
                <button className="btn-secondary mb-2" onClick={async () => { for (const p of data.stale_invites) await post(p.lead_id, "withdrawn", undefined, undefined, `Withdrawn · ${p.name}`); }}>I withdrew all {data.stale_invites.length}</button>
                {data.stale_invites.map((p) => personRow(p, (
                  <>
                    {profile(p)}
                    <button className="btn-primary" onClick={() => post(p.lead_id, "withdrawn", undefined, undefined, `Withdrawn · ${p.name}`)}>I withdrew it</button>
                  </>
                ), `invited ${p.days_invited} days ago`))}
              </div>
            </Section>
          )}

          <Section id="invite" title="New people to invite" count={data.to_invite.length}>
            {data.to_invite.length === 0 ? <Empty>No new prospects. The Scout adds them to your sheet.</Empty> : data.to_invite.map((p) => (
              <article key={p.lead_id} className={`card mb-2.5 p-4 transition-opacity ${leaving.has(p.lead_id) ? "opacity-30" : ""}`}>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <b>{p.name}</b>
                  <span className="text-sm text-brand-muted">{[p.title, p.company].filter(Boolean).join(" at ")}{p.segment ? ` · ${p.segment}` : ""}</span>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <a className="btn-primary" href={p.linkedin_url} target="_blank" rel="noreferrer">Connect on LinkedIn</a>
                  <button className="btn-link" onClick={() => post(p.lead_id, "invite_sent", undefined, undefined, `Invitation logged · ${p.name}`)}>I invited on LinkedIn</button>
                  <button className="btn-link" onClick={() => post(p.lead_id, "not_a_fit", undefined, undefined, `Marked do not contact · ${p.name}`)}>Do not contact</button>
                </div>
                <p className="mt-2 text-sm text-brand-muted">Connect on their profile (no note), then tap “I invited on LinkedIn”.</p>
              </article>
            ))}
          </Section>
        </div>
      </main>
    </div>
  );
}

function stageLabel(s: string) {
  return s === "to_send" ? "First message" : s === "day4" ? "Day 4 follow-up" : "Day 10 follow-up";
}

/** Messages due, straight from the sheet. One card per person: A/B/C pills pick the option, one editable box,
 *  Copy, Open profile, then report it posted. Follow-ups carry a single option, so no pills. */
function SheetDue({ rows, edits, setEdits, onAct, busy, date }: {
  rows: SheetDueRow[] | null;
  edits: Record<string, string>;
  setEdits: (f: (e: Record<string, string>) => Record<string, string>) => void;
  onAct: (row: SheetDueRow, action: "mark_sent" | "skip" | "replied", variant?: string, editedText?: string) => void;
  busy: Set<string>;
  date: string;
}) {
  const [nudged, setNudged] = useState<Set<string>>(new Set()); // copied but not yet reported posted
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, number>>({}); // contact -> selected option index
  if (rows === null) return <Empty>Loading from your sheet…</Empty>;
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border-2 border-brand-ok bg-brand-ok-soft px-4 py-7 text-center">
        <div className="text-xl font-extrabold">Nothing due today</div>
        <p className="mt-1 text-sm text-brand-muted">New messages appear here when the research agent finishes a dossier. {fmtWeekdayDate(date)}.</p>
      </div>
    );
  }
  const copy = async (key: string, text: string) => {
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
    }
    setCopiedKey(key);
    setNudged((s) => new Set(s).add(key));
    window.setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
  };
  const letters = ["A", "B", "C", "D", "E"];
  return (
    <>
      {rows.map((row) => {
        const id = row["Contact ID"];
        const url = row["LinkedIn URL"];
        const opts = row.Variants;
        const idx = Math.min(picked[id] ?? 0, Math.max(0, opts.length - 1));
        const v = opts[idx];
        const key = v ? `${id}:${v.Variant}` : id;
        const text = v ? edits[key] ?? v.Body : "";
        const edited = !!v && text !== v.Body;
        const letter = letters[idx] ?? String(idx + 1);
        return (
          <article key={id} className="card mb-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-extrabold">{row["Full Name"]}</span>
              <span className="text-sm text-brand-muted">{[row.Title, row.Company].filter(Boolean).join(" at ")}</span>
              <span className="pill bg-brand-navy text-brand-on-navy uppercase tracking-wide">{stageLabel(row.Stage)}</span>
            </div>
            {opts.length > 1 && (
              <div className="mt-2.5 flex gap-1.5" role="tablist" aria-label="Message options">
                {opts.map((o, i) => (
                  <button
                    key={o.Variant}
                    role="tab"
                    aria-selected={i === idx}
                    onClick={() => setPicked((p) => ({ ...p, [id]: i }))}
                    className={`h-8 w-8 rounded-md border text-sm font-extrabold ${i === idx ? "border-brand-navy bg-brand-navy text-brand-on-navy" : "border-brand-border bg-brand-card text-brand-ink hover:bg-brand-primary-soft"}`}
                  >
                    {letters[i] ?? i + 1}
                  </button>
                ))}
              </div>
            )}
            {v ? (
              <>
                <div className="mt-2 text-xs text-brand-muted">
                  {opts.length > 1 ? `Variant ${letter} ` : "Message "}
                  {edited ? "(edited, will be recorded as your own)" : "(edit it here before you copy)"}
                </div>
                <textarea
                  className={`mt-1 block min-h-[150px] w-full resize-y rounded-md border-l-[3px] p-3 text-[15px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-accent/25 ${nudged.has(key) ? "border-brand-highlight bg-brand-highlight-soft" : "border-brand-accent bg-brand-surface"}`}
                  value={text}
                  onChange={(e) => setEdits((m) => ({ ...m, [key]: e.target.value }))}
                />
              </>
            ) : (
              <p className="mt-3 text-sm text-brand-muted">No message options yet. The agent has not posted any for this stage.</p>
            )}
            {v && nudged.has(key) ? <p className="mt-1.5 text-sm font-semibold text-brand-ink">Copied. Paste it on LinkedIn, then come back and tap “I posted {letter} on LinkedIn”.</p> : null}
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {v ? <button className="btn-secondary" onClick={() => copy(key, text)}>{copiedKey === key ? "Copied" : "Copy"}</button> : null}
              {url ? <a className="btn-secondary" href={url} target="_blank" rel="noreferrer">Open profile</a> : null}
              {v ? <button className="btn-primary" disabled={busy.has(id)} onClick={() => onAct(row, "mark_sent", v.Variant, edited ? text : undefined)}>{busy.has(id) ? "Saving…" : opts.length > 1 ? `I posted ${letter} on LinkedIn` : "I posted this on LinkedIn"}</button> : null}
              <button className="btn-secondary" disabled={busy.has(id)} onClick={() => onAct(row, "replied")}>They replied</button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {row["Dossier URL"] ? <a className="btn-link" href={row["Dossier URL"]} target="_blank" rel="noreferrer">Open dossier</a> : null}
              <button className="btn-link" disabled={busy.has(id)} onClick={() => onAct(row, "skip")}>Skip until tomorrow</button>
            </div>
          </article>
        );
      })}
    </>
  );
}
