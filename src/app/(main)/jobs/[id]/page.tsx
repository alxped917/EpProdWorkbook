import { archiveJob, deleteJob, updateJob } from "@/actions/jobs";
import { JobHeader } from "@/components/job-header";
import { Card, Flash, inputClass, labelClass } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { loadJob } from "@/lib/load-job";
import { getWorkspace } from "@/lib/workspace";
import { one } from "@/lib/search";
import { displayDate, displayDateTime } from "@/lib/dates";
import { aboutBoxes, formatBoxes } from "@/lib/coverage";
import { lbs, round1 } from "@/lib/format";
import { warehouseWhere } from "@/lib/auth";

export const metadata = { title: "Job" };

export default async function JobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePerm("jobs", "view");
  const { id } = await params;
  const sp = await searchParams;
  const { job, flags } = await loadJob(id, user);
  const workspace = await getWorkspace();
  const editable = can(user.permissions, "jobs", "edit");
  const scope = warehouseWhere(user);
  const [warehouses, colors, txs] = await Promise.all([
    db.warehouse.findMany({ where: { active: true, ...(scope ? { id: scope } : {}) }, orderBy: { name: "asc" } }),
    db.product.findMany({ where: { category: "FLAKE", status: "ACTIVE" }, orderBy: { name: "asc" } }),
    db.inventoryTransaction.findMany({ where: { jobId: job.id, event: "DRAWN" }, select: { productId: true, barcode: true } }),
  ]);
  const containers = new Map<string, Set<string>>();
  for (const tx of txs) {
    if (!tx.barcode) continue;
    const set = containers.get(tx.productId) ?? new Set<string>();
    set.add(tx.barcode);
    containers.set(tx.productId, set);
  }
  const usedRows = job.materials
    .map((line) => {
      const used = round1(line.lbsCheckedOut - line.lbsCheckedIn);
      const units = line.product.weightPerBox ? round1(used / line.product.weightPerBox) : null;
      return { id: line.id, name: line.product.name, used, units, containers: containers.get(line.productId)?.size ?? 0 };
    })
    .filter((row) => row.used !== 0 || row.containers > 0);
  return (
    <div>
      <JobHeader job={job} flags={flags} />
      <Flash notice={one(sp.notice)} error={one(sp.error)} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Details">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted">Address</dt><dd>{[job.address1, job.city, job.state, job.postalCode].filter(Boolean).join(", ") || "—"}</dd>
            <dt className="text-muted">Warehouse</dt><dd>{job.warehouse?.name ?? "—"}</dd>
            <dt className="text-muted">Crew</dt><dd>{job.crew?.name ?? "No crew match"}</dd>
            <dt className="text-muted">Foreman</dt><dd>{job.foreman || "—"}</dd>
            <dt className="text-muted">Salesperson</dt><dd>{job.salesperson || "—"}</dd>
            <dt className="text-muted">Scheduled</dt><dd>{displayDate(job.scheduledDate)}</dd>
            <dt className="text-muted">Installed</dt><dd>{displayDate(job.installedDate)}</dd>
            <dt className="text-muted">Floor</dt><dd>{job.squareFootage ? `${job.squareFootage.toLocaleString()} sq ft` : "—"}</dd>
            <dt className="text-muted">Flake</dt><dd>{job.flakeColor || "—"} · {job.flakeSize}</dd>
            <dt className="text-muted">Season</dt><dd>{job.season}</dd>
          </dl>
          {flags.length ? <ul className="mt-3 space-y-1 text-sm text-danger">{flags.map((f) => <li key={f.id}>{f.label}</li>)}</ul> : null}
          {editable ? (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium">Edit job</summary>
              <form action={updateJob} className="mt-3 grid gap-3 md:grid-cols-2">
                <input type="hidden" name="id" value={job.id} />
                <label className="block"><span className={labelClass}>Type</span>
                  <select className={inputClass} name="type" defaultValue={job.type}><option value="STANDARD">Standard</option><option value="REPAIR">Repair</option></select>
                </label>
                <label className="block"><span className={labelClass}>Status</span>
                  <select className={inputClass} name="status" defaultValue={job.status}>
                    <option value="NEW">New</option><option value="IN_PROGRESS">In progress</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option>
                  </select>
                </label>
                <label className="block md:col-span-2"><span className={labelClass}>Street</span><input className={inputClass} name="address1" defaultValue={job.address1} /></label>
                <label className="block"><span className={labelClass}>City</span><input className={inputClass} name="city" defaultValue={job.city} /></label>
                <label className="block"><span className={labelClass}>State</span><input className={inputClass} name="state" defaultValue={job.state} /></label>
                <label className="block"><span className={labelClass}>Postal code</span><input className={inputClass} name="postalCode" defaultValue={job.postalCode} /></label>
                <label className="block"><span className={labelClass}>Warehouse</span>
                  <select className={inputClass} name="warehouseId" defaultValue={job.warehouseId ?? ""}>
                    <option value="">Unassigned</option>
                    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </label>
                <label className="block"><span className={labelClass}>Salesperson</span><input className={inputClass} name="salesperson" defaultValue={job.salesperson} /></label>
                <label className="block"><span className={labelClass}>Foreman</span><input className={inputClass} name="foreman" defaultValue={job.foreman} /></label>
                <label className="block"><span className={labelClass}>Scheduled</span><input className={inputClass} type="date" name="scheduledDate" defaultValue={job.scheduledDate ?? ""} /></label>
                <label className="block"><span className={labelClass}>Installed</span><input className={inputClass} type="date" name="installedDate" defaultValue={job.installedDate ?? ""} /></label>
                <label className="block"><span className={labelClass}>Square feet</span><input className={inputClass} name="squareFootage" defaultValue={job.squareFootage ?? ""} /></label>
                <label className="block"><span className={labelClass}>Verticals</span><input className={inputClass} name="verticalLf" defaultValue={job.verticalLf} /></label>
                <label className="block"><span className={labelClass}>Stairs</span><input className={inputClass} name="stairsLf" defaultValue={job.stairsLf} /></label>
                <label className="block"><span className={labelClass}>Flake color</span><input className={inputClass} name="flakeColor" list="job-colors" defaultValue={job.flakeColor} /></label>
                <datalist id="job-colors">{colors.map((c) => <option key={c.id} value={c.name} />)}</datalist>
                <label className="block"><span className={labelClass}>Flake size</span>
                  <select className={inputClass} name="flakeSize" defaultValue={job.flakeSize}><option>1/4</option><option>1/8</option><option>1/16</option></select>
                </label>
                <label className="block"><span className={labelClass}>Season</span>
                  <select className={inputClass} name="season" defaultValue={job.season}><option value="summer">Summer</option><option value="winter">Winter</option><option value="auto">Auto</option></select>
                </label>
                <label className="block"><span className={labelClass}>Builder Prime status</span><input className={inputClass} name="builderPrimeStatus" defaultValue={job.builderPrimeStatus} /></label>
                <label className="block md:col-span-2"><span className={labelClass}>CompanyCam link</span><input className={inputClass} name="companyCamUrl" defaultValue={job.companyCamUrl} /></label>
                <label className="block md:col-span-2"><span className={labelClass}>Notes</span><textarea className={inputClass} name="notes" defaultValue={job.notes} rows={3} /></label>
                <button className="min-h-11 rounded-xl bg-accent px-4 text-sm font-medium text-accent-ink" type="submit">Save job</button>
              </form>
            </details>
          ) : null}
        </Card>
        <Card title="Builder Prime">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted">Project ID</dt><dd>{job.builderPrimeProjectId || "—"}</dd>
            <dt className="text-muted">Status</dt><dd>{job.builderPrimeStatus || "—"}</dd>
            <dt className="text-muted">Source</dt><dd>{job.source}</dd>
            <dt className="text-muted">Last sync</dt><dd>{displayDateTime(job.bpSyncedAt, workspace.timezone)}</dd>
          </dl>
          <a className="mt-3 inline-block text-sm text-accent" href={`https://${workspace.bpSubdomain}.builderprime.com`} target="_blank" rel="noreferrer">Open {workspace.bpSubdomain}.builderprime.com</a>
          {job.companyCamUrl ? <a className="mt-2 block text-sm text-accent" href={job.companyCamUrl} target="_blank" rel="noreferrer">CompanyCam photos</a> : <p className="mt-2 text-sm text-muted">No CompanyCam link.</p>}
        </Card>
      </div>
      <Card className="mt-4" title="Close-out">
        {usedRows.length === 0 ? <p className="text-sm text-muted">No material has been weighed on this job yet.</p> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-muted"><tr><th className="py-2">Material</th><th>Lb</th><th>Units</th><th>Containers</th></tr></thead>
              <tbody>
                {usedRows.map((row) => (
                  <tr key={row.id} className="border-t border-line">
                    <td className="py-2">{row.name}</td>
                    <td>{lbs(row.used)}</td>
                    <td>{row.units == null ? "—" : row.units}</td>
                    <td>{row.containers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card className="mt-4" title="Pick sheet summary">
        {job.pickLines.length === 0 ? <p className="text-sm text-muted">No pick sheet yet. Edit the pick sheet to calculate pounds from the coverage rates.</p> : (
          <ul className="divide-y divide-line text-sm">
            {job.pickLines.map((line) => {
              const boxes = line.product ? aboutBoxes(line.plannedLbs, line.product.weightPerBox) : null;
              return (
                <li key={line.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>{line.componentKey.replaceAll("_", " ")} · {line.product?.name ?? "Not mapped"}</span>
                  <span>{line.plannedLbs} lb{boxes != null ? `, about ${formatBoxes(boxes)}` : ""}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {editable ? (
        <Card className="mt-4" title="Danger zone">
          <p className="text-sm text-muted">Archive hides the job from the default list. Delete hides it everywhere and keeps the job number reserved. Neither one removes inventory history.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <form action={archiveJob}>
              <input type="hidden" name="id" value={job.id} />
              <button className="min-h-11 rounded-xl border border-line px-4 text-sm" type="submit">{job.archivedAt ? "Restore" : "Archive"}</button>
            </form>
            {can(user.permissions, "admin", "edit") ? (
              <form action={deleteJob}>
                <input type="hidden" name="id" value={job.id} />
                <button className="min-h-11 rounded-xl bg-danger px-4 text-sm text-white" type="submit">Delete</button>
              </form>
            ) : null}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
