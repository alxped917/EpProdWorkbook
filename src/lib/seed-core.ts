import type { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";
import { defaultCoverage } from "./coverage";
import { defaultFieldMap, defaultStatusMap } from "./builder-prime-map";
import { CATALOG, WAREHOUSE_SEEDS } from "./master-data";
import { nameKey } from "./names";
import { systemRoles } from "./permissions";
import { resolveSeedPlan, type SeedPlan } from "./seed-plan";

/**
 * Idempotent shop setup: roles, the six warehouses, products, and coverage rates.
 * Existing rows are left alone so a second run does not reset prices or permissions.
 */
export async function seedCore(prisma: PrismaClient): Promise<void> {
  for (const role of systemRoles()) {
    const existing = await prisma.role.findUnique({ where: { name: role.name } });
    if (existing) continue;
    await prisma.role.create({
      data: {
        name: role.name,
        description: role.description,
        isSystem: role.name !== "Auditor",
        permissions: JSON.stringify(role.permissions),
      },
    });
  }

  for (const item of CATALOG) {
    const key = nameKey(item.name);
    const existing = await prisma.product.findUnique({ where: { nameKey: key } });
    if (existing) continue;
    await prisma.product.create({
      data: {
        name: item.name,
        nameKey: key,
        category: item.category,
        componentKey: item.componentKey,
        pricePerLb: item.pricePerLb,
        weightPerBox: item.weightPerBox,
        priceIsPlaceholder: item.priceIsPlaceholder,
        vendorName: item.vendorName,
        vendorEmail: item.vendorEmail,
        reorderPointLbs: item.reorderPointLbs,
        orderUpToLbs: item.orderUpToLbs,
        notes: item.priceIsPlaceholder ? "Sample placeholder price. Edit before relying on job cost." : "",
      },
    });
  }

  for (const warehouse of WAREHOUSE_SEEDS) {
    const existing = await prisma.warehouse.findUnique({ where: { name: warehouse.name } });
    if (existing) continue;
    await prisma.warehouse.create({
      data: {
        name: warehouse.name,
        address1: "Update this ship-to address",
        city: warehouse.city,
        state: warehouse.state,
        postalCode: warehouse.postalCode,
        notes: "Add the real ship-to address and location manager.",
      },
    });
  }

  const products = await prisma.product.findMany();
  const componentMap: Record<string, string> = {};
  for (const product of products) {
    if (product.componentKey && !componentMap[product.componentKey]) componentMap[product.componentKey] = product.id;
  }
  const coverage = defaultCoverage();
  const warehouses = await prisma.warehouse.findMany();
  for (const warehouse of warehouses) coverage.locationFactors[warehouse.name] = coverage.locationFactors[warehouse.name] ?? 1;

  const workspace = await prisma.workspaceConfig.findUnique({ where: { id: "workspace" } });
  if (!workspace) {
    await prisma.workspaceConfig.create({
      data: {
        companyName: "Endless Poxybilities",
        timezone: "America/Chicago",
        coverageJson: JSON.stringify(coverage),
        componentMapJson: JSON.stringify(componentMap),
        bpSubdomain: process.env.BUILDER_PRIME_SUBDOMAIN?.trim() || "endlesspoxybilities",
        bpMode: "mock",
        bpImportStatuses: "Sold, Job Sold, Contract Signed",
        bpFieldMapJson: JSON.stringify(defaultFieldMap()),
        bpStatusMapJson: JSON.stringify(defaultStatusMap()),
        varianceTolerancePct: 5,
        winterMonths: "11,12,1,2,3",
      },
    });
  }

  const byName = new Map(products.map((product) => [product.name.toLowerCase(), product.id]));
  const tidal = byName.get("tidal wave");
  const coyote = byName.get("coyote");
  if (tidal) {
    await prisma.colorMap.upsert({
      where: { bpColorName: "midnight blue" },
      update: {},
      create: { bpColorName: "midnight blue", productId: tidal },
    });
  }
  if (coyote) {
    await prisma.colorMap.upsert({
      where: { bpColorName: "coyote" },
      update: {},
      create: { bpColorName: "coyote", productId: coyote },
    });
  }
  for (const warehouse of warehouses) {
    await prisma.warehouseMatch.upsert({
      where: { bpLocation: warehouse.name.toLowerCase() },
      update: {},
      create: { bpLocation: warehouse.name.toLowerCase(), warehouseId: warehouse.id },
    });
  }
}

export async function ensureAdmin(prisma: PrismaClient, plan: SeedPlan): Promise<{ created: boolean; email: string }> {
  if (!plan.adminEmail || !plan.adminPassword) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required to create the first account.");
  }
  const existing = await prisma.user.findUnique({ where: { email: plan.adminEmail } });
  if (existing) return { created: false, email: existing.email };
  const role = await prisma.role.findUnique({ where: { name: "Admin" } });
  if (!role) throw new Error("Admin role is missing. Run setup again.");
  const name = plan.adminName || plan.adminEmail.split("@")[0] || "Admin";
  await prisma.user.create({
    data: {
      email: plan.adminEmail,
      name,
      passwordHash: hashSync(plan.adminPassword, 10),
      roleId: role.id,
      allWarehouses: true,
      active: true,
    },
  });
  await prisma.auditEvent.create({
    data: {
      action: "setup",
      entityType: "user",
      userName: name,
      summary: `Created the first admin account for ${plan.adminEmail}`,
    },
  });
  return { created: true, email: plan.adminEmail };
}

export async function runProductionSeed(
  prisma: PrismaClient,
  env: Parameters<typeof resolveSeedPlan>[0],
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const plan = resolveSeedPlan(env);
  if (!plan.ok) return plan;
  if (!plan.production) {
    return { ok: false, error: "This page is for the live website. On your own computer, run npm run db:seed instead." };
  }
  if (plan.sample) {
    return {
      ok: false,
      error: "SEED_SAMPLE_DATA is turned on. Remove it and redeploy for a clean shop, or run the seed command from a computer that can reach the database.",
    };
  }
  if ((await prisma.user.count()) > 0) {
    return { ok: false, error: "An account already exists. Sign in instead of running setup again." };
  }
  await seedCore(prisma);
  const admin = await ensureAdmin(prisma, plan);
  return { ok: true, email: admin.email };
}
