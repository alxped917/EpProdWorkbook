import Link from "next/link";
import { PageHeader, inputClass } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { listJobs } from "@/lib/job-query";
import { one } from "@/lib/search";

export const metadata = { title: "Check out / check in" };

export default async function CheckPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePerm("inventory", "view");
  const sp = await searchParams;
  const q = one(sp.q);
  const jobs = await listJobs(user, { q });
  const open = jobs.filter((job) => job.status !== "CANCELLED" && job.status !== "COMPLETED").slice(0, 30);
  return (
    <div>
      <PageHeader title="Check Out / Check In" subtitle="Pick the job, then weigh each material. Amounts save as you type." />
      <form className="mb-4 flex gap-2" action="/inventory/check">
        <input className={inputClass} name="q" defaultValue={q} placeholder="Job number, city, foreman" aria-label="Find a job" />
        <button className="min-h-11 rounded-xl bg-accent px-4 text-sm text-accent-ink" type="submit">Find</button>
      </form>
      <ul className="space-y-2">
        {open.map((job) => (
          <li key={job.id}>
            <Link className="flex items-center justify-between rounded-2xl border border-line bg-panel px-4 py-3" href={`/jobs/${job.id}/materials`}>
              <span>
                <span className="font-medium">{job.jobNumber}</span>
                <span className="mt-0.5 block text-sm text-muted">{job.warehouse?.name ?? "No warehouse"} · {job.city} · {job.flakeColor || "No color"}</span>
              </span>
              <span className="text-sm text-accent">Weigh</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
