import type { CompanyMembership } from "../lib/context/types";
// Fictional Ghana-based organizations and demo vehicle identifiers, not real customer or registration data.
export const companies: CompanyMembership[] = [
  {
    id: "akwaaba",
    name: "Akwaaba Vehicle Rental",
    timezone: "Africa/Accra",
    branches: [
      { id: "accra", name: "Accra Airport" },
      { id: "kumasi", name: "Kumasi Central" },
    ],
  },
  {
    id: "sankofa",
    name: "Sankofa Mobility",
    timezone: "Africa/Accra",
    branches: [
      { id: "tema", name: "Tema Harbour" },
      { id: "takoradi", name: "Takoradi Depot" },
    ],
  },
];
export const mockNow = "2026-11-13T09:00:00.000Z";

import type {
  DepartureQueueItem,
  ReturnQueueItem,
  BlockerSummary,
} from "../features/dashboard/models";
const issues: Omit<BlockerSummary, "id">[][] = [
  [
    {
      description: "No vehicle allocated",
      severity: "Departure blocker",
      tone: "danger",
      resolution: { moduleKey: "operations", label: "Vehicle allocation" },
    },
  ],
  [
    {
      description: "Allocated vehicle reported unavailable",
      severity: "Departure blocker",
      tone: "danger",
      resolution: { moduleKey: "fleet", label: "Fleet availability" },
    },
    {
      description: "Inspection outstanding",
      severity: "Preparation issue",
      tone: "warning",
      resolution: { moduleKey: "operations", label: "Vehicle Inspection" },
    },
  ],
  [
    {
      description: "Cleaning awaiting completion",
      severity: "Preparation issue",
      tone: "warning",
      resolution: { moduleKey: "operations", label: "Vehicle preparation" },
    },
  ],
  [
    {
      description: "Maintenance review outstanding",
      severity: "Departure blocker",
      tone: "danger",
      resolution: { moduleKey: "maintenance", label: "Maintenance" },
    },
  ],
  [
    {
      description: "Departure documentation incomplete",
      severity: "Preparation issue",
      tone: "warning",
      resolution: { moduleKey: "rentals", label: "Booking Management" },
    },
  ],
];
const offsets = [
  -30, 15, 35, 45, 75, 90, 115, 120, 150, 180, 210, 240, 300, 360,
];
export const departures: DepartureQueueItem[] = companies.flatMap((company) =>
  offsets.map((minutes, index) => {
    const branch = company.branches[index % company.branches.length];
    const id = `${company.id}-d${String(index + 1).padStart(2, "0")}`;
    return {
      id,
      companyId: company.id,
      branchId: branch.id,
      branchName: branch.name,
      bookingReference: `${company.id === "akwaaba" ? "AKW" : "SNK"}-26-${String(4101 + index)}`,
      scheduledAt: new Date(
        Date.parse(mockNow) + minutes * 60_000,
      ).toISOString(),
      vehicle:
        index % 7 === 0
          ? null
          : `DEMO-GH-${company.id === "akwaaba" ? "AKW" : "SNK"}-${102 + index}`,
      displayStatus:
        index === 5
          ? "Preparation awaiting final confirmation"
          : "Departure preparation",
      blockers: (issues[index % 7] ?? []).map((issue, i) => ({
        ...issue,
        id: `${id}-b${i + 1}`,
      })),
      outstanding: true,
      priority: [0, 1, 4, 2, 3, 100, 100][index % 7],
    };
  }),
);
export const returns: ReturnQueueItem[] = companies.flatMap((company) =>
  [-20, 30, 60, 110, 180].map((minutes, index) => {
    const branch = company.branches[index % company.branches.length];
    const related =
      index % 7 === 0
        ? departures.find(
            (d) =>
              d.companyId === company.id &&
              d.branchId === branch.id &&
              d.id.endsWith("d03"),
          )
        : undefined;
    return {
      id: `${company.id}-r${index + 1}`,
      companyId: company.id,
      branchId: branch.id,
      branchName: branch.name,
      reference: `${company.id === "akwaaba" ? "AKW" : "SNK"}-RET-${7101 + index}`,
      vehicle: `DEMO-GH-RT-${company.id === "akwaaba" ? "AKW" : "SNK"}-${201 + index}`,
      scheduledAt: new Date(
        Date.parse(mockNow) + minutes * 60_000,
      ).toISOString(),
      relatedDepartureId: related?.id,
      relatedDepartureReference: related?.bookingReference,
    };
  }),
);
