import {
  calculatePickSheet,
  locationFactorFor,
  type ComponentKey,
  type CoverageConfig,
  type FlakeSize,
  type OptionalFlag,
  type PickLine,
} from "./coverage";

export type PickProduct = {
  id: string;
  name: string;
  category: string;
  componentKey: string | null;
};

export function resolveComponentProduct(
  key: ComponentKey,
  flakeColor: string,
  products: PickProduct[],
  componentMap: { [key: string]: string | undefined },
): string | null {
  if (key === "FLAKE") {
    const color = flakeColor.trim().toLowerCase();
    if (!color) return null;
    return products.find((product) => product.category === "FLAKE" && product.name.toLowerCase() === color)?.id ?? null;
  }
  return componentMap[key] ?? null;
}

export function buildPickLines(input: {
  squareFeet: number;
  verticalLf: number;
  stairsLf: number;
  flakeSize: FlakeSize;
  season: "summer" | "winter";
  warehouseName?: string | null;
  include: Record<OptionalFlag, boolean>;
  flakeColor: string;
  products: PickProduct[];
  componentMap: { [key: string]: string | undefined };
  coverage: CoverageConfig;
}): (PickLine & { productId: string | null })[] {
  const calculated = calculatePickSheet(
    {
      squareFeet: input.squareFeet,
      verticalLf: input.verticalLf,
      stairsLf: input.stairsLf,
      flakeSize: input.flakeSize,
      season: input.season,
      locationFactor: locationFactorFor(input.coverage, input.warehouseName),
      include: input.include,
    },
    input.coverage,
  );
  return [...calculated.lines, ...calculated.weighOnly].map((line) => ({
    ...line,
    productId: resolveComponentProduct(line.key, input.flakeColor, input.products, input.componentMap),
  }));
}
