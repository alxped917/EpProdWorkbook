import "server-only";
import { db } from "./db";
import { writeAudit } from "./audit";
import { getWorkspace } from "./workspace";
import { listBuilderPrimeProjects } from "./builder-prime-client";
import { mapBuilderPrimeProject, mergeSyncedJob, shouldImportStatus, type LooseProject } from "./builder-prime-map";
import { matchCrew, type CrewRef } from "./crew";
import { jobSearchText } from "./names";
import { isFlakeSize } from "./coverage";

export type SyncResult = {
  ok: boolean;
  message: string;
  created: number;
  updated: number;
  skipped: number;
};

async function settingsForSync() {
  const workspace = await getWorkspace();
  const [colors, matches, warehouses, crews] = await Promise.all([
    db.colorMap.findMany({ include: { product: true } }),
    db.warehouseMatch.findMany(),
    db.warehouse.findMany({ where: { active: true } }),
    db.crew.findMany({ where: { active: true }, include: { lead: true, members: { include: { user: true } } } }),
  ]);
  const colorMap: Record<string, string> = {};
  for (const row of colors) colorMap[row.bpColorName.trim().toLowerCase()] = row.product.name;
  const warehouseByLocation: Record<string, string> = {};
  for (const row of matches) warehouseByLocation[row.bpLocation.trim().toLowerCase()] = row.warehouseId;
  const cityCounts = new Map<string, string[]>();
  for (const warehouse of warehouses) {
    const city = warehouse.city.trim().toLowerCase();
    cityCounts.set(city, [...(cityCounts.get(city) ?? []), warehouse.id]);
  }
  const warehouseByCity: Record<string, string> = {};
  for (const [city, ids] of cityCounts) {
    if (ids.length === 1) warehouseByCity[city] = ids[0];
  }
  const crewRefs: CrewRef[] = crews.map((crew) => ({
    id: crew.id,
    name: crew.name,
    leadName: crew.lead?.name ?? "",
    memberNames: crew.members.map((member) => member.user.name),
  }));
  return { workspace, colorMap, warehouseByLocation, warehouseByCity, crewRefs };
}

