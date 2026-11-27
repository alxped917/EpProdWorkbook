import { CountEditor } from "@/components/count-editor";
import { PageHeader, inputClass } from "@/components/ui";
import { requirePerm, warehouseWhere, canSeeWarehouse } from "@/lib/auth";
import { db } from "@/lib/db";
import { one } from "@/lib/search";

export const metadata = { title: "Count stock" };

export default async function CountPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePerm("inventory", "view");
  const sp = await searchParams;
  const scope = warehouseWhere(user);
  const warehouses = await db.warehouse.findMany({ where: { active: true, ...(scope ? { id: scope } : {}) }, orderBy: { name: "asc" } });
  const warehouseId = one(sp.warehouseId) || warehouses[0]?.id || "";
  if (!warehouseId || !canSeeWarehouse(user, warehouseId)) {
    return <PageHeader title="Count stock" subtitle="No warehouse is assigned to you." />;
  }
  const [products, balances] = await Promise.all([
    db.product.findMany({ where: { status: "ACTIVE" }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    db.stockBalance.findMany({ where: { warehouseId } }),
  ]);
  const byProduct = new Map(balances.map((b) => [b.productId, b]));
  const rows = products.map((product) => ({
    productId: product.id,
    warehouseId,
    name: product.name,
    category: product.category,
    onHand: byProduct.get(product.id)?.onHandLbs ?? 0,
    shelfMin: byProduct.get(product.id)?.shelfMinLbs ?? 0,
  }));
  return (
    <div>
      <PageHeader title="Count stock" subtitle="Each change is saved as a stock adjustment. Shelf minimums feed the ordering report." />
      <form className="mb-4 max-w-sm" action="/inventory/count">
        <select className={inputClass} name="warehouseId" defaultValue={warehouseId} aria-label="Warehouse" onChange={undefined}>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <button className="mt-2 min-h-11 rounded-xl border border-line px-4 text-sm" type="submit">Load warehouse</button>
      </form>
      <CountEditor rows={rows} />
    </div>
  );
}
