import { addJobMaterial } from "@/actions/inventory";
import { JobHeader } from "@/components/job-header";
import { MaterialsEditor } from "@/components/materials-editor";
import { requirePerm } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { loadJob } from "@/lib/load-job";
import { aboutBoxes, formatBoxes } from "@/lib/coverage";

export const metadata = { title: "Check out / check in" };

export default async function MaterialsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePerm("jobs", "view");
  const { id } = await params;
  const { job, flags } = await loadJob(id, user);
  const balances = job.warehouseId
    ? await db.stockBalance.findMany({ where: { warehouseId: job.warehouseId } })
    : [];
  const onHand = new Map(balances.map((b) => [b.productId, b.onHandLbs]));
  const planned = new Map(job.pickLines.map((line) => [line.productId, line]));
  const weighOnly = new Set(job.pickLines.filter((line) => line.plannedLbs === 0 && (line.componentKey === "MENDER_A" || line.componentKey === "MENDER_B")).map((line) => line.productId));
  const rows = job.materials.map((line) => {
    const plan = planned.get(line.productId);
    const boxes = plan && line.product.weightPerBox ? formatBoxes(aboutBoxes(plan.plannedLbs, line.product.weightPerBox)) : null;
    return {
      productId: line.productId,
      name: line.product.name,
      category: line.product.category,
      plannedLbs: plan ? plan.plannedLbs : null,
      boxes,
      lbsCheckedOut: line.lbsCheckedOut,
      lbsCheckedIn: line.lbsCheckedIn,
      onHand: onHand.get(line.productId) ?? 0,
      weighOnly: weighOnly.has(line.productId),
    };
  });
  const locked = !can(user.permissions, "inventory", "edit") || Boolean(job.archivedAt) || job.status === "CANCELLED";
  const products = await db.product.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } });
  const already = new Set(job.materials.map((m) => m.productId));
  return (
    <div>
      <JobHeader job={job} flags={flags} />
      {!job.warehouseId ? <p className="mb-4 text-sm text-danger">Assign a warehouse on the job before weighing. Stock will not move until then.</p> : null}
      {rows.length === 0 ? <p className="mb-4 text-sm text-muted">No materials yet. Save a pick sheet or add a product below.</p> : null}
      <MaterialsEditor jobId={job.id} rows={rows} locked={locked} />
      {can(user.permissions, "inventory", "edit") && !locked ? (
        <form action={addJobMaterial} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input type="hidden" name="jobId" value={job.id} />
          <select className="min-h-11 flex-1 rounded-xl border border-line bg-canvas px-3" name="productId" aria-label="Add a material">
            {products.filter((p) => !already.has(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="min-h-11 rounded-xl border border-line px-4 text-sm" type="submit">Add material</button>
        </form>
      ) : null}
    </div>
  );
}
