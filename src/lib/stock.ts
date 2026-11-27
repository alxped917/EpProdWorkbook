import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { writeAudit } from "./audit";
import { round2 } from "./format";
import { isValidBarcode, normalizeBarcode, generateBarcode } from "./barcode";
import {
  planMaterialUpdate,
  planReceive,
  planStockCount,
  planTrash,
  shouldStartJob,
  type Plan,
  type PlannedEvent,
} from "./inventory";
import type { CurrentUser } from "./auth";

type Tx = Prisma.TransactionClient;

async function balanceOf(tx: Tx, warehouseId: string, productId: string) {
  return tx.stockBalance.upsert({
    where: { warehouseId_productId: { warehouseId, productId } },
    update: {},
    create: { warehouseId, productId, onHandLbs: 0, shelfMinLbs: 0 },
  });
}

async function notifyIfLow(
  tx: Tx,
  input: { before: number; after: number; shelfMin: number; productName: string; warehouseName: string },
) {
  if (input.shelfMin <= 0) return;
  if (input.before > input.shelfMin + 0.001 && input.after <= input.shelfMin + 0.001) {
    await tx.notification.create({
      data: {
        kind: "LOW_STOCK",
        subject: `Low stock: ${input.productName} at ${input.warehouseName}`,
        body: `${input.productName} at ${input.warehouseName} is down to ${input.after} lb. The shelf minimum is ${input.shelfMin} lb. Email delivery is not configured, so this notice is stored in the outbox.`,
        status: "SKIPPED_NO_SMTP",
      },
    });
  }
}

async function writeEvents(
  tx: Tx,
  input: {
    events: PlannedEvent[];
    warehouseId: string;
    productId: string;
    jobId?: string | null;
    userId?: string | null;
    barcode?: string;
    productName: string;
    warehouseName: string;
    shelfMin: number;
    before: number;
  },
) {
  let before = input.before;
  for (const event of input.events) {
    await tx.inventoryTransaction.create({
      data: {
        barcode: input.barcode ?? "",
        productId: input.productId,
        event: event.event,
        weightChange: event.weightChange,
        newBalance: event.newBalance,
        warehouseId: input.warehouseId,
        jobId: input.jobId ?? null,
        userId: input.userId ?? null,
        note: event.note,
      },
    });
    before = event.newBalance;
  }
  if (input.events.length) {
    await notifyIfLow(tx, {
      before: input.before,
      after: before,
      shelfMin: input.shelfMin,
      productName: input.productName,
      warehouseName: input.warehouseName,
    });
  }
}

export async function saveMaterialLine(
  user: CurrentUser,
  input: { jobId: string; productId: string; lbsCheckedOut: number; lbsCheckedIn: number; barcode?: string },
): Promise<
  | { ok: true; lbsCheckedOut: number; lbsCheckedIn: number; used: number; onHand: number }
  | { ok: false; error: string }
