export const SECTIONS = [
  ["dashboard", "Dashboard"],
  ["warehouses", "Warehouses"],
  ["inventory", "Inventory"],
  ["jobs", "Jobs"],
  ["calendar", "Production Calendar"],
  ["transactions", "Transactions"],
  ["reporting", "Reporting"],
  ["masterData", "Master Data"],
  ["events", "Event activity"],
  ["admin", "Admin Center"],
] as const;

export type SectionKey = (typeof SECTIONS)[number][0];
export type PermLevel = "none" | "view" | "edit";
export type PermissionMap = Record<SectionKey, PermLevel>;

const RANK: Record<PermLevel, number> = { none: 0, view: 1, edit: 2 };

export function emptyPermissions(): PermissionMap {
  return {
    dashboard: "none",
    warehouses: "none",
    inventory: "none",
    jobs: "none",
    calendar: "none",
    transactions: "none",
    reporting: "none",
    masterData: "none",
    events: "none",
    admin: "none",
  };
}

export function normalizePermissions(value: unknown): PermissionMap {
  const base = emptyPermissions();
  if (!value || typeof value !== "object") return base;
  const record = value as Record<string, unknown>;
  for (const [key] of SECTIONS) {
    const level = record[key];
    if (level === "none" || level === "view" || level === "edit") base[key] = level;
  }
  return base;
}

export function can(map: PermissionMap, section: SectionKey, level: PermLevel): boolean {
  return RANK[map[section] ?? "none"] >= RANK[level];
}

export const SECTION_PATHS: Record<SectionKey, string> = {
  dashboard: "/dashboard",
  warehouses: "/warehouses",
  inventory: "/inventory/records",
  jobs: "/jobs",
  calendar: "/calendar",
  transactions: "/transactions",
  reporting: "/reporting",
  masterData: "/master-data",
  events: "/events",
  admin: "/admin",
};

const HOME_ORDER: SectionKey[] = [
  "dashboard",
  "jobs",
  "inventory",
  "calendar",
  "warehouses",
  "transactions",
  "reporting",
  "masterData",
  "events",
  "admin",
];

export function homePath(map: PermissionMap): string {
  const section = HOME_ORDER.find((key) => can(map, key, "view"));
  return section ? SECTION_PATHS[section] : "/forbidden";
}

function all(level: PermLevel): PermissionMap {
  const map = emptyPermissions();
  for (const [key] of SECTIONS) map[key] = level;
  return map;
}

export function systemRoles(): { name: string; description: string; permissions: PermissionMap }[] {
  const installer = emptyPermissions();
  installer.dashboard = "view";
  installer.jobs = "view";
  installer.inventory = "edit";
  installer.calendar = "view";

  const lead = { ...installer };
  lead.jobs = "edit";
  lead.reporting = "view";
  lead.transactions = "view";
  lead.events = "view";

  const warehouse = emptyPermissions();
  warehouse.dashboard = "view";
  warehouse.warehouses = "view";
  warehouse.inventory = "edit";
  warehouse.jobs = "view";
  warehouse.masterData = "view";
  warehouse.transactions = "view";
  warehouse.reporting = "view";
  warehouse.calendar = "view";

  const office = all("edit");
  office.admin = "none";
  office.inventory = "view";

  const admin = all("edit");

  const auditor = all("view");
  auditor.admin = "none";
  auditor.inventory = "view";

  return [
    { name: "Installer", description: "Weigh materials in and out on assigned warehouses.", permissions: installer },
    { name: "Team Lead", description: "Installer access plus job edits and crew reporting.", permissions: lead },
    { name: "Warehouse", description: "Stock, counts, labels, and receiving.", permissions: warehouse },
    { name: "Office", description: "Jobs, master data, and reporting. Inventory is view-only.", permissions: office },
    { name: "Admin", description: "Full access, including roles and Builder Prime settings.", permissions: admin },
    { name: "Auditor", description: "Custom sample role with view access and no admin.", permissions: auditor },
  ];
}
