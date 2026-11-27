import { NextResponse } from "next/server";
import { getCurrentUser, warehouseWhere } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "transactions", "view")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const scope = warehouseWhere(user);
  const warehouseId = url.searchParams.get("warehouseId");
  const rows = await db.inventoryTransaction.findMany({
    where: {
      ...(url.searchParams.get("event") ? { event: url.searchParams.get("event")! } : {}),
      ...(url.searchParams.get("job") ? { jobId: url.searchParams.get("job")! } : {}),
      ...(warehouseId ? { warehouseId } : scope ? { warehouseId: scope } : {}),
    },
    include: { product: true, warehouse: true, job: true, user: true },
    orderBy: { occurredAt: "desc" },
    take: 5000,
  });
  const csv = toCsv([
    ["occurredAt", "barcode", "product", "event", "weightChange", "newBalance", "warehouse", "jobNumber", "user", "note"],
    ...rows.map((row) => [
      row.occurredAt.toISOString(),
      row.barcode,
      row.product.name,
      row.event,
      row.weightChange,
      row.newBalance,
      row.warehouse.name,
      row.job?.jobNumber,
      row.user?.name,
      row.note,
    ]),
  ]);
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=\"transactions.csv\"" },
  });
}
