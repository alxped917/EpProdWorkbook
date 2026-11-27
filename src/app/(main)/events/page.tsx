import { PageHeader, inputClass } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";
import { one } from "@/lib/search";
import { displayDateTime } from "@/lib/dates";

export const metadata = { title: "Event activity" };

export default async function EventsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePerm("events", "view");
  void user;
  const sp = await searchParams;
  const workspace = await getWorkspace();
  const q = one(sp.q).toLowerCase();
  const entity = one(sp.entity);
  const events = await db.auditEvent.findMany({
    where: entity ? { entityType: entity } : {},
    orderBy: { occurredAt: "desc" },
    take: 200,
  });
  const visible = q ? events.filter((event) => `${event.summary} ${event.userName} ${event.action}`.toLowerCase().includes(q)) : events;
  return (
    <div>
      <PageHeader title="Event activity" subtitle="Who changed jobs, stock, products, roles, and syncs." />
      <form className="mb-4 flex gap-2" action="/events">
        <input className={inputClass} name="q" defaultValue={one(sp.q)} placeholder="Search the log" aria-label="Search events" />
        <select className={inputClass} name="entity" defaultValue={entity} aria-label="Entity">
          <option value="">All types</option>
          {["job", "stock", "product", "user", "role", "warehouse", "sync", "container"].map((item) => <option key={item}>{item}</option>)}
        </select>
        <button className="min-h-11 rounded-xl border border-line px-4 text-sm" type="submit">Filter</button>
      </form>
      <ul className="divide-y divide-line rounded-2xl border border-line">
        {visible.map((event) => (
          <li key={event.id} className="px-4 py-3 text-sm">
            <p className="font-medium">{event.summary}</p>
            <p className="text-muted">{displayDateTime(event.occurredAt, workspace.timezone)} · {event.userName || "System"} · {event.action}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
