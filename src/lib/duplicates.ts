export function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return row[b.length];
}

export function findDuplicatePairs(names: { id: string; name: string }[]): { a: string; b: string; reason: string }[] {
  const pairs: { a: string; b: string; reason: string }[] = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const left = normalizeName(names[i].name);
      const right = normalizeName(names[j].name);
      if (!left || !right) continue;
      if (left === right) pairs.push({ a: names[i].id, b: names[j].id, reason: "Same name" });
      else if (
        Math.min(left.length, right.length) >= 8 &&
        levenshtein(left, right) <= 2 &&
        !(left.length === right.length && left.slice(0, -1) === right.slice(0, -1))
      ) {
        pairs.push({ a: names[i].id, b: names[j].id, reason: "Very similar name" });
      }
    }
  }
  return pairs;
}
