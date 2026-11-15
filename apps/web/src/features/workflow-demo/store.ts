"use client";
import { useMemo, useSyncExternalStore } from "react";
import { z } from "zod";
import { steps } from "./steps";

export const demoStorageKey = "drivecore.workflow-demo.v1";
const event = "drivecore-demo-change";
const record = z.object({
  id: z.uuid(),
  companyId: z.uuid(),
  branchId: z.uuid().optional(),
  kind: z.enum(["company", "branch", "customer", "vehicle"]),
  values: z.record(z.string(), z.string()),
});
export type DemoRecord = z.infer<typeof record>;
const schema = z
  .object({
    version: z.literal(1),
    entered: z.boolean(),
    records: z.array(record).max(1000),
  })
  .superRefine((data, ctx) => {
    const ids = new Set<string>();
    for (const item of data.records) {
      const index = ["company", "branch", "customer", "vehicle"].indexOf(
        item.kind,
      );
      const company = data.records.find(
        (r) => r.id === item.companyId && r.kind === "company",
      );
      const branch = data.records.find(
        (r) =>
          r.id === item.branchId &&
          r.kind === "branch" &&
          r.companyId === item.companyId,
      );
      if (
        ids.has(item.id) ||
        !steps[index].schema.safeParse(item.values).success ||
        !company ||
        (item.kind === "company" && item.id !== item.companyId) ||
        ((item.kind === "customer" || item.kind === "vehicle") && !branch)
      )
        ctx.addIssue({ code: "custom", message: "Invalid demo records." });
      ids.add(item.id);
    }
  });
type DemoState = z.infer<typeof schema>;
const empty: DemoState = { version: 1, entered: false, records: [] };
function snapshot() {
  try {
    return localStorage.getItem(demoStorageKey) ?? "";
  } catch {
    return "storage-unavailable";
  }
}
function subscribe(listener: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === demoStorageKey || e.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(event, listener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(event, listener);
  };
}
function parse(raw: string): { data: DemoState; error: string | null } {
  if (!raw) return { data: empty, error: null };
  try {
    return { data: schema.parse(JSON.parse(raw)), error: null };
  } catch {
    return {
      data: empty,
      error:
        "Saved demo data could not be read. Reset the demo to start again. If browser storage is disabled, enable it and reload. Live records are unaffected.",
    };
  }
}
export function useDemoStore() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "loading");
  const result = useMemo(() => parse(raw), [raw]);
  function update(change: (current: DemoState) => DemoState) {
    const current = parse(snapshot());
    if (current.error) throw new Error(current.error);
    const next = schema.safeParse(change(current.data));
    if (!next.success)
      throw new Error(
        "The demo cannot save more records. Reset the demo to start again.",
      );
    try {
      localStorage.setItem(demoStorageKey, JSON.stringify(next.data));
    } catch {
      throw new Error(
        "Demo storage is unavailable or full. Enable browser storage or reset the demo and try again.",
      );
    }
    window.dispatchEvent(new Event(event));
  }
  function reset() {
    localStorage.removeItem(demoStorageKey);
    window.dispatchEvent(new Event(event));
  }
  return { ...result, loading: raw === "loading", update, reset };
}
