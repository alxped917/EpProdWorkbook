import { deleteRole, saveRole } from "@/actions/admin";
import { Flash, PageHeader } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { can, SECTIONS, normalizePermissions } from "@/lib/permissions";
import { db } from "@/lib/db";
import { one } from "@/lib/search";

export const metadata = { title: "Roles" };

export default async function RolesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requirePerm("admin", "view");
  const sp = await searchParams;
  const roles = await db.role.findMany({ include: { users: true }, orderBy: { name: "asc" } });
  const editable = can(actor.permissions, "admin", "edit");
  return (
    <div>
      <PageHeader title="Roles" subtitle="Each section can be hidden, view-only, or editable." />
      <Flash notice={one(sp.notice)} error={one(sp.error)} />
      <div className="space-y-4">
        {roles.map((role) => {
          const perms = normalizePermissions(JSON.parse(role.permissions));
          return (
            <form key={role.id} action={saveRole} className="rounded-2xl border border-line p-4">
              <input type="hidden" name="id" value={role.id} />
              <div className="flex flex-wrap items-center gap-3">
                <input className="min-h-11 rounded-xl border border-line bg-canvas px-3" name="name" defaultValue={role.name} readOnly={role.isSystem} />
                <span className="text-sm text-muted">{role.users.length} people{role.isSystem ? " · system" : ""}</span>
              </div>
              <input className="mt-2 w-full rounded-xl border border-line bg-canvas px-3 py-2 text-sm" name="description" defaultValue={role.description} disabled={!editable} />
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {SECTIONS.map(([key, label]) => (
                  <fieldset key={key} className="flex items-center justify-between gap-2 text-sm">
                    <legend className="sr-only">{label}</legend>
                    <span>{label}</span>
                    <span className="flex gap-2">
                      {(["none", "view", "edit"] as const).map((level) => (
                        <label key={level}><input type="radio" name={`perm_${key}`} value={level} defaultChecked={perms[key] === level} disabled={!editable} /> {level}</label>
                      ))}
                    </span>
                  </fieldset>
                ))}
              </div>
              {editable ? <button className="mt-3 min-h-11 rounded-xl bg-accent px-4 text-sm text-accent-ink" type="submit">Save role</button> : null}
              {editable && !role.isSystem ? (
                <button className="ml-2 text-sm text-danger" formAction={deleteRole} type="submit">Delete</button>
              ) : null}
            </form>
          );
        })}
      </div>
      {editable ? (
        <form action={saveRole} className="mt-6 rounded-2xl border border-dashed border-line p-4">
          <h2 className="font-semibold">Custom role</h2>
          <input className="mt-2 min-h-11 w-full rounded-xl border border-line bg-canvas px-3" name="name" placeholder="Role name" required />
          <input className="mt-2 w-full rounded-xl border border-line bg-canvas px-3 py-2 text-sm" name="description" placeholder="Description" />
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {SECTIONS.map(([key, label]) => (
              <label key={key} className="flex items-center justify-between text-sm">
                {label}
                <select name={`perm_${key}`} defaultValue="none" className="rounded-lg border border-line bg-canvas px-2 py-1">
                  <option value="none">none</option>
                  <option value="view">view</option>
                  <option value="edit">edit</option>
                </select>
              </label>
            ))}
          </div>
          <button className="mt-3 min-h-11 rounded-xl bg-accent px-4 text-sm text-accent-ink" type="submit">Create role</button>
        </form>
      ) : null}
    </div>
  );
}
