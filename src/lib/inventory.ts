import { round2 } from "./format";

export type StockEventName = "DRAWN" | "RETURNED" | "ADJUSTED" | "TRASHED" | "RECEIVED";

export type PlannedEvent = {
  event: StockEventName;
  weightChange: number;
  newBalance: number;
  note: string;
};

export type PlanOk = { ok: true; onHand: number; used: number; events: PlannedEvent[] };
export type PlanErr = { ok: false; error: string };
export type Plan = PlanOk | PlanErr;

function finiteLbs(value: number, label: string): string | null {
  if (!Number.isFinite(value)) return `${label} must be a number`;
  if (value < -0.0001) return `${label} cannot be negative`;
  return null;
}

/**
 * Absolute "lbs checked out / lbs checked in" editor.
 * Warehouse balance change is signed: negative leaves the building.
 * Returns are applied before draws so a same-request correction cannot false-fail.
 */
export function planMaterialUpdate(input: {
  previousOut: number;
  previousIn: number;
  nextOut: number;
  nextIn: number;
  onHand: number;
}): Plan {
  const outErr = finiteLbs(input.nextOut, "Lbs checked out");
  if (outErr) return { ok: false, error: outErr };
  const inErr = finiteLbs(input.nextIn, "Lbs checked in");
  if (inErr) return { ok: false, error: inErr };
  const nextOut = round2(input.nextOut);
  const nextIn = round2(input.nextIn);
  const previousOut = round2(input.previousOut);
  const previousIn = round2(input.previousIn);
  if (nextIn - nextOut > 0.001) {
    return { ok: false, error: "Lbs checked in cannot exceed lbs checked out" };
  }
  const drawnDelta = round2(nextOut - previousOut);
  const returnedDelta = round2(nextIn - previousIn);
  const steps: { event: StockEventName; delta: number; note: string }[] = [];
  if (returnedDelta > 0) steps.push({ event: "RETURNED", delta: returnedDelta, note: "Checked in" });
  if (returnedDelta < 0) steps.push({ event: "DRAWN", delta: returnedDelta, note: "Return correction" });
  if (drawnDelta > 0) steps.push({ event: "DRAWN", delta: -drawnDelta, note: "Checked out" });
  if (drawnDelta < 0) steps.push({ event: "RETURNED", delta: -drawnDelta, note: "Checkout correction" });

  let onHand = round2(input.onHand);
  const events: PlannedEvent[] = [];
  for (const step of steps) {
    const next = round2(onHand + step.delta);
    if (next < -0.001) {
      return { ok: false, error: "That checkout would take stock below zero" };
    }
    onHand = Math.max(0, next);
    events.push({ event: step.event, weightChange: step.delta, newBalance: onHand, note: step.note });
  }
  return { ok: true, onHand, used: round2(nextOut - nextIn), events };
}

export function planStockCount(systemLbs: number, countedLbs: number): Plan {
  const err = finiteLbs(countedLbs, "Counted amount");
  if (err) return { ok: false, error: err };
  const counted = round2(countedLbs);
  const system = round2(systemLbs);
  const delta = round2(counted - system);
  if (Math.abs(delta) < 0.001) {
    return { ok: true, onHand: system, used: 0, events: [] };
  }
  return {
    ok: true,
    onHand: counted,
    used: 0,
    events: [
      {
        event: "ADJUSTED",
        weightChange: delta,
        newBalance: counted,
        note: `Count stock (system ${system} lb, counted ${counted} lb)`,
      },
    ],
  };
}

export function planTrash(onHand: number, containerLbs: number): Plan {
  const err = finiteLbs(containerLbs, "Container weight");
  if (err) return { ok: false, error: err };
  const lbs = round2(containerLbs);
  if (lbs === 0) return { ok: false, error: "Container has no weight left to trash" };
  const next = round2(onHand - lbs);
  if (next < -0.001) return { ok: false, error: "Trashing that container would take stock below zero" };
  return {
    ok: true,
    onHand: Math.max(0, next),
    used: 0,
    events: [{ event: "TRASHED", weightChange: -lbs, newBalance: Math.max(0, next), note: "Container trashed" }],
  };
}

export function planReceive(onHand: number, lbs: number): Plan {
  const err = finiteLbs(lbs, "Received weight");
  if (err) return { ok: false, error: err };
  const amount = round2(lbs);
  if (amount === 0) return { ok: false, error: "Received weight must be greater than zero" };
  const next = round2(onHand + amount);
  return {
    ok: true,
    onHand: next,
    used: 0,
    events: [{ event: "RECEIVED", weightChange: amount, newBalance: next, note: "Received into stock" }],
  };
}

export function shouldStartJob(previousStatus: string, previousOutTotal: number, nextOut: number): boolean {
  return previousStatus === "NEW" && previousOutTotal <= 0.001 && nextOut > 0.001;
}
