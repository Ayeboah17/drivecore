import type { MockIdentity } from "../lib/context/types";
const allModules = [
  "dashboard",
  "operations",
  "fleet",
  "customers",
  "rentals",
  "maintenance",
  "inventory",
  "finance",
  "procurement",
  "reports",
  "administration",
];
export const profiles: Record<
  string,
  MockIdentity & {
    access: Record<string, readonly string[]>;
    hiddenRecords: readonly string[];
  }
> = {
  operator: {
    id: "operator",
    name: "Kwame Yeboah",
    profileLabel: "Multi-company operator",
    modules: allModules,
    access: { akwaaba: ["accra", "kumasi"], sankofa: ["tema", "takoradi"] },
    hiddenRecords: [],
  },
  restricted: {
    id: "restricted",
    name: "Ama Owusu",
    profileLabel: "Accra-only operator",
    modules: ["dashboard", "operations", "fleet", "rentals", "maintenance"],
    access: { akwaaba: ["accra"] },
    hiddenRecords: ["akwaaba-d03"],
  },
  noAccess: {
    id: "noAccess",
    name: "Kofi Asante",
    profileLabel: "No organizational access",
    modules: [],
    access: {},
    hiddenRecords: [],
  },
};
export const profileOptions = Object.values(profiles).map(
  ({ id, profileLabel }) => ({ id, label: profileLabel }),
);
