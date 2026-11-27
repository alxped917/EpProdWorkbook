import { describe, expect, it } from "vitest";
import { jobCostLines, varianceLabel } from "@/lib/job-cost";
import { jobQualityFlags } from "@/lib/job-flags";
import { matchCrew } from "@/lib/crew";
import { parseCsv, toCsv } from "@/lib/csv";
import { findDuplicatePairs } from "@/lib/duplicates";
import {
  defaultFieldMap,
  defaultStatusMap,
  mapBuilderPrimeProject,
  mergeSyncedJob,
  shouldImportStatus,
  toISODate,
  type BpSettings,
} from "@/lib/builder-prime-map";
import { can, systemRoles } from "@/lib/permissions";
import { weekRange } from "@/lib/dates";

const settings = (): BpSettings => ({
  fieldMap: defaultFieldMap(),
  statusMap: defaultStatusMap(),
  importStatuses: ["Sold", "Job Sold", "Contract Signed"],
  colorMap: { coyote: "Coyote", "midnight blue": "Tidal Wave" },
  warehouseByLocation: { lakeville: "wh-lakeville" },
  warehouseByCity: { phoenix: "wh-phoenix", "sioux falls": "wh-sf" },
});

describe("job cost, flags, crews, and Builder Prime mapping", () => {
  it("costs used material and labels variance against the tolerance", () => {
    expect(varianceLabel(10, 10, 5)).toBe("On target");
    expect(varianceLabel(11, 10, 5)).toBe("Over");
    expect(varianceLabel(9, 10, 5)).toBe("Under");
    expect(varianceLabel(10.4, 10, 5)).toBe("On target");
    const report = jobCostLines(
      [
        { name: "Flake", plannedLbs: 100, takenLbs: 120, returnedLbs: 10, pricePerLb: 2 },
        { name: "Base A", plannedLbs: 20, takenLbs: 20, returnedLbs: 0, pricePerLb: 4.1 },
      ],
      5,
    );
    expect(report.lines[0].usedLbs).toBe(110);
    expect(report.lines[0].cost).toBe(220);
    expect(report.lines[0].variance).toBe("Over");
    expect(report.totals.used).toBe(130);
    expect(report.totals.cost).toBe(302);
  });

  it("flags missing flake color and square footage", () => {
    const flags = jobQualityFlags({
      flakeColor: "",
      squareFootage: null,
      warehouseId: "w",
      foreman: "Casey Nguyen",
      scheduledDate: "2026-12-01",
      knownColors: ["Cabin Fever"],
    });
    expect(flags.map((f) => f.id)).toEqual(["no-color", "no-sqft"]);
    const unknown = jobQualityFlags({
      flakeColor: "Not A Color",
      squareFootage: 100,
      warehouseId: "w",
      foreman: "Casey Nguyen",
      scheduledDate: "2026-12-01",
      knownColors: ["Cabin Fever"],
    });
    expect(unknown.map((f) => f.id)).toContain("unknown-color");
  });

  it("assigns a job to the crew that contains the foreman", () => {
    const crews = [
      { id: "north", name: "North", leadName: "Casey Nguyen", memberNames: ["Morgan Hale"] },
      { id: "metro", name: "Metro", leadName: "Riley Brooks", memberNames: [] },
    ];
    expect(matchCrew("morgan hale", crews)?.id).toBe("north");
    expect(matchCrew("Riley Brooks", crews)?.id).toBe("metro");
    expect(matchCrew("Someone Else", crews)).toBeNull();
  });

  it("maps API and webhook project shapes and keeps local in-progress status", () => {
    const api = mapBuilderPrimeProject(
      {
        id: 910101,
        projectNumber: "EP-3101",
        projectStatusDescription: "Sold",
        salesPerson: { firstName: "Parker", lastName: "Olsen" },
        foreman: { firstName: "Casey", lastName: "Nguyen" },
        estimatedStartDate: 1764720000000,
        location: { addressLine1: "18 Fictional Oak St", city: "Lakeville", state: "MN", postalCode: "55044" },
        customFields: [
          { customFieldName: "Square Footage", customFieldValue: "707" },
          { customFieldName: "Flake Color", customFieldValue: "Coyote" },
          { customFieldName: "Flake Size", customFieldValue: "1/8" },
        ],
      },
      settings(),
    );
    expect("error" in api).toBe(false);
    if ("error" in api) return;
    expect(api.jobNumber).toBe("EP-3101");
    expect(api.squareFootage).toBe(707);
    expect(api.flakeColor).toBe("Coyote");
    expect(api.flakeSize).toBe("1/8");
    expect(api.foreman).toBe("Casey Nguyen");
    expect(api.warehouseId).toBe("wh-lakeville");
    expect(api.localStatus).toBe("NEW");
    expect(api.scheduledDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const webhook = mapBuilderPrimeProject(
      {
        type: "project",
        projectId: "910103",
        projectNumber: "EP-3103",
        projectStatus: "Sold",
        projectType: "Repair",
        salesPerson: "Parker Olsen",
        foreman: "Quinn Alvarez",
        worksiteAddressLine1: "9 Practice Ln",
        worksiteAddressCity: "Sioux Falls",
        worksiteAddressState: "SD",
        worksiteAddressPostalCode: "57104",
        customFields: [{ name: "Flake Color", value: "coyote" }, { name: "Square Footage", value: "180" }],
      },
      settings(),
    );
    expect("error" in webhook).toBe(false);
    if ("error" in webhook) return;
    expect(webhook.type).toBe("REPAIR");
    expect(webhook.city).toBe("Sioux Falls");
    expect(webhook.warehouseId).toBe("wh-sf");
    expect(webhook.flakeColor).toBe("Coyote");

    expect(mergeSyncedJob(null, api)).toMatchObject({ action: "create", status: "NEW" });
    expect(mergeSyncedJob({ status: "IN_PROGRESS", deletedAt: null, archivedAt: null }, api)).toMatchObject({
      action: "update",
      status: "IN_PROGRESS",
    });
    expect(
      mergeSyncedJob(
        { status: "IN_PROGRESS", deletedAt: null, archivedAt: null },
        { ...api, localStatus: "CANCELLED" },
      ).status,
    ).toBe("CANCELLED");
    expect(mergeSyncedJob({ status: "NEW", deletedAt: "2026-01-01", archivedAt: null }, api).action).toBe("skip");
    expect(shouldImportStatus("Job Sold", settings().importStatuses)).toBe(true);
    expect(shouldImportStatus("Lead", settings().importStatuses)).toBe(false);
    expect(toISODate("2026-12-03T15:00:00.000Z")).toBe("2026-12-03");
  });

  it("parses and exports CSV without formula injection", () => {
    const rows = parseCsv('name,price\n"Basecoat A","4.10"\nFlake,"2.00"\n');
    expect(rows[1][0]).toBe("Basecoat A");
    const csv = toCsv([
      ["name", "note"],
      ["=HYPERLINK()", "ok"],
    ]);
    expect(csv).toContain("'=HYPERLINK()");
  });

  it("spots duplicate product names", () => {
    const pairs = findDuplicatePairs([
      { id: "a", name: "Basecoat A" },
      { id: "b", name: "basecoat a" },
      { id: "c", name: "Basecoat B" },
    ]);
    expect(pairs).toEqual([{ a: "a", b: "b", reason: "Same name" }]);
  });

  it("gives installers inventory edit and keeps admin above a custom auditor", () => {
    const roles = Object.fromEntries(systemRoles().map((role) => [role.name, role.permissions]));
    expect(can(roles.Installer, "inventory", "edit")).toBe(true);
    expect(can(roles.Installer, "admin", "view")).toBe(false);
    expect(can(roles.Office, "jobs", "edit")).toBe(true);
    expect(can(roles.Office, "inventory", "edit")).toBe(false);
    expect(can(roles.Auditor, "reporting", "view")).toBe(true);
    expect(can(roles.Admin, "admin", "edit")).toBe(true);
    expect(weekRange("2026-11-27")).toEqual({ start: "2026-11-23", end: "2026-11-29" });
  });
});
