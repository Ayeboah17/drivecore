import { test, expect } from "@playwright/test";
import { createMockDataSource } from "../../src/mocks/data-source";
test("search separates planned availability from permission and scopes records", async () => {
  const source = createMockDataSource("restricted", "normal");
  const context = await source.resolveContext("akwaaba", "all");
  expect((await source.search(context, "Finance")).navigation).toEqual([]);
  expect((await source.search(context, "Fleet")).navigation[0]).toMatchObject({
    title: "Fleet",
    planned: true,
  });
  expect((await source.search(context, "SNK")).departures).toEqual([]);
  expect((await source.search(context, "AKW-26-4103")).departures).toEqual([]);
  expect(
    (await source.search(context, "AKW-26-4101")).departures[0].href,
  ).toContain("/companies/akwaaba/departures/akwaaba-d01?branch=all");
  expect(
    (await source.search(context, "unavailable")).blockers.every(
      (b) => !b.description.includes("Kumasi"),
    ),
  ).toBeTruthy();
});
test("empty input suggests navigation; cancellation and errors are explicit", async () => {
  const source = createMockDataSource("operator", "normal");
  const context = await source.resolveContext("akwaaba", "all");
  const empty = await source.search(context, "");
  expect(empty.departures).toEqual([]);
  expect(empty.totals.navigation).toBe(11);
  const controller = new AbortController();
  const pending = createMockDataSource("operator", "slow").search(
    context,
    "AKW",
    controller.signal,
  );
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  await expect(
    createMockDataSource("operator", "search-error").search(context, "Fleet"),
  ).rejects.toMatchObject({ kind: "request" });
});
