import { Flash, PageHeader, inputClass } from "@/components/ui";
import { requirePerm, warehouseWhere } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";
import { one } from "@/lib/search";
import { displayDateTime } from "@/lib/dates";
import { lbs } from "@/lib/format";

export const metadata = { title: "Transactions" };

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePerm("transactions", "view");
  const sp = await searchParams;
  const workspace = await getWorkspace();
  const scope = warehouseWhere(user);
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const take = 50;
  const q = one(sp.q).toLowerCase();
  const event = one(sp.event);
  const warehouseId = one(sp.warehouseId);
  const jobId = one(sp.job);
  const where = {
    ...(event ? { event } : {}),
    ...(jobId ? { jobId } : {}),
    ...(warehouseId ? { warehouseId } : scope ? { warehouseId: scope } : {}),
  };
  const [warehouses, rows, total] = await Promise.all([
    db.warehouse.findMany({ where: { active: true, ...(scope ? { id: scope } : {}) }, orderBy: { name: "asc" } }),
    db.inventoryTransaction.findMany({
      where,
      include: { product: true, warehouse: true, job: true, user: true },
      orderBy: { occurredAt: "desc" },
      skip: (page - 1) * take,
      take,
    }),
    db.inventoryTransaction.count({ where }),
  ]);
  const visible = q
    ? rows.filter((row) => `${row.barcode} ${row.product.name} ${row.job?.jobNumber ?? ""} ${row.user?.name ?? ""}`.toLowerCase().includes(q))
    : rows;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ q: one(sp.q), event, warehouseId, job: jobId })) if (value) params.set(key, value);
  return (
    <div>
      <PageHeader
        title="Transactions"
        subtitle="Every draw, return, count, trash, and receipt."
        actions={<a className="inline-flex min-h-11 items-center rounded-xl border border-line px-3 text-sm" href={`/api/exports/transactions?${params.toString()}`}>Export CSV</a>}
      />
      <Flash notice={one(sp.notice)} />
      <form className="mb-4 grid gap-2 md:grid-cols-5" action="/transactions">
        <input className={inputClass} name="q" defaultValue={one(sp.q)} placeholder="Barcode, product, job, user" aria-label="Search transactions" />
        <select className={inputClass} name="event" defaultValue={event} aria-label="Event">
          <option value="">Any event</option>
          {["DRAWN", "RETURNED", "ADJUSTED", "TRASHED", "RECEIVED"].map((item) => <option key={item}>{item}</option>)}
        </select>
        <select className={inputClass} name="warehouseId" defaultValue={warehouseId} aria-label="Warehouse">
          <option value="">Any warehouse</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <input className={inputClass} name="job" defaultValue={jobId} placeholder="Job id filter" aria-label="Job id" />
        <button className="min-h-11 rounded-xl bg-accent text-sm text-accent-ink" type="submit">Filter</button>
      </form>
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="min-w-full text-sm">
          <thead className="bg-sunken text-left text-muted">
            <tr>{["When", "Barcode", "Product", "Event", "Change", "Balance", "Warehouse", "Job", "User"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="px-3 py-2 whitespace-nowrap">{displayDateTime(row.occurredAt, workspace.timezone)}</td>
                <td className="px-3 py-2 font-mono text-xs">{row.barcode || "—"}</td>
                <td className="px-3 py-2">{row.product.name}</td>
                <td className="px-3 py-2">{row.event}</td>
                <td className={`px-3 py-2 ${row.weightChange < 0 ? "text-danger" : "text-ok"}`}>{row.weightChange > 0 ? "+" : ""}{lbs(row.weightChange)}</td>
                <td className="px-3 py-2">{lbs(row.newBalance)}</td>
                <td className="px-3 py-2">{row.warehouse.name}</td>
                <td className="px-3 py-2">{row.job ? <a className="text-accent" href={`/jobs/${row.job.id}`}>{row.job.jobNumber}</a> : "—"}</td>
                <td className="px-3 py-2">{row.user?.name ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-muted">{total} transaction{total === 1 ? "" : "s"} · page {page}</p>
      <div className="mt-2 flex gap-2">
        {page > 1 ? <a className="text-sm text-accent" href={`/transactions?${params.toString()}&page=${page - 1}`}>Previous</a> : null}
        {page * take < total ? <a className="text-sm text-accent" href={`/transactions?${params.toString()}&page=${page + 1}`}>Next</a> : null}
      </div>
    </div>
  );
}
