"use server";

import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requirePerm } from "@/lib/auth";
import { SECTIONS, emptyPermissions, type PermLevel } from "@/lib/permissions";
import { normalizeCoverage } from "@/lib/coverage";
import { getWorkspace } from "@/lib/workspace";
import { syncBuilderPrime, importBuilderPrimeProjects } from "@/lib/sync";
import { testBuilderPrimeConnection } from "@/lib/builder-prime-client";
import { webhookSample } from "@/lib/bp-fixtures";
import { round2 } from "@/lib/format";

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function saveRole(formData: FormData) {
  const user = await requirePerm("admin", "edit");
  const id = text(formData, "id");
  const name = text(formData, "name");
  if (!name) redirect("/admin/roles?error=Role name is required");
  const permissions = emptyPermissions();
  for (const [key] of SECTIONS) {
    const level = text(formData, `perm_${key}`);
    permissions[key] = level === "edit" || level === "view" || level === "none" ? (level as PermLevel) : "none";
  }
  const data = { name, description: text(formData, "description"), permissions: JSON.stringify(permissions) };
  if (id) {
    const existing = await db.role.findUnique({ where: { id } });
    if (!existing) redirect("/admin/roles?error=Role not found");
    if (existing.isSystem && existing.name !== name) redirect("/admin/roles?error=System role names stay fixed");
    await db.role.update({ where: { id }, data: existing.isSystem ? { description: data.description, permissions: data.permissions } : data });
  } else {
    await db.role.create({ data });
  }
  await writeAudit({
    userId: user.id,
    userName: user.name,
    action: "role_saved",
    entityType: "role",
    entityId: id,
    summary: `Saved role ${name}`,
  });
  revalidatePath("/admin/roles");
  redirect("/admin/roles?notice=Role saved");
}

export async function deleteRole(formData: FormData) {
  const user = await requirePerm("admin", "edit");
  const id = text(formData, "id");
  const role = await db.role.findUnique({ where: { id }, include: { users: true } });
  if (!role) redirect("/admin/roles?error=Role not found");
  if (role.isSystem) redirect("/admin/roles?error=System roles cannot be deleted");
  if (role.users.length) redirect("/admin/roles?error=Reassign users before deleting this role");
  await db.role.delete({ where: { id } });
  await writeAudit({ userId: user.id, userName: user.name, action: "role_deleted", entityType: "role", entityId: id, summary: `Deleted role ${role.name}` });
  redirect("/admin/roles?notice=Role deleted");
}

export async function saveUser(formData: FormData) {
  const actor = await requirePerm("admin", "edit");
  const id = text(formData, "id");
  const name = text(formData, "name");
  const email = text(formData, "email").toLowerCase();
  const roleId = text(formData, "roleId");
  if (!name || !email || !roleId) redirect("/admin/users?error=Name, email, and role are required");
  const clash = await db.user.findUnique({ where: { email } });
  if (clash && clash.id !== id) redirect("/admin/users?error=That email is already in use");
  const allWarehouses = formData.get("allWarehouses") === "on";
  const warehouseIds = formData.getAll("warehouseId").map(String);
  const password = text(formData, "password");
  const data = {
    name,
    email,
    roleId,
    allWarehouses,
    active: formData.get("active") === "on",
    phone: text(formData, "phone"),
  };
  const saved = id
    ? await db.user.update({
        where: { id },
        data: password ? { ...data, passwordHash: await hash(password, 10) } : data,
      })
    : await db.user.create({
        data: { ...data, passwordHash: await hash(password || process.env.SEED_PASSWORD || "demo-pass-7783", 10) },
      });
  await db.userWarehouse.deleteMany({ where: { userId: saved.id } });
  if (!allWarehouses) {
    await db.userWarehouse.createMany({
      data: warehouseIds.map((warehouseId) => ({ userId: saved.id, warehouseId })),
    });
  }
  await writeAudit({
    userId: actor.id,
    userName: actor.name,
    action: id ? "user_updated" : "user_created",
    entityType: "user",
    entityId: saved.id,
    summary: `${id ? "Updated" : "Created"} user ${saved.email}`,
  });
  revalidatePath("/admin/users");
  redirect("/admin/users?notice=User saved");
}

export async function saveCrew(formData: FormData) {
  const actor = await requirePerm("admin", "edit");
  const id = text(formData, "id");
  const name = text(formData, "name");
  if (!name) redirect("/admin/crews?error=Crew name is required");
  const leadId = text(formData, "leadId") || null;
  const memberIds = formData.getAll("memberId").map(String);
  const saved = id
    ? await db.crew.update({ where: { id }, data: { name, leadId, active: formData.get("active") === "on" } })
    : await db.crew.create({ data: { name, leadId, active: true } });
  await db.crewMember.deleteMany({ where: { crewId: saved.id } });
  const unique = Array.from(new Set([...(leadId ? [leadId] : []), ...memberIds]));
  if (unique.length) {
    await db.crewMember.createMany({ data: unique.map((userId) => ({ crewId: saved.id, userId })) });
  }
  await writeAudit({
    userId: actor.id,
    userName: actor.name,
    action: "crew_saved",
    entityType: "crew",
    entityId: saved.id,
    summary: `Saved crew ${saved.name}`,
  });
  revalidatePath("/admin/crews");
  redirect("/admin/crews?notice=Crew saved");
}

