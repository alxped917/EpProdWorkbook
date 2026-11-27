export function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function lbs(n: number, digits = 1): string {
  return `${n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })} lb`;
}

export function round1(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10 + (n >= 0 ? 1e-8 : -1e-8)) / 10;
}

export function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100 + (n >= 0 ? 1e-8 : -1e-8)) / 100;
}

export function roundMoney(n: number): number {
  return round2(n);
}

export function pct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export function titleCaseStatus(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
