import { test, expect } from "@playwright/test";
import { createQueryClient } from "../../src/lib/data/query-client";
import { waitForMock } from "../../src/mocks/scenarios";
test("cancelled queries do not accept delayed results", async () => {
  const client = createQueryClient();
  const promise = client.fetchQuery({
    queryKey: ["scope", "operator", "slow", "akwaaba", "all", "departures"],
    queryFn: async ({ signal }) => {
      await waitForMock(signal, 50);
      return "old records";
    },
  });
  await client.cancelQueries({ queryKey: ["scope"] });
  await expect(promise).rejects.toBeDefined();
  expect(
    client.getQueryData([
      "scope",
      "operator",
      "slow",
      "akwaaba",
      "all",
      "departures",
    ]),
  ).toBeUndefined();
  client.clear();
});
test("mock delays honor an already aborted signal", async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(waitForMock(controller.signal, 100)).rejects.toMatchObject({
    name: "AbortError",
  });
});
