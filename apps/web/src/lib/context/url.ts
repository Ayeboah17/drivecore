import { branchValue, type BranchScope } from "./types";
const identifier = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;
export function parseScope(companyId: string, values: URLSearchParams) {
  if (!identifier.test(companyId)) return null;
  const branches = values.getAll("branch");
  if (branches.length > 1) return null;
  const value = branches[0] ?? "all";
  if (!identifier.test(value)) return null;
  const branch: BranchScope =
    value === "all" ? { kind: "all" } : { kind: "branch", branchId: value };
  return { companyId, branch };
}
export function scopedPath(
  companyId: string,
  destination: string,
  branch: BranchScope,
) {
  return `/companies/${encodeURIComponent(companyId)}/${destination}?branch=${encodeURIComponent(branchValue(branch))}`;
}
export function dashboardPath(
  companyId: string,
  branch: BranchScope = { kind: "all" },
) {
  return scopedPath(companyId, "dashboard", branch);
}
export function safeReturnPath(
  raw: string | null,
  companyId: string,
  branch: BranchScope,
) {
  const fallback = dashboardPath(companyId, branch);
  if (!raw || raw.length > 2000 || !raw.startsWith("/") || raw.startsWith("//"))
    return fallback;
  try {
    const url = new URL(raw, "https://drivecore.invalid");
    if (
      url.origin !== "https://drivecore.invalid" ||
      url.pathname !==
        `/companies/${encodeURIComponent(companyId)}/dashboard` ||
      url.hash
    )
      return fallback;
    const scope = parseScope(companyId, url.searchParams);
    if (!scope || branchValue(scope.branch) !== branchValue(branch))
      return fallback;
    // Only queue state may survive a return link.
    const allowed = new Set([
      "branch",
      "depFilter",
      "depSort",
      "depPage",
      "depQuery",
      "retSort",
      "retPage",
    ]);
    for (const key of [...url.searchParams.keys()])
      if (!allowed.has(key)) url.searchParams.delete(key);
    return url.pathname + "?" + url.searchParams.toString();
  } catch {
    return fallback;
  }
}
