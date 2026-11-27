export type QualityFlag = { id: string; label: string };

export function jobQualityFlags(job: {
  flakeColor: string;
  squareFootage: number | null;
  warehouseId: string | null;
  foreman: string;
  scheduledDate: string | null;
  knownColors: string[];
}): QualityFlag[] {
  const flags: QualityFlag[] = [];
  const color = job.flakeColor.trim();
  if (!color) flags.push({ id: "no-color", label: "No flake color" });
  else if (!job.knownColors.some((c) => c.toLowerCase() === color.toLowerCase())) {
    flags.push({ id: "unknown-color", label: "Flake color is not in master data" });
  }
  if (job.squareFootage == null || job.squareFootage <= 0) {
    flags.push({ id: "no-sqft", label: "Missing square footage" });
  }
  if (!job.warehouseId) flags.push({ id: "no-warehouse", label: "No warehouse" });
  if (!job.foreman.trim()) flags.push({ id: "no-foreman", label: "No foreman" });
  if (!job.scheduledDate) flags.push({ id: "no-date", label: "No scheduled date" });
  return flags;
}
