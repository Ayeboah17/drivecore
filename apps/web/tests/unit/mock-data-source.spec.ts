import { test, expect } from "@playwright/test";
import { createMockDataSource } from "../../src/mocks/data-source";
test("directory and context respect simulated company and branch access", async () => {
  const source = createMockDataSource("restricted", "normal");
  const directory = await source.directory();
  expect(directory.map((c) => c.id)).toEqual(["akwaaba"]);
  expect(directory[0].branches.map((b) => b.id)).toEqual(["accra"]);
  await expect(source.resolveContext("sankofa", "all")).rejects.toMatchObject({
    kind: "denied",
  });
  await expect(
    source.resolveContext("akwaaba", "kumasi"),
  ).rejects.toMatchObject({
    kind: "denied",
  });
  await expect(source.resolveContext("akwaaba", "tema")).rejects.toMatchObject({
    kind: "denied",
  });
  expect(await createMockDataSource("noAccess", "normal").directory()).toEqual(
    [],
  );
  await expect(
    createMockDataSource("operator", "access-lost").resolveContext(
      "akwaaba",
      "all",
    ),
  ).rejects.toMatchObject({ kind: "denied" });
});
