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
  // Desktop only: collapse the sidebar to icons. Remembered on this device. On a phone the sidebar is a drawer and always shows labels.
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("tracker.sideCollapsed") === "1");
  const toggleCollapsed = () => setCollapsed((c) => { localStorage.setItem("tracker.sideCollapsed", c ? "0" : "1"); return !c; });
  const hide = collapsed ? "lg:hidden" : "";
  const ICON: Record<string, string> = { waiting: "💬", due: "✉️", researching: "🔎", accept: "🤝", stale: "⏳", invite: "➕" };
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
          className={`fixed left-0 top-0 z-30 flex h-screen w-60 shrink-0 flex-col gap-3.5 bg-brand-navy px-4 py-5 text-brand-on-navy shadow-2xl transition-all lg:sticky lg:translate-x-0 lg:shadow-none ${collapsed ? "lg:w-[72px] lg:px-2" : ""} ${open ? "translate-x-0" : "-translate-x-full"}`}
        >
          <button className="absolute right-3 top-3 rounded-full bg-white/10 px-2.5 py-1 text-sm text-white/80 lg:hidden" onClick={() => setOpen(false)} aria-label="Close sections">✕</button>
          <Link to="/today" title="God’s L’Eye" className={`flex items-center gap-2.5 font-display text-lg font-extrabold ${collapsed ? "lg:justify-center" : ""}`}>
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-brand-accent text-sm text-brand-on-accent" aria-hidden>👁</span>
            <span className={`flex flex-col leading-tight ${hide}`}>God’s L’Eye<span className="text-[10px] font-semibold opacity-70">GenTeam (Genspark) Edition</span></span>
          </Link>

          <p className={`flex items-center gap-2 px-1 text-xs text-brand-on-navy opacity-70 ${collapsed ? "lg:justify-center" : ""}`} title="Updates automatically"><span className="h-2 w-2 rounded-full bg-green-400" aria-hidden /><span className={hide}>Updates automatically</span></p>
          {value.sync && (
            <button disabled={value.syncing} className="flex w-full items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/15 disabled:opacity-60" onClick={value.sync}>
              <span aria-hidden>⇅</span><span className={hide}>{value.syncing ? "Syncing sheet…" : "Sync sheet"}</span>
            </button>
          )}

          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
            <NavLink to="/today" title="Today" className={link} onClick={() => setOpen(false)}><span><span aria-hidden className={collapsed ? "" : "lg:hidden"}>📅</span><span className={hide}>Today</span></span></NavLink>
            <NavLink to="/campaigns" end title="Campaigns" className={link} onClick={() => setOpen(false)}><span><span aria-hidden className={collapsed ? "" : "lg:hidden"}>🗂</span><span className={hide}>Campaigns</span></span></NavLink>
            <NavLink to="/scout" title="Scout" className={link} onClick={() => setOpen(false)}><span><span aria-hidden className={collapsed ? "" : "lg:hidden"}>🔭</span><span className={hide}>Scout</span></span></NavLink>
            <NavLink to="/ledger" title="Ledger" className={link} onClick={() => setOpen(false)}><span><span aria-hidden className={collapsed ? "" : "lg:hidden"}>📒</span><span className={hide}>Ledger</span></span></NavLink>
            {value.sections.length > 0 && <div className="mt-3 border-t border-white/10 pt-3 text-[10px] font-bold uppercase tracking-wider text-white/40"><span className={hide}>On this page</span></div>}
            {value.sections.map((s) => (
              <button key={s.id} onClick={() => jump(s.id)} title={`${s.label} (${s.count})`} className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-white/75 hover:bg-white/10 hover:text-white ${collapsed ? "lg:flex-col lg:gap-0.5 lg:px-1" : ""}`}>
                <span className="flex items-center gap-2"><span aria-hidden className={collapsed ? "" : "lg:hidden"}>{ICON[s.id] ?? "•"}</span><span className={hide}>{s.label}</span></span>
                <b className="font-display text-xs font-extrabold" style={{ color: theme.highlight }}>{s.count}</b>
              </button>
            ))}
            <div className="mt-3 border-t border-white/10 pt-3" />
            {activeId && <NavLink to={`/campaigns/${activeId}`} title="Campaign settings and delete" className={link} onClick={() => setOpen(false)}><span><span aria-hidden className={collapsed ? "" : "lg:hidden"}>⚙</span><span className={hide}>Manage campaign</span></span></NavLink>}
          </nav>

          {value.meter && (
            <div className={`rounded-xl bg-white/10 px-3 py-2.5 text-xs text-white/75 ${hide}`}>
              Invites today <b style={{ color: theme.highlight }}>{value.meter.used}{value.meter.cap > 0 ? ` · target ${value.meter.cap}` : ""}</b>
              {value.meter.cap > 0 ? (
                <div className="my-1.5 h-1.5 rounded-full bg-white/15">
                  <i className="block h-full rounded-full" style={{ width: `${pct}%`, background: theme.highlight }} />
                </div>
              ) : <div className="my-1.5" />}
              Send invites by hand; log each one here.
            </div>
          )}

          <select
            className={`rounded-lg border border-white/15 bg-white/10 px-2 py-1.5 text-sm text-white ${hide}`}
            value={activeId ?? ""}
            onChange={(e) => { setActiveId(e.target.value); nav("/today"); }}
            aria-label="Active campaign"
          >
            {campaigns.length === 0 && <option value="">— no campaign yet —</option>}
            {campaigns.map((c) => (
              <option key={c.id} value={c.id} className="text-black">{c.name}</option>
            ))}
          </select>
          <button className={`flex items-center gap-2 text-sm text-brand-cream hover:underline ${collapsed ? "lg:justify-center" : ""}`} onClick={() => setBrandOpen(true)} title="Brand colours">
            <span className="flex gap-0.5" aria-hidden>
              <span className="h-3 w-3 rounded-sm" style={{ background: theme.primary }} />
              <span className="h-3 w-3 rounded-sm" style={{ background: theme.accent }} />
              <span className="h-3 w-3 rounded-sm" style={{ background: theme.highlight }} />
            </span>
            <span className={hide}>Brand colours</span>
          </button>
          <button className="hidden items-center justify-center gap-2 rounded-lg border border-white/15 px-2 py-1.5 text-xs text-white/70 hover:bg-white/10 lg:flex" onClick={toggleCollapsed} aria-pressed={collapsed} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <span aria-hidden>{collapsed ? "»" : "«"}</span><span className={hide}>Collapse</span>
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