export async function importBuilderPrimeProjects(
  projects: LooseProject[],
  trigger: "MANUAL" | "CRON" | "WEBHOOK",
  actor?: { id: string; name: string },
): Promise<SyncResult> {
  const started = await db.syncLog.create({
    data: { trigger, mode: "pending", status: "RUNNING" },
  });
  const ctx = await settingsForSync();
  await db.syncLog.update({ where: { id: started.id }, data: { mode: ctx.workspace.bpMode } });
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const lines: string[] = [];
  for (const project of projects) {
    const mapped = mapBuilderPrimeProject(project, {
      fieldMap: ctx.workspace.fieldMap,
      statusMap: ctx.workspace.statusMap,
      importStatuses: ctx.workspace.importStatuses,
      colorMap: ctx.colorMap,
      warehouseByLocation: ctx.warehouseByLocation,
      warehouseByCity: ctx.warehouseByCity,
    });
    if ("error" in mapped) {
      skipped++;
      lines.push(mapped.error);
      continue;
    }
    if (trigger !== "WEBHOOK" && !shouldImportStatus(mapped.builderPrimeStatus, ctx.workspace.importStatuses)) {
      skipped++;
      lines.push(`${mapped.jobNumber}: status “${mapped.builderPrimeStatus}” is not in the import list`);
      continue;
    }
    const local = await db.job.findFirst({
      where: { builderPrimeProjectId: mapped.builderPrimeProjectId },
    });
    const decision = mergeSyncedJob(
      local ? { status: local.status, deletedAt: local.deletedAt?.toISOString() ?? null, archivedAt: local.archivedAt?.toISOString() ?? null } : null,
      mapped,
    );
    if (decision.action === "skip") {
      skipped++;
      lines.push(`${mapped.jobNumber}: ${decision.reason}`);
      continue;
    }
    const collision = await db.job.findUnique({ where: { jobNumber: mapped.jobNumber } });
    if (collision && collision.builderPrimeProjectId !== mapped.builderPrimeProjectId) {
      skipped++;
      lines.push(`${mapped.jobNumber}: job number already exists on another record`);
      continue;
    }
    const crew = matchCrew(mapped.foreman, ctx.crewRefs);
    const shared = {
      jobNumber: mapped.jobNumber,
      builderPrimeStatus: mapped.builderPrimeStatus,
      type: mapped.type,
      address1: mapped.address1,
      address2: mapped.address2,
      city: mapped.city,
      state: mapped.state,
      postalCode: mapped.postalCode,
      salesperson: mapped.salesperson,
      foreman: mapped.foreman,
      warehouseId: mapped.warehouseId,
      crewId: crew?.id ?? null,
      scheduledDate: mapped.scheduledDate,
      installedDate: mapped.installedDate,
      squareFootage: mapped.squareFootage,
      verticalLf: mapped.verticalLf,
      stairsLf: mapped.stairsLf,
      flakeColor: mapped.flakeColor,
      flakeSize: isFlakeSize(mapped.flakeSize) ? mapped.flakeSize : "1/4",
      bpSyncedAt: new Date(),
      status: decision.status,
      searchText: jobSearchText([
        mapped.jobNumber,
        mapped.builderPrimeProjectId,
        mapped.address1,
        mapped.city,
        mapped.state,
        mapped.foreman,
        mapped.salesperson,
        mapped.flakeColor,
        mapped.builderPrimeStatus,
      ]),
    };
    if (!local) {
      await db.job.create({
        data: {
          ...shared,
          builderPrimeProjectId: mapped.builderPrimeProjectId,
          source: trigger === "WEBHOOK" ? "WEBHOOK" : "BUILDER_PRIME",
          squareFootage: mapped.squareFootage,
          flakeColor: mapped.flakeColor,
        },
      });
      created++;
      lines.push(`Created ${mapped.jobNumber}`);
    } else {
      await db.job.update({
        where: { id: local.id },
        data: {
          ...shared,
          squareFootage: mapped.squareFootage ?? local.squareFootage,
          flakeColor: mapped.flakeColor || local.flakeColor,
          verticalLf: mapped.verticalLf || local.verticalLf,
          stairsLf: mapped.stairsLf || local.stairsLf,
          scheduledDate: mapped.scheduledDate ?? local.scheduledDate,
          installedDate: mapped.installedDate ?? local.installedDate,
          warehouseId: mapped.warehouseId ?? local.warehouseId,
          address1: mapped.address1 || local.address1,
          city: mapped.city || local.city,
          state: mapped.state || local.state,
          postalCode: mapped.postalCode || local.postalCode,
          salesperson: mapped.salesperson || local.salesperson,
          foreman: mapped.foreman || local.foreman,
          searchText: jobSearchText([
            mapped.jobNumber,
            mapped.builderPrimeProjectId,
            mapped.address1 || local.address1,
            mapped.city || local.city,
            mapped.foreman || local.foreman,
            mapped.salesperson || local.salesperson,
            mapped.flakeColor || local.flakeColor,
          ]),
        },
      });
      updated++;
      lines.push(`Updated ${mapped.jobNumber} (${decision.reason})`);
    }
  }
  const message = `Created ${created}, updated ${updated}, skipped ${skipped}.`;
  await db.syncLog.update({
    where: { id: started.id },
    data: {
      finishedAt: new Date(),
      status: "SUCCESS",
      createdCount: created,
      updatedCount: updated,
      skippedCount: skipped,
      message,
      detail: lines.slice(0, 80).join("\n").slice(0, 4000),
    },
  });
  await db.notification.create({
    data: {
      kind: "SYNC_REPORT",
      subject: `Builder Prime sync (${trigger.toLowerCase()})`,
      body: `${message}\n${lines.slice(0, 30).join("\n")}\n\nEmail delivery is not configured, so this report stays in the outbox.`,
      status: "SKIPPED_NO_SMTP",
    },
  });
  await writeAudit({
    userId: actor?.id,
    userName: actor?.name ?? "System",
    action: "builder_prime_sync",
    entityType: "sync",
    entityId: started.id,
    summary: message,
  });
  return { ok: true, message, created, updated, skipped };
}

export async function syncBuilderPrime(trigger: "MANUAL" | "CRON", actor?: { id: string; name: string }): Promise<SyncResult> {
  const workspace = await getWorkspace();
  const listed = await listBuilderPrimeProjects({
    mode: workspace.bpMode,
    subdomain: workspace.bpSubdomain,
    statuses: workspace.importStatuses,
  });
  if (listed.error) {
    await db.syncLog.create({
      data: {
        trigger,
        mode: workspace.bpMode,
        status: "ERROR",
        finishedAt: new Date(),
        message: listed.error,
      },
    });
    return { ok: false, message: listed.error, created: 0, updated: 0, skipped: 0 };
  }
  return importBuilderPrimeProjects(listed.projects, trigger, actor);
}
