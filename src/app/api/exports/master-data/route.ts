import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "masterData", "view")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const products = await db.product.findMany({ orderBy: { name: "asc" } });
  const csv = toCsv([
    ["name", "category", "pricePerLb", "weightPerBox", "status", "componentKey", "vendorName", "reorderPointLbs", "orderUpToLbs"],
    ...products.map((p) => [p.name, p.category, p.pricePerLb, p.weightPerBox, p.status, p.componentKey, p.vendorName, p.reorderPointLbs, p.orderUpToLbs]),
  ]);
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=\"products.csv\"" },
  });
}
