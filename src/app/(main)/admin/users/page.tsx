import { saveUser } from "@/actions/admin";
import { Flash, PageHeader, inputClass, labelClass } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { one } from "@/lib/search";

export const metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requirePerm("admin", "view");
  const sp = await searchParams;
  const [users, roles, warehouses] = await Promise.all([
    db.user.findMany({ include: { role: true, warehouses: true }, orderBy: { name: "asc" } }),
    db.role.findMany({ orderBy: { name: "asc" } }),
    db.warehouse.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const editable = can(actor.permissions, "admin", "edit");
  return (
    <div>
      <PageHeader title="Users" subtitle="Installers only see the warehouses you assign, unless All warehouses is on." />
      <Flash notice={one(sp.notice)} error={one(sp.error)} />
      <div className="space-y-3">
        {users.map((user) => (
          <details key={user.id} className="rounded-2xl border border-line p-3">
            <summary className="cursor-pointer">{user.name} · {user.role.name} · {user.email}{user.active ? "" : " · inactive"}</summary>
            {editable ? (
              <form action={saveUser} className="mt-3 grid gap-3 md:grid-cols-2">
                <input type="hidden" name="id" value={user.id} />
                <label className="block"><span className={labelClass}>Name</span><input className={inputClass} name="name" defaultValue={user.name} /></label>
                <label className="block"><span className={labelClass}>Email</span><input className={inputClass} name="email" defaultValue={user.email} /></label>
                <label className="block"><span className={labelClass}>Role</span>
                  <select className={inputClass} name="roleId" defaultValue={user.roleId}>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select>
                </label>
                <label className="block"><span className={labelClass}>New password</span><input className={inputClass} name="password" type="password" placeholder="Leave blank to keep" /></label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="allWarehouses" defaultChecked={user.allWarehouses} /> All warehouses</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={user.active} /> Active</label>
                <fieldset className="md:col-span-2">
                  <legend className={labelClass}>Warehouses</legend>
                  <div className="flex flex-wrap gap-3">
                    {warehouses.map((w) => (
                      <label key={w.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="warehouseId" value={w.id} defaultChecked={user.warehouses.some((row) => row.warehouseId === w.id)} /> {w.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <button className="min-h-11 rounded-xl bg-accent px-4 text-sm text-accent-ink" type="submit">Save user</button>
              </form>
            ) : null}
          </details>
        ))}
      </div>
      {editable ? (
        <form action={saveUser} className="mt-6 grid max-w-xl gap-3">
          <h2 className="font-semibold">Add user</h2>
          <input className={inputClass} name="name" placeholder="Name" required />
          <input className={inputClass} name="email" type="email" placeholder="Email" required />
          <select className={inputClass} name="roleId">{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select>
          <input className={inputClass} name="password" type="password" placeholder="Password (blank uses the demo password)" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="allWarehouses" /> All warehouses</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked /> Active</label>
          <div className="flex flex-wrap gap-3">
            {warehouses.map((w) => <label key={w.id} className="text-sm"><input type="checkbox" name="warehouseId" value={w.id} /> {w.name}</label>)}
          </div>
          <button className="min-h-11 rounded-xl bg-accent px-4 text-sm text-accent-ink" type="submit">Create user</button>
        </form>
      ) : null}
    </div>
  );
}
