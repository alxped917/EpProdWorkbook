import { describe, expect, it } from "vitest";
import {
  aboutBoxes,
  calculatePickSheet,
  defaultCoverage,
  formatBoxes,
  normalizeCoverage,
  resolveSeason,
  stockStatus,
  type PickInput,
} from "@/lib/coverage";

const baseInput = (over: Partial<PickInput> = {}): PickInput => ({
  squareFeet: 707,
  verticalLf: 0,
  stairsLf: 0,
  flakeSize: "1/4",
  season: "summer",
  include: { moisture: false, gator: false, baseCd: false, topCd: false },
  ...over,
});

function lbs(input: PickInput, key: string, config = defaultCoverage()) {
  return calculatePickSheet(input, config).lines.find((line) => line.key === key)?.lbs;
}

describe("pick sheet math", () => {
  it("matches the 707 sq ft, 1/4 inch reference point", () => {
    const result = calculatePickSheet(baseInput(), defaultCoverage());
    expect(lbs(baseInput(), "FLAKE")).toBe(101);
    expect(lbs(baseInput(), "BASE_A")).toBe(26.7);
    expect(lbs(baseInput(), "BASE_B")).toBe(13.4);
    expect(lbs(baseInput(), "TOP_A")).toBe(34);
    expect(lbs(baseInput(), "TOP_B")).toBe(34);
    expect(result.lines.map((line) => line.key)).toEqual(["FLAKE", "BASE_A", "BASE_B", "TOP_A", "TOP_B"]);
    expect(result.weighOnly.map((line) => line.key)).toEqual(["MENDER_A", "MENDER_B"]);
  });

  it("scales floor area linearly from the configured rate", () => {
    expect(lbs(baseInput({ squareFeet: 353.5 }), "FLAKE")).toBe(50.5);
    expect(lbs(baseInput({ squareFeet: 0 }), "BASE_A")).toBe(0);
  });

  it("uses the flake-size rate from config and leaves base coat on the shared rate", () => {
    expect(lbs(baseInput({ flakeSize: "1/8" }), "FLAKE")).toBe(70);
    expect(lbs(baseInput({ flakeSize: "1/16" }), "FLAKE")).toBe(40);
    expect(lbs(baseInput({ flakeSize: "1/8" }), "BASE_A")).toBe(26.7);
  });

  it("applies season, location, verticals, and stairs from config", () => {
    const summer = lbs(baseInput(), "FLAKE")!;
    const winter = lbs(baseInput({ season: "winter" }), "FLAKE")!;
    expect(winter).toBe(Math.round(summer * 1.08 * 10) / 10);
    expect(lbs(baseInput({ locationFactor: 2 }), "TOP_A")).toBe(68);
    const withVertical = lbs(baseInput({ verticalLf: 10 }), "BASE_A")!;
    expect(withVertical).toBeGreaterThan(26.7);
    const withStairs = lbs(baseInput({ stairsLf: 10 }), "FLAKE")!;
    expect(withStairs).toBeGreaterThan(101);
  });

  it("includes optional components only when asked, and never prices mender", () => {
    const plain = calculatePickSheet(baseInput(), defaultCoverage());
    expect(plain.lines.some((line) => line.key === "MOISTURE_A")).toBe(false);
    const withMoisture = calculatePickSheet(
      baseInput({ include: { moisture: true, gator: true, baseCd: false, topCd: false } }),
      defaultCoverage(),
    );
    expect(withMoisture.lines.some((line) => line.key === "MOISTURE_A")).toBe(true);
    expect(withMoisture.lines.some((line) => line.key === "GATOR")).toBe(true);
    expect(withMoisture.lines.some((line) => line.key === "MENDER_A")).toBe(false);
  });

  it("reads rates from the passed-in config instead of a hardcoded table", () => {
    const config = defaultCoverage();
    for (const size of ["1/4", "1/8", "1/16"] as const) config.floorLbsPerSqft.FLAKE[size] = 1;
    config.floorLbsPerSqft.BASE_A["1/4"] = 0;
    config.seasonMultiplier.summer = 1;
    const result = calculatePickSheet(baseInput({ squareFeet: 12 }), config);
    expect(result.lines.find((line) => line.key === "FLAKE")?.lbs).toBe(12);
    expect(result.lines.find((line) => line.key === "BASE_A")?.lbs).toBe(0);
  });

  it("fills missing coverage keys from defaults and drops bad numbers", () => {
    const normalized = normalizeCoverage({
      floorLbsPerSqft: { FLAKE: { "1/4": 0.5, "1/8": -3 } },
      seasonMultiplier: { summer: 1.1, winter: Number.NaN },
    });
    expect(normalized.floorLbsPerSqft.FLAKE["1/4"]).toBe(0.5);
    expect(normalized.floorLbsPerSqft.FLAKE["1/8"]).toBe(defaultCoverage().floorLbsPerSqft.FLAKE["1/8"]);
    expect(normalized.floorLbsPerSqft.BASE_B["1/4"]).toBe(defaultCoverage().floorLbsPerSqft.BASE_B["1/4"]);
    expect(normalized.seasonMultiplier.summer).toBe(1.1);
    expect(normalized.seasonMultiplier.winter).toBe(1.08);
  });

  it("describes boxes from weight per box", () => {
    expect(aboutBoxes(101, 40)).toBe(2.5);
    expect(aboutBoxes(26.7, 48)).toBe(0.6);
    expect(aboutBoxes(13.4, 52.5)).toBe(0.3);
    expect(aboutBoxes(0, 40)).toBe(0);
    expect(aboutBoxes(10, null)).toBeNull();
    expect(formatBoxes(1)).toBe("1 box");
    expect(formatBoxes(2.5)).toBe("2.5 boxes");
  });

  it("warns when a mapped product is out of stock or short", () => {
    expect(stockStatus(null, 10)).toBe("unmapped");
    expect(stockStatus(0, 10)).toBe("none");
    expect(stockStatus(4, 10)).toBe("short");
    expect(stockStatus(10, 10)).toBe("ok");
    expect(stockStatus(0, 0)).toBe("ok");
  });

  it("derives season from the install month when set to auto", () => {
    expect(resolveSeason("winter", "2026-07-01", [11, 12, 1, 2, 3])).toBe("winter");
    expect(resolveSeason("auto", "2026-01-15", [11, 12, 1, 2, 3])).toBe("winter");
    expect(resolveSeason("auto", "2026-07-15", [11, 12, 1, 2, 3])).toBe("summer");
  });
});
