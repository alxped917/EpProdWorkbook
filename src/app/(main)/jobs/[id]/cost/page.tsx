import { JobHeader } from "@/components/job-header";
import { Badge, Card } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { loadJob } from "@/lib/load-job";
import { getWorkspace } from "@/lib/workspace";
import { jobCostLines } from "@/lib/job-cost";
import { displayDate, displayDateTime } from "@/lib/dates";
import { lbs, money, pct } from "@/lib/format";

export const metadata = { title: "Job cost" };

const tone = { Over: "danger", Under: "accent", "On target": "ok", "No plan": "neutral" } as const;

export default async function CostPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePerm("jobs", "view");
  const { id } = await params;
  const { job, flags } = await loadJob(id, user);
  const workspace = await getWorkspace();
  const planned = new Map(job.pickLines.filter((line) => line.productId).map((line) => [line.productId as string, line.plannedLbs]));
  const names = new Map<string, { name: string; price: number; planned: number; taken: number; returned: number }>();
  for (const line of job.pickLines) {
    if (!line.productId || !line.product) continue;
    names.set(line.productId, { name: line.product.name, price: line.product.pricePerLb, planned: line.plannedLbs, taken: 0, returned: 0 });
  }
  for (const line of job.materials) {
    const current = names.get(line.productId) ?? {
      name: line.product.name,
      price: line.product.pricePerLb,
      planned: planned.get(line.productId) ?? 0,
      taken: 0,
      returned: 0,
    };
    current.taken = line.lbsCheckedOut;
    current.returned = line.lbsCheckedIn;
    names.set(line.productId, current);
  }
  const report = jobCostLines(
    [...names.values()].map((row) => ({
      name: row.name,
      plannedLbs: row.planned,
      takenLbs: row.taken,
      returnedLbs: row.returned,
      pricePerLb: row.price,
    })),
    workspace.varianceTolerancePct,
  );
  const timeline = [
    ["Added", displayDateTime(job.createdAt, workspace.timezone)],
    ["Scheduled", displayDate(job.scheduledDate)],
    ["First check-out", displayDateTime(job.firstCheckoutAt, workspace.timezone)],
    ["Finished", job.installedDate ? displayDate(job.installedDate) : job.status === "COMPLETED" ? "Completed" : "—"],
  ];
  return (
    <div>
      <JobHeader job={job} flags={flags} />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Planned", lbs(report.totals.planned)],
          ["Taken", lbs(report.totals.taken)],
          ["Returned", lbs(report.totals.returned)],
          ["Used", lbs(report.totals.used)],
          ["Cost of used", money(report.totals.cost)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-line bg-panel p-4">
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-1 text-xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <p className="mb-4 text-sm">
        Variance {pct(report.totals.variancePct)} <Badge tone={tone[report.totals.variance]}>{report.totals.variance}</Badge>
        <span className="text-muted"> · tolerance {workspace.varianceTolerancePct}%</span>
      </p>
      <Card title="By material">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-muted">
              <tr>{["Material", "Planned", "Taken", "Returned", "Used", "Price/lb", "Cost", "Variance"].map((h) => <th key={h} className="py-2 pr-3">{h}</th>)}</tr>
            </thead>
            <tbody>
              {report.lines.map((line) => (
                <tr key={line.name} className="border-t border-line">
                  <td className="py-2 pr-3">{line.name}</td>
                  <td className="pr-3">{lbs(line.plannedLbs)}</td>
                  <td className="pr-3">{lbs(line.takenLbs)}</td>
                  <td className="pr-3">{lbs(line.returnedLbs)}</td>
                  <td className="pr-3">{lbs(line.usedLbs)}</td>
                  <td className="pr-3">{money(line.pricePerLb)}</td>
                  <td className="pr-3">{money(line.cost)}</td>
                  <td><Badge tone={tone[line.variance]}>{line.variance} {pct(line.variancePct)}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card className="mt-4" title="Timeline">
        <ol className="space-y-2 text-sm">
          {timeline.map(([label, value]) => (
            <li key={label} className="flex justify-between gap-3 border-b border-line py-2"><span>{label}</span><span>{value}</span></li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
