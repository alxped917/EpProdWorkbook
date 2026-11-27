import { describe, expect, it } from "vitest";
import {
  planMaterialUpdate,
  planReceive,
  planStockCount,
  planTrash,
  shouldStartJob,
} from "@/lib/inventory";
import { generateBarcode, isValidBarcode } from "@/lib/barcode";

describe("inventory balance", () => {
  it("draws stock on checkout and returns it on check-in", () => {
    const drawn = planMaterialUpdate({ previousOut: 0, previousIn: 0, nextOut: 10, nextIn: 0, onHand: 50 });
    expect(drawn.ok).toBe(true);
    if (!drawn.ok) return;
    expect(drawn.onHand).toBe(40);
    expect(drawn.used).toBe(10);
    expect(drawn.events).toEqual([
      { event: "DRAWN", weightChange: -10, newBalance: 40, note: "Checked out" },
    ]);

    const returned = planMaterialUpdate({ previousOut: 10, previousIn: 0, nextOut: 10, nextIn: 4, onHand: 40 });
    expect(returned.ok).toBe(true);
    if (!returned.ok) return;
    expect(returned.onHand).toBe(44);
    expect(returned.used).toBe(6);
    expect(returned.events[0]).toMatchObject({ event: "RETURNED", weightChange: 4, newBalance: 44 });
  });

  it("records both events when out and in are entered together", () => {
    const plan = planMaterialUpdate({ previousOut: 0, previousIn: 0, nextOut: 10, nextIn: 4, onHand: 50 });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.events.map((e) => e.event)).toEqual(["RETURNED", "DRAWN"]);
    expect(plan.onHand).toBe(44);
    expect(plan.used).toBe(6);
    expect(plan.events[0].newBalance).toBe(54);
    expect(plan.events[1].newBalance).toBe(44);
  });

  it("rejects check-in above checkout and checkouts that would go negative", () => {
    const tooMuchIn = planMaterialUpdate({ previousOut: 5, previousIn: 0, nextOut: 5, nextIn: 6, onHand: 20 });
    expect(tooMuchIn).toEqual({ ok: false, error: "Lbs checked in cannot exceed lbs checked out" });
    const short = planMaterialUpdate({ previousOut: 0, previousIn: 0, nextOut: 30, nextIn: 0, onHand: 12 });
    expect(short.ok).toBe(false);
    const negative = planMaterialUpdate({ previousOut: 0, previousIn: 0, nextOut: -1, nextIn: 0, onHand: 12 });
    expect(negative.ok).toBe(false);
  });

  it("puts weight back when a checkout amount is corrected downward", () => {
    const plan = planMaterialUpdate({ previousOut: 10, previousIn: 2, nextOut: 8, nextIn: 2, onHand: 40 });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.onHand).toBe(42);
    expect(plan.used).toBe(6);
    expect(plan.events[0]).toMatchObject({ event: "RETURNED", weightChange: 2, note: "Checkout correction" });
  });

  it("writes no transaction when the numbers do not change", () => {
    const plan = planMaterialUpdate({ previousOut: 3, previousIn: 1, nextOut: 3, nextIn: 1, onHand: 15 });
    expect(plan).toMatchObject({ ok: true, onHand: 15, used: 2, events: [] });
  });

  it("adjusts on-hand to the counted amount", () => {
    const changed = planStockCount(50, 42);
    expect(changed.ok).toBe(true);
    if (!changed.ok) return;
    expect(changed.onHand).toBe(42);
    expect(changed.events[0]).toMatchObject({ event: "ADJUSTED", weightChange: -8, newBalance: 42 });
    const same = planStockCount(42, 42);
    expect(same).toMatchObject({ ok: true, events: [] });
    expect(planStockCount(10, -1).ok).toBe(false);
  });

  it("trashes and receives weight against the balance", () => {
    const trashed = planTrash(50, 10);
    expect(trashed.ok).toBe(true);
    if (!trashed.ok) return;
    expect(trashed.onHand).toBe(40);
    expect(trashed.events[0].event).toBe("TRASHED");
    expect(planTrash(5, 8).ok).toBe(false);
    const received = planReceive(40, 12.5);
    expect(received.ok).toBe(true);
    if (!received.ok) return;
    expect(received.onHand).toBe(52.5);
    expect(received.events[0].event).toBe("RECEIVED");
  });

  it("moves a new job to in progress on the first checkout", () => {
    expect(shouldStartJob("NEW", 0, 2)).toBe(true);
    expect(shouldStartJob("NEW", 2, 4)).toBe(false);
    expect(shouldStartJob("COMPLETED", 0, 2)).toBe(false);
    expect(shouldStartJob("NEW", 0, 0)).toBe(false);
  });

  it("generates barcodes in the IS-XXXXXXXX-XXXX format", () => {
    expect(isValidBarcode("IS-DEMO0001-A001")).toBe(true);
    expect(isValidBarcode("is-demo0001-a001")).toBe(true);
    expect(isValidBarcode("IS-SHORT-A001")).toBe(false);
    const barcode = generateBarcode(() => 0);
    expect(isValidBarcode(barcode)).toBe(true);
    expect(barcode).toHaveLength(16);
  });
});