> {
  try {
    return await db.$transaction(async (tx) => {
      const job = await tx.job.findUnique({ where: { id: input.jobId }, include: { warehouse: true } });
      if (!job || job.deletedAt) return { ok: false as const, error: "Job not found" };
      if (job.archivedAt) return { ok: false as const, error: "This job is archived" };
      if (job.status === "CANCELLED") return { ok: false as const, error: "Cancelled jobs cannot move stock" };
      if (!job.warehouseId || !job.warehouse) return { ok: false as const, error: "Assign a warehouse before weighing materials" };
      const product = await tx.product.findUnique({ where: { id: input.productId } });
      if (!product || product.status !== "ACTIVE") return { ok: false as const, error: "That product is not active" };

      const existing = await tx.jobMaterial.findUnique({
        where: { jobId_productId: { jobId: job.id, productId: product.id } },
      });
      const previousOut = existing?.lbsCheckedOut ?? 0;
      const previousIn = existing?.lbsCheckedIn ?? 0;
      const balance = await balanceOf(tx, job.warehouseId, product.id);
      const plan = planMaterialUpdate({
        previousOut,
        previousIn,
        nextOut: input.lbsCheckedOut,
        nextIn: input.lbsCheckedIn,
        onHand: balance.onHandLbs,
      });
      if (!plan.ok) return plan;

      const nextOut = round2(input.lbsCheckedOut);
      const nextIn = round2(input.lbsCheckedIn);
      await tx.jobMaterial.upsert({
        where: { jobId_productId: { jobId: job.id, productId: product.id } },
        update: { lbsCheckedOut: nextOut, lbsCheckedIn: nextIn },
        create: { jobId: job.id, productId: product.id, lbsCheckedOut: nextOut, lbsCheckedIn: nextIn },
      });
      await tx.stockBalance.update({
        where: { warehouseId_productId: { warehouseId: job.warehouseId, productId: product.id } },
        data: { onHandLbs: plan.onHand },
      });
      await writeEvents(tx, {
        events: plan.events,
        warehouseId: job.warehouseId,
        productId: product.id,
        jobId: job.id,
        userId: user.id,
        barcode: input.barcode,
        productName: product.name,
        warehouseName: job.warehouse.name,
        shelfMin: balance.shelfMinLbs,
        before: balance.onHandLbs,
      });

      const others = await tx.jobMaterial.aggregate({
        where: { jobId: job.id, NOT: { productId: product.id } },
        _sum: { lbsCheckedOut: true },
      });
      const previousTotal = (others._sum.lbsCheckedOut ?? 0) + previousOut;
      const nextTotal = (others._sum.lbsCheckedOut ?? 0) + nextOut;
      if (shouldStartJob(job.status, previousTotal, nextTotal)) {
        await tx.job.update({
          where: { id: job.id },
          data: { status: "IN_PROGRESS", firstCheckoutAt: job.firstCheckoutAt ?? new Date() },
        });
      }
      if (plan.events.length) {
        await writeAudit(
          {
            userId: user.id,
            userName: user.name,
            action: "material_weighed",
            entityType: "job",
            entityId: job.id,
            summary: `${job.jobNumber}: ${product.name} out ${nextOut} lb, in ${nextIn} lb`,
            before: { out: previousOut, in: previousIn, onHand: balance.onHandLbs },
            after: { out: nextOut, in: nextIn, onHand: plan.onHand },
          },
          tx,
        );
      }
      return { ok: true as const, lbsCheckedOut: nextOut, lbsCheckedIn: nextIn, used: plan.used, onHand: plan.onHand };
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not save weights" };
  }
}

export async function applyBarcode(
  user: CurrentUser,
  input: { jobId: string; barcode: string; direction: "out" | "in"; lbs?: number | null },
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const code = normalizeBarcode(input.barcode);
  if (!isValidBarcode(code)) return { ok: false, error: "Barcode must look like IS-XXXXXXXX-XXXX" };
  const container = await db.inventoryContainer.findUnique({
    where: { barcode: code },
    include: { product: true, warehouse: true },
  });
  if (!container) return { ok: false, error: "No container uses that barcode" };
  if (container.status === "TRASHED") return { ok: false, error: "That container was trashed" };
  const job = await db.job.findUnique({ where: { id: input.jobId } });
  if (!job || job.deletedAt) return { ok: false, error: "Job not found" };
  if (job.warehouseId !== container.warehouseId) {
    return { ok: false, error: `That container is at ${container.warehouse.name}, not this job's warehouse` };
  }
  const line = await db.jobMaterial.findUnique({
    where: { jobId_productId: { jobId: job.id, productId: container.productId } },
  });
  const currentOut = line?.lbsCheckedOut ?? 0;
  const currentIn = line?.lbsCheckedIn ?? 0;
  if (input.direction === "out") {
    const amount = round2(input.lbs && input.lbs > 0 ? input.lbs : container.remainingLbs);
    if (amount <= 0) return { ok: false, error: "That container has nothing left to check out" };
    if (amount - container.remainingLbs > 0.001) {
      return { ok: false, error: `Only ${container.remainingLbs} lb remains on ${code}` };
    }
    const saved = await saveMaterialLine(user, {
      jobId: job.id,
      productId: container.productId,
      lbsCheckedOut: currentOut + amount,
      lbsCheckedIn: currentIn,
      barcode: code,
    });
    if (!saved.ok) return saved;
    await db.inventoryContainer.update({
      where: { id: container.id },
      data: {
        remainingLbs: round2(container.remainingLbs - amount),
        drawnLbs: round2(container.drawnLbs + amount),
        status: round2(container.remainingLbs - amount) <= 0 ? "CHECKED_OUT" : "IN_STOCK",
        jobId: job.id,
      },
    });
    return { ok: true, message: `Checked out ${amount} lb of ${container.product.name} (${code})` };
  }
  if (container.jobId && container.jobId !== job.id) {
    return { ok: false, error: "That container is checked out to a different job" };
  }
  const amount = round2(input.lbs && input.lbs > 0 ? input.lbs : container.drawnLbs);
  if (amount <= 0) return { ok: false, error: "Nothing from that container is checked out" };
  if (amount - container.drawnLbs > 0.001) {
    return { ok: false, error: `Only ${container.drawnLbs} lb from ${code} is still out` };
  }
const saved = await saveMaterialLine(user, {
      jobId: job.id,
      productId: container.productId,
      lbsCheckedOut: currentOut,
      lbsCheckedIn: currentIn + amount,
      barcode: code,
    });
  if (!saved.ok) return saved;
  const remaining = round2(container.remainingLbs + amount);
  const drawn = round2(container.drawnLbs - amount);
  await db.inventoryContainer.update({
    where: { id: container.id },
    data: {
      remainingLbs: remaining,
      drawnLbs: drawn,
      status: drawn <= 0 ? (remaining <= 0 ? "EMPTY" : "IN_STOCK") : remaining <= 0 ? "CHECKED_OUT" : "IN_STOCK",
      jobId: drawn <= 0 ? null : job.id,
    },
  });
  return { ok: true, message: `Checked in ${amount} lb of ${container.product.name} (${code})` };
}

export async function saveStockCount(
  user: CurrentUser,
  input: { warehouseId: string; productId: string; countedLbs: number },
): Promise<{ ok: true; onHand: number } | { ok: false; error: string }> {
  try {
    return await db.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.findUnique({ where: { id: input.warehouseId } });
      const product = await tx.product.findUnique({ where: { id: input.productId } });
      if (!warehouse || !product) return { ok: false as const, error: "Warehouse or product not found" };
      const balance = await balanceOf(tx, warehouse.id, product.id);
      const plan: Plan = planStockCount(balance.onHandLbs, input.countedLbs);
      if (!plan.ok) return plan;
      await tx.stockBalance.update({
        where: { warehouseId_productId: { warehouseId: warehouse.id, productId: product.id } },
        data: { onHandLbs: plan.onHand },
      });
      await tx.stockCount.create({
        data: {
          warehouseId: warehouse.id,
          productId: product.id,
          systemLbs: balance.onHandLbs,
          countedLbs: plan.onHand,
          userId: user.id,
        },
      });
      await writeEvents(tx, {
        events: plan.events,
        warehouseId: warehouse.id,
        productId: product.id,
        userId: user.id,
        productName: product.name,
        warehouseName: warehouse.name,
        shelfMin: balance.shelfMinLbs,
        before: balance.onHandLbs,
      });
      if (plan.events.length) {
        await writeAudit(
          {
            userId: user.id,
            userName: user.name,
            action: "stock_counted",
            entityType: "stock",
            entityId: balance.id,
            summary: `${warehouse.name} ${product.name}: counted ${plan.onHand} lb (was ${balance.onHandLbs} lb)`,
          },
          tx,
        );
      }
      return { ok: true as const, onHand: plan.onHand };
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not save the count" };
  }
}

export async function receiveContainers(
  user: CurrentUser,
  input: { warehouseId: string; productId: string; containerLbs: number; count: number },
): Promise<{ ok: true; barcodes: string[] } | { ok: false; error: string }> {
  const count = Math.round(input.count);
  if (count < 1 || count > 50) return { ok: false, error: "Create between 1 and 50 containers" };
  const barcodes: string[] = [];
  try {
    await db.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.findUnique({ where: { id: input.warehouseId } });
      const product = await tx.product.findUnique({ where: { id: input.productId } });
      if (!warehouse || !product) throw new Error("Warehouse or product not found");
      const each = round2(input.containerLbs);
      if (each <= 0) throw new Error("Container weight must be greater than zero");
      let balance = await balanceOf(tx, warehouse.id, product.id);
      for (let i = 0; i < count; i++) {
        let barcode = "";
        for (let attempt = 0; attempt < 8; attempt++) {
          const candidate = generateBarcode();
          const exists = await tx.inventoryContainer.findUnique({ where: { barcode: candidate } });
          if (!exists && isValidBarcode(candidate)) {
            barcode = candidate;
            break;
          }
        }
        if (!barcode) throw new Error("Could not generate a unique barcode");
        const plan = planReceive(balance.onHandLbs, each);
        if (!plan.ok) throw new Error(plan.error);
        await tx.inventoryContainer.create({
          data: {
            barcode,
            productId: product.id,
            warehouseId: warehouse.id,
            remainingLbs: each,
            capacityLbs: each,
            status: "IN_STOCK",
          },
        });
        await tx.stockBalance.update({
          where: { warehouseId_productId: { warehouseId: warehouse.id, productId: product.id } },
          data: { onHandLbs: plan.onHand },
        });
        await writeEvents(tx, {
          events: plan.events,
          warehouseId: warehouse.id,
          productId: product.id,
          userId: user.id,
          barcode,
          productName: product.name,
          warehouseName: warehouse.name,
          shelfMin: balance.shelfMinLbs,
          before: balance.onHandLbs,
        });
        balance = { ...balance, onHandLbs: plan.onHand };
        barcodes.push(barcode);
      }
      await writeAudit(
        {
          userId: user.id,
          userName: user.name,
          action: "containers_received",
          entityType: "product",
          entityId: product.id,
          summary: `Received ${count} container${count === 1 ? "" : "s"} of ${product.name} at ${warehouse.name}`,
        },
        tx,
      );
    });
    return { ok: true, barcodes };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not receive containers" };
  }
}

