import type { ResolvedContext } from "../context/types";
import { dashboardPath, scopedPath } from "../context/url";
export function modulePath(context: ResolvedContext, key: string) {
  return key === "dashboard"
    ? dashboardPath(context.company.id, context.branch)
    : scopedPath(
        context.company.id,
        `modules/${encodeURIComponent(key)}`,
        context.branch,
      );
}
export function recordPath(
  context: ResolvedContext,
  kind: "departures" | "blockers",
  id: string,
  from?: string,
) {
  const base = scopedPath(
    context.company.id,
    `${kind}/${encodeURIComponent(id)}`,
    context.branch,
  );
  return from ? base + "&from=" + encodeURIComponent(from) : base;
}
