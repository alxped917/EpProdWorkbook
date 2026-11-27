export type CrewRef = {
  id: string;
  name: string;
  leadName: string;
  memberNames: string[];
};

export function normalizePerson(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** A job belongs to the crew whose lead or member matches the Builder Prime foreman. */
export function matchCrew(foreman: string, crews: CrewRef[]): CrewRef | null {
  const key = normalizePerson(foreman);
  if (!key) return null;
  return (
    crews.find((crew) => {
      const names = [crew.leadName, ...crew.memberNames].map(normalizePerson).filter(Boolean);
      return names.includes(key);
    }) ?? null
  );
}
