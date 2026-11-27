export function nameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function jobSearchText(parts: Array<string | number | null | undefined>): string {
  return parts
    .filter((part) => part != null && String(part).trim() !== "")
    .join(" ")
    .toLowerCase();
}
