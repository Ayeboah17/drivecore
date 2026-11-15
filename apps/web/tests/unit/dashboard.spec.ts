import { test, expect } from "@playwright/test";
import { createMockDataSource } from "../../src/mocks/data-source";
import { parseQueueState } from "../../src/features/dashboard/queue-url";
const defaults = parseQueueState(new URLSearchParams());
test("summary counts unique departures and individual issues; all-branch results paginate", async () => {
  const source = createMockDataSource("operator", "normal");
  const context = await source.resolveContext("akwaaba", "all");
  const summary = await source.dashboardSummary(context);
  expect(summary.departures).toBe(14);
  expect(summary.affectedDepartures).toBe(10);
  expect(summary.issues).toBe(12);
  expect(summary.dueSoon).toBe(7);
  const page = await source.departures(context, defaults.departures);
  expect(page.items).toHaveLength(10);
  expect(page.total).toBe(14);
  expect(page.items[0].id).toBe("akwaaba-d01");
  expect(new Set(page.items.map((d) => d.id)).size).toBe(10);
  const second = await source.departures(context, {
    ...defaults.departures,
    page: 99,
  });
  expect(second.page).toBe(2);
  expect(second.items).toHaveLength(4);
});
test("branch, profile, filters and no-results are scoped in the adapter", async () => {
  const source = createMockDataSource("restricted", "normal");
  const context = await source.resolveContext("akwaaba", "all");
  const rows = await source.departures(context, defaults.departures);
  expect(rows.items.every((d) => d.branchId === "accra")).toBeTruthy();
  expect(rows.items.some((d) => d.id === "akwaaba-d03")).toBeFalsy();
  const rs = await source.returns(context, defaults.returns);
  expect(rs.items[0].relatedDepartureId).toBeUndefined();
  expect(
    (
      await source.departures(context, {
        ...defaults.departures,
        query: "NO-MATCH",
      })
    ).total,
  ).toBe(0);
  expect(
    (
      await source.departures(context, {
        ...defaults.departures,
        filter: "blocked",
      })
    ).items.every((d) => d.blockers.length),
  ).toBeTruthy();
});
test("one failed queue does not fail the other", async () => {
  const source = createMockDataSource("operator", "returns-error");
  const context = await source.resolveContext("akwaaba", "all");
  await expect(source.returns(context, defaults.returns)).rejects.toMatchObject(
    { kind: "request" },
  );
  expect((await source.departures(context, defaults.departures)).total).toBe(
    14,
  );
});

test("fixture allocation issues are coherent and unblocked departures follow blockers within the due-soon band", async () => {
  const source = createMockDataSource("operator", "normal");
  const context = await source.resolveContext("akwaaba", "all");
  const all = await source.departures(context, {
    ...defaults.departures,
    pageSize: 100,
  });
  for (const item of all.items) {
    if (
      item.blockers.some(
        (blocker) => blocker.description === "No vehicle allocated",
      )
    )
      expect(item.vehicle).toBeNull();
  }
  const soon = await source.departures(context, {
    ...defaults.departures,
    filter: "soon",
  });
  expect(soon.items.map((item) => item.id)).toEqual([
    "akwaaba-d08",
    "akwaaba-d02",
    "akwaaba-d04",
    "akwaaba-d05",
    "akwaaba-d03",
    "akwaaba-d06",
    "akwaaba-d07",
  ]);
});
