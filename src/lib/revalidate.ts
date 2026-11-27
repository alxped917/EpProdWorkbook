import "server-only";
import { revalidatePath } from "next/cache";

export function revalidateStock(jobId?: string) {
  for (const path of ["/dashboard", "/inventory/records", "/inventory/check", "/inventory/count", "/transactions", "/reporting", "/jobs"]) {
    revalidatePath(path);
  }
  if (jobId) {
    revalidatePath(`/jobs/${jobId}`);
    revalidatePath(`/jobs/${jobId}/materials`);
    revalidatePath(`/jobs/${jobId}/cost`);
    revalidatePath(`/jobs/${jobId}/pick`);
  }
}
