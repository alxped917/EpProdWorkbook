import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { jobQualityFlags } from "./job-flags";
import { canSeeWarehouse, warehouseWhere, type CurrentUser } from "./auth";

export type JobQuery = {
  q?: string;
  status?: string;
  type?: string;
  warehouseId?: string;
  flakeColor?: string;
  needs?: string;
  archived?: string;
};

export async function listJobs(user: CurrentUser, query: JobQuery) {
  const where: Prisma.JobWhereInput = { deletedAt: null };
  if (query.archived !== "1") where.archivedAt = null;
  const scope = warehouseWhere(user);
  if (query.warehouseId) {
    if (!canSeeWarehouse(user, query.warehouseId)) return [];
    where.warehouseId = query.warehouseId;
  } else if (scope) where.warehouseId = scope;
  if (query.status) where.status = query.status;
  if (query.type) where.type = query.type;
  if (query.flakeColor) where.flakeColor = query.flakeColor;
  if (query.q) where.searchText = { contains: query.q.trim().toLowerCase() };
  const [jobs, colors] = await Promise.all([
    db.job.findMany({
      where,
      include: { warehouse: true, crew: true },
      orderBy: [{ scheduledDate: "asc" }, { jobNumber: "asc" }],
      take: 500,
    }),
    db.product.findMany({ where: { category: "FLAKE", status: "ACTIVE" }, select: { name: true } }),
  ]);
  const knownColors = colors.map((color) => color.name);
  const withFlags = jobs.map((job) => ({
    ...job,
    flags: jobQualityFlags({
      flakeColor: job.flakeColor,
      squareFootage: job.squareFootage,
      warehouseId: job.warehouseId,
      foreman: job.foreman,
      scheduledDate: job.scheduledDate,
      knownColors,
    }),
  }));
  if (query.needs === "1") return withFlags.filter((job) => job.flags.length > 0);
  return withFlags;
}
