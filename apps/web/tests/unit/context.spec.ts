import { test, expect } from "@playwright/test";
import {
  parseScope,
  dashboardPath,
  safeReturnPath,
} from "../../src/lib/context/url";
test("URL scope is explicit and rejects duplicate or malformed branches", () => {
  expect(dashboardPath("akwaaba")).toBe(
    "/companies/akwaaba/dashboard?branch=all",
  );
  expect(parseScope("akwaaba", new URLSearchParams())?.branch).toEqual({
    kind: "all",
  });
  expect(
    parseScope("akwaaba", new URLSearchParams("branch=accra"))?.branch,
  ).toEqual({ kind: "branch", branchId: "accra" });
  expect(
    parseScope("akwaaba", new URLSearchParams("branch=all&branch=accra")),
  ).toBeNull();
  expect(parseScope("../akwaaba", new URLSearchParams())).toBeNull();
});
test("return locations cannot cross company, branch, or origin", () => {
  const scope = { kind: "all" } as const;
  expect(safeReturnPath("//evil.invalid", "akwaaba", scope)).toBe(
    dashboardPath("akwaaba"),
  );
  expect(
    safeReturnPath("/companies/sankofa/dashboard?branch=all", "akwaaba", scope),
  ).toBe(dashboardPath("akwaaba"));
  expect(
    safeReturnPath(
      "/companies/akwaaba/dashboard?branch=accra",
      "akwaaba",
      scope,
    ),
  ).toBe(dashboardPath("akwaaba"));
  expect(
    safeReturnPath(
      "/companies/akwaaba/dashboard?branch=all&depPage=2&evil=x",
      "akwaaba",
      scope,
    ),
  ).toContain("depPage=2");
  expect(
    safeReturnPath(
      "/companies/akwaaba/dashboard?branch=all&evil=x",
      "akwaaba",
      scope,
    ),
  ).not.toContain("evil");
});
