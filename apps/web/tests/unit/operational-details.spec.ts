import { test, expect } from "@playwright/test";
import { createMockDataSource } from "../../src/mocks/data-source";
test("details enforce scope and simulated record access independently of navigation", async () => {
  const source = createMockDataSource("operator", "normal");
  const context = await source.resolveContext("akwaaba", "accra");
  expect((await source.departure(context, "akwaaba-d01")).vehicle).toBeNull();
  expect(
    (await source.blocker(context, "akwaaba-d01-b1")).bookingReference,
  ).toBe("AKW-26-4101");
  await expect(source.departure(context, "sankofa-d01")).rejects.toMatchObject({
    kind: "unavailable",
  });
  await expect(source.departure(context, "akwaaba-d02")).rejects.toMatchObject({
    kind: "unavailable",
  });
  const restricted = createMockDataSource("restricted", "normal");
  const restrictedContext = await restricted.resolveContext("akwaaba", "all");
  await expect(
    restricted.departure(restrictedContext, "akwaaba-d03"),
  ).rejects.toMatchObject({ kind: "unavailable" });
  await expect(
    restricted.blocker(restrictedContext, "akwaaba-d03-b1"),
  ).rejects.toMatchObject({ kind: "unavailable" });
});
