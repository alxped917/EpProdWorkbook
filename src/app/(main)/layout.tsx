import { AppShell, type NavItem } from "@/components/shell";
import { requireUser, seesAllWarehouses } from "@/lib/auth";
import { can, type SectionKey } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const NAV: { section: SectionKey; item: NavItem }[] = [
  { section: "dashboard", item: { href: "/dashboard", label: "Dashboard", icon: "dashboard" } },
  { section: "warehouses", item: { href: "/warehouses", label: "Warehouses", icon: "warehouses" } },
  {
    section: "inventory",
    item: {
      href: "/inventory/records",
      label: "Inventory",
      icon: "inventory",
      children: [
        { href: "/inventory/records", label: "Records" },
        { href: "/inventory/check", label: "Check Out / Check In" },
        { href: "/inventory/count", label: "Count Stock" },
      ],
    },
  },
  { section: "jobs", item: { href: "/jobs", label: "Jobs", icon: "jobs" } },
  { section: "calendar", item: { href: "/calendar", label: "Production Calendar", icon: "calendar" } },
  { section: "transactions", item: { href: "/transactions", label: "Transactions", icon: "transactions" } },
  { section: "reporting", item: { href: "/reporting", label: "Reporting", icon: "reporting" } },
  { section: "masterData", item: { href: "/master-data", label: "Master Data", icon: "master" } },
  { section: "events", item: { href: "/events", label: "Event activity", icon: "events" } },
  { section: "admin", item: { href: "/admin", label: "Admin Center", icon: "admin" } },
];

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const nav = NAV.filter((entry) => can(user.permissions, entry.section, "view")).map((entry) => entry.item);
  const scope = seesAllWarehouses(user) ? "All warehouses" : `${user.warehouseIds.length} warehouse${user.warehouseIds.length === 1 ? "" : "s"}`;
  return (
    <AppShell user={{ name: user.name, roleName: user.roleName, scope }} nav={nav}>
      {children}
    </AppShell>
  );
}