export async function saveCoverage(formData: FormData) {
  const actor = await requirePerm("admin", "edit");
  let parsed: unknown = {};
  try {
    parsed = JSON.parse(text(formData, "coverage") || "{}");
  } catch {
    redirect("/admin/coverage?error=Coverage rates could not be read");
  }
  const coverage = normalizeCoverage(parsed);
  const tolerance = Number(text(formData, "tolerance"));
  const winterMonths = text(formData, "winterMonths")
    .split(",")
    .map((n) => Number(n.trim()))
    .filter((n) => n >= 1 && n <= 12);
  await db.workspaceConfig.update({
    where: { id: "workspace" },
    data: {
      coverageJson: JSON.stringify(coverage),
      varianceTolerancePct: Number.isFinite(tolerance) && tolerance >= 0 ? tolerance : 5,
      winterMonths: (winterMonths.length ? winterMonths : [11, 12, 1, 2, 3]).join(","),
      timezone: text(formData, "timezone") || "America/Chicago",
    },
  });
  await writeAudit({
    userId: actor.id,
    userName: actor.name,
    action: "coverage_saved",
    entityType: "workspace",
    summary: "Updated coverage rates",
  });
  revalidatePath("/admin/coverage");
  redirect("/admin/coverage?notice=Coverage rates saved");
}

export async function saveBuilderPrimeSettings(formData: FormData) {
  const actor = await requirePerm("admin", "edit");
  const mode = text(formData, "bpMode") === "live" ? "live" : "mock";
  const fieldMap = {
    squareFootage: text(formData, "squareFootage").split(",").map((s) => s.trim()).filter(Boolean),
    flakeColor: text(formData, "flakeColor").split(",").map((s) => s.trim()).filter(Boolean),
    flakeSize: text(formData, "flakeSize").split(",").map((s) => s.trim()).filter(Boolean),
    verticalLf: text(formData, "verticalLf").split(",").map((s) => s.trim()).filter(Boolean),
    stairsLf: text(formData, "stairsLf").split(",").map((s) => s.trim()).filter(Boolean),
    jobType: text(formData, "jobType").split(",").map((s) => s.trim()).filter(Boolean),
  };
  const statusMap: Record<string, string> = {};
  for (const line of text(formData, "statusMap").split("\n")) {
    const [from, to] = line.split("=").map((s) => s.trim());
    if (from && to) statusMap[from.toLowerCase()] = to;
  }
  const subdomain = text(formData, "bpSubdomain").toLowerCase().replace(/[^a-z0-9-]/g, "") || "endlesspoxybilities";
  await db.workspaceConfig.update({
    where: { id: "workspace" },
    data: {
      bpSubdomain: subdomain,
      bpMode: mode,
      bpImportStatuses: text(formData, "importStatuses") || "Sold",
      bpFieldMapJson: JSON.stringify(fieldMap),
      bpStatusMapJson: JSON.stringify(statusMap),
    },
  });
  await writeAudit({
    userId: actor.id,
    userName: actor.name,
    action: "builder_prime_settings",
    entityType: "workspace",
    summary: `Builder Prime mode set to ${mode}`,
  });
  revalidatePath("/admin/builder-prime");
  redirect("/admin/builder-prime?notice=Settings saved");
}

export async function addColorMap(formData: FormData) {
  await requirePerm("admin", "edit");
  const bpColorName = text(formData, "bpColorName");
  const productId = text(formData, "productId");
  if (!bpColorName || !productId) redirect("/admin/builder-prime?error=Color and product are required");
  await db.colorMap.upsert({
    where: { bpColorName: bpColorName.toLowerCase() },
    update: { productId },
    create: { bpColorName: bpColorName.toLowerCase(), productId },
  });
  revalidatePath("/admin/builder-prime");
  redirect("/admin/builder-prime?notice=Color mapping saved");
}

export async function deleteColorMap(formData: FormData) {
  await requirePerm("admin", "edit");
  await db.colorMap.delete({ where: { id: text(formData, "id") } });
  redirect("/admin/builder-prime?notice=Color mapping removed");
}

