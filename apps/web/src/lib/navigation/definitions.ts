export const navigation = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: "dashboard",
    availability: "implemented",
    description: "Today's operational work.",
  },
  {
    key: "operations",
    label: "Operations",
    icon: "operations",
    availability: "planned",
    description:
      "Allocation, dispatch, vehicle inspections, handovers and returns will be managed here.",
  },
  {
    key: "fleet",
    label: "Fleet",
    icon: "fleet",
    availability: "planned",
    description:
      "Vehicle records, availability and fleet history will be managed here.",
  },
  {
    key: "customers",
    label: "Customers",
    icon: "customers",
    availability: "planned",
    description:
      "Individual and corporate customer records will be managed here.",
  },
  {
    key: "rentals",
    label: "Rentals",
    icon: "rentals",
    availability: "planned",
    description:
      "Booking management, rental contracts and extensions will be managed here.",
  },
  {
    key: "maintenance",
    label: "Maintenance",
    icon: "maintenance",
    availability: "planned",
    description:
      "Maintenance schedules, faults and work orders will be managed here.",
  },
  {
    key: "inventory",
    label: "Inventory",
    icon: "inventory",
    availability: "planned",
    description:
      "Parts, stock movements and inventory records will be managed here.",
  },
  {
    key: "finance",
    label: "Finance",
    icon: "finance",
    availability: "planned",
    description:
      "Financial records and approved accounting workflows will be managed here.",
  },
  {
    key: "procurement",
    label: "Procurement",
    icon: "procurement",
    availability: "planned",
    description:
      "Requisitions, purchases and supplier workflows will be managed here.",
  },
  {
    key: "reports",
    label: "Reports",
    icon: "reports",
    availability: "planned",
    description: "Operational and business reports will be available here.",
  },
  {
    key: "administration",
    label: "Administration",
    icon: "administration",
    availability: "planned",
    description:
      "Approved organizational and access settings will be managed here.",
  },
] as const;
export type ModuleKey = (typeof navigation)[number]["key"];
export function permittedNavigation(modules: readonly string[]) {
  return navigation.filter((item) => modules.includes(item.key));
}
export function findModule(key: string) {
  return navigation.find((item) => item.key === key);
}
