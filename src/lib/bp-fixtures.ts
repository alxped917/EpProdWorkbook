import type { LooseProject } from "./builder-prime-map";

/** Fake Builder Prime projects. Ids are in the 910000 range so they cannot be confused with a live account. */
export const sampleProjects: LooseProject[] = [
  {
    id: 910101,
    projectNumber: "EP-3101",
    projectName: "Hollis garage — sample",
    projectStatusDescription: "Sold",
    projectTypeDescription: "Garage Floor",
    estimatedValue: 6400,
    estimatedStartDate: "2026-12-03",
    salesPerson: { firstName: "Parker", lastName: "Olsen" },
    foreman: { firstName: "Casey", lastName: "Nguyen" },
    location: { addressLine1: "18 Fictional Oak St", city: "Lakeville", state: "MN", postalCode: "55044" },
    customFields: [
      { customFieldName: "Square Footage", customFieldValue: "707" },
      { customFieldName: "Flake Color", customFieldValue: "Cabin Fever" },
      { customFieldName: "Flake Size", customFieldValue: "1/4" },
    ],
  },
  {
    id: 910102,
    projectNumber: "EP-3102",
    projectName: "Nguyen shop — sample",
    projectStatusDescription: "Job Sold",
    projectTypeDescription: "Garage Floor",
    estimatedStartDate: "2026-12-08",
    salesPerson: "Parker Olsen",
    foreman: "Riley Brooks",
    worksiteAddressLine1: "440 Sample Ridge Rd",
    worksiteAddressCity: "Phoenix",
    worksiteAddressState: "AZ",
    worksiteAddressPostalCode: "85009",
    customFields: [
      { customFieldName: "Square Footage", customFieldValue: "1250" },
      { customFieldName: "Flake Color", customFieldValue: "Tidal Wave" },
      { customFieldName: "Flake Size", customFieldValue: "1/4" },
      { customFieldName: "Verticals", customFieldValue: "24" },
    ],
  },
  {
    id: 910103,
    projectNumber: "EP-3103",
    projectName: "Keller repair — sample",
    projectStatusDescription: "Sold",
    projectTypeDescription: "Repair",
    estimatedStartDate: "2026-12-05",
    salesPerson: { firstName: "Parker", lastName: "Olsen" },
    foreman: { firstName: "Quinn", lastName: "Alvarez" },
    location: { addressLine1: "9 Practice Ln", city: "Sioux Falls", state: "SD", postalCode: "57104" },
    customFields: [
      { customFieldName: "Square Footage", customFieldValue: "180" },
      { customFieldName: "Flake Color", customFieldValue: "coyote" },
      { customFieldName: "Flake Size", customFieldValue: "1/8" },
    ],
  },
  {
    id: 910104,
    projectNumber: "EP-3104",
    projectName: "Berg basement — sample",
    projectStatusDescription: "Contract Signed",
    estimatedStartDate: "2026-12-12",
    salesPerson: { firstName: "Avery", lastName: "Quinn" },
    foreman: { firstName: "Casey", lastName: "Nguyen" },
    location: { addressLine1: "77 Mock Cedar Ave", city: "Cokato", state: "MN", postalCode: "55321" },
    customFields: [
      { customFieldName: "Square Footage", customFieldValue: "860" },
      { customFieldName: "Flake Color", customFieldValue: "Gravel" },
      { customFieldName: "Flake Size", customFieldValue: "1/16" },
      { customFieldName: "Stairs", customFieldValue: "12" },
    ],
  },
  {
    id: 910105,
    projectNumber: "EP-3105",
    projectName: "Iverson porch — sample",
    projectStatusDescription: "Sold",
    estimatedStartDate: "2026-12-15",
    foreman: "Riley Brooks",
    salesPerson: "Parker Olsen",
    location: { addressLine1: "300 Fictional Pl", city: "Zimmerman", state: "MN", postalCode: "55398" },
    customFields: [
      { customFieldName: "Flake Color", customFieldValue: "Midnight Blue" },
      { customFieldName: "Flake Size", customFieldValue: "1/4" },
    ],
  },
  {
    id: 910106,
    projectNumber: "EP-3106",
    projectName: "Already scheduled — sample update",
    projectStatusDescription: "Sold",
    estimatedStartDate: "2026-12-02",
    salesPerson: "Parker Olsen",
    foreman: "Casey Nguyen",
    location: { addressLine1: "12 Demo Yard Rd", city: "Clarkfield", state: "MN", postalCode: "56223" },
    customFields: [
      { customFieldName: "Square Footage", customFieldValue: "540" },
      { customFieldName: "Flake Color", customFieldValue: "Overcast" },
      { customFieldName: "Flake Size", customFieldValue: "1/4" },
    ],
  },
];

export const webhookSample: LooseProject = {
  type: "project",
  projectId: "910199",
  projectNumber: "EP-3199",
  projectName: "Webhook sample — Ellis garage",
  projectStatus: "Sold",
  projectType: "Garage Floor",
  salesPerson: "Parker Olsen",
  foreman: "Jordan Ellis",
  estimatedStartDate: "2026-12-18",
  worksiteAddressLine1: "5 Fictional Pine Ct",
  worksiteAddressCity: "Sioux Falls",
  worksiteAddressState: "SD",
  worksiteAddressPostalCode: "57104",
  customFields: [
    { customFieldName: "Square Footage", customFieldValue: "640" },
    { customFieldName: "Flake Color", customFieldValue: "Creekbed" },
    { customFieldName: "Flake Size", customFieldValue: "1/4" },
  ],
};

export function projectsForStatuses(statuses: string[]): LooseProject[] {
  if (statuses.length === 0) return sampleProjects;
  const wanted = new Set(statuses.map((s) => s.trim().toLowerCase()));
  return sampleProjects.filter((project) =>
    wanted.has(String(project.projectStatusDescription ?? "").trim().toLowerCase()),
  );
}
