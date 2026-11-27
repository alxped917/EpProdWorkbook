import { JobHeader } from "@/components/job-header";
import { Flash } from "@/components/ui";
import { PickSheetForm } from "@/components/pick-sheet-form";
import { requirePerm } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { loadJob } from "@/lib/load-job";
import { getWorkspace } from "@/lib/workspace";
import { one } from "@/lib/search";

export const metadata = { title: "Pick sheet" };

export default async function PickPage({
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
  const products = await db.product.findMany({ orderBy: { name: "asc" } });
  const balances = job.warehouseId ? await db.stockBalance.findMany({ where: { warehouseId: job.warehouseId } }) : [];
  const onHand = Object.fromEntries(balances.map((b) => [b.productId, b.onHandLbs]));
  return (
    <div>
      <JobHeader job={job} flags={flags} />
      <Flash error={one(sp.error)} notice={one(sp.notice)} />
      {can(user.permissions, "jobs", "edit") ? (
        <PickSheetForm
          job={job}
          coverage={workspace.coverage}
          products={products.map((p) => ({ id: p.id, name: p.name, category: p.category, componentKey: p.componentKey, weightPerBox: p.weightPerBox }))}
          componentMap={workspace.componentMap}
          onHand={onHand}
          warehouseName={job.warehouse?.name ?? null}
        />
      ) : (
        <p className="text-sm text-muted">Your role can view this job but cannot edit the pick sheet.</p>
      )}
    </div>
  );
}
