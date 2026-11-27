import "server-only";
import { notFound } from "next/navigation";
import { db } from "./db";
import { canSeeWarehouse, type CurrentUser } from "./auth";
import { jobQualityFlags } from "./job-flags";

export async function loadJob(id: string, user: CurrentUser) {
  const include = {
    warehouse: true,
    crew: { include: { lead: true } },
    materials: { include: { product: true }, orderBy: { product: { name: "asc" as const } } },
    pickLines: { include: { product: true } },
  };
  const job =
    (await db.job.findUnique({ where: { id }, include })) ??
    (await db.job.findUnique({ where: { jobNumber: id }, include }));
  if (!job || job.deletedAt || !canSeeWarehouse(user, job.warehouseId)) notFound();
  const colors = await db.product.findMany({ where: { category: "FLAKE", status: "ACTIVE" }, select: { name: true } });
  const flags = jobQualityFlags({
    flakeColor: job.flakeColor,
    squareFootage: job.squareFootage,
    warehouseId: job.warehouseId,
    foreman: job.foreman,
    scheduledDate: job.scheduledDate,
    knownColors: colors.map((c) => c.name),
  });
  return { job, flags };
}
