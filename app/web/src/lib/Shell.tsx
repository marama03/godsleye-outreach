// God's L'Eye shell: navy sidebar (section counts, invite meter, refresh, sheet sync, brand) + content column.
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useCampaign } from "./campaign-context";
import { useTheme } from "./theme";
import BrandPanel from "./BrandPanel";

export interface SideSection {
  id: string;
  label: string;
  count: number | string;
}
export interface SideMeter {
  used: number;
  cap: number;
}
export interface SideCtx {
  sections: SideSection[];
  meter: SideMeter | null;
  refresh: (() => void) | null;
  sync: (() => void) | null;
  syncing: boolean;
  set: (v: Partial<Pick<SideCtx, "sections" | "meter" | "refresh" | "sync" | "syncing">>) => void;
}

const Ctx = createContext<SideCtx | null>(null);
export function useSide(): SideCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("Shell missing");
  return v;
}

export default function Shell({ children }: { children: ReactNode }) {
  const { campaigns, activeId, setActiveId } = useCampaign();
  const { theme } = useTheme();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [brandOpen, setBrandOpen] = useState(false);
  const [state, setState] = useState<Omit<SideCtx, "set">>({ sections: [], meter: null, refresh: null, sync: null, syncing: false });
  const value = useMemo<SideCtx>(() => ({ ...state, set: (v) => setState((s) => ({ ...s, ...v })) }), [state]);

  const jump = (id: string) => {
    setOpen(false);
    document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const link = ({ isActive }: { isActive: boolean }) =>
    `flex justify-between gap-2 rounded-lg px-2.5 py-2 text-sm ${isActive ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"}`;
  const pct = value.meter ? Math.min(100, Math.round((value.meter.used / Math.max(1, value.meter.cap)) * 100)) : 0;

  return (
    <Ctx.Provider value={value}>
      <div className="flex min-h-screen">
        <aside
          aria-label="Sections"
          className={`fixed left-0 top-0 z-30 flex h-screen w-60 shrink-0 flex-col gap-3.5 bg-brand-navy px-4 py-5 text-brand-on-navy shadow-2xl transition-transform lg:sticky lg:translate-x-0 lg:shadow-none ${open ? "translate-x-0" : "-translate-x-full"}`}
        >
          <Link to="/today" className="flex items-center gap-2.5 font-display text-lg font-extrabold">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-brand-accent text-sm text-brand-on-accent" aria-hidden>👁</span>
            <span className="flex flex-col leading-tight">God’s L’Eye<span className="text-[10px] font-semibold opacity-70">GenTeam (Genspark) Edition</span></span>
          </Link>

          <p className="flex items-center gap-2 px-1 text-xs text-brand-on-navy opacity-70"><span className="h-2 w-2 rounded-full bg-green-400" aria-hidden />Updates automatically</p>
          {value.sync && (
            <button disabled={value.syncing} className="flex w-full items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/15 disabled:opacity-60" onClick={value.sync}>
              {value.syncing ? "Syncing sheet…" : "⇅ Sync sheet"}
            </button>
          )}

          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
            {value.sections.map((s) => (
              <button key={s.id} onClick={() => jump(s.id)} className="flex justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-white/75 hover:bg-white/10 hover:text-white">
                <span>{s.label}</span>
                <b className="font-display text-xs font-extrabold" style={{ color: theme.highlight }}>{s.count}</b>
              </button>
            ))}
            <div className="mt-3 border-t border-white/10 pt-3" />
            <NavLink to="/ledger" className={link} onClick={() => setOpen(false)}>Ledger</NavLink>
            <NavLink to="/campaigns/new" className={link} onClick={() => setOpen(false)}>New campaign</NavLink>
          </nav>

          {value.meter && (
            <div className="rounded-xl bg-white/10 px-3 py-2.5 text-xs text-white/75">
              Invites today <b style={{ color: theme.highlight }}>{value.meter.used} of {value.meter.cap}</b>
              <div className="my-1.5 h-1.5 rounded-full bg-white/15">
                <i className="block h-full rounded-full" style={{ width: `${pct}%`, background: theme.highlight }} />
              </div>
              Send invites by hand; log each one here.
            </div>
          )}

          <select
            className="rounded-lg border border-white/15 bg-white/10 px-2 py-1.5 text-sm text-white"
            value={activeId ?? ""}
            onChange={(e) => { setActiveId(e.target.value); nav("/today"); }}
            aria-label="Active campaign"
          >
            {campaigns.length === 0 && <option value="">— no campaign yet —</option>}
            {campaigns.map((c) => (
              <option key={c.id} value={c.id} className="text-black">{c.name}</option>
            ))}
          </select>
          <button className="flex items-center gap-2 text-sm text-brand-cream hover:underline" onClick={() => setBrandOpen(true)}>
            <span className="flex gap-0.5" aria-hidden>
              <span className="h-3 w-3 rounded-sm" style={{ background: theme.primary }} />
              <span className="h-3 w-3 rounded-sm" style={{ background: theme.accent }} />
              <span className="h-3 w-3 rounded-sm" style={{ background: theme.highlight }} />
            </span>
            Brand colours
          </button>
        </aside>

        <div className="min-w-0 flex-1">{children}</div>

        <button
          className="fixed bottom-3.5 right-3.5 z-40 rounded-full bg-brand-navy px-4 py-2.5 text-sm font-bold text-brand-on-navy shadow-xl lg:hidden"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          Sections
        </button>
        <BrandPanel open={brandOpen} onClose={() => setBrandOpen(false)} />
      </div>
    </Ctx.Provider>
  );
}
