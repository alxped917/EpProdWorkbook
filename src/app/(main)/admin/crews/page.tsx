import { saveCrew } from "@/actions/admin";
import { Flash, PageHeader, inputClass } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { one } from "@/lib/search";

export const metadata = { title: "Crews" };

export default async function CrewsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requirePerm("admin", "view");
  const sp = await searchParams;
  const [crews, users] = await Promise.all([
    db.crew.findMany({ include: { lead: true, members: { include: { user: true } }, jobs: { where: { deletedAt: null }, select: { jobNumber: true } } }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const editable = can(actor.permissions, "admin", "edit");
  return (
    <div>
      <PageHeader title="Crews" subtitle="A job joins the crew whose lead or member matches the Builder Prime foreman." />
      <Flash notice={one(sp.notice)} error={one(sp.error)} />
      <div className="space-y-4">
        {crews.map((crew) => (
          <form key={crew.id} action={saveCrew} className="rounded-2xl border border-line p-4">
            <input type="hidden" name="id" value={crew.id} />
            <input className={inputClass} name="name" defaultValue={crew.name} disabled={!editable} />
            <label className="mt-3 block text-sm">Team lead
              <select className={inputClass} name="leadId" defaultValue={crew.leadId ?? ""} disabled={!editable}>
                <option value="">Unassigned</option>
                {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
            </label>
            <fieldset className="mt-3">
              <legend className="text-sm">Members</legend>
              <div className="mt-2 flex flex-wrap gap-3">
                {users.map((user) => (
                  <label key={user.id} className="text-sm">
                    <input type="checkbox" name="memberId" value={user.id} defaultChecked={crew.members.some((m) => m.userId === user.id)} disabled={!editable} /> {user.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={crew.active} disabled={!editable} /> Active</label>
            <p className="mt-2 text-sm text-muted">Jobs: {crew.jobs.map((j) => j.jobNumber).join(", ") || "none yet"}</p>
            {editable ? <button className="mt-3 min-h-11 rounded-xl bg-accent px-4 text-sm text-accent-ink" type="submit">Save crew</button> : null}
          </form>
        ))}
      </div>
      {editable ? (
        <form action={saveCrew} className="mt-6 max-w-xl space-y-3">
          <h2 className="font-semibold">New crew</h2>
          <input className={inputClass} name="name" placeholder="Crew name" required />
          <select className={inputClass} name="leadId"><option value="">Lead</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
          <div className="flex flex-wrap gap-3">{users.map((u) => <label key={u.id} className="text-sm"><input type="checkbox" name="memberId" value={u.id} /> {u.name}</label>)}</div>
          <button className="min-h-11 rounded-xl bg-accent px-4 text-sm text-accent-ink" type="submit">Create crew</button>
        </form>
      ) : null}
    </div>
  );
}
