import Link from "next/link";
import { Badge, ButtonLink, Empty, Flash, PageHeader, inputClass, statusTone } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { listJobs } from "@/lib/job-query";
import { one } from "@/lib/search";
import { displayDate } from "@/lib/dates";
import { titleCaseStatus } from "@/lib/format";

export const metadata = { title: "Jobs" };

export default async function JobsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePerm("jobs", "view");
  const sp = await searchParams;
  const query = {
    q: one(sp.q),
    status: one(sp.status),
    type: one(sp.type),
    warehouseId: one(sp.warehouseId),
    flakeColor: one(sp.flakeColor),
    needs: one(sp.needs),
    archived: one(sp.archived),
  };
  const [jobs, warehouses, colors] = await Promise.all([
    listJobs(user, query),
    db.warehouse.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.product.findMany({ where: { category: "FLAKE", status: "ACTIVE" }, orderBy: { name: "asc" } }),
  ]);
  const exportQuery = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value) exportQuery.set(key, value);
  return (
    <div>
      <PageHeader
        title="Jobs"
        subtitle="Projects from the shop and from Builder Prime."
        actions={
          <>
            {can(user.permissions, "jobs", "edit") ? <ButtonLink href="/jobs/new" variant="primary">New job</ButtonLink> : null}
            <a className="inline-flex min-h-11 items-center rounded-xl border border-line px-3 text-sm" href={`/api/exports/jobs?${exportQuery.toString()}`}>Export CSV</a>
          </>
        }
      />
      <Flash notice={one(sp.notice)} error={one(sp.error)} />
      <form className="mb-4 grid gap-2 md:grid-cols-6" action="/jobs">
        <input className={inputClass} name="q" defaultValue={query.q} placeholder="Search" aria-label="Search jobs" />
        <select className={inputClass} name="status" defaultValue={query.status} aria-label="Status">
          <option value="">Any status</option>
          <option value="NEW">New</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select className={inputClass} name="type" defaultValue={query.type} aria-label="Type">
          <option value="">Any type</option>
          <option value="STANDARD">Standard</option>
          <option value="REPAIR">Repair</option>
        </select>
        <select className={inputClass} name="warehouseId" defaultValue={query.warehouseId} aria-label="Warehouse">
          <option value="">Any warehouse</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <select className={inputClass} name="flakeColor" defaultValue={query.flakeColor} aria-label="Flake color">
          <option value="">Any color</option>
          {colors.map((c) => <option key={c.id}>{c.name}</option>)}
        </select>
        <button className="min-h-11 rounded-xl bg-accent px-3 text-sm font-medium text-accent-ink" type="submit">Filter</button>
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input type="checkbox" name="needs" value="1" defaultChecked={query.needs === "1"} /> Needs a look
        </label>
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input type="checkbox" name="archived" value="1" defaultChecked={query.archived === "1"} /> Show archived
        </label>
      </form>
      {jobs.length === 0 ? <Empty>No jobs match these filters.</Empty> : (
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="min-w-full text-sm">
            <thead className="bg-sunken text-left text-muted">
              <tr>
                {["Job", "Status", "Where", "Foreman", "When", "Floor", "Color", "Flags"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-t border-line">
                  <td className="px-3 py-3">
                    <Link className="font-medium text-accent" href={`/jobs/${job.id}`}>{job.jobNumber}</Link>
                    <p className="text-xs text-muted">{job.type === "REPAIR" ? "Repair" : "Standard"}{job.crew ? ` · ${job.crew.name}` : ""}</p>
                  </td>
                  <td className="px-3 py-3"><Badge tone={statusTone(job.status)}>{titleCaseStatus(job.status)}</Badge></td>
                  <td className="px-3 py-3">{job.warehouse?.name ?? "—"}<span className="block text-xs text-muted">{[job.city, job.state].filter(Boolean).join(", ")}</span></td>
                  <td className="px-3 py-3">{job.foreman || "—"}</td>
                  <td className="px-3 py-3">{displayDate(job.scheduledDate)}</td>
                  <td className="px-3 py-3">{job.squareFootage ? `${job.squareFootage.toLocaleString()} sq ft` : "—"}</td>
                  <td className="px-3 py-3">{job.flakeColor || "—"}<span className="block text-xs text-muted">{job.flakeSize}</span></td>
                  <td className="px-3 py-3 text-danger">{job.flags.length ? job.flags.map((f) => f.label).join(", ") : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>
  );
}
