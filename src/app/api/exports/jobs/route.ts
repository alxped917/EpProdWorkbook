import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listJobs } from "@/lib/job-query";
import { toCsv } from "@/lib/csv";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "jobs", "view")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const jobs = await listJobs(user, {
    q: url.searchParams.get("q") ?? "",
    status: url.searchParams.get("status") ?? "",
    type: url.searchParams.get("type") ?? "",
    warehouseId: url.searchParams.get("warehouseId") ?? "",
    flakeColor: url.searchParams.get("flakeColor") ?? "",
    needs: url.searchParams.get("needs") ?? "",
    archived: url.searchParams.get("archived") ?? "",
  });
  const csv = toCsv([
    ["jobNumber", "builderPrimeProjectId", "type", "status", "builderPrimeStatus", "address", "city", "state", "salesperson", "foreman", "warehouse", "crew", "scheduledDate", "installedDate", "squareFootage", "flakeColor", "flakeSize", "needsLook"],
    ...jobs.map((job) => [
      job.jobNumber,
      job.builderPrimeProjectId,
      job.type,
      job.status,
      job.builderPrimeStatus,
      job.address1,
      job.city,
      job.state,
      job.salesperson,
      job.foreman,
      job.warehouse?.name,
      job.crew?.name,
      job.scheduledDate,
      job.installedDate,
      job.squareFootage,
      job.flakeColor,
      job.flakeSize,
      job.flags.map((f) => f.label).join("; "),
    ]),
  ]);
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=\"jobs.csv\"" },
  });
}
