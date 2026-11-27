import { NextResponse } from "next/server";
import { getCurrentUser, canSeeWarehouse } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { buildLabelsPdf } from "@/lib/pdf";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "inventory", "view")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ids = new URL(request.url).searchParams.getAll("id");
  if (!ids.length) return NextResponse.json({ error: "Select at least one container" }, { status: 400 });
  const containers = await db.inventoryContainer.findMany({
    where: { id: { in: ids } },
    include: { product: true, warehouse: true },
  });
  const allowed = containers.filter((c) => canSeeWarehouse(user, c.warehouseId));
  const bytes = await buildLabelsPdf(
    allowed.map((c) => ({
      barcode: c.barcode,
      title: c.product.name,
      detail: `${c.warehouse.name} · ${c.capacityLbs} lb`,
    })),
  );
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=\"barcode-labels.pdf\"",
    },
  });
}
