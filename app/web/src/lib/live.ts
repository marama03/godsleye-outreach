// Live refresh. One shared EventSource to /api/changes; any screen that shows stored data subscribes with
// useLive(load) and is called again whenever the data folder changes (an agent wrote a lead, a dossier landed,
// another tab clicked Sent). It also reloads when the tab comes back into view and after a dropped
// connection, and falls back to a slow poll if the stream cannot be opened.
import { useEffect, useRef } from "react";

type Listener = () => void;
const listeners = new Set<Listener>();
let es: EventSource | null = null;
let helloSeen = false;
let pollTimer: number | null = null;
let pending: number | null = null;

function fire() {
  if (pending !== null) return;
  pending = window.setTimeout(() => {
    pending = null;
    listeners.forEach((l) => l());
  }, 150);
}

function startPoll() {
  if (pollTimer !== null) return;
  pollTimer = window.setInterval(() => { if (document.visibilityState === "visible") fire(); }, 10000);
}
function stopPoll() {
  if (pollTimer !== null) { window.clearInterval(pollTimer); pollTimer = null; }
}

function connect() {
  if (es || typeof EventSource === "undefined") { if (typeof EventSource === "undefined") startPoll(); return; }
  es = new EventSource("/api/changes");
  es.addEventListener("hello", () => {
    stopPoll();
    if (helloSeen) fire(); // reconnected: we may have missed changes
    helloSeen = true;
  });
  es.addEventListener("change", () => fire());
  es.onerror = () => startPoll(); // EventSource retries by itself; poll meanwhile
}

document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") fire(); });
window.addEventListener("focus", () => fire());

export function useLive(cb: () => void | Promise<unknown>): void {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    const l: Listener = () => { Promise.resolve(ref.current()).catch(() => undefined); };
    listeners.add(l);
    connect();
    return () => { listeners.delete(l); };
  }, []);
}
