import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { requirePerm } from "@/lib/auth";

export const metadata = { title: "Admin Center" };

const links = [
  ["/admin/users", "Users", "People, roles, and which warehouses they can see."],
  ["/admin/roles", "Roles", "Permission toggles for each section."],
  ["/admin/crews", "Crews", "Team lead plus installers. Jobs follow the foreman."],
  ["/admin/coverage", "Coverage rates", "Pounds per square foot, season, and location."],
  ["/admin/builder-prime", "Builder Prime", "Mock or live sync, field mapping, and logs."],
  ["/admin/purchasing", "Purchasing", "Reorder drafts and the notification outbox."],
];

export default async function AdminPage() {
  await requirePerm("admin", "view");
  return (
    <div>
      <PageHeader title="Admin Center" subtitle="Access, coverage math, and the Builder Prime connection." />
      <div className="grid gap-3 md:grid-cols-2">
        {links.map(([href, title, body]) => (
          <Link key={href} href={href} className="rounded-2xl border border-line bg-panel p-4 hover:border-accent">
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted">{body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