export async function addWarehouseMatch(formData: FormData) {
  await requirePerm("admin", "edit");
  const bpLocation = text(formData, "bpLocation");
  const warehouseId = text(formData, "warehouseId");
  if (!bpLocation || !warehouseId) redirect("/admin/builder-prime?error=Location and warehouse are required");
  await db.warehouseMatch.upsert({
    where: { bpLocation: bpLocation.toLowerCase() },
    update: { warehouseId },
    create: { bpLocation: bpLocation.toLowerCase(), warehouseId },
  });
  redirect("/admin/builder-prime?notice=Warehouse match saved");
}

export async function deleteWarehouseMatch(formData: FormData) {
  await requirePerm("admin", "edit");
  await db.warehouseMatch.delete({ where: { id: text(formData, "id") } });
  redirect("/admin/builder-prime?notice=Warehouse match removed");
}

export async function syncJobs() {
  const user = await requirePerm("admin", "edit");
  const result = await syncBuilderPrime("MANUAL", { id: user.id, name: user.name });
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  revalidatePath("/admin/builder-prime");
  const key = result.ok ? "notice" : "error";
  redirect(`/admin/builder-prime?${key}=${encodeURIComponent(result.message)}`);
}

export async function importSampleWebhook() {
  const user = await requirePerm("admin", "edit");
  const result = await importBuilderPrimeProjects([webhookSample], "WEBHOOK", { id: user.id, name: user.name });
  revalidatePath("/jobs");
  redirect(`/admin/builder-prime?notice=${encodeURIComponent(result.message)}`);
}

export async function testConnection() {
  await requirePerm("admin", "edit");
  const workspace = await getWorkspace();
  const message = await testBuilderPrimeConnection(workspace.bpMode, workspace.bpSubdomain);
  redirect(`/admin/builder-prime?notice=${encodeURIComponent(message)}`);
}

export async function generatePurchaseOrders() {
  const user = await requirePerm("admin", "edit");
  const [products, balances, warehouses] = await Promise.all([
    db.product.findMany({ where: { status: "ACTIVE" } }),
    db.stockBalance.findMany(),
    db.warehouse.findMany(),
  ]);
  const warehouseName = new Map(warehouses.map((w) => [w.id, w.name]));
  const groups = new Map<string, { vendorName: string; vendorEmail: string; lines: { productId: string; warehouseId: string; lbs: number; unitPrice: number; name: string }[] }>();
  for (const balance of balances) {
    const product = products.find((item) => item.id === balance.productId);
    if (!product) continue;
    const reorder = product.reorderPointLbs > 0 ? product.reorderPointLbs : balance.shelfMinLbs;
    if (reorder <= 0 || balance.onHandLbs > reorder + 0.001) continue;
    const target = product.orderUpToLbs > 0 ? product.orderUpToLbs : Math.max(balance.shelfMinLbs, reorder);
    const lbs = round2(Math.max(0, target - balance.onHandLbs));
    if (lbs <= 0) continue;
    const vendor = product.vendorName || "Unassigned vendor";
    const group = groups.get(vendor) ?? { vendorName: vendor, vendorEmail: product.vendorEmail, lines: [] };
    group.lines.push({
      productId: product.id,
      warehouseId: balance.warehouseId,
      lbs,
      unitPrice: product.pricePerLb,
      name: `${product.name} @ ${warehouseName.get(balance.warehouseId) ?? "warehouse"}`,
    });
    groups.set(vendor, group);
  }
  if (groups.size === 0) redirect("/admin/purchasing?notice=Nothing is below a reorder point");
  const created: string[] = [];
  for (const group of groups.values()) {
    const number = `PO-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`;
    const po = await db.purchaseOrder.create({
      data: {
        number,
        vendorName: group.vendorName,
        vendorEmail: group.vendorEmail,
        notes: "Generated from shelf minimums and reorder points. Sample data — review before sending.",
        lines: { create: group.lines.map(({ name: _name, ...line }) => line) },
      },
    });
    const body = [
      `Purchase order ${po.number}`,
      `Vendor: ${group.vendorName}`,
      ...group.lines.map((line) => `${line.name}: ${line.lbs} lb @ $${line.unitPrice.toFixed(2)}/lb`),
      "",
      "Email was not sent. Set up an SMTP relay to deliver purchase orders; this copy is stored in the outbox.",
    ].join("\n");
    await db.notification.create({
      data: {
        kind: "PURCHASE_ORDER",
        toAddress: group.vendorEmail,
        subject: `Purchase order ${po.number}`,
        body,
        status: "SKIPPED_NO_SMTP",
      },
    });
    created.push(number);
  }
  await writeAudit({
    userId: user.id,
    userName: user.name,
    action: "purchase_orders_generated",
    entityType: "purchase_order",
    summary: `Generated ${created.join(", ")}`,
  });
  redirect(`/admin/purchasing?notice=${encodeURIComponent(`Drafted ${created.join(", ")}. Email is stored, not sent.`)}`);
}
