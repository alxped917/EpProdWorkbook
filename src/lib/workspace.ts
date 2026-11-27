import "server-only";
import { db } from "./db";
import { normalizeCoverage, type ComponentKey, type CoverageConfig } from "./coverage";
import { defaultFieldMap, defaultStatusMap, type FieldMap } from "./builder-prime-map";

export type Workspace = {
  companyName: string;
  timezone: string;
  coverage: CoverageConfig;
  componentMap: Partial<Record<ComponentKey, string>>;
  bpSubdomain: string;
  bpMode: "mock" | "live";
  importStatuses: string[];
  fieldMap: FieldMap;
  statusMap: Record<string, string>;
  varianceTolerancePct: number;
  winterMonths: number[];
};

function objectOr<T>(text: string, fallback: T): T {
  try {
    const parsed = JSON.parse(text) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export async function getWorkspace(): Promise<Workspace> {
  const row = await db.workspaceConfig.findUnique({ where: { id: "workspace" } });
  if (!row) throw new Error("Workspace config is missing. Run npm run db:seed.");
  const fieldDefaults = defaultFieldMap();
  const parsedFields = objectOr<Partial<FieldMap>>(row.bpFieldMapJson, {});
  return {
    companyName: row.companyName,
    timezone: row.timezone,
    coverage: normalizeCoverage(objectOr(row.coverageJson, {})),
    componentMap: objectOr(row.componentMapJson, {}),
    bpSubdomain: row.bpSubdomain || process.env.BUILDER_PRIME_SUBDOMAIN || "endlesspoxybilities",
    bpMode: row.bpMode === "live" && process.env.BUILDER_PRIME_API_KEY?.trim() ? "live" : "mock",
    importStatuses: row.bpImportStatuses.split(",").map((s) => s.trim()).filter(Boolean),
    fieldMap: {
      squareFootage: parsedFields.squareFootage?.length ? parsedFields.squareFootage : fieldDefaults.squareFootage,
      flakeColor: parsedFields.flakeColor?.length ? parsedFields.flakeColor : fieldDefaults.flakeColor,
      flakeSize: parsedFields.flakeSize?.length ? parsedFields.flakeSize : fieldDefaults.flakeSize,
      verticalLf: parsedFields.verticalLf?.length ? parsedFields.verticalLf : fieldDefaults.verticalLf,
      stairsLf: parsedFields.stairsLf?.length ? parsedFields.stairsLf : fieldDefaults.stairsLf,
      jobType: parsedFields.jobType?.length ? parsedFields.jobType : fieldDefaults.jobType,
    },
    statusMap: { ...defaultStatusMap(), ...objectOr<Record<string, string>>(row.bpStatusMapJson, {}) },
    varianceTolerancePct: row.varianceTolerancePct,
    winterMonths: row.winterMonths.split(",").map((n) => Number(n.trim())).filter((n) => n >= 1 && n <= 12),
  };
}

export function apiKeyConfigured(): boolean {
  return Boolean(process.env.BUILDER_PRIME_API_KEY?.trim());
}
