import { Flash, PageHeader, inputClass, labelClass } from "@/components/ui";
import { createJob } from "@/actions/jobs";
import { requirePerm, warehouseWhere } from "@/lib/auth";
import { db } from "@/lib/db";
import { one } from "@/lib/search";

export const metadata = { title: "New job" };

export default async function NewJobPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePerm("jobs", "edit");
  const sp = await searchParams;
  const scope = warehouseWhere(user);
  const [warehouses, colors] = await Promise.all([
    db.warehouse.findMany({ where: { active: true, ...(scope ? { id: scope } : {}) }, orderBy: { name: "asc" } }),
    db.product.findMany({ where: { category: "FLAKE", status: "ACTIVE" }, orderBy: { name: "asc" } }),
  ]);
  return (
    <div>
      <PageHeader title="New job" subtitle="Create a shop job. Sold Builder Prime projects can also be imported from Admin." />
      <Flash error={one(sp.error)} />
      <form action={createJob} className="grid max-w-3xl gap-3 md:grid-cols-2">
        <label className="block"><span className={labelClass}>Job number</span><input className={inputClass} name="jobNumber" required /></label>
        <label className="block"><span className={labelClass}>Type</span>
          <select className={inputClass} name="type"><option value="STANDARD">Standard</option><option value="REPAIR">Repair</option></select>
        </label>
        <label className="block md:col-span-2"><span className={labelClass}>Street address</span><input className={inputClass} name="address1" /></label>
        <label className="block"><span className={labelClass}>City</span><input className={inputClass} name="city" /></label>
        <label className="block"><span className={labelClass}>State</span><input className={inputClass} name="state" /></label>
        <label className="block"><span className={labelClass}>Postal code</span><input className={inputClass} name="postalCode" /></label>
        <label className="block"><span className={labelClass}>Warehouse</span>
          <select className={inputClass} name="warehouseId"><option value="">Unassigned</option>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
        </label>
        <label className="block"><span className={labelClass}>Salesperson</span><input className={inputClass} name="salesperson" /></label>
        <label className="block"><span className={labelClass}>Foreman</span><input className={inputClass} name="foreman" /></label>
        <label className="block"><span className={labelClass}>Scheduled date</span><input className={inputClass} type="date" name="scheduledDate" /></label>
        <label className="block"><span className={labelClass}>Square feet</span><input className={inputClass} name="squareFootage" inputMode="decimal" /></label>
        <label className="block"><span className={labelClass}>Flake color</span><input className={inputClass} name="flakeColor" list="colors" /></label>
        <datalist id="colors">{colors.map((c) => <option key={c.id} value={c.name} />)}</datalist>
        <label className="block"><span className={labelClass}>Flake size</span>
          <select className={inputClass} name="flakeSize"><option>1/4</option><option>1/8</option><option>1/16</option></select>
        </label>
        <label className="block"><span className={labelClass}>Season</span>
          <select className={inputClass} name="season"><option value="summer">Summer</option><option value="winter">Winter</option></select>
        </label>
        <label className="block"><span className={labelClass}>Verticals (lf)</span><input className={inputClass} name="verticalLf" inputMode="decimal" /></label>
        <label className="block"><span className={labelClass}>Stairs (lf)</span><input className={inputClass} name="stairsLf" inputMode="decimal" /></label>
        <label className="block md:col-span-2"><span className={labelClass}>CompanyCam link</span><input className={inputClass} name="companyCamUrl" placeholder="https://" /></label>
        <label className="block md:col-span-2"><span className={labelClass}>Notes</span><textarea className={inputClass} name="notes" rows={3} /></label>
        <button className="min-h-11 rounded-xl bg-accent px-4 text-sm font-medium text-accent-ink md:col-span-2" type="submit">Create job</button>
      </form>
    </div>
  );
}
