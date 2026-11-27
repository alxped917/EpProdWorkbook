import { round1, roundMoney } from "./format";

export type VarianceLabel = "Over" | "Under" | "On target" | "No plan";

export function varianceLabel(used: number, planned: number, tolerancePct: number): VarianceLabel {
  if (planned <= 0 && used <= 0) return "On target";
  if (planned <= 0) return "Over";
  const high = planned * (1 + tolerancePct / 100);
  const low = planned * (1 - tolerancePct / 100);
  if (used > high + 0.001) return "Over";
  if (used < low - 0.001) return "Under";
  return "On target";
}

export function variancePct(used: number, planned: number): number | null {
  if (planned <= 0) return null;
  return Math.round(((used - planned) / planned) * 1000) / 10;
}

export type CostLineInput = {
  name: string;
  plannedLbs: number;
  takenLbs: number;
  returnedLbs: number;
  pricePerLb: number;
};

export type CostLine = CostLineInput & {
  usedLbs: number;
  cost: number;
  variancePct: number | null;
  variance: VarianceLabel;
};

export function jobCostLines(lines: CostLineInput[], tolerancePct: number): {
  lines: CostLine[];
  totals: { planned: number; taken: number; returned: number; used: number; cost: number; variancePct: number | null; variance: VarianceLabel };
} {
  const detailed = lines.map((line) => {
    const usedLbs = round1(line.takenLbs - line.returnedLbs);
    return {
      ...line,
      usedLbs,
      cost: roundMoney(usedLbs * line.pricePerLb),
      variancePct: variancePct(usedLbs, line.plannedLbs),
      variance: varianceLabel(usedLbs, line.plannedLbs, tolerancePct),
    };
  });
  const planned = round1(detailed.reduce((s, l) => s + l.plannedLbs, 0));
  const taken = round1(detailed.reduce((s, l) => s + l.takenLbs, 0));
  const returned = round1(detailed.reduce((s, l) => s + l.returnedLbs, 0));
  const used = round1(taken - returned);
  const cost = roundMoney(detailed.reduce((s, l) => s + l.cost, 0));
  return {
    lines: detailed,
    totals: {
      planned,
      taken,
      returned,
      used,
      cost,
      variancePct: variancePct(used, planned),
      variance: varianceLabel(used, planned, tolerancePct),
    },
  };
}
