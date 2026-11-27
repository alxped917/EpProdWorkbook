import { addColorMap, addWarehouseMatch, deleteColorMap, deleteWarehouseMatch, importSampleWebhook, saveBuilderPrimeSettings, syncJobs, testConnection } from "@/actions/admin";
import { Flash, PageHeader, inputClass, labelClass } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { apiKeyConfigured, getWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { one } from "@/lib/search";
import { displayDateTime } from "@/lib/dates";

export const metadata = { title: "Builder Prime" };

export default async function BuilderPrimePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePerm("admin", "edit");
  const sp = await searchParams;
  const workspace = await getWorkspace();
  const [colors, matches, products, warehouses, logs] = await Promise.all([
    db.colorMap.findMany({ include: { product: true }, orderBy: { bpColorName: "asc" } }),
    db.warehouseMatch.findMany({ include: { warehouse: true }, orderBy: { bpLocation: "asc" } }),
    db.product.findMany({ where: { category: "FLAKE", status: "ACTIVE" }, orderBy: { name: "asc" } }),
    db.warehouse.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.syncLog.findMany({ orderBy: { startedAt: "desc" }, take: 12 }),
  ]);
  return (
    <div>
      <PageHeader title="Builder Prime" subtitle="The API key stays in the server environment. This page never shows it." />
      <Flash notice={one(sp.notice)} error={one(sp.error)} />
      <p className="mb-4 text-sm">API key configured: <strong>{apiKeyConfigured() ? "yes" : "no"}</strong>. Mode: <strong>{workspace.bpMode}</strong>. Subdomain: {workspace.bpSubdomain}.builderprime.com</p>
      <div className="mb-4 flex flex-wrap gap-2">
        <form action={syncJobs}><button className="min-h-11 rounded-xl bg-accent px-4 text-sm text-accent-ink" type="submit">Sync Jobs</button></form>
        <form action={testConnection}><button className="min-h-11 rounded-xl border border-line px-4 text-sm" type="submit">Test connection</button></form>
        <form action={importSampleWebhook}><button className="min-h-11 rounded-xl border border-line px-4 text-sm" type="submit">Import sample webhook</button></form>
      </div>
      <form action={saveBuilderPrimeSettings} className="grid max-w-3xl gap-3">
        <label className="block"><span className={labelClass}>Mode</span>
          <select className={inputClass} name="bpMode" defaultValue={workspace.bpMode}><option value="mock">Mock / sample data</option><option value="live">Live Open API</option></select>
        </label>
        <label className="block"><span className={labelClass}>Subdomain</span><input className={inputClass} name="bpSubdomain" defaultValue={workspace.bpSubdomain} /></label>
        <label className="block"><span className={labelClass}>Import statuses (comma separated)</span><input className={inputClass} name="importStatuses" defaultValue={workspace.importStatuses.join(", ")} /></label>
        <label className="block"><span className={labelClass}>Square footage field names</span><input className={inputClass} name="squareFootage" defaultValue={workspace.fieldMap.squareFootage.join(", ")} /></label>
        <label className="block"><span className={labelClass}>Flake color field names</span><input className={inputClass} name="flakeColor" defaultValue={workspace.fieldMap.flakeColor.join(", ")} /></label>
        <label className="block"><span className={labelClass}>Flake size field names</span><input className={inputClass} name="flakeSize" defaultValue={workspace.fieldMap.flakeSize.join(", ")} /></label>
        <label className="block"><span className={labelClass}>Verticals field names</span><input className={inputClass} name="verticalLf" defaultValue={workspace.fieldMap.verticalLf.join(", ")} /></label>
        <label className="block"><span className={labelClass}>Stairs field names</span><input className={inputClass} name="stairsLf" defaultValue={workspace.fieldMap.stairsLf.join(", ")} /></label>
        <label className="block"><span className={labelClass}>Job type field names</span><input className={inputClass} name="jobType" defaultValue={workspace.fieldMap.jobType.join(", ")} /></label>
        <label className="block"><span className={labelClass}>Status map (one BuilderPrime=LOCAL per line)</span>
          <textarea className={inputClass} name="statusMap" rows={8} defaultValue={Object.entries(workspace.statusMap).map(([k, v]) => `${k}=${v}`).join("\n")} />
        </label>
        <button className="min-h-11 rounded-xl bg-accent px-4 text-sm text-accent-ink" type="submit">Save settings</button>
      </form>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="font-semibold">Color mapping</h2>
          <ul className="mt-2 text-sm">{colors.map((row) => (
            <li key={row.id} className="flex items-center justify-between border-b border-line py-1">{row.bpColorName} → {row.product.name}
              <form action={deleteColorMap}><input type="hidden" name="id" value={row.id} /><button className="text-danger" type="submit">Remove</button></form>
            </li>
          ))}</ul>
          <form action={addColorMap} className="mt-2 grid gap-2">
            <input className={inputClass} name="bpColorName" placeholder="Builder Prime color" />
            <select className={inputClass} name="productId">{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <button className="min-h-11 rounded-xl border border-line text-sm" type="submit">Add color map</button>
          </form>
        </div>
        <div>
          <h2 className="font-semibold">Warehouse matching</h2>
          <p className="text-sm text-muted">A unique city also matches on its own. Add a row when Builder Prime uses a nickname.</p>
          <ul className="mt-2 text-sm">{matches.map((row) => (
            <li key={row.id} className="flex items-center justify-between border-b border-line py-1">{row.bpLocation} → {row.warehouse.name}
              <form action={deleteWarehouseMatch}><input type="hidden" name="id" value={row.id} /><button className="text-danger" type="submit">Remove</button></form>
            </li>
          ))}</ul>
          <form action={addWarehouseMatch} className="mt-2 grid gap-2">
            <input className={inputClass} name="bpLocation" placeholder="City or nickname" />
            <select className={inputClass} name="warehouseId">{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
            <button className="min-h-11 rounded-xl border border-line text-sm" type="submit">Add match</button>
          </form>
        </div>
      </div>
      <h2 className="mb-2 mt-6 font-semibold">Sync log</h2>
      <ul className="space-y-2 text-sm">
        {logs.map((log) => (
          <li key={log.id} className="rounded-xl border border-line p-3">
            <p>{displayDateTime(log.startedAt, workspace.timezone)} · {log.trigger} · {log.mode} · {log.status}</p>
            <p>{log.message}</p>
            {log.detail ? <pre className="mt-1 whitespace-pre-wrap text-xs text-muted">{log.detail}</pre> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
