import { test, expect } from "@playwright/test";
import {
  navigation,
  permittedNavigation,
} from "../../src/lib/navigation/definitions";
test("navigation distinguishes availability from permissions", () => {
  expect(navigation.map((n) => n.label)).toEqual([
    "Dashboard",
    "Operations",
    "Fleet",
    "Customers",
    "Rentals",
    "Maintenance",
    "Inventory",
    "Finance",
    "Procurement",
    "Reports",
    "Administration",
  ]);
  const visible = permittedNavigation(["dashboard", "fleet"]);
  expect(visible.map((n) => n.key)).toEqual(["dashboard", "fleet"]);
  expect(visible[1].availability).toBe("planned");
});
