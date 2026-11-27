/** Date-only helpers. Install dates are stored as YYYY-MM-DD so warehouse time zones cannot shift the day. */

export function todayISO(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function parseISODate(iso: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) throw new Error(`Invalid date: ${iso}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function formatISODate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDaysISO(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return formatISODate(date);
}

export function weekdayUTC(iso: string): number {
  return parseISODate(iso).getUTCDay();
}

/** Monday–Sunday week that contains `iso`. */
export function weekRange(iso: string): { start: string; end: string } {
  const day = weekdayUTC(iso);
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = addDaysISO(iso, mondayOffset);
  return { start, end: addDaysISO(start, 6) };
}

export function monthRange(iso: string): { start: string; end: string } {
  const date = parseISODate(iso);
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  return { start: formatISODate(start), end: formatISODate(end) };
}

export function monthGrid(iso: string): string[] {
  const { start } = monthRange(iso);
  const leading = weekdayUTC(start);
  const gridStart = addDaysISO(start, -leading);
  return Array.from({ length: 42 }, (_, i) => addDaysISO(gridStart, i));
}

export function displayDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = parseISODate(iso);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function displayDateTime(value: Date | string | null | undefined, timeZone: string): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function inRange(iso: string | null | undefined, start: string, end: string): boolean {
  if (!iso) return false;
  return iso >= start && iso <= end;
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function addMonthsISO(iso: string, months: number): string {
  const date = parseISODate(iso);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return formatISODate(date);
}
