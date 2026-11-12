// JSON store. Four files under /data. Single write mutex. Atomic write = temp + rename.
// Records every path touched so verify can prove nothing was written outside the project.
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Campaign, ChainsFile, Lead, LedgerEvent } from "../shared/types.js";
import { GTM_V1 } from "../shared/chain-gtm.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(__dirname, "..");
export const DATA_DIR = process.env.GODSLEYE_DATA_DIR ? path.resolve(process.env.GODSLEYE_DATA_DIR) : path.join(PROJECT_ROOT, "data");
export const DOSSIER_DIR = path.join(DATA_DIR, "dossiers");
export const TOUCHED_LOG = path.join(DATA_DIR, "touched-paths.json");

export const FILES = {
  campaigns: path.join(DATA_DIR, "campaigns.json"),
  chains: path.join(DATA_DIR, "chains.json"),
  leads: path.join(DATA_DIR, "leads.json"),
  events: path.join(DATA_DIR, "events.json"),
  config: path.join(DATA_DIR, "config.json"),
} as const;

export interface Db {
  campaigns: Campaign[];
  chains: ChainsFile;
  leads: Lead[];
  events: LedgerEvent[];
}

const touched = new Set<string>();
export function recordTouch(p: string): void {
  touched.add(path.resolve(p));
}
export function touchedPaths(): string[] {
  return [...touched].sort();
}

// ---- single mutex: serialises every read-modify-write ----
let chain: Promise<unknown> = Promise.resolve();
export function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}

async function ensureDirs(): Promise<void> {
  await fs.mkdir(DOSSIER_DIR, { recursive: true });
  recordTouch(DATA_DIR);
  recordTouch(DOSSIER_DIR);
}

// A missing file means "empty". Anything else (a file mid-rename on Windows, or half-written by another program)
// is retried, and if it never clears it is an error: never mistaken for an empty store, because the next write would erase real data.
async function readJson<T>(file: string, fallback: T): Promise<T> {
  let last: any;
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      const raw = await fs.readFile(file, "utf8");
      return JSON.parse(raw) as T;
    } catch (err: any) {
      // rename-over-existing can look like "missing" for a moment on Windows; only believe it if it stays missing
      if (err?.code === "ENOENT" && attempt >= 3) return fallback;
      last = err;
      await new Promise((r) => setTimeout(r, 40 + attempt * 30));
    }
  }
  throw last;
}

export async function atomicWrite(file: string, data: unknown): Promise<void> {
  await ensureDirs();
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2) + "\n", "utf8");
  await fs.rename(tmp, file);
  recordTouch(file);
  await persistTouched();
}

async function persistTouched(): Promise<void> {
  // written directly (not via atomicWrite) to avoid recursion; still inside /data
  touched.add(path.resolve(TOUCHED_LOG));
  const tmp = `${TOUCHED_LOG}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(touchedPaths(), null, 2) + "\n", "utf8");
  await fs.rename(tmp, TOUCHED_LOG);
}

export interface ConfigFile { sheet_url?: string; sheet_title?: string; connected_at?: string; last_synced_at?: string }

/** The connection note an agent (or the owner, from the dashboard) keeps in data/config.json. Never holds a credential. */
export async function loadConfig(): Promise<ConfigFile> {
  await ensureDirs();
  const c = await readJson<ConfigFile>(FILES.config, {});
  return c && typeof c === "object" ? c : {};
}
export async function saveConfig(c: ConfigFile): Promise<void> {
  await atomicWrite(FILES.config, c);
}

export async function loadDb(): Promise<Db> {
  await ensureDirs();
  const [campaigns, chains, leads, events] = await Promise.all([
    readJson<Campaign[]>(FILES.campaigns, []),
    readJson<ChainsFile>(FILES.chains, {}),
    readJson<Lead[]>(FILES.leads, []),
    readJson<LedgerEvent[]>(FILES.events, []),
  ]);
  // A fresh clone has no chains.json; the built-in chain is always available (a stored one wins).
  return { campaigns, chains: { "gtm@1": GTM_V1, ...chains }, leads, events };
}

export async function saveCampaigns(rows: Campaign[]): Promise<void> {
  await atomicWrite(FILES.campaigns, rows);
}
export async function saveChains(rows: ChainsFile): Promise<void> {
  await atomicWrite(FILES.chains, rows);
}
export async function saveLeads(rows: Lead[]): Promise<void> {
  await atomicWrite(FILES.leads, rows);
}
export async function saveEvents(rows: LedgerEvent[]): Promise<void> {
  await atomicWrite(FILES.events, rows);
}

export async function writeDossier(fileName: string, markdown: string): Promise<string> {
  await ensureDirs();
  const full = path.join(DOSSIER_DIR, fileName);
  const tmp = `${full}.tmp`;
  await fs.writeFile(tmp, markdown, "utf8");
  await fs.rename(tmp, full);
  recordTouch(full);
  await persistTouched();
  return path.relative(PROJECT_ROOT, full).split(path.sep).join("/");
}

export async function readDossier(relPath: string): Promise<string | null> {
  // Accept "x.md", "dossiers/x.md" and "data/dossiers/x.md"; always resolve inside the dossiers folder.
  const rel = relPath.replace(/\\/g, "/").replace(/^(\.\/)?(data\/)?(dossiers\/)?/, "");
  const full = path.resolve(DOSSIER_DIR, rel);
  if (!full.startsWith(DOSSIER_DIR + path.sep)) return null; // never read outside the dossiers folder
  try {
    return await fs.readFile(full, "utf8");
  } catch {
    return null;
  }
}

export async function wipeData(): Promise<void> {
  await fs.rm(DATA_DIR, { recursive: true, force: true });
  touched.clear();
  await ensureDirs();
}
