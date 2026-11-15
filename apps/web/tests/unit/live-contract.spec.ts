import { test, expect } from "@playwright/test";
import {
  safeLoginReturn,
  normalizePage,
  userSchema,
  can,
  type User,
} from "../../src/lib/api/contracts";
import { csrfToken } from "../../src/lib/api/client";
import { resolveScope } from "../../src/features/live/context";
import { assertRecordScope } from "../../src/features/records/service";
const user: User = {
  id: 1,
  name: "Synthetic",
  email: "synthetic@example.test",
  roles: [],
  permissions: ["customers.view"],
  is_platform_admin: false,
  companies: [
    { id: 1, name: "One", branch_id: 2 },
    { id: 3, name: "Three", branch_id: null },
  ],
};
const directory = {
  companies: user.companies.map((c) => ({ ...c, currency: "" })),
  branches: [],
  branchesAvailable: false,
};
test("redirects stay inside company routes and reject encoded or backslash redirects", () => {
  for (const value of [
    "//evil.test",
    "https://evil.test",
    "/\\evil.test",
    "/login",
    "/companies%2f..",
    "/companies/1%5cfoo",
  ])
    expect(safeLoginReturn(value)).toBe("/companies");
  expect(safeLoginReturn("/companies/1/dashboard?branch=all")).toBe(
    "/companies/1/dashboard?branch=all",
  );
});
test("profile parsing fails closed, permission uses capabilities and admin bypass", () => {
  expect(
    userSchema.safeParse({ id: 1, roles: ["company-admin"] }).success,
  ).toBe(false);
  expect(can(user, "customers.manage")).toBe(false);
  expect(can({ ...user, is_platform_admin: true }, "customers.manage")).toBe(
    true,
  );
});
test("assigned branch works without catalogue; unknown branch and company are unavailable", () => {
  expect(resolveScope(user, directory, "1", "all")).toBeNull();
  expect(resolveScope(user, directory, "1", "2")).toBeNull();
  expect(resolveScope(user, directory, "1", "4")).not.toBeNull();
  expect(resolveScope(user, directory, "3", "4")).not.toBeNull();
  expect(resolveScope(user, directory, "9", "all")).not.toBeNull();
  expect(
    resolveScope({ ...user, is_platform_admin: true }, directory, "9", "all"),
  ).not.toBeNull();
});
test("normalizes pagination without following upstream links", () => {
  expect(
    normalizePage({
      data: ["a"],
      meta: { current_page: 2, last_page: 3, per_page: 25, total: 51 },
    }),
  ).toEqual({ items: ["a"], page: 2, lastPage: 3, pageSize: 25, total: 51 });
});
test("record is rejected before display/cache when selected context differs", () => {
  const record = {
    id: 1,
    company_id: 1,
    branch_id: 2,
    name: "Synthetic",
    type: "individual" as const,
    email: null,
    phone: null,
    created_at: "",
    updated_at: "",
  };
  expect(assertRecordScope(record, "1", "all")).toEqual(record);
  expect(() => assertRecordScope(record, "3", "all")).toThrow();
  expect(() => assertRecordScope(record, "1", "4")).toThrow();
});
test("XSRF is URL decoded once and malformed tokens do not crash", () => {
  expect(csrfToken("other=x; XSRF-TOKEN=synthetic%3D")).toBe("synthetic=");
  expect(csrfToken("XSRF-TOKEN=%invalid")).toBe("");
});
