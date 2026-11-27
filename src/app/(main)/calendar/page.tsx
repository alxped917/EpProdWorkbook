import Link from "next/link";
import { PageHeader, inputClass } from "@/components/ui";
import { requirePerm, warehouseWhere } from "@/lib/auth";
import { db } from "@/lib/db";
import { listJobs } from "@/lib/job-query";
import { one } from "@/lib/search";
import { addDaysISO, addMonthsISO, displayDate, monthGrid, monthRange, todayISO, weekRange } from "@/lib/dates";
import { getWorkspace } from "@/lib/workspace";

export const metadata = { title: "Production calendar" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePerm("calendar", "view");
  const sp = await searchParams;
  const workspace = await getWorkspace();
  const today = todayISO(workspace.timezone);
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(one(sp.date)) ? one(sp.date) : today;
  const view = one(sp.view) === "week" || one(sp.view) === "day" ? one(sp.view) : "month";
  const scope = warehouseWhere(user);
  const [warehouses, colors, jobs] = await Promise.all([
    db.warehouse.findMany({ where: { active: true, ...(scope ? { id: scope } : {}) }, orderBy: { name: "asc" } }),
    db.product.findMany({ where: { category: "FLAKE", status: "ACTIVE" }, orderBy: { name: "asc" } }),
    listJobs(user, {
      warehouseId: one(sp.warehouseId),
      status: one(sp.status),
      flakeColor: one(sp.flakeColor),
      archived: "1",
    }),
  ]);
  const minSq = Number(one(sp.minSqft));
  const maxSq = Number(one(sp.maxSqft));
  const filtered = jobs.filter((job) => {
    if (!job.scheduledDate || job.status === "CANCELLED") return false;
    if (Number.isFinite(minSq) && minSq > 0 && (job.squareFootage ?? 0) < minSq) return false;
    if (Number.isFinite(maxSq) && maxSq > 0 && (job.squareFootage ?? 0) > maxSq) return false;
    return true;
  });
  const days = view === "month" ? monthGrid(anchor) : view === "week" ? Array.from({ length: 7 }, (_, i) => addDaysISO(weekRange(anchor).start, i)) : [anchor];
  const month = monthRange(anchor);
  const prev = view === "month" ? addMonthsISO(anchor, -1) : addDaysISO(anchor, view === "week" ? -7 : -1);
  const next = view === "month" ? addMonthsISO(anchor, 1) : addDaysISO(anchor, view === "week" ? 7 : 1);
  const qs = (extra: Record<string, string>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...sp, ...extra })) {
      const v = Array.isArray(value) ? value[0] : value;
      if (v) params.set(key, String(v));
    }
    return `/calendar?${params.toString()}`;
  };
  return (
    <div>
      <PageHeader title="Production calendar" subtitle="Jobs sit on their scheduled install date." />
      <form className="mb-4 grid gap-2 md:grid-cols-6" action="/calendar">
        <input type="hidden" name="date" value={anchor} />
        <input type="hidden" name="view" value={view} />
        <select className={inputClass} name="warehouseId" defaultValue={one(sp.warehouseId)} aria-label="Warehouse">
          <option value="">All warehouses</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <select className={inputClass} name="status" defaultValue={one(sp.status)} aria-label="Status">
          <option value="">Any status</option>
          <option value="NEW">New</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="COMPLETED">Completed</option>
        </select>
        <select className={inputClass} name="flakeColor" defaultValue={one(sp.flakeColor)} aria-label="Flake color">
          <option value="">Any color</option>
          {colors.map((c) => <option key={c.id}>{c.name}</option>)}
        </select>
        <input className={inputClass} name="minSqft" defaultValue={one(sp.minSqft)} placeholder="Min sq ft" aria-label="Minimum square feet" />
        <input className={inputClass} name="maxSqft" defaultValue={one(sp.maxSqft)} placeholder="Max sq ft" aria-label="Maximum square feet" />
        <button className="min-h-11 rounded-xl bg-accent text-sm text-accent-ink" type="submit">Filter</button>
      </form>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Link className="rounded-xl border border-line px-3 py-2 text-sm" href={qs({ date: prev })}>Previous</Link>
        <Link className="rounded-xl border border-line px-3 py-2 text-sm" href={qs({ date: today })}>Today</Link>
        <Link className="rounded-xl border border-line px-3 py-2 text-sm" href={qs({ date: next })}>Next</Link>
        {(["month", "week", "day"] as const).map((item) => (
          <Link key={item} className={`rounded-xl px-3 py-2 text-sm ${view === item ? "bg-accent text-accent-ink" : "border border-line"}`} href={qs({ view: item })}>
            {item[0].toUpperCase() + item.slice(1)}
          </Link>
        ))}
        <p className="text-sm text-muted">{view === "month" ? month.start.slice(0, 7) : displayDate(anchor)}</p>
      </div>
      <div className={view === "month" ? "grid grid-cols-7 gap-1" : view === "week" ? "grid gap-2 md:grid-cols-7" : "space-y-2"}>
        {view === "month" ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <p key={d} className="px-1 text-xs text-muted">{d}</p>) : null}
        {days.map((day) => {
          const dayJobs = filtered.filter((job) => job.scheduledDate === day);
          const inMonth = day.slice(0, 7) === anchor.slice(0, 7);
          return (
            <div key={day} className={`min-h-24 rounded-xl border border-line p-1 ${day === today ? "ring-2 ring-accent" : ""} ${view === "month" && !inMonth ? "opacity-50" : ""}`}>
              <p className="text-xs text-muted">{day.slice(8)}</p>
              {dayJobs.map((job) => (
                <Link key={job.id} href={`/jobs/${job.id}`} className="mt-1 block truncate rounded-lg bg-sunken px-1 py-0.5 text-xs">
                  {job.jobNumber} · {job.flakeColor || "no color"} · {job.squareFootage ?? "?"}
                </Link>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
