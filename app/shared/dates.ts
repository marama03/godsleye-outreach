// Date helpers. All business dates are YYYY-MM-DD strings interpreted as local calendar days.
// R4: ONE weekend-roll helper, used everywhere.

export function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0); // noon avoids DST edge cases
}

export function todayYmd(now: Date = new Date()): string {
  return toYmd(now);
}

export function addDays(ymd: string, days: number): string {
  const d = fromYmd(ymd);
  d.setDate(d.getDate() + days);
  return toYmd(d);
}

/** Whole calendar days from a -> b (b - a). */
export function diffDays(aYmd: string, bYmd: string): number {
  const a = fromYmd(aYmd).getTime();
  const b = fromYmd(bYmd).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function isWeekend(ymd: string): boolean {
  const dow = fromYmd(ymd).getDay();
  return dow === 0 || dow === 6;
}

/**
 * R4 WEEKEND ROLL. Sat -> next Mon (+2). Sun -> next Mon (+1). Weekday unchanged.
 * This is the only place weekend logic lives.
 */
export function rollWeekend(ymd: string): string {
  const dow = fromYmd(ymd).getDay();
  if (dow === 6) return addDays(ymd, 2);
  if (dow === 0) return addDays(ymd, 1);
  return ymd;
}

/** Next weekday strictly after the given date (used by the daily-cap overflow rule R8). */
export function nextWeekdayAfter(ymd: string): string {
  return rollWeekend(addDays(ymd, 1));
}

/** ISO date (YYYY-MM-DD, local) from an ISO UTC timestamp. */
export function ymdFromIso(iso: string): string {
  return toYmd(new Date(iso));
}

export function formatWeekdayDate(ymd: string): string {
  return fromYmd(ymd).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}
