"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requirePerm } from "@/lib/auth";
import { nameKey } from "@/lib/names";
import { csvObjects } from "@/lib/csv";
import { round2 } from "@/lib/format";
import { revalidatePath } from "next/cache";

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function saveWarehouse(formData: FormData) {
  const user = await requirePerm("warehouses", "edit");
  const id = text(formData, "id");
  const name = text(formData, "name");
  if (!name) redirect("/warehouses?error=Name is required");
  const data = {
    name,
    address1: text(formData, "address1"),
    address2: text(formData, "address2"),
    city: text(formData, "city"),
    state: text(formData, "state"),
    postalCode: text(formData, "postalCode"),
    locationManagerId: text(formData, "locationManagerId") || null,
    notes: text(formData, "notes"),
    active: formData.get("active") === "on",
  };
  if (!data.address1 || !data.city || !data.state || !data.postalCode) {
    redirect("/warehouses?error=Ship-to address, city, state, and postal code are required");
  }
  const saved = id
    ? await db.warehouse.update({ where: { id }, data })
    : await db.warehouse.create({ data });
  await writeAudit({
    userId: user.id,
    userName: user.name,
    action: id ? "warehouse_updated" : "warehouse_created",
    entityType: "warehouse",
    entityId: saved.id,
    summary: `${id ? "Updated" : "Created"} warehouse ${saved.name}`,
  });
  revalidatePath("/warehouses");
  redirect("/warehouses?notice=Warehouse saved");
}

export async function saveProduct(formData: FormData) {
  const user = await requirePerm("masterData", "edit");
  const id = text(formData, "id");
  const name = text(formData, "name");
  const category = text(formData, "category").toUpperCase();
  if (!name) redirect("/master-data?error=Name is required");
  if (!["CHEMICAL", "SUPPLY", "FLAKE"].includes(category)) redirect("/master-data?error=Pick a category");
  const price = Number(text(formData, "pricePerLb"));
  if (!Number.isFinite(price) || price < 0) redirect("/master-data?error=Price per lb must be zero or more");
  const boxRaw = text(formData, "weightPerBox");
  const weightPerBox = boxRaw ? Number(boxRaw) : null;
  if (weightPerBox != null && (!Number.isFinite(weightPerBox) || weightPerBox <= 0)) {
    redirect("/master-data?error=Weight per box must be greater than zero");
  }
  const key = nameKey(name);
  const clash = await db.product.findUnique({ where: { nameKey: key } });
  if (clash && clash.id !== id) redirect("/master-data?error=A product with that name already exists. Merge them instead.");
  const data = {
    name,
    nameKey: key,
    category,
    pricePerLb: price,
    priceIsPlaceholder: formData.get("priceIsPlaceholder") === "on",
    weightPerBox,
    status: text(formData, "status") === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    vendorName: text(formData, "vendorName"),
    vendorEmail: text(formData, "vendorEmail"),
    reorderPointLbs: Math.max(0, Number(text(formData, "reorderPointLbs")) || 0),
    orderUpToLbs: Math.max(0, Number(text(formData, "orderUpToLbs")) || 0),
    notes: text(formData, "notes"),
    componentKey: text(formData, "componentKey") || null,
  };
  const saved = id ? await db.product.update({ where: { id }, data }) : await db.product.create({ data });
  await writeAudit({
    userId: user.id,
    userName: user.name,
    action: id ? "product_updated" : "product_created",
    entityType: "product",
    entityId: saved.id,
    summary: `${id ? "Updated" : "Created"} ${saved.name}`,
  });
  revalidatePath("/master-data");
  redirect(`/master-data?notice=Saved ${saved.name}&tab=${saved.category}`);
}

