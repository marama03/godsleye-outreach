// Brand theme. Every colour in the UI is a CSS variable; this file owns them.
// Default palette ("Orange meets Navy"). Saved in data/config.json (follows the person across devices); localStorage is the fallback.
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export interface Theme {
  primary: string; // buttons, active nav, links
  accent: string; // warm secondary (variant B, toasts)
  highlight: string; // yellow: flash-in rows, undo action
  navy: string; // ledger panel, dark chrome
  cream: string; // soft panels (waiting strip)
  neutral: string; // secondary text
  surface: string; // page background
  card: string; // card background
  ink: string; // primary text
}

export const DEFAULT_THEME: Theme = {
  primary: "#ef4124",
  accent: "#ec7323",
  highlight: "#efca08",
  navy: "#000022",
  cream: "#ece4b7",
  neutral: "#666666",
  surface: "#f3f3f3",
  card: "#ffffff",
  ink: "#000022",
};

export const THEME_FIELDS: { key: keyof Theme; label: string; hint: string }[] = [
  { key: "primary", label: "Primary", hint: "buttons, active nav, Sent" },
  { key: "accent", label: "Accent", hint: "variant B, warm secondary" },
  { key: "highlight", label: "Highlight", hint: "new ledger rows, Undo" },
  { key: "navy", label: "Chrome", hint: "ledger panel, header text" },
  { key: "cream", label: "Soft panel", hint: "waiting-on-you strip" },
  { key: "neutral", label: "Neutral", hint: "secondary text, borders" },
  { key: "surface", label: "Background", hint: "page" },
  { key: "card", label: "Card", hint: "card surfaces" },
  { key: "ink", label: "Text", hint: "primary text" },
];

const KEY = "tracker.theme";
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHex(s: string): boolean {
  return HEX.test(s.trim());
}

function normalize(s: string): string {
  let h = s.trim().toLowerCase();
  if (!h.startsWith("#")) h = "#" + h;
  if (h.length === 4) h = "#" + [...h.slice(1)].map((c) => c + c).join("");
  return h;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = normalize(hex).slice(1);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Black or white, whichever reads better on the given colour. */
export function onColor(hex: string): string {
  return luminance(hex) > 0.4 ? "#000022" : "#ffffff";
}

function mix(hex: string, withHex: string, amount: number): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(withHex);
  const m = a.map((v, i) => Math.round(v + (b[i] - v) * amount));
  return "#" + m.map((v) => v.toString(16).padStart(2, "0")).join("");
}

export function applyTheme(t: Theme): void {
  const r = document.documentElement.style;
  const set = (k: string, v: string) => r.setProperty(`--${k}`, v);
  for (const [k, v] of Object.entries(t)) set(k, normalize(v));
  set("on-primary", onColor(t.primary));
  set("on-accent", onColor(t.accent));
  set("on-highlight", onColor(t.highlight));
  set("on-navy", onColor(t.navy));
  set("on-cream", onColor(t.cream));
  set("primary-hover", mix(t.primary, "#000000", 0.15));
  set("primary-soft", mix(t.primary, t.card, 0.88));
  set("accent-soft", mix(t.accent, t.card, 0.85));
  set("highlight-soft", mix(t.highlight, t.card, 0.7));
  set("navy-soft", mix(t.navy, "#ffffff", 0.12)); // borders inside the dark panel
  set("navy-muted", mix(t.navy, "#ffffff", 0.55)); // muted text inside the dark panel
  set("border", mix(t.neutral, t.card, 0.72));
  set("muted", mix(t.neutral, t.card, 0.15));
  set("ok", "#1f7a4d");
  set("ok-soft", mix("#1f7a4d", t.card, 0.86));
  set("danger", mix(t.primary, "#000000", 0.25));
  set("danger-soft", mix(t.primary, t.card, 0.9));
}

function load(): Theme {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_THEME;
    const parsed = JSON.parse(raw) as Partial<Theme>;
    const out = { ...DEFAULT_THEME };
    for (const k of Object.keys(DEFAULT_THEME) as (keyof Theme)[]) if (parsed[k] && isHex(parsed[k]!)) out[k] = normalize(parsed[k]!);
    return out;
  } catch {
    return DEFAULT_THEME;
  }
}

interface Ctx {
  theme: Theme;
  setColor: (k: keyof Theme, hex: string) => void;
  setTheme: (t: Theme) => void;
  reset: () => void;
  isDefault: boolean;
}

const C = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(load);
  const synced = useRef(false); // do not write to the server until it has been asked what it already has
  // The palette travels with the data (data/config.json). localStorage stays as the fallback and as the first paint.
  useEffect(() => {
    let alive = true;
    fetch("/api/config").then((r) => (r.ok ? r.json() : null)).then((c) => {
      if (!alive) return;
      const remote = c?.theme as Partial<Theme> | null | undefined;
      if (remote && typeof remote === "object") {
        const out = { ...DEFAULT_THEME };
        for (const k of Object.keys(DEFAULT_THEME) as (keyof Theme)[]) if (remote[k] && isHex(remote[k]!)) out[k] = normalize(remote[k]!);
        setThemeState(out);
      }
      synced.current = true;
      if (!remote) setThemeState((t) => ({ ...t })); // nothing saved on the server yet: push what this browser has
    }).catch(() => { synced.current = true; });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(KEY, JSON.stringify(theme));
    if (synced.current) {
      const isDef = JSON.stringify(theme) === JSON.stringify(DEFAULT_THEME);
      fetch("/api/theme", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ theme: isDef ? null : theme }) }).catch(() => undefined);
    }
  }, [theme]);
  const value = useMemo<Ctx>(
    () => ({
      theme,
      setColor: (k, hex) => isHex(hex) && setThemeState((t) => ({ ...t, [k]: normalize(hex) })),
      setTheme: (t) => setThemeState(t),
      reset: () => setThemeState(DEFAULT_THEME),
      isDefault: JSON.stringify(theme) === JSON.stringify(DEFAULT_THEME),
    }),
    [theme],
  );
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useTheme(): Ctx {
  const v = useContext(C);
  if (!v) throw new Error("ThemeProvider missing");
  return v;
}
