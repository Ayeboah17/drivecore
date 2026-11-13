import { test, expect } from "@playwright/test";
import { createMockDataSource } from "../../src/mocks/data-source";
test("notifications only link accessible functional mock details", async () => {
  const source = createMockDataSource("restricted", "normal");
  const context = await source.resolveContext("akwaaba", "all");
  const result = await source.notifications(context);
  expect(result.items.length).toBeGreaterThan(0);
  for (const item of result.items) {
    expect(item.branchName).toBe("Accra Airport");
    expect(item.href).toContain("/companies/akwaaba/blockers/");
    expect(item.href).not.toContain("akwaaba-d03");
  }
  expect(
    (await createMockDataSource("operator", "empty").notifications(context))
      .items,
  ).toEqual([]);
});
