import { isFlakeSize, type FlakeSize } from "./coverage";

export type LooseProject = Record<string, unknown>;

export type FieldMap = {
  squareFootage: string[];
  flakeColor: string[];
  flakeSize: string[];
  verticalLf: string[];
  stairsLf: string[];
  jobType: string[];
};

export type BpSettings = {
  fieldMap: FieldMap;
  statusMap: Record<string, string>;
  importStatuses: string[];
  colorMap: Record<string, string>;
  warehouseByLocation: Record<string, string>;
  warehouseByCity: Record<string, string>;
};

export type IncomingJob = {
  builderPrimeProjectId: string;
  jobNumber: string;
  builderPrimeStatus: string;
  localStatus: string;
  type: "STANDARD" | "REPAIR";
  address1: string;
  address2: string;
  city: string;
  state: string;
  postalCode: string;
  salesperson: string;
  foreman: string;
  scheduledDate: string | null;
  installedDate: string | null;
  squareFootage: number | null;
  verticalLf: number;
  stairsLf: number;
  flakeColor: string;
  flakeSize: FlakeSize;
  warehouseId: string | null;
  projectName: string;
};

export const defaultFieldMap = (): FieldMap => ({
  squareFootage: ["Square Footage", "Sq Ft", "Floor Sq Ft", "squareFootage"],
  flakeColor: ["Flake Color", "Color", "Broadcast Color", "flakeColor"],
  flakeSize: ["Flake Size", "Chip Size", "flakeSize"],
  verticalLf: ["Verticals", "Vertical Lf", "verticalLf"],
  stairsLf: ["Stairs", "Stair Lf", "stairsLf"],
  jobType: ["Job Type", "Project Type"],
});

export const defaultStatusMap = (): Record<string, string> => ({
  sold: "NEW",
  "job sold": "NEW",
  "contract signed": "NEW",
  scheduled: "NEW",
  "in progress": "IN_PROGRESS",
  installing: "IN_PROGRESS",
  complete: "COMPLETED",
  completed: "COMPLETED",
  closed: "COMPLETED",
  cancelled: "CANCELLED",
  canceled: "CANCELLED",
  lost: "CANCELLED",
});

export function personName(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const joined = `${String(o.firstName ?? "")} ${String(o.lastName ?? "")}`.trim();
    if (joined) return joined;
    if (typeof o.name === "string") return o.name.trim();
  }
  return "";
}

export function toISODate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value < 10_000_000_000 ? value * 1000 : value;
    const date = new Date(ms);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    const iso = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
    if (iso) return iso[1];
    if (/^\d+$/.test(trimmed)) return toISODate(Number(trimmed));
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  return null;
}

function customFieldMap(project: LooseProject): Map<string, string> {
  const map = new Map<string, string>();
  for (const key of ["customFields", "customFieldValues"]) {
    const arr = project[key];
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const name = String(o.customFieldName ?? o.name ?? o.label ?? "").trim();
      const val = o.customFieldValue ?? o.value ?? "";
      if (name) map.set(name.toLowerCase(), String(val ?? "").trim());
    }
  }
  return map;
}

function lookupField(project: LooseProject, names: string[]): string {
  const custom = customFieldMap(project);
  for (const name of names) {
    const fromCustom = custom.get(name.toLowerCase());
    if (fromCustom) return fromCustom;
    const direct = project[name];
    if (typeof direct === "string" && direct.trim()) return direct.trim();
    if (typeof direct === "number" && Number.isFinite(direct)) return String(direct);
  }
  return "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function addressOf(project: LooseProject): Pick<IncomingJob, "address1" | "address2" | "city" | "state" | "postalCode"> {
  const nested =
    asRecord(project.location) ??
    asRecord(project.workSiteAddress) ??
    asRecord(project.worksiteAddress) ??
    asRecord(project.address);
  const pick = (flat: string, nestedKey: string) => {
    const direct = project[flat];
    if (typeof direct === "string" && direct.trim()) return direct.trim();
    const fromNested = nested?.[nestedKey];
    return typeof fromNested === "string" ? fromNested.trim() : "";
  };
  return {
    address1: pick("worksiteAddressLine1", "addressLine1") || pick("addressLine1", "line1"),
    address2: pick("worksiteAddressLine2", "addressLine2"),
    city: pick("worksiteAddressCity", "city"),
    state: pick("worksiteAddressState", "state"),
    postalCode: pick("worksiteAddressPostalCode", "postalCode") || pick("worksiteAddressZip", "zip"),
  };
}

function numberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function mapBuilderPrimeProject(project: LooseProject, settings: BpSettings): IncomingJob | { error: string } {
  const id = String(project.id ?? project.projectId ?? "").trim();
  if (!id) return { error: "Project payload has no id" };
  const jobNumber = String(project.projectNumber ?? project.jobNumber ?? "").trim() || `BP-${id}`;
  const builderPrimeStatus = String(
    project.projectStatusDescription ?? project.projectStatus ?? project.status ?? "",
  ).trim();
  const mappedStatus = settings.statusMap[builderPrimeStatus.toLowerCase()] ?? "NEW";
  const localStatus = ["NEW", "IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(mappedStatus) ? mappedStatus : "NEW";
  const typeText = `${lookupField(project, settings.fieldMap.jobType)} ${String(project.projectTypeDescription ?? project.projectType ?? "")}`.toLowerCase();
  const flakeRaw = lookupField(project, settings.fieldMap.flakeSize);
  const flakeSize: FlakeSize = isFlakeSize(flakeRaw) ? flakeRaw : "1/4";
  const colorRaw = lookupField(project, settings.fieldMap.flakeColor);
  const colorKey = colorRaw.toLowerCase();
  const flakeColor = settings.colorMap[colorKey] ?? colorRaw;
  const address = addressOf(project);
  const cityKey = address.city.toLowerCase();
  const warehouseId =
    settings.warehouseByLocation[cityKey] ??
    settings.warehouseByLocation[address.city.toLowerCase()] ??
    settings.warehouseByCity[cityKey] ??
    null;
  return {
    builderPrimeProjectId: id,
    jobNumber,
    builderPrimeStatus,
    localStatus,
    type: typeText.includes("repair") ? "REPAIR" : "STANDARD",
    ...address,
    salesperson: personName(project.salesPerson ?? project.salesperson),
    foreman: personName(project.foreman),
    scheduledDate: toISODate(project.estimatedStartDate ?? project.scheduledDate),
    installedDate: toISODate(project.completionDate ?? project.completionDateTime ?? project.estimatedFinishDate),
    squareFootage: numberOrNull(lookupField(project, settings.fieldMap.squareFootage)),
    verticalLf: numberOrNull(lookupField(project, settings.fieldMap.verticalLf)) ?? 0,
    stairsLf: numberOrNull(lookupField(project, settings.fieldMap.stairsLf)) ?? 0,
    flakeColor,
    flakeSize,
    warehouseId,
    projectName: String(project.projectName ?? "").trim(),
  };
}

export type LocalJobSnap = {
  status: string;
  deletedAt: string | null;
  archivedAt: string | null;
};

export function mergeSyncedJob(
  local: LocalJobSnap | null,
  incoming: IncomingJob,
): { action: "create" | "update" | "skip"; status: string; reason: string } {
  if (!local) return { action: "create", status: incoming.localStatus, reason: "New project" };
  if (local.deletedAt) return { action: "skip", status: local.status, reason: "Local job is deleted" };
  if (incoming.localStatus === "CANCELLED") {
    return { action: "update", status: "CANCELLED", reason: "Builder Prime cancelled the project" };
  }
  if (local.status === "IN_PROGRESS" || local.status === "COMPLETED") {
    return { action: "update", status: local.status, reason: "Kept local workflow status" };
  }
  return { action: "update", status: incoming.localStatus, reason: "Updated from Builder Prime" };
}

export function shouldImportStatus(status: string, importStatuses: string[]): boolean {
  if (importStatuses.length === 0) return true;
  const key = status.trim().toLowerCase();
  return importStatuses.some((item) => item.trim().toLowerCase() === key);
}
