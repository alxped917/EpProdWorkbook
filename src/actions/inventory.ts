"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { canSeeWarehouse, getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { applyBarcode, receiveContainers, saveMaterialLine, saveStockCount, trashContainer } from "@/lib/stock";
import { revalidateStock } from "@/lib/revalidate";
import { round2 } from "@/lib/format";

async function editor() {
  const user = await getCurrentUser();
  if (!user) return { user: null, error: "Sign in again." };
  if (!can(user.permissions, "inventory", "edit")) return { user, error: "Your role cannot change inventory." };
  return { user, error: null };
}

export async function saveWeights(input: {
  jobId: string;
  productId: string;
  lbsCheckedOut: number;
  lbsCheckedIn: number;
}) {
  const gate = await editor();
  if (!gate.user || gate.error) return { ok: false as const, error: gate.error ?? "Unauthorized" };
  const job = await db.job.findUnique({ where: { id: input.jobId } });
  if (!job || job.deletedAt || !canSeeWarehouse(gate.user, job.warehouseId)) {
    return { ok: false as const, error: "Job not found" };
  }
  const result = await saveMaterialLine(gate.user, input);
  if (result.ok) revalidateStock(input.jobId);
  return result;
}

export async function scanBarcode(input: {
  jobId: string;
  barcode: string;
  direction: "out" | "in";
  lbs?: number | null;
}) {
  const gate = await editor();
  if (!gate.user || gate.error) return { ok: false as const, error: gate.error ?? "Unauthorized" };
  const job = await db.job.findUnique({ where: { id: input.jobId } });
  if (!job || job.deletedAt || !canSeeWarehouse(gate.user, job.warehouseId)) {
    return { ok: false as const, error: "Job not found" };
  }
  const result = await applyBarcode(gate.user, input);
  if (result.ok) revalidateStock(input.jobId);
  return result;
}

export async function addJobMaterial(formData: FormData) {
  const gate = await editor();
  if (!gate.user || gate.error) redirect(`/login`);
  const jobId = String(formData.get("jobId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const job = await db.job.findUnique({ where: { id: jobId } });
  if (!job || !canSeeWarehouse(gate.user, job.warehouseId)) redirect("/jobs");
  if (productId) {
    await db.jobMaterial.upsert({
      where: { jobId_productId: { jobId, productId } },
      update: {},
      create: { jobId, productId, lbsCheckedOut: 0, lbsCheckedIn: 0 },
    });
  }
  revalidateStock(jobId);
  redirect(`/jobs/${jobId}/materials`);
}

export async function saveCount(input: { warehouseId: string; productId: string; countedLbs: number }) {
  const gate = await editor();
  if (!gate.user || gate.error) return { ok: false as const, error: gate.error ?? "Unauthorized" };
  if (!canSeeWarehouse(gate.user, input.warehouseId)) return { ok: false as const, error: "Warehouse not found" };
  const result = await saveStockCount(gate.user, input);
  if (result.ok) revalidateStock();
  return result;
}

export async function saveShelfMin(input: { warehouseId: string; productId: string; shelfMinLbs: number }) {
  const gate = await editor();
  if (!gate.user || gate.error) return { ok: false as const, error: gate.error ?? "Unauthorized" };
  if (!canSeeWarehouse(gate.user, input.warehouseId)) return { ok: false as const, error: "Warehouse not found" };
  if (!Number.isFinite(input.shelfMinLbs) || input.shelfMinLbs < 0) {
    return { ok: false as const, error: "Shelf minimum cannot be negative" };
  }
  await db.stockBalance.upsert({
    where: { warehouseId_productId: { warehouseId: input.warehouseId, productId: input.productId } },
    update: { shelfMinLbs: round2(input.shelfMinLbs) },
    create: { warehouseId: input.warehouseId, productId: input.productId, onHandLbs: 0, shelfMinLbs: round2(input.shelfMinLbs) },
  });
  revalidateStock();
  return { ok: true as const };
}

export async function receiveStock(formData: FormData) {
  const gate = await editor();
  if (!gate.user || gate.error) redirect("/inventory/records?error=You cannot receive stock");
  const warehouseId = String(formData.get("warehouseId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const containerLbs = Number(formData.get("containerLbs"));
  const count = Number(formData.get("count") ?? 1);
  if (!canSeeWarehouse(gate.user, warehouseId)) redirect("/inventory/records?error=Warehouse not found");
  const result = await receiveContainers(gate.user, { warehouseId, productId, containerLbs, count });
  revalidateStock();
  if (!result.ok) redirect(`/inventory/records?error=${encodeURIComponent(result.error)}`);
  redirect(`/inventory/records?notice=${encodeURIComponent(`Received ${result.barcodes.length} container${result.barcodes.length === 1 ? "" : "s"}`)}&print=${result.barcodes.join(",")}`);
}

export async function trashStock(formData: FormData) {
  const gate = await editor();
  if (!gate.user || gate.error) redirect("/inventory/records?error=You cannot trash stock");
  const id = String(formData.get("id") ?? "");
  const container = await db.inventoryContainer.findUnique({ where: { id } });
  if (!container || !canSeeWarehouse(gate.user, container.warehouseId)) redirect("/inventory/records?error=Container not found");
  const result = await trashContainer(gate.user, id);
  revalidateStock();
  if (!result.ok) redirect(`/inventory/records?error=${encodeURIComponent(result.error)}`);
  redirect("/inventory/records?notice=Container trashed");
}
