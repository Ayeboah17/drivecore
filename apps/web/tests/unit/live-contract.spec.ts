import { test, expect } from "@playwright/test";
import {
  safeLoginReturn,
  normalizePage,
  userSchema,
  documentSchema,
  can,
  type User,
} from "../../src/lib/api/contracts";
import { csrfToken } from "../../src/lib/api/client";
import {
  humanizeFieldLabel,
  humanizeFieldMessage,
} from "../../src/lib/api/error-format";
import {
  evaluateTransitionTiming,
  generateDriverPassword,
} from "../../src/features/rentals/timing";
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
test("documentSchema coerces string numeric IDs from Laravel multipart responses and rejects invalid IDs", () => {
  const valid = documentSchema.safeParse({
    id: "701",
    company_id: "1",
    branch_id: "2",
    uploaded_by: "5",
    entity_type: "vehicle",
    entity_id: "10",
    original_name: "policy.pdf",
    mime_type: "application/pdf",
    size: "2048",
    expires_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  });
  expect(valid.success).toBe(true);
  if (valid.success) {
    expect(valid.data.company_id).toBe(1);
    expect(valid.data.branch_id).toBe(2);
    expect(valid.data.size).toBe(2048);
  }
  expect(
    documentSchema.safeParse({
      id: "0",
      company_id: "1",
      branch_id: "2",
      uploaded_by: null,
      original_name: "policy.pdf",
      mime_type: "application/pdf",
      size: 10,
      created_at: "",
      updated_at: "",
    }).success,
  ).toBe(false);
  expect(
    documentSchema.safeParse({
      id: 1,
      company_id: "abc",
      branch_id: 2,
      uploaded_by: null,
      original_name: "policy.pdf",
      mime_type: "application/pdf",
      size: 10,
      created_at: "",
      updated_at: "",
    }).success,
  ).toBe(false);
});
test("error-format humanizes raw database column names in labels and messages", () => {
  expect(humanizeFieldLabel("vehicle_id")).toBe("Vehicle");
  expect(humanizeFieldLabel("customer_id")).toBe("Customer");
  expect(humanizeFieldLabel("starts_at")).toBe("Departure");
  expect(humanizeFieldLabel("ends_at")).toBe("Expected return");
  expect(humanizeFieldLabel("driver_user_id")).toBe("Driver");
  expect(humanizeFieldLabel("functions.0")).toBe("Vehicle functions");

  expect(humanizeFieldMessage("vehicle_id could not be booked.")).toBe(
    "Vehicle could not be booked.",
  );
  expect(
    humanizeFieldMessage(
      "The selected customer_id and driver user id are invalid for starts_at.",
    ),
  ).toBe("The selected customer and driver are invalid for departure.");
});
test("evaluateTransitionTiming warns strictly outside ±30 minutes and generateDriverPassword meets strength rules", () => {
  const base = Date.parse("2026-06-15T12:00:00Z");
  expect(
    evaluateTransitionTiming("handover", "2026-06-15T12:00:00Z", base),
  ).toEqual({ outsideWindow: false });
  expect(
    evaluateTransitionTiming("handover", "2026-06-15T12:30:00Z", base),
  ).toEqual({ outsideWindow: false });
  expect(
    evaluateTransitionTiming("return", "2026-06-15T11:30:00Z", base),
  ).toEqual({ outsideWindow: false });
  expect(evaluateTransitionTiming("handover", null, base)).toEqual({
    outsideWindow: false,
  });

  const earlyHandover = evaluateTransitionTiming(
    "handover",
    "2026-06-15T12:31:00Z",
    base,
  );
  expect(earlyHandover.outsideWindow).toBe(true);
  if (earlyHandover.outsideWindow) {
    expect(earlyHandover.direction).toBe("early");
    expect(earlyHandover.summary).toContain("Scheduled departure is in 31m");
  }

  const lateReturn = evaluateTransitionTiming(
    "return",
    "2026-06-15T09:45:00Z",
    base,
  );
  expect(lateReturn.outsideWindow).toBe(true);
  if (lateReturn.outsideWindow) {
    expect(lateReturn.direction).toBe("late");
    expect(lateReturn.summary).toContain("Scheduled return was 2h 15m ago");
  }

  const pw1 = generateDriverPassword();
  const pw2 = generateDriverPassword();
  expect(pw1.length).toBeGreaterThanOrEqual(12);
  expect(/[a-zA-Z]/.test(pw1)).toBe(true);
  expect(/\d/.test(pw1)).toBe(true);
  expect(pw1).not.toBe(pw2);
});
