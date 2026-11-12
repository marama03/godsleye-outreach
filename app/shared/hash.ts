// Hashing helpers. Node-only (server, scripts). The web never computes hashes.
import { createHash, randomUUID } from "node:crypto";

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** lead_id = first 12 chars of sha256(linkedin_url). Dedupe key. */
export function leadIdFor(linkedinUrl: string): string {
  return sha256Hex(linkedinUrl.trim()).slice(0, 12);
}

export { variantFor } from "./variant.js";

export function newEventId(): string {
  return `evt_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export function newIdempotencyKey(): string {
  return `idk_${randomUUID().replace(/-/g, "")}`;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function campaignIdFor(name: string, now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `cmp_${y}${m}${d}_${slugify(name) || "campaign"}`;
}
