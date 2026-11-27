import { PageHeader, inputClass, Badge } from "@/components/ui";
import { requirePerm, warehouseWhere } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";
import { one } from "@/lib/search";
import { addDaysISO, todayISO } from "@/lib/dates";
import { jobCostLines } from "@/lib/job-cost";
import { lbs, pct } from "@/lib/format";
import { listJobs } from "@/lib/job-query";

export const metadata = { title: "Reporting" };

export default async function ReportingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePerm("reporting", "view");
  const sp = await searchParams;
  const workspace = await getWorkspace();
  const today = todayISO(workspace.timezone);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(one(sp.from)) ? one(sp.from) : addDaysISO(today, -30);
  const to = /^\d{4}-\d{2}-\d{2}$/.test(one(sp.to)) ? one(sp.to) : today;
  const tab = one(sp.tab) || "health";
  const scope = warehouseWhere(user);
  const warehouseId = one(sp.warehouseId);
  const warehouses = await db.warehouse.findMany({ where: { active: true, ...(scope ? { id: scope } : {}) }, orderBy: { name: "asc" } });
  const balanceWhere = warehouseId ? { warehouseId } : scope ? { warehouseId: scope } : {};
  const [balances, jobs, transactions] = await Promise.all([
    db.stockBalance.findMany({ where: balanceWhere, include: { product: true, warehouse: true } }),
    listJobs(user, { warehouseId, archived: "1" }),
    db.inventoryTransaction.findMany({
      where: {
        ...balanceWhere,
        occurredAt: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T23:59:59Z`) },
        event: { in: ["DRAWN", "RETURNED"] },
      },
      include: { product: true },
    }),
  ]);
  const upcoming = jobs.filter((job) => (job.status === "NEW" || job.status === "IN_PROGRESS") && (!job.scheduledDate || job.scheduledDate >= today));
  const needed = new Map<string, { name: string; lbs: number }>();
  for (const job of upcoming) {
    const full = await db.jobPickLine.findMany({ where: { jobId: job.id }, include: { product: true } });
    for (const line of full) {
      if (!line.productId || !line.product || line.plannedLbs <= 0) continue;
      const current = needed.get(line.productId) ?? { name: line.product.name, lbs: 0 };
      current.lbs += line.plannedLbs;
      needed.set(line.productId, current);
    }
  }
  const onHandByProduct = new Map<string, number>();
  for (const balance of balances) onHandByProduct.set(balance.productId, (onHandByProduct.get(balance.productId) ?? 0) + balance.onHandLbs);
  const health = [...balances].sort((a, b) => a.onHandLbs / Math.max(a.shelfMinLbs, 1) - b.onHandLbs / Math.max(b.shelfMinLbs, 1));
  const ordering = balances.filter((b) => (b.shelfMinLbs > 0 && b.onHandLbs <= b.shelfMinLbs) || (b.product.reorderPointLbs > 0 && b.onHandLbs <= b.product.reorderPointLbs));
  const usage = new Map<string, number>();
  for (const tx of transactions) {
    const day = tx.occurredAt.toISOString().slice(0, 10);
    usage.set(day, (usage.get(day) ?? 0) + -tx.weightChange);
  }
  const materialRows = await db.jobMaterial.findMany({
    where: { job: { deletedAt: null, ...(warehouseId ? { warehouseId } : scope ? { warehouseId: scope } : {}) } },
    include: { job: true, product: true },
  });
  const stillOut = materialRows.filter((row) => row.lbsCheckedOut - row.lbsCheckedIn > 0.05 && row.job.status !== "CANCELLED");
  const crewMap = new Map<string, { name: string; jobs: number; variance: number[] }>();
  for (const job of jobs) {
    if (!job.crew || job.status === "CANCELLED") continue;
    const lines = await db.job.findUnique({
      where: { id: job.id },
      include: { pickLines: { include: { product: true } }, materials: { include: { product: true } } },
    });
    if (!lines) continue;
    const comparable = lines.pickLines.reduce((s, l) => s + l.plannedLbs, 0);
    if (comparable <= 0) continue;
    const report = jobCostLines(
      lines.materials.map((m) => ({
        name: m.product.name,
        plannedLbs: lines.pickLines.find((p) => p.productId === m.productId)?.plannedLbs ?? 0,
        takenLbs: m.lbsCheckedOut,
        returnedLbs: m.lbsCheckedIn,
        pricePerLb: m.product.pricePerLb,
      })),
      workspace.varianceTolerancePct,
    );
    if (report.totals.taken <= 0) continue;
    const bucket = crewMap.get(job.crew.id) ?? { name: job.crew.name, jobs: 0, variance: [] };
    bucket.jobs += 1;
    if (report.totals.variancePct != null) bucket.variance.push(report.totals.variancePct);
    crewMap.set(job.crew.id, bucket);
  }
  const maxUsage = Math.max(1, ...usage.values());
  const tabs = [
    ["health", "Stock health"],
    ["needed", "Needed vs on hand"],
    ["ordering", "Needs ordering"],
    ["usage", "Usage"],
    ["out", "Checked out"],
    ["crews", "Crew variance"],
  ];
  return (
    <div>
      <PageHeader title="Reporting" subtitle="Stock, upcoming demand, usage, and how crews compare with the pick sheet." />
      <form className="mb-4 grid gap-2 md:grid-cols-4" action="/reporting">
        <input type="hidden" name="tab" value={tab} />
        <select className={inputClass} name="warehouseId" defaultValue={warehouseId} aria-label="Warehouse">
          <option value="">All warehouses</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <input className={inputClass} type="date" name="from" defaultValue={from} aria-label="From" />
        <input className={inputClass} type="date" name="to" defaultValue={to} aria-label="To" />
        <button className="min-h-11 rounded-xl bg-accent text-sm text-accent-ink" type="submit">Apply</button>
      </form>
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map(([key, label]) => (
          <a key={key} className={`rounded-full px-3 py-1 text-sm ${tab === key ? "bg-accent text-accent-ink" : "border border-line"}`} href={`/reporting?tab=${key}&warehouseId=${warehouseId}&from=${from}&to=${to}`}>{label}</a>
        ))}
      </div>
      {tab === "health" ? (
        <table className="min-w-full text-sm">
          <thead className="text-left text-muted"><tr><th>Warehouse</th><th>Product</th><th>On hand</th><th>Shelf min</th></tr></thead>
          <tbody>
            {health.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="py-2">{row.warehouse.name}</td>
                <td>{row.product.name}</td>
                <td>{lbs(row.onHandLbs)}</td>
                <td>{row.shelfMinLbs > 0 && row.onHandLbs <= row.shelfMinLbs ? <Badge tone="danger">{lbs(row.shelfMinLbs)}</Badge> : lbs(row.shelfMinLbs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {tab === "needed" ? (
        <table className="min-w-full text-sm">
          <thead className="text-left text-muted"><tr><th>Product</th><th>Needed on upcoming jobs</th><th>On hand</th><th>Gap</th></tr></thead>
          <tbody>
            {[...needed.entries()].map(([id, row]) => {
              const hand = onHandByProduct.get(id) ?? 0;
              return (
                <tr key={id} className="border-t border-line">
                  <td className="py-2">{row.name}</td><td>{lbs(row.lbs)}</td><td>{lbs(hand)}</td>
                  <td>{hand + 0.05 < row.lbs ? <Badge tone="danger">{lbs(row.lbs - hand)} short</Badge> : "Covered"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
      {tab === "ordering" ? (
        <table className="min-w-full text-sm">
          <thead className="text-left text-muted"><tr><th>Warehouse</th><th>Product</th><th>On hand</th><th>Suggest</th></tr></thead>
          <tbody>
            {ordering.map((row) => {
              const target = row.product.orderUpToLbs > 0 ? row.product.orderUpToLbs : row.shelfMinLbs;
              return (
                <tr key={row.id} className="border-t border-line">
                  <td className="py-2">{row.warehouse.name}</td>
                  <td>{row.product.name}</td>
                  <td>{lbs(row.onHandLbs)}</td>
                  <td>{lbs(Math.max(0, target - row.onHandLbs))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
      {tab === "usage" ? (
        <ul className="space-y-2">
          {[...usage.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([day, net]) => (
            <li key={day} className="flex items-center gap-3 text-sm">
              <span className="w-28">{day}</span>
              <span className="h-3 rounded bg-accent" style={{ width: `${Math.max(4, (net / maxUsage) * 240)}px` }} />
              <span>{lbs(net)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {tab === "out" ? (
        <table className="min-w-full text-sm">
          <thead className="text-left text-muted"><tr><th>Job</th><th>Product</th><th>Out</th><th>In</th><th>Still out</th></tr></thead>
          <tbody>
            {stillOut.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="py-2"><a className="text-accent" href={`/jobs/${row.jobId}`}>{row.job.jobNumber}</a></td>
                <td>{row.product.name}</td>
                <td>{lbs(row.lbsCheckedOut)}</td>
                <td>{lbs(row.lbsCheckedIn)}</td>
                <td>{lbs(row.lbsCheckedOut - row.lbsCheckedIn)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {tab === "crews" ? (
        <div>
          <p className="mb-3 text-sm text-muted">Comparable jobs are ones with a saved pick sheet and at least one checkout. Variance is total used pounds versus planned pounds. Crews are matched from the Builder Prime foreman.</p>
          <ul className="space-y-2">
            {[...crewMap.values()].map((crew) => {
              const avg = crew.variance.length ? crew.variance.reduce((s, n) => s + n, 0) / crew.variance.length : null;
              return <li key={crew.name} className="rounded-xl border border-line px-3 py-2 text-sm">{crew.name}: {crew.jobs} jobs, average variance {pct(avg == null ? null : Math.round(avg * 10) / 10)}</li>;
            })}
          </ul>
        </div>
      ) : null}
      <p className="mt-4 text-xs text-muted">Usage dates follow the transaction timestamp in UTC.</p>
    </div>
  );
}
