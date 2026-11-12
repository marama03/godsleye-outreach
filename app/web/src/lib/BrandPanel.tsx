import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { DEFAULT_THEME, THEME_FIELDS, isHex, useTheme, type Theme } from "./theme";

export default function BrandPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { theme, setColor, setTheme, reset, isDefault } = useTheme();
  const [drafts, setDrafts] = useState<Partial<Record<keyof Theme, string>>>({});
  const [pasteErr, setPasteErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showJson, setShowJson] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const commit = (k: keyof Theme, v: string) => {
    setDrafts((d) => ({ ...d, [k]: v }));
    if (isHex(v)) setColor(k, v);
  };

  const exportJson = JSON.stringify(theme, null, 2);

  const importJson = (text: string) => {
    try {
      const parsed = JSON.parse(text) as Partial<Theme>;
      const next = { ...theme };
      let n = 0;
      for (const f of THEME_FIELDS) if (parsed[f.key] && isHex(parsed[f.key]!)) { next[f.key] = parsed[f.key]!; n++; }
      if (!n) throw new Error("no valid hex fields found");
      setTheme(next);
      setDrafts({});
      setPasteErr(null);
    } catch (e: any) {
      setPasteErr(e.message ?? String(e));
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end bg-black/30" onClick={onClose}>
      <aside
        className="flex h-screen w-full max-w-[560px] flex-col border-l border-brand-border bg-brand-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Brand colours"
      >
        {/* pinned header */}
        <div className="shrink-0 border-b border-brand-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Brand</h2>
              <p className="text-xs text-brand-muted">Hex codes. Applies live, saved in this browser only — one palette for the whole app.</p>
            </div>
            <button className="btn-ghost" onClick={onClose}>Close</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn-secondary" disabled={isDefault} onClick={() => { reset(); setDrafts({}); }}>Reset to default</button>
            <button
              className="btn-ghost"
              onClick={async () => {
                try { await navigator.clipboard.writeText(exportJson); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { setShowJson(true); }
              }}
            >
              {copied ? "Copied" : "Copy as JSON"}
            </button>
            <button className="btn-ghost" onClick={() => setShowJson((s) => !s)}>{showJson ? "Hide JSON" : "Paste JSON"}</button>
          </div>
        </div>

        {/* scrollable body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {showJson && (
            <div className="mb-5">
              <span className="label">Theme JSON — paste a palette here, or copy this one</span>
              <textarea
                className="input h-36 font-mono text-xs"
                defaultValue={exportJson}
                spellCheck={false}
                onPaste={(e) => { const t = e.clipboardData.getData("text"); if (t) { e.preventDefault(); importJson(t); } }}
                onBlur={(e) => { if (e.target.value.trim()) importJson(e.target.value); }}
              />
              {pasteErr && <p className="mt-1 text-xs text-brand-danger">{pasteErr}</p>}
            </div>
          )}

          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            {THEME_FIELDS.map((f) => {
              const val = drafts[f.key] ?? theme[f.key];
              const bad = !isHex(val);
              return (
                <div key={f.key} className="min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">{f.label}</span>
                    <span className="truncate text-[11px] text-brand-muted">{f.hint}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <label className="relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-md border border-brand-border" style={{ backgroundColor: theme[f.key] }} title="Pick a colour">
                      <input type="color" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" value={theme[f.key]} onChange={(e) => commit(f.key, e.target.value)} aria-label={`${f.label} colour picker`} />
                    </label>
                    <input
                      className={`input min-w-0 font-mono ${bad ? "border-brand-danger" : ""}`}
                      value={val}
                      spellCheck={false}
                      onChange={(e) => commit(f.key, e.target.value)}
                      onBlur={() => setDrafts((d) => { const n = { ...d }; delete n[f.key]; return n; })}
                      placeholder="#rrggbb"
                      aria-label={`${f.label} hex`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6">
            <span className="label">Default palette</span>
            <div className="flex flex-wrap gap-2">
              {Object.entries(DEFAULT_THEME).map(([k, v]) => (
                <button
                  key={k}
                  type="button"
                  className="flex items-center gap-1.5 rounded-md border border-brand-border px-2 py-1 font-mono text-[11px] hover:bg-brand-surface"
                  onClick={() => navigator.clipboard?.writeText(v)}
                  title={`${k} — click to copy`}
                >
                  <span className="h-4 w-4 rounded-sm border border-brand-border" style={{ backgroundColor: v }} />
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* pinned preview */}
        <div className="shrink-0 border-t border-brand-border bg-brand-surface px-6 py-4">
          <span className="label">Preview</span>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-primary" type="button">Sent</button>
            <button className="btn-secondary" type="button">Replied</button>
            <button className="btn-ghost" type="button">Skip</button>
            <button className="btn-danger" type="button">Not a fit</button>
            <span className="pill-a ml-2">variant A</span>
            <span className="pill-b">variant B</span>
            <span className="pill bg-brand-highlight text-brand-on-highlight">new row</span>
          </div>
          <div className="mt-3 rounded bg-brand-navy px-3 py-2 font-mono text-xs text-brand-on-navy">
            <span className="text-brand-navy-muted">ledger ·</span> 2026-11-05T09:30:00Z · <span className="font-semibold">sent</span> · step 2 · B · <span className="text-brand-highlight">undo</span>
          </div>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
