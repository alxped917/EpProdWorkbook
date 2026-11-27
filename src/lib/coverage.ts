import { round1 } from "./format";

export const FLAKE_SIZES = ["1/4", "1/8", "1/16"] as const;
export type FlakeSize = (typeof FLAKE_SIZES)[number];

export const COMPONENTS = [
  { key: "FLAKE", label: "Flake", mode: "calculated" },
  { key: "BASE_A", label: "Base A", mode: "calculated" },
  { key: "BASE_B", label: "Base B", mode: "calculated" },
  { key: "TOP_A", label: "Top A", mode: "calculated" },
  { key: "TOP_B", label: "Top B", mode: "calculated" },
  { key: "MOISTURE_A", label: "Moisture Barrier A", mode: "optional", option: "moisture" },
  { key: "MOISTURE_B", label: "Moisture Barrier B", mode: "optional", option: "moisture" },
  { key: "GATOR", label: "Gator / Shark Bite", mode: "optional", option: "gator" },
  { key: "BASE_C", label: "Base C", mode: "optional", option: "baseCd" },
  { key: "BASE_D", label: "Base D", mode: "optional", option: "baseCd" },
  { key: "TOP_C", label: "Top C", mode: "optional", option: "topCd" },
  { key: "TOP_D", label: "Top D", mode: "optional", option: "topCd" },
  { key: "MENDER_A", label: "Mender A", mode: "weigh-only" },
  { key: "MENDER_B", label: "Mender B", mode: "weigh-only" },
] as const;

export type ComponentKey = (typeof COMPONENTS)[number]["key"];
export type OptionalFlag = "moisture" | "gator" | "baseCd" | "topCd";

export const COMPONENT_KEYS = COMPONENTS.map((c) => c.key) as ComponentKey[];

export type CoverageConfig = {
  floorLbsPerSqft: Record<ComponentKey, Record<FlakeSize, number>>;
  verticalLbsPerLf: Record<ComponentKey, number>;
  stairLbsPerLf: Record<ComponentKey, number>;
  seasonMultiplier: { summer: number; winter: number };
  locationFactors: Record<string, number>;
};

export type PickInput = {
  squareFeet: number;
  verticalLf: number;
  stairsLf: number;
  flakeSize: FlakeSize;
  season: "summer" | "winter";
  locationFactor?: number;
  include: Record<OptionalFlag, boolean>;
};

export type PickLine = {
  key: ComponentKey;
  label: string;
  lbs: number;
  mode: "calculated" | "optional" | "weigh-only";
};

const REF_SQFT = 707;

function perSqft(lbs: number): number {
  return lbs / REF_SQFT;
}

function rates(flakeLbsAtRef: number, extras: Partial<Record<ComponentKey, number>> = {}): Record<ComponentKey, number> {
  const base: Record<ComponentKey, number> = {
    FLAKE: perSqft(flakeLbsAtRef),
    BASE_A: perSqft(26.7),
    BASE_B: perSqft(13.4),
    TOP_A: perSqft(34),
    TOP_B: perSqft(34),
    MOISTURE_A: 0.02,
    MOISTURE_B: 0.01,
    GATOR: 0.004,
    BASE_C: perSqft(10),
    BASE_D: perSqft(5),
    TOP_C: perSqft(12),
    TOP_D: perSqft(12),
    MENDER_A: 0,
    MENDER_B: 0,
  };
  return { ...base, ...extras };
}

function zeroRecord(): Record<ComponentKey, number> {
  return Object.fromEntries(COMPONENT_KEYS.map((key) => [key, 0])) as Record<ComponentKey, number>;
}

export function defaultCoverage(): CoverageConfig {
  const quarter = rates(101);
  const eighth = rates(70);
  const sixteenth = rates(40);
  const floorLbsPerSqft = Object.fromEntries(
    COMPONENT_KEYS.map((key) => [
      key,
      { "1/4": quarter[key], "1/8": eighth[key], "1/16": sixteenth[key] },
    ]),
  ) as CoverageConfig["floorLbsPerSqft"];

  return {
    floorLbsPerSqft,
    verticalLbsPerLf: {
      ...zeroRecord(),
      FLAKE: 0.15,
      BASE_A: 0.04,
      BASE_B: 0.02,
      TOP_A: 0.03,
      TOP_B: 0.03,
      MOISTURE_A: 0.01,
      MOISTURE_B: 0.005,
      BASE_C: 0.02,
      BASE_D: 0.01,
      TOP_C: 0.02,
      TOP_D: 0.02,
    },
    stairLbsPerLf: {
      ...zeroRecord(),
      FLAKE: 0.2,
      BASE_A: 0.06,
      BASE_B: 0.03,
      TOP_A: 0.05,
      TOP_B: 0.05,
      MOISTURE_A: 0.015,
      MOISTURE_B: 0.008,
      BASE_C: 0.03,
      BASE_D: 0.015,
      TOP_C: 0.03,
      TOP_D: 0.03,
    },
    seasonMultiplier: { summer: 1, winter: 1.08 },
    locationFactors: {},
  };
}

