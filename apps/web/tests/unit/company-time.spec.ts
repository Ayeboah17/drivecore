import { test, expect } from "@playwright/test";
import {
  companyDate,
  formatTime,
  isDueSoon,
  timeBand,
} from "../../src/lib/time/company-time";
test("company dates and DST do not depend on browser timezone", () => {
  expect(companyDate("2026-11-13T23:30:00Z", "Europe/Prague")).toBe(
    "2026-11-14",
  );
  expect(companyDate("2026-11-13T23:30:00Z", "Europe/London")).toBe(
    "2026-11-13",
  );
  expect(formatTime("2026-03-29T01:30:00Z", "Europe/Prague")).toBe("03:30");
  expect(formatTime("2026-10-25T00:30:00Z", "Europe/Prague")).toBe("02:30");
  expect(formatTime("2026-10-25T01:30:00Z", "Europe/Prague")).toBe("02:30");
});
test("due soon includes now and 120 minutes, but not earlier or later; past completed is not outstanding", () => {
  const now = "2026-11-13T09:00:00Z";
  expect(isDueSoon(now, now)).toBeTruthy();
  expect(isDueSoon("2026-11-13T11:00:00Z", now)).toBeTruthy();
  expect(isDueSoon("2026-11-13T11:00:01Z", now)).toBeFalsy();
  expect(isDueSoon("2026-11-13T08:59:59Z", now)).toBeFalsy();
  expect(
    timeBand({ scheduledAt: "2026-11-13T08:00:00Z", outstanding: false }, now),
  ).toBe(2);
});

test("Ghana demo uses Accra time at midnight and throughout the year", () => {
  expect(companyDate("2026-11-13T23:30:00Z", "Africa/Accra")).toBe(
    "2026-11-13",
  );
  expect(companyDate("2026-11-14T00:00:00Z", "Africa/Accra")).toBe(
    "2026-11-14",
  );
  expect(formatTime("2026-01-13T09:00:00Z", "Africa/Accra")).toBe("09:00");
  expect(formatTime("2026-07-13T09:00:00Z", "Africa/Accra")).toBe("09:00");
});
