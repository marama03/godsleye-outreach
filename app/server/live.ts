// Live updates. The data folder is the app's brain and an agent on the same machine writes into it, so the
// screen must follow the files, not a button. This streams one small event whenever a data file changes.
// It only stats files: no reads, no writes, no network beyond the browser's own connection.
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Express, Request, Response } from "express";
import { DATA_DIR, DOSSIER_DIR } from "./store.js";

const WATCHED = ["campaigns.json", "chains.json", "leads.json", "events.json"];

async function signature(): Promise<string> {
  const parts: string[] = [];
  for (const f of WATCHED) {
    try {
      const s = await fs.stat(path.join(DATA_DIR, f));
      parts.push(`${f}:${s.mtimeMs}:${s.size}`);
    } catch {
      parts.push(`${f}:-`);
    }
  }
  try {
    for (const f of await fs.readdir(DOSSIER_DIR)) {
      const s = await fs.stat(path.join(DOSSIER_DIR, f));
      parts.push(`d/${f}:${s.mtimeMs}`);
    }
  } catch { /* no dossier folder yet */ }
  return parts.join("|");
}

export function registerLive(app: Express): void {
  const clients = new Set<Response>();
  let last = "";
  let version = 0;
  let timer: NodeJS.Timeout | null = null;

  const tick = async () => {
    const sig = await signature();
    if (sig !== last) {
      const first = last === "";
      last = sig;
      if (!first) {
        version++;
        for (const c of clients) c.write(`event: change\ndata: ${version}\n\n`);
      }
    }
  };

  app.get("/api/changes", (req: Request, res: Response) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write(`retry: 3000\nevent: hello\ndata: ${version}\n\n`);
    clients.add(res);
    if (!timer) {
      tick().catch(() => undefined);
      timer = setInterval(() => tick().catch(() => undefined), 1000);
    }
    const ka = setInterval(() => res.write(": keepalive\n\n"), 25000);
    req.on("close", () => {
      clearInterval(ka);
      clients.delete(res);
      if (clients.size === 0 && timer) { clearInterval(timer); timer = null; last = ""; }
    });
  });
}
