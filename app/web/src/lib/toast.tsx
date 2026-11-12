import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export interface Toast {
  id: number;
  text: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  ttlMs: number;
  startedAt: number;
}

interface Ctx {
  show: (t: Omit<Toast, "id" | "startedAt">) => number;
  dismiss: (id: number) => void;
}

const C = createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const show = useCallback((t: Omit<Toast, "id" | "startedAt">) => {
    const id = ++seq.current;
    setToasts((prev) => [...prev, { ...t, id, startedAt: Date.now() }]);
    window.setTimeout(() => dismiss(id), t.ttlMs);
    return id;
  }, [dismiss]);

  return (
    <C.Provider value={{ show, dismiss }}>
      {children}
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2">
        {toasts.map((t) => (
          <ToastView key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </C.Provider>
  );
}

function ToastView({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [left, setLeft] = useState(toast.ttlMs);
  useEffect(() => {
    const iv = window.setInterval(() => setLeft(Math.max(0, toast.ttlMs - (Date.now() - toast.startedAt))), 100);
    return () => window.clearInterval(iv);
  }, [toast]);
  const pct = (left / toast.ttlMs) * 100;
  return (
    <div className="pointer-events-auto relative min-w-[320px] overflow-hidden rounded-lg border border-brand-navy-soft bg-brand-navy px-4 py-3 text-sm text-brand-on-navy shadow-xl">
      <div className="flex items-center justify-between gap-6">
        <span>{toast.text}</span>
        {toast.actionLabel && (
          <button
            className="rounded border border-brand-highlight px-2.5 py-1 text-xs font-semibold text-brand-highlight hover:bg-brand-highlight hover:text-brand-on-highlight"
            onClick={async () => {
              await toast.onAction?.();
              onDismiss();
            }}
          >
            {toast.actionLabel} ({Math.ceil(left / 1000)}s)
          </button>
        )}
      </div>
      <div className="absolute bottom-0 left-0 h-0.5 bg-brand-highlight transition-[width] duration-100" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function useToast(): Ctx {
  const v = useContext(C);
  if (!v) throw new Error("ToastProvider missing");
  return v;
}
