import Link from "next/link";
import { PageHeader, Card, Badge, statusTone } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { listJobs } from "@/lib/job-query";
import { getWorkspace } from "@/lib/workspace";
import { displayDate, inRange, monthRange, todayISO, weekRange } from "@/lib/dates";
import { titleCaseStatus } from "@/lib/format";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requirePerm("dashboard", "view");
  const workspace = await getWorkspace();
  const today = todayISO(workspace.timezone);
  const week = weekRange(today);
  const month = monthRange(today);
  const jobs = await listJobs(user, {});
  const open = jobs.filter((job) => job.status !== "COMPLETED" && job.status !== "CANCELLED");
  const installingToday = jobs.filter((job) => job.scheduledDate === today && job.status !== "CANCELLED" && job.status !== "COMPLETED");
  const thisWeek = jobs.filter((job) => inRange(job.scheduledDate, week.start, week.end) && job.status !== "CANCELLED");
  const thisMonth = jobs.filter((job) => inRange(job.scheduledDate, month.start, month.end) && job.status !== "CANCELLED");
  const inProgress = jobs.filter((job) => job.status === "IN_PROGRESS");
  const needs = jobs.filter((job) => job.flags.length && job.status !== "COMPLETED" && job.status !== "CANCELLED");
  const scheduled = jobs.filter((job) => job.scheduledDate && job.scheduledDate >= today && job.status === "NEW");
  const cards = [
    ["Open jobs", open.length, "/jobs"],
    ["Scheduled", scheduled.length, "/jobs?status=NEW"],
    ["Installing today", installingToday.length, "/calendar?view=day"],
    ["This week", thisWeek.length, "/calendar?view=week"],
    ["This month", thisMonth.length, "/calendar"],
    ["In progress", inProgress.length, "/jobs?status=IN_PROGRESS"],
    ["Needs a look", needs.length, "/jobs?needs=1"],
  ];
  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`${workspace.companyName} · ${displayDate(today)}`} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, count, href]) => (
          <Link key={String(label)} href={String(href)} className="rounded-2xl border border-line bg-panel p-4 hover:border-accent">
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-2 text-3xl font-semibold">{count}</p>
          </Link>
        ))}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card title="Installing today">
          {installingToday.length === 0 ? <p className="text-sm text-muted">Nothing on the calendar for today.</p> : (
            <ul className="space-y-2">
              {installingToday.map((job) => (
                <li key={job.id}>
                  <Link className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 hover:bg-sunken" href={`/jobs/${job.id}`}>
                    <span>
                      <span className="font-medium">{job.jobNumber}</span>
                      <span className="mt-0.5 block text-sm text-muted">{job.city || "No city"} · {job.foreman || "No foreman"} · {job.flakeColor || "No color"}</span>
                    </span>
                    <Badge tone={statusTone(job.status)}>{titleCaseStatus(job.status)}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Needs a look">
          {needs.length === 0 ? <p className="text-sm text-muted">Every open job has a color, square footage, warehouse, foreman, and date.</p> : (
            <ul className="space-y-2">
              {needs.slice(0, 8).map((job) => (
                <li key={job.id}>
                  <Link className="block rounded-xl px-2 py-2 hover:bg-sunken" href={`/jobs/${job.id}`}>
                    <span className="font-medium">{job.jobNumber}</span>
                    <span className="mt-0.5 block text-sm text-danger">{job.flags.map((flag) => flag.label).join(" · ")}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
