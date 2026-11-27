import { saveWarehouse } from "@/actions/catalog";
import { Card, Flash, PageHeader, inputClass, labelClass } from "@/components/ui";
import { requirePerm, warehouseWhere } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { one } from "@/lib/search";

export const metadata = { title: "Warehouses" };

export default async function WarehousesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePerm("warehouses", "view");
  const sp = await searchParams;
  const scope = warehouseWhere(user);
  const [warehouses, people] = await Promise.all([
    db.warehouse.findMany({
      where: scope ? { id: scope } : {},
      include: { locationManager: true, _count: { select: { jobs: true } } },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const editable = can(user.permissions, "warehouses", "edit");
  return (
    <div>
      <PageHeader title="Warehouses" subtitle="Ship-to locations the crews pull from." />
      <Flash notice={one(sp.notice)} error={one(sp.error)} />
      <div className="grid gap-4 lg:grid-cols-2">
        {warehouses.map((warehouse) => (
          <Card key={warehouse.id} title={warehouse.name} action={warehouse.active ? undefined : <span className="text-xs text-muted">Inactive</span>}>
            <p className="text-sm">{warehouse.address1}{warehouse.address2 ? `, ${warehouse.address2}` : ""}</p>
            <p className="text-sm">{warehouse.city}, {warehouse.state} {warehouse.postalCode}</p>
            <p className="mt-2 text-sm text-muted">Location manager: {warehouse.locationManager?.name ?? "Unassigned"} · {warehouse._count.jobs} jobs</p>
            {warehouse.notes ? <p className="mt-2 text-sm">{warehouse.notes}</p> : null}
            {editable ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm">Edit</summary>
                <WarehouseForm warehouse={warehouse} people={people} />
              </details>
            ) : null}
          </Card>
        ))}
      </div>
      {editable ? (
        <Card className="mt-4" title="Add a warehouse">
          <WarehouseForm people={people} />
        </Card>
      ) : null}
    </div>
  );
}

function WarehouseForm({
  warehouse,
  people,
}: {
  warehouse?: {
    id: string;
    name: string;
    address1: string;
    address2: string;
    city: string;
    state: string;
    postalCode: string;
    locationManagerId: string | null;
    notes: string;
    active: boolean;
  };
  people: { id: string; name: string }[];
}) {
  return (
    <form action={saveWarehouse} className="mt-3 grid gap-3 md:grid-cols-2">
      {warehouse ? <input type="hidden" name="id" value={warehouse.id} /> : null}
      <label className="block md:col-span-2"><span className={labelClass}>Name</span><input className={inputClass} name="name" defaultValue={warehouse?.name} required /></label>
      <label className="block md:col-span-2"><span className={labelClass}>Ship-to address</span><input className={inputClass} name="address1" defaultValue={warehouse?.address1} required /></label>
      <label className="block md:col-span-2"><span className={labelClass}>Address line 2</span><input className={inputClass} name="address2" defaultValue={warehouse?.address2} /></label>
      <label className="block"><span className={labelClass}>City</span><input className={inputClass} name="city" defaultValue={warehouse?.city} required /></label>
      <label className="block"><span className={labelClass}>State</span><input className={inputClass} name="state" defaultValue={warehouse?.state} required /></label>
      <label className="block"><span className={labelClass}>Postal code</span><input className={inputClass} name="postalCode" defaultValue={warehouse?.postalCode} required /></label>
      <label className="block"><span className={labelClass}>Location manager</span>
        <select className={inputClass} name="locationManagerId" defaultValue={warehouse?.locationManagerId ?? ""}>
          <option value="">Unassigned</option>
          {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
        </select>
      </label>
      <label className="block md:col-span-2"><span className={labelClass}>Notes</span><textarea className={inputClass} name="notes" defaultValue={warehouse?.notes} rows={2} /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={warehouse?.active ?? true} /> Active</label>
      <button className="min-h-11 rounded-xl bg-accent px-4 text-sm font-medium text-accent-ink md:col-span-2" type="submit">Save warehouse</button>
    </form>
  );
}
