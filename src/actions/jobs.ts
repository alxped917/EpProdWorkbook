"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { canSeeWarehouse, getCurrentUser, requirePerm } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { jobSearchText } from "@/lib/names";
import { isFlakeSize, resolveSeason } from "@/lib/coverage";
import { buildPickLines } from "@/lib/pick-build";
import { getWorkspace } from "@/lib/workspace";
import { matchCrew } from "@/lib/crew";
import { revalidateStock } from "@/lib/revalidate";
import { revalidatePath } from "next/cache";

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function optionalNumber(formData: FormData, key: string): number | null {
  const raw = text(formData, key);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function dateField(formData: FormData, key: string): string | null {
  const raw = text(formData, key);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

async function crewIdFor(foreman: string): Promise<string | null> {
  const crews = await db.crew.findMany({
    where: { active: true },
    include: { lead: true, members: { include: { user: true } } },
  });
  return (
    matchCrew(
      foreman,
      crews.map((crew) => ({
        id: crew.id,
        name: crew.name,
        leadName: crew.lead?.name ?? "",
        memberNames: crew.members.map((member) => member.user.name),
      })),
    )?.id ?? null
  );
}

function searchFor(input: {
  jobNumber: string;
  builderPrimeProjectId?: string | null;
  address1: string;
  city: string;
  state: string;
  foreman: string;
  salesperson: string;
  flakeColor: string;
  builderPrimeStatus?: string;
}) {
  return jobSearchText([
    input.jobNumber,
    input.builderPrimeProjectId,
    input.address1,
    input.city,
    input.state,
    input.foreman,
    input.salesperson,
    input.flakeColor,
    input.builderPrimeStatus,
  ]);
}

export async function createJob(formData: FormData) {
  const user = await requirePerm("jobs", "edit");
  const jobNumber = text(formData, "jobNumber");
  if (!jobNumber) redirect("/jobs/new?error=Job number is required");
  const warehouseId = text(formData, "warehouseId") || null;
  if (warehouseId && !canSeeWarehouse(user, warehouseId)) redirect("/jobs/new?error=You cannot use that warehouse");
  const existing = await db.job.findUnique({ where: { jobNumber } });
  if (existing) redirect("/jobs/new?error=That job number already exists");
  const foreman = text(formData, "foreman");
  const data = {
    jobNumber,
    type: text(formData, "type") === "REPAIR" ? "REPAIR" : "STANDARD",
    status: "NEW",
    address1: text(formData, "address1"),
    city: text(formData, "city"),
    state: text(formData, "state"),
    postalCode: text(formData, "postalCode"),
    salesperson: text(formData, "salesperson"),
    foreman,
    warehouseId,
    crewId: await crewIdFor(foreman),
    scheduledDate: dateField(formData, "scheduledDate"),
    squareFootage: optionalNumber(formData, "squareFootage"),
    verticalLf: optionalNumber(formData, "verticalLf") ?? 0,
    stairsLf: optionalNumber(formData, "stairsLf") ?? 0,
    flakeColor: text(formData, "flakeColor"),
    flakeSize: isFlakeSize(text(formData, "flakeSize")) ? text(formData, "flakeSize") : "1/4",
    season: text(formData, "season") === "winter" ? "winter" : "summer",
    companyCamUrl: text(formData, "companyCamUrl"),
    notes: text(formData, "notes"),
    source: "MANUAL",
  };
  const job = await db.job.create({
    data: { ...data, searchText: searchFor(data) },
  });
  await writeAudit({
    userId: user.id,
    userName: user.name,
    action: "job_created",
    entityType: "job",
    entityId: job.id,
    summary: `Created job ${job.jobNumber}`,
  });
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  redirect(`/jobs/${job.id}?notice=Job created`);
}

export async function updateJob(formData: FormData) {
  const user = await requirePerm("jobs", "edit");
  const id = text(formData, "id");
  const current = await db.job.findUnique({ where: { id } });
  if (!current || current.deletedAt || !canSeeWarehouse(user, current.warehouseId)) redirect("/jobs");
  const warehouseId = text(formData, "warehouseId") || null;
  if (warehouseId && !canSeeWarehouse(user, warehouseId)) {
    redirect(`/jobs/${id}?error=You cannot move the job to that warehouse`);
  }
  const status = text(formData, "status");
  const allowed = ["NEW", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
  const foreman = text(formData, "foreman");
  const next = {
    type: text(formData, "type") === "REPAIR" ? "REPAIR" : "STANDARD",
    status: allowed.includes(status) ? status : current.status,
    address1: text(formData, "address1"),
    city: text(formData, "city"),
    state: text(formData, "state"),
    postalCode: text(formData, "postalCode"),
    salesperson: text(formData, "salesperson"),
    foreman,
    warehouseId,
    crewId: await crewIdFor(foreman),
    scheduledDate: dateField(formData, "scheduledDate"),
    installedDate: dateField(formData, "installedDate"),
    squareFootage: optionalNumber(formData, "squareFootage"),
    verticalLf: optionalNumber(formData, "verticalLf") ?? 0,
    stairsLf: optionalNumber(formData, "stairsLf") ?? 0,
    flakeColor: text(formData, "flakeColor"),
    flakeSize: isFlakeSize(text(formData, "flakeSize")) ? text(formData, "flakeSize") : current.flakeSize,
    season: text(formData, "season") === "winter" ? "winter" : text(formData, "season") === "auto" ? "auto" : "summer",
    companyCamUrl: text(formData, "companyCamUrl"),
    notes: text(formData, "notes"),
    builderPrimeStatus: text(formData, "builderPrimeStatus") || current.builderPrimeStatus,
  };
  if (next.companyCamUrl && !/^https?:\/\//i.test(next.companyCamUrl)) {
    redirect(`/jobs/${id}?error=CompanyCam link must start with http:// or https://`);
  }
  await db.job.update({
    where: { id },
    data: {
      ...next,
      searchText: searchFor({
        jobNumber: current.jobNumber,
        builderPrimeProjectId: current.builderPrimeProjectId,
        address1: next.address1,
        city: next.city,
        state: next.state,
        foreman: next.foreman,
        salesperson: next.salesperson,
        flakeColor: next.flakeColor,
        builderPrimeStatus: next.builderPrimeStatus,
      }),
    },
  });
  await writeAudit({
    userId: user.id,
    userName: user.name,
    action: "job_updated",
    entityType: "job",
    entityId: id,
    summary: `Updated job ${current.jobNumber}`,
  });
  revalidatePath(`/jobs/${id}`);
  revalidatePath("/jobs");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  redirect(`/jobs/${id}?notice=Job saved`);
}

export async function savePickSheet(formData: FormData) {
  const user = await requirePerm("jobs", "edit");
  const id = text(formData, "id");
  const job = await db.job.findUnique({ where: { id }, include: { warehouse: true } });
  if (!job || job.deletedAt || !canSeeWarehouse(user, job.warehouseId)) redirect("/jobs");
  const workspace = await getWorkspace();
  const squareFootage = optionalNumber(formData, "squareFootage");
  const flakeSize = text(formData, "flakeSize");
  if (!isFlakeSize(flakeSize)) redirect(`/jobs/${id}/pick?error=Choose a flake size`);
  const seasonInput = text(formData, "season");
  const scheduledDate = dateField(formData, "scheduledDate") ?? job.scheduledDate;
  const season = resolveSeason(seasonInput, scheduledDate, workspace.winterMonths);
  const include = {
    moisture: formData.get("includeMoisture") === "on",
    gator: formData.get("includeGator") === "on",
    baseCd: formData.get("includeBaseCd") === "on",
    topCd: formData.get("includeTopCd") === "on",
  };
  const products = await db.product.findMany();
  const lines = buildPickLines({
    squareFeet: squareFootage ?? 0,
    verticalLf: optionalNumber(formData, "verticalLf") ?? 0,
    stairsLf: optionalNumber(formData, "stairsLf") ?? 0,
    flakeSize,
    season,
    warehouseName: job.warehouse?.name,
    include,
    flakeColor: text(formData, "flakeColor") || job.flakeColor,
    products,
    componentMap: workspace.componentMap,
    coverage: workspace.coverage,
  });
  const flakeColor = text(formData, "flakeColor") || job.flakeColor;
  await db.$transaction(async (tx) => {
    await tx.job.update({
      where: { id },
      data: {
        squareFootage,
        verticalLf: optionalNumber(formData, "verticalLf") ?? 0,
        stairsLf: optionalNumber(formData, "stairsLf") ?? 0,
        flakeSize,
        flakeColor,
        season: seasonInput === "auto" ? "auto" : season,
        scheduledDate,
        includeMoisture: include.moisture,
        includeGator: include.gator,
        includeBaseCd: include.baseCd,
        includeTopCd: include.topCd,
        searchText: searchFor({
          jobNumber: job.jobNumber,
          builderPrimeProjectId: job.builderPrimeProjectId,
          address1: job.address1,
          city: job.city,
          state: job.state,
          foreman: job.foreman,
          salesperson: job.salesperson,
          flakeColor,
          builderPrimeStatus: job.builderPrimeStatus,
        }),
      },
    });
    await tx.jobPickLine.deleteMany({ where: { jobId: id } });
    for (const line of lines) {
      await tx.jobPickLine.create({
        data: { jobId: id, componentKey: line.key, productId: line.productId, plannedLbs: line.lbs },
      });
      if (line.productId) {
        await tx.jobMaterial.upsert({
          where: { jobId_productId: { jobId: id, productId: line.productId } },
          update: {},
          create: { jobId: id, productId: line.productId },
        });
      }
    }
  });
  await writeAudit({
    userId: user.id,
    userName: user.name,
    action: "pick_sheet_saved",
    entityType: "job",
    entityId: id,
    summary: `Saved pick sheet for ${job.jobNumber}`,
  });
  revalidateStock(id);
  redirect(`/jobs/${id}?notice=Pick sheet saved`);
}

export async function archiveJob(formData: FormData) {
  const user = await requirePerm("jobs", "edit");
  const id = text(formData, "id");
  const job = await db.job.findUnique({ where: { id } });
  if (!job || !canSeeWarehouse(user, job.warehouseId)) redirect("/jobs");
  const archived = !job.archivedAt;
  await db.job.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
  await writeAudit({
    userId: user.id,
    userName: user.name,
    action: archived ? "job_archived" : "job_restored",
    entityType: "job",
    entityId: id,
    summary: `${archived ? "Archived" : "Restored"} ${job.jobNumber}`,
  });
  revalidatePath("/jobs");
  redirect(`/jobs/${id}?notice=${archived ? "Job archived" : "Job restored"}`);
}

export async function deleteJob(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const id = text(formData, "id");
  if (!can(user.permissions, "admin", "edit")) redirect(`/jobs/${id}?error=Only an admin can delete a job`);
  const job = await db.job.findUnique({ where: { id } });
  if (!job) redirect("/jobs");
  await db.job.update({ where: { id }, data: { deletedAt: new Date() } });
  await writeAudit({
    userId: user.id,
    userName: user.name,
    action: "job_deleted",
    entityType: "job",
    entityId: id,
    summary: `Deleted ${job.jobNumber}`,
  });
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  redirect("/jobs?notice=Job deleted");
}
