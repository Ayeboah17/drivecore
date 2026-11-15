import { test, expect } from "@playwright/test";
import {
  companyInput,
  branchInput,
  canCreateBranch,
  canCreateCompany,
  hasWholeCompanyDirectory,
} from "../../src/features/setup/contracts";
import { allowedPath } from "../../src/lib/server/backend-proxy";
import type { User } from "../../src/lib/api/contracts";
const user: User = {
  id: 1,
  name: "Synthetic",
  email: "synthetic@example.test",
  roles: ["company-admin"],
  permissions: ["companies.manage", "branches.manage"],
  is_platform_admin: false,
  companies: [
    { id: 1, name: "One", branch_id: null },
    { id: 2, name: "Two", branch_id: 3 },
  ],
};
test("company creation needs platform flag; branch creation needs whole-company membership and capability", () => {
  expect(canCreateCompany(user)).toBe(false);
  expect(canCreateCompany({ ...user, is_platform_admin: true })).toBe(true);
  expect(canCreateBranch(user, "1")).toBe(true);
  expect(canCreateBranch(user, "2")).toBe(false);
  expect(canCreateBranch(user, "9")).toBe(false);
  expect(canCreateBranch({ ...user, permissions: [] }, "1")).toBe(false);
  expect(
    canCreateBranch(
      { ...user, is_platform_admin: true, companies: [], permissions: [] },
      "9",
    ),
  ).toBe(true);
});
test("setup schemas mirror current name and currency constraints without a currency catalogue", () => {
  expect(
    companyInput.safeParse({ name: "Synthetic", currency: "XYZ" }).success,
  ).toBe(true);
  for (const currency of ["zmw", "ZM", "ZMWX", "123"])
    expect(
      companyInput.safeParse({ name: "Synthetic", currency }).success,
    ).toBe(false);
  expect(branchInput.safeParse({ name: " " }).success).toBe(false);
  expect(branchInput.safeParse({ name: "x".repeat(256) }).success).toBe(false);
});
test("proxy permits only existing company/branch creation methods", () => {
  expect(allowedPath("POST", "api/v1/companies")).toBe(true);
  expect(allowedPath("POST", "api/v1/branches")).toBe(true);
  expect(allowedPath("PATCH", "api/v1/companies/1")).toBe(false);
  expect(allowedPath("DELETE", "api/v1/branches/1")).toBe(false);
});

test("an empty branch directory proves company emptiness only with whole-company visibility", () => {
  expect(hasWholeCompanyDirectory(user, "1")).toBe(false);
  const reader = { ...user, permissions: ["branches.view"] };
  expect(hasWholeCompanyDirectory(reader, "1")).toBe(true);
  expect(hasWholeCompanyDirectory(reader, "2")).toBe(false);
  expect(hasWholeCompanyDirectory(reader, "9")).toBe(false);
  expect(
    hasWholeCompanyDirectory(
      { ...user, is_platform_admin: true, companies: [], permissions: [] },
      "9",
    ),
  ).toBe(true);
});