export async function importProducts(formData: FormData) {
  const user = await requirePerm("masterData", "edit");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) redirect("/master-data?error=Choose a CSV file");
  const rows = csvObjects(await file.text());
  let created = 0;
  let updated = 0;
  const errors: string[] = [];
  for (const row of rows) {
    const lowered: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) lowered[key.toLowerCase().replace(/\s+/g, "")] = value;
    const name = lowered.name;
    const category = (lowered.category || "").toUpperCase();
    if (!name) {
      errors.push("A row is missing a name");
      continue;
    }
    if (!["CHEMICAL", "SUPPLY", "FLAKE"].includes(category)) {
      errors.push(`${name}: category must be CHEMICAL, SUPPLY, or FLAKE`);
      continue;
    }
    const price = Number(lowered.priceperlb || lowered.price);
    if (!Number.isFinite(price) || price < 0) {
      errors.push(`${name}: price per lb is invalid`);
      continue;
    }
    const boxRaw = lowered.weightperbox || lowered.boxweight || "";
    const weightPerBox = boxRaw ? Number(boxRaw) : null;
    const status = (lowered.status || "ACTIVE").toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE";
    const key = nameKey(name);
    const existing = await db.product.findUnique({ where: { nameKey: key } });
    const data = {
      name: name.trim(),
      nameKey: key,
      category,
      pricePerLb: price,
      weightPerBox: weightPerBox && weightPerBox > 0 ? weightPerBox : null,
      status,
    };
    if (existing) {
      await db.product.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await db.product.create({ data });
      created++;
    }
  }
  await writeAudit({
    userId: user.id,
    userName: user.name,
    action: "products_imported",
    entityType: "product",
    summary: `CSV import created ${created}, updated ${updated}, failed ${errors.length}`,
  });
  const extra = errors.length ? ` ${errors.slice(0, 2).join(" ")}` : "";
  revalidatePath("/master-data");
  redirect(`/master-data?notice=${encodeURIComponent(`Imported ${created} new, updated ${updated}.${extra}`)}`);
}

export async function mergeProducts(formData: FormData) {
  const user = await requirePerm("masterData", "edit");
  const keepId = text(formData, "keepId");
  const dropId = text(formData, "dropId");
  if (!keepId || !dropId || keepId === dropId) redirect("/master-data?error=Choose two different products to merge");
  const [keep, drop] = await Promise.all([
    db.product.findUnique({ where: { id: keepId } }),
    db.product.findUnique({ where: { id: dropId } }),
  ]);
  if (!keep || !drop) redirect("/master-data?error=Product not found");
  await db.$transaction(async (tx) => {
    const dropBalances = await tx.stockBalance.findMany({ where: { productId: dropId } });
    for (const row of dropBalances) {
      const existing = await tx.stockBalance.findUnique({
        where: { warehouseId_productId: { warehouseId: row.warehouseId, productId: keepId } },
      });
      if (existing) {
        await tx.stockBalance.update({
          where: { id: existing.id },
          data: {
            onHandLbs: round2(existing.onHandLbs + row.onHandLbs),
            shelfMinLbs: Math.max(existing.shelfMinLbs, row.shelfMinLbs),
          },
        });
        await tx.stockBalance.delete({ where: { id: row.id } });
      } else {
        await tx.stockBalance.update({ where: { id: row.id }, data: { productId: keepId } });
      }
    }
    const dropLines = await tx.jobMaterial.findMany({ where: { productId: dropId } });
    for (const line of dropLines) {
      const existing = await tx.jobMaterial.findUnique({
        where: { jobId_productId: { jobId: line.jobId, productId: keepId } },
      });
      if (existing) {
        await tx.jobMaterial.update({
          where: { id: existing.id },
          data: {
            lbsCheckedOut: round2(existing.lbsCheckedOut + line.lbsCheckedOut),
            lbsCheckedIn: round2(existing.lbsCheckedIn + line.lbsCheckedIn),
          },
        });
        await tx.jobMaterial.delete({ where: { id: line.id } });
      } else {
        await tx.jobMaterial.update({ where: { id: line.id }, data: { productId: keepId } });
      }
    }
    await tx.inventoryContainer.updateMany({ where: { productId: dropId }, data: { productId: keepId } });
    await tx.jobPickLine.updateMany({ where: { productId: dropId }, data: { productId: keepId } });
    await tx.inventoryTransaction.updateMany({ where: { productId: dropId }, data: { productId: keepId } });
    await tx.stockCount.updateMany({ where: { productId: dropId }, data: { productId: keepId } });
    await tx.colorMap.updateMany({ where: { productId: dropId }, data: { productId: keepId } });
    await tx.purchaseOrderLine.updateMany({ where: { productId: dropId }, data: { productId: keepId } });
    const config = await tx.workspaceConfig.findUnique({ where: { id: "workspace" } });
    if (config) {
      const map = JSON.parse(config.componentMapJson) as Record<string, string>;
      for (const key of Object.keys(map)) if (map[key] === dropId) map[key] = keepId;
      await tx.workspaceConfig.update({ where: { id: "workspace" }, data: { componentMapJson: JSON.stringify(map) } });
    }
    await tx.product.delete({ where: { id: dropId } });
    await writeAudit(
      {
        userId: user.id,
        userName: user.name,
        action: "products_merged",
        entityType: "product",
        entityId: keepId,
        summary: `Merged ${drop.name} into ${keep.name}`,
      },
      tx,
    );
  });
  revalidatePath("/master-data");
  redirect(`/master-data?notice=${encodeURIComponent(`Merged ${drop.name} into ${keep.name}`)}`);
}
