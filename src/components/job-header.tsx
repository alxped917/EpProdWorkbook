import { buttonClass, Badge, statusTone } from "./ui";
import { titleCaseStatus } from "@/lib/format";

export function JobHeader({
  job,
  flags,
}: {
  job: { id: string; jobNumber: string; status: string; type: string; archivedAt: Date | null };
  flags: { label: string }[];
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <p className="text-sm text-muted">{job.type === "REPAIR" ? "Repair" : "Standard"} job</p>
        <h1 className="text-3xl font-semibold tracking-tight">{job.jobNumber}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge tone={statusTone(job.status)}>{titleCaseStatus(job.status)}</Badge>
          {job.archivedAt ? <Badge>Archived</Badge> : null}
          {flags.length ? <Badge tone="danger">Needs a look</Badge> : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <a className={buttonClass("primary")} href={`/jobs/${job.id}/materials`}>Check Out / Check In</a>
        <a className={buttonClass()} href={`/transactions?job=${job.id}`}>Transactions</a>
        <a className={buttonClass()} href={`/jobs/${job.id}/cost`}>Job cost</a>
        <a className={buttonClass()} href={`/api/jobs/${job.id}/pick-sheet`}>Pick sheet PDF</a>
        <a className={buttonClass()} href={`/jobs/${job.id}/pick`}>Edit pick sheet</a>
      </div>
    </div>
  );
}
