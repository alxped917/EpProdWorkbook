import { receiveStock, trashStock } from "@/actions/inventory";
import { Flash, PageHeader, inputClass, labelClass } from "@/components/ui";
import { requirePerm, warehouseWhere, canSeeWarehouse } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { one } from "@/lib/search";
import { lbs } from "@/lib/format";

export const metadata = { title: "Inventory records" };

export default async function RecordsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePerm("inventory", "view");
  const sp = await searchParams;
  const scope = warehouseWhere(user);
  const warehouseId = one(sp.warehouseId);
  if (warehouseId && !canSeeWarehouse(user, warehouseId)) {
    return <PageHeader title="Inventory records" subtitle="That warehouse is outside your assignment." />;
  }
  const q = one(sp.q).toLowerCase();
  const [warehouses, products, containers, balances] = await Promise.all([
    db.warehouse.findMany({ where: { active: true, ...(scope ? { id: scope } : {}) }, orderBy: { name: "asc" } }),
    db.product.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
    db.inventoryContainer.findMany({
      where: {
        ...(warehouseId ? { warehouseId } : scope ? { warehouseId: scope } : {}),
        status: { not: "TRASHED" },
      },
      include: { product: true, warehouse: true },
      orderBy: { barcode: "asc" },
    }),
    db.stockBalance.findMany({
      where: warehouseId ? { warehouseId } : scope ? { warehouseId: scope } : {},
      include: { product: true, warehouse: true },
    }),
  ]);
  const barcoded = new Map<string, number>();
  for (const container of containers) {
    if (container.status === "CHECKED_OUT") continue;
    const key = `${container.warehouseId}:${container.productId}`;
    barcoded.set(key, (barcoded.get(key) ?? 0) + container.remainingLbs);
  }
  const editable = can(user.permissions, "inventory", "edit");
  const visibleContainers = containers.filter((c) => !q || c.barcode.toLowerCase().includes(q) || c.product.name.toLowerCase().includes(q));
  return (
    <div>
      <PageHeader title="Inventory records" subtitle="Barcoded containers and the bulk weight that is not on a label." />
      <Flash notice={one(sp.notice)} error={one(sp.error)} />
      <form className="mb-4 flex flex-col gap-2 sm:flex-row" action="/inventory/records">
        <select className={inputClass} name="warehouseId" defaultValue={warehouseId} aria-label="Warehouse">
          <option value="">All assigned warehouses</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <input className={inputClass} name="q" defaultValue={one(sp.q)} placeholder="Search barcode or product" aria-label="Search records" />
        <button className="min-h-11 rounded-xl bg-accent px-4 text-sm text-accent-ink" type="submit">Search</button>
      </form>
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="min-w-full text-sm">
          <thead className="bg-sunken text-left text-muted">
            <tr>{["Warehouse", "Product", "On hand", "On labels", "Bulk"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
          </thead>
          <tbody>
            {balances.filter((b) => !q || b.product.name.toLowerCase().includes(q)).map((b) => {
              const labeled = barcoded.get(`${b.warehouseId}:${b.productId}`) ?? 0;
              return (
                <tr key={b.id} className="border-t border-line">
                  <td className="px-3 py-2">{b.warehouse.name}</td>
                  <td className="px-3 py-2">{b.product.name}</td>
                  <td className="px-3 py-2">{lbs(b.onHandLbs)}</td>
                  <td className="px-3 py-2">{lbs(labeled)}</td>
                  <td className="px-3 py-2">{lbs(Math.round((b.onHandLbs - labeled) * 10) / 10)}{b.onHandLbs + 0.05 < labeled ? " · labels exceed on-hand" : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <h2 className="mb-2 mt-6 text-lg font-semibold">Containers</h2>
      <form id="labels" action="/api/labels" method="get" />
      <div className="mb-3">
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="min-w-full text-sm">
            <thead className="bg-sunken text-left text-muted">
              <tr>{["", "Barcode", "Product", "Warehouse", "Remaining", "Status", ""].map((h) => <th key={h || "x"} className="px-3 py-2">{h}</th>)}</tr>
            </thead>
            <tbody>
              {visibleContainers.map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="px-3 py-2"><input form="labels" type="checkbox" name="id" value={c.id} aria-label={`Select ${c.barcode}`} /></td>
                  <td className="px-3 py-2 font-mono text-xs">{c.barcode}</td>
                  <td className="px-3 py-2">{c.product.name}</td>
                  <td className="px-3 py-2">{c.warehouse.name}</td>
                  <td className="px-3 py-2">{lbs(c.remainingLbs)}</td>
                  <td className="px-3 py-2">{c.status.replaceAll("_", " ")}</td>
                  <td className="px-3 py-2">
                    {editable ? (
                      <>
                        <form id={`trash-${c.id}`} action={trashStock}><input type="hidden" name="id" value={c.id} /></form>
                        <button className="text-danger" form={`trash-${c.id}`} type="submit">Trash</button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="mt-3 min-h-11 rounded-xl border border-line px-4 text-sm" form="labels" type="submit">Print barcode labels</button>
      </div>
      {editable ? (
        <form action={receiveStock} className="grid max-w-xl gap-3 rounded-2xl border border-line p-4 md:grid-cols-2">
          <h2 className="text-base font-semibold md:col-span-2">Receive containers</h2>
          <label className="block"><span className={labelClass}>Warehouse</span>
            <select className={inputClass} name="warehouseId" required>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
          </label>
          <label className="block"><span className={labelClass}>Product</span>
            <select className={inputClass} name="productId" required>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          </label>
          <label className="block"><span className={labelClass}>Pounds each</span><input className={inputClass} name="containerLbs" inputMode="decimal" required defaultValue={40} /></label>
          <label className="block"><span className={labelClass}>How many</span><input className={inputClass} name="count" inputMode="numeric" required defaultValue={1} /></label>
          <button className="min-h-11 rounded-xl bg-accent px-4 text-sm font-medium text-accent-ink md:col-span-2" type="submit">Add to stock and print later</button>
        </form>
      ) : null}
    </div>
  );
}
