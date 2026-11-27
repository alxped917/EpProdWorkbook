import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { homePath } from "@/lib/permissions";

export default async function HomePage() {
  const user = await getCurrentUser();
  redirect(user ? homePath(user.permissions) : "/login");
}