export async function trashContainer(
  user: CurrentUser,
  containerId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await db.$transaction(async (tx) => {
      const container = await tx.inventoryContainer.findUnique({
        where: { id: containerId },
        include: { product: true, warehouse: true },
      });
      if (!container) throw new Error("Container not found");
      if (container.drawnLbs > 0.001) throw new Error("Check this container back in before trashing it");
      const balance = await balanceOf(tx, container.warehouseId, container.productId);
      const plan = planTrash(balance.onHandLbs, container.remainingLbs);
      if (!plan.ok) throw new Error(plan.error);
      await tx.inventoryContainer.update({
        where: { id: container.id },
        data: { remainingLbs: 0, status: "TRASHED" },
      });
      await tx.stockBalance.update({
        where: { warehouseId_productId: { warehouseId: container.warehouseId, productId: container.productId } },
        data: { onHandLbs: plan.onHand },
      });
      await writeEvents(tx, {
        events: plan.events,
        warehouseId: container.warehouseId,
        productId: container.productId,
        userId: user.id,
        barcode: container.barcode,
        productName: container.product.name,
        warehouseName: container.warehouse.name,
        shelfMin: balance.shelfMinLbs,
        before: balance.onHandLbs,
      });
      await writeAudit(
        {
          userId: user.id,
          userName: user.name,
          action: "container_trashed",
          entityType: "container",
          entityId: container.id,
          summary: `Trashed ${container.barcode} (${container.product.name})`,
        },
        tx,
      );
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not trash the container" };
  }
}
