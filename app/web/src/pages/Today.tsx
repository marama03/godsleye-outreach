import { useLive } from "../lib/live";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtWeekdayDate, newIdempotencyKey, type TodayCard, type TodayResponse } from "../lib/api";
import { useCampaign } from "../lib/campaign-context";
import { useToast } from "../lib/toast";

type ExitKind = "sent" | "replied" | "skipped" | "not_a_fit";

export default function Today() {
  const { active } = useCampaign();
  const toast = useToast();
  const [data, setData] = useState<TodayResponse | null>(null);
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const keys = useRef(new Map<string, string>()); // (lead:step:kind) -> idempotency key

  const load = async () => {
    if (!active) return;
    setData(await api.today(active.id));
  };
  useEffect(() => {
    load().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);
  useLive(load);

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

  async function exit(card: TodayCard, kind: ExitKind) {
    if (!active) return;
    const k = `${card.lead_id}:${card.step}:${kind}`;
    if (!keys.current.has(k)) keys.current.set(k, newIdempotencyKey());
    setBusy((b) => new Set(b).add(k));
    try {
      const out = await api.postEvent({
        campaign_id: active.id,
        lead_id: card.lead_id,
        kind,
        step: card.step,
        body_text: kind === "sent" ? card.body : undefined,
        idempotency_key: keys.current.get(k)!,
      });
      if (out.duplicate) {
        toast.show({ text: "Already logged — one row, not two.", ttlMs: 2500 });
      } else {
        const id = out.event!.event_id;
        const label =
          kind === "sent" ? "Sent logged" : kind === "replied" ? "Reply logged" : kind === "skipped" ? "Skipped" : "Marked not a fit";
        toast.show({
          text: `${label} · ${card.name}`,
          actionLabel: "Undo",
          ttlMs: 5000,
          onAction: async () => {
            await api.undo(id);
            keys.current.delete(k);
            setLeaving((s) => { const n = new Set(s); n.delete(card.lead_id); return n; });
            await load();
          },
        });
      }
      // animate out, then reload
      setLeaving((s) => new Set(s).add(card.lead_id));
      window.setTimeout(async () => {
        await load();
        setLeaving((s) => { const n = new Set(s); n.delete(card.lead_id); return n; });
      }, 380);
    } catch (e: any) {
      toast.show({ text: e.message ?? String(e), ttlMs: 4000 });
    } finally {
      setBusy((b) => { const n = new Set(b); n.delete(k); return n; });
    }
  }

  if (!active) return <p className="text-brand-muted">No campaign yet. <Link className="underline" to="/campaigns/new">Create one.</Link></p>;
  if (!data) return <p className="text-brand-muted">Loading…</p>;

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Today</h1>
          <p className="mt-1 text-sm text-brand-muted">{fmtWeekdayDate(data.date)} · <span className="font-mono">{active.id}</span></p>
        </div>
        <div className="text-right text-sm text-brand-muted">
          {data.cards.length} due · cap {data.daily_cap}
          {data.overflow_count > 0 && data.overflow_rolls_to && (
            <div className="text-xs">+{data.overflow_count} roll to {fmtWeekdayDate(data.overflow_rolls_to)}</div>
          )}
        </div>
      </div>

      {data.stale_replies > 0 && (
        <div className="mt-4 rounded-md border border-brand-primary bg-brand-primary-soft px-4 py-2 text-sm font-semibold text-brand-primary">
          {data.stale_replies} {data.stale_replies === 1 ? "reply" : "replies"} waiting 3+ days
        </div>
      )}

      {data.waiting_on_you.length > 0 && (
        <section className="mt-4 rounded-lg border border-brand-cream bg-brand-cream p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-brand-on-cream">Waiting on you</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {data.waiting_on_you.map((w) => (
              <li key={w.lead_id} className="rounded-md border border-brand-border bg-brand-card px-3 py-1.5 text-sm">
                <span className="font-medium">{w.name}</span> <span className="text-brand-muted">· {w.company} · replied {w.days_waiting}d ago</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-brand-on-cream">A reply stops the sequence. No further step is ever due for these leads.</p>
        </section>
      )}

      {data.all_clear ? (
        <AllClear data={data} />
      ) : (
        <div className="mt-6 space-y-4">
          {data.cards.map((card) => (
            <article
              key={card.lead_id}
              className={`card p-5 ${leaving.has(card.lead_id) ? "animate-cardout" : ""}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">
                    {card.name} <span className="font-normal text-brand-muted">· {card.title} at {card.company} · {card.segment}</span>
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                    <span className="pill bg-brand-navy text-brand-on-navy">step {card.step} of {card.total_steps}</span>
                    <span className={`pill ${card.variant === "A" ? "bg-brand-primary-soft text-brand-primary" : "bg-brand-accent-soft text-brand-accent"}`}>variant {card.variant}</span>
                    <span className="pill bg-brand-surface text-brand-ink">day +{card.offset_days}</span>
                    <span className="text-brand-muted">{card.angle}</span>
                  </div>
                </div>
                <div className="shrink-0 text-right text-sm">
                  <div className="font-semibold">
                    {card.days_since_touch == null ? "first message" : `${card.days_since_touch} days since last touch`}
                  </div>
                  <div className="text-xs text-brand-muted">due {fmtWeekdayDate(card.due_date)}</div>
                </div>
              </div>

              <div className="relative mt-4">
                <pre className="whitespace-pre-wrap rounded-md border border-brand-border bg-brand-surface p-4 font-sans text-[15px] leading-relaxed">{card.body}</pre>
                <button className="btn-secondary absolute right-2 top-2" onClick={() => copyBody(card)}>
                  {copied === card.lead_id ? "Copied" : "Copy"}
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="flex gap-3 text-sm">
                  {card.dossier_path ? (
                    <a className="underline" href={api.dossierUrl(card.dossier_path)} target="_blank" rel="noreferrer">Open dossier</a>
                  ) : (
                    <span className="text-brand-muted">No dossier yet</span>
                  )}
                  <a className="underline" href={card.linkedin_url} target="_blank" rel="noreferrer">Open profile</a>
                </div>
                <div className="flex gap-2">
                  <button className="btn-secondary" onClick={() => copyBody(card)}>Copy</button>
                  <button className="btn-primary" disabled={busy.has(`${card.lead_id}:${card.step}:sent`)} onClick={() => exit(card, "sent")}>Sent</button>
                  <button className="btn-secondary" onClick={() => exit(card, "replied")}>Replied</button>
                  <button className="btn-ghost" onClick={() => exit(card, "skipped")}>Skip</button>
                  <button className="btn-danger" onClick={() => exit(card, "not_a_fit")}>Not a fit</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function AllClear({ data }: { data: TodayResponse }) {
  return (
    <div className="card mt-6 flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-ok-soft text-3xl text-brand-ok" aria-label="All clear">✓</div>
      <h2 className="mt-5 text-3xl font-bold tracking-tight">Nothing due today</h2>
      <p className="mt-2 text-brand-muted">
        {data.sent_this_week} {data.sent_this_week === 1 ? "message" : "messages"} sent this week.
      </p>
      <p className="mt-1 text-brand-muted">
        Next due: {data.next_due ? <strong>{fmtWeekdayDate(data.next_due)}</strong> : <span className="text-brand-muted">nothing scheduled</span>}
      </p>
      <Link to="/ledger" className="btn-ghost mt-6">See what your taps just did</Link>
    </div>
  );
}