function nonNeg(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function normalizeCoverage(value: unknown): CoverageConfig {
  const defaults = defaultCoverage();
  if (!value || typeof value !== "object") return defaults;
  const partial = value as Partial<CoverageConfig>;
  const floorLbsPerSqft = {} as CoverageConfig["floorLbsPerSqft"];
  for (const key of COMPONENT_KEYS) {
    floorLbsPerSqft[key] = { "1/4": 0, "1/8": 0, "1/16": 0 };
    for (const size of FLAKE_SIZES) {
      floorLbsPerSqft[key][size] = nonNeg(
        partial.floorLbsPerSqft?.[key]?.[size],
        defaults.floorLbsPerSqft[key][size],
      );
    }
  }
  const verticalLbsPerLf = { ...defaults.verticalLbsPerLf };
  const stairLbsPerLf = { ...defaults.stairLbsPerLf };
  for (const key of COMPONENT_KEYS) {
    verticalLbsPerLf[key] = nonNeg(partial.verticalLbsPerLf?.[key], defaults.verticalLbsPerLf[key]);
    stairLbsPerLf[key] = nonNeg(partial.stairLbsPerLf?.[key], defaults.stairLbsPerLf[key]);
  }
  const locationFactors: Record<string, number> = {};
  if (partial.locationFactors && typeof partial.locationFactors === "object") {
    for (const [name, factor] of Object.entries(partial.locationFactors)) {
      if (typeof factor === "number" && Number.isFinite(factor) && factor > 0) locationFactors[name] = factor;
    }
  }
  return {
    floorLbsPerSqft,
    verticalLbsPerLf,
    stairLbsPerLf,
    seasonMultiplier: {
      summer: nonNeg(partial.seasonMultiplier?.summer, 1) || 1,
      winter: nonNeg(partial.seasonMultiplier?.winter, 1.08) || 1,
    },
    locationFactors,
  };
}

export function isFlakeSize(value: string): value is FlakeSize {
  return (FLAKE_SIZES as readonly string[]).includes(value);
}

export function calculatePickSheet(input: PickInput, config: CoverageConfig): { lines: PickLine[]; weighOnly: PickLine[] } {
  const squareFeet = Math.max(0, Number.isFinite(input.squareFeet) ? input.squareFeet : 0);
  const verticalLf = Math.max(0, Number.isFinite(input.verticalLf) ? input.verticalLf : 0);
  const stairsLf = Math.max(0, Number.isFinite(input.stairsLf) ? input.stairsLf : 0);
  const seasonFactor = config.seasonMultiplier[input.season] ?? 1;
  const locationFactor = input.locationFactor && input.locationFactor > 0 ? input.locationFactor : 1;
  const factor = seasonFactor * locationFactor;
  const lines: PickLine[] = [];

  for (const component of COMPONENTS) {
    if (component.mode === "weigh-only") continue;
    if (component.mode === "optional" && !input.include[component.option]) continue;
    const perSqft = config.floorLbsPerSqft[component.key]?.[input.flakeSize] ?? 0;
    const raw = squareFeet * perSqft + verticalLf * (config.verticalLbsPerLf[component.key] ?? 0) + stairsLf * (config.stairLbsPerLf[component.key] ?? 0);
    lines.push({
      key: component.key,
      label: component.label,
      lbs: round1(raw * factor),
      mode: component.mode,
    });
  }

  const weighOnly = COMPONENTS.filter((c) => c.mode === "weigh-only").map((component) => ({
    key: component.key,
    label: component.label,
    lbs: 0,
    mode: "weigh-only" as const,
  }));

  return { lines, weighOnly };
}

export function aboutBoxes(lbs: number, weightPerBox: number | null | undefined): number | null {
  if (weightPerBox == null || !Number.isFinite(weightPerBox) || weightPerBox <= 0) return null;
  if (!Number.isFinite(lbs) || lbs <= 0) return 0;
  return Math.round((lbs / weightPerBox) * 10) / 10;
}

export function formatBoxes(count: number | null): string {
  if (count == null) return "box weight not set";
  const text = Number.isInteger(count) ? String(count) : count.toFixed(1);
  return `${text} box${count === 1 ? "" : "es"}`;
}

export function stockStatus(
  onHand: number | null,
  neededLbs: number,
): "unmapped" | "none" | "short" | "ok" {
  if (onHand == null) return "unmapped";
  if (neededLbs > 0 && onHand <= 0) return "none";
  if (onHand + 0.001 < neededLbs) return "short";
  return "ok";
}

export function resolveSeason(explicit: string, installDate: string | null, winterMonths: number[]): "summer" | "winter" {
  if (explicit === "summer" || explicit === "winter") return explicit;
  if (!installDate || !/^\d{4}-\d{2}-\d{2}$/.test(installDate)) return "summer";
  const month = Number(installDate.slice(5, 7));
  return winterMonths.includes(month) ? "winter" : "summer";
}

export function locationFactorFor(config: CoverageConfig, warehouseName: string | null | undefined): number {
  if (!warehouseName) return 1;
  const factor = config.locationFactors[warehouseName];
  return factor && factor > 0 ? factor : 1;
}
