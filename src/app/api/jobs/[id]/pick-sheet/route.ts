import { NextResponse } from "next/server";
import { getCurrentUser, canSeeWarehouse } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";
import { aboutBoxes, formatBoxes, stockStatus } from "@/lib/coverage";
import { buildPickSheetPdf } from "@/lib/pdf";
import { COMPONENTS } from "@/lib/coverage";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "jobs", "view")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const job = await db.job.findUnique({
    where: { id },
    include: { warehouse: true, pickLines: { include: { product: true } } },
  });
  if (!job || job.deletedAt || !canSeeWarehouse(user, job.warehouseId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const workspace = await getWorkspace();
  const balances = job.warehouseId ? await db.stockBalance.findMany({ where: { warehouseId: job.warehouseId } }) : [];
  const onHand = new Map(balances.map((b) => [b.productId, b.onHandLbs]));
  const bytes = await buildPickSheetPdf({
    company: workspace.companyName,
    jobNumber: job.jobNumber,
    address: [job.address1, job.city, job.state, job.postalCode].filter(Boolean).join(", ") || "No address",
    warehouse: job.warehouse?.name ?? "Unassigned",
    schedule: job.scheduledDate ?? "Unscheduled",
    flake: job.flakeColor || "No color",
    size: job.flakeSize,
    sqft: job.squareFootage ? `${job.squareFootage} sq ft` : "Missing",
    lines: job.pickLines.map((line) => {
      const label = COMPONENTS.find((c) => c.key === line.componentKey)?.label ?? line.componentKey;
      const boxes = line.product ? aboutBoxes(line.plannedLbs, line.product.weightPerBox) : null;
      const hand = line.productId ? onHand.get(line.productId) ?? 0 : null;
      const stock = stockStatus(line.product ? hand : null, line.plannedLbs);
      return {
        label,
        product: line.product?.name ?? "Not mapped",
        lbs: String(line.plannedLbs),
        boxes: formatBoxes(boxes),
        stock: stock === "none" ? "None in stock" : stock === "short" ? "Short" : stock === "unmapped" ? "Unmapped" : "In stock",
      };
    }),
  });
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${job.jobNumber}-pick-sheet.pdf"`,
    },
  });
}
