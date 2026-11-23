"use client";
import { createContext, useContext, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import {
  branchSchema,
  companySchema,
  can,
  pageSchema,
  normalizePage,
  type Branch,
  type Company,
  type User,
} from "@/lib/api/contracts";
import { ApiError, read } from "@/lib/api/client";

export interface Directory {
  companies: Company[];
  branches: Branch[];
  branchesAvailable: boolean;
}
async function directoryPages<T>(
  path: string,
  schema: Parameters<typeof pageSchema>[0],
  signal: AbortSignal,
): Promise<T[]> {
  const records: T[] = [];
  for (let page = 1; page <= 100; page++) {
    const result = await read(
      `${path}?page=${page}`,
      pageSchema(schema),
      signal,
    );
    const normalized = normalizePage(result);
    if (normalized.page !== page)
      throw new ApiError(502, "Unexpected directory page. Try again.");
    records.push(...(normalized.items as T[]));
    if (page >= normalized.lastPage) return records;
  }
  throw new ApiError(
    502,
    "Organization directory exceeds the supported size. Contact support.",
  );
}
export async function loadDirectory(
  user: User,
  signal: AbortSignal,
): Promise<Directory> {
  const [companies, branches] = await Promise.all([
    user.is_platform_admin
      ? directoryPages<Company>("api/v1/companies", companySchema, signal)
      : Promise.resolve(
          user.companies.map((c) => ({
            id: c.id,
            name: c.name,
            currency: c.currency ?? "",
          })),
        ),
    can(user, "branches.view")
      ? directoryPages<Branch>("api/v1/branches", branchSchema, signal)
      : Promise.resolve([]),
  ]);
  return { companies, branches, branchesAvailable: can(user, "branches.view") };
}
export function resolveScope(
  user: User,
  directory: Directory,
  companyId: string,
  branch: string,
) {
  if (
    !/^[1-9]\d*$/.test(companyId) ||
    !(branch === "all" || /^[1-9]\d*$/.test(branch))
  )
    return "Invalid company or branch URL.";
  const company = directory.companies.find((c) => String(c.id) === companyId);
  if (!company) return "This company is unavailable or inaccessible.";
  const membership = user.companies.find((c) => String(c.id) === companyId);
  if (!user.is_platform_admin && !membership)
    return "Company access is unavailable.";
  if (branch !== "all") {
    if (
      !user.is_platform_admin &&
      membership?.branch_id !== null &&
      String(membership?.branch_id) !== branch
    )
      return "This branch is unavailable or inaccessible.";
    if (
      !directory.branches.some(
        (b) => String(b.id) === branch && String(b.company_id) === companyId,
      ) &&
      (user.is_platform_admin || String(membership?.branch_id) !== branch)
    )
      return "Branch lookup is unavailable for this account.";
  }
  return null;
}
interface Scope {
  directory: Directory | null;
  company: Company | null;
  companyId: string;
  branch: string;
  error: Error | null;
  pending: boolean;
  key: readonly unknown[];
  navigate: (url: string) => void;
  retry: () => void;
}
const Context = createContext<Scope | null>(null);
export function LiveContext({ children }: { children: React.ReactNode }) {
  const { user, epoch } = useSession();
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const client = useQueryClient();
  const companyId = pathname.match(/^\/companies\/([^/]+)/)?.[1] ?? "";
  const branch = search.get("branch") ?? "all";
  const identity = JSON.stringify(user);
  const directory = useQuery({
    queryKey: ["live", epoch, user?.id, "directory", identity],
    queryFn: ({ signal }) => loadDirectory(user!, signal),
    enabled: !!user,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const scopeError =
    user && directory.data && companyId
      ? search.getAll("branch").length > 1
        ? "Invalid branch URL."
        : resolveScope(user, directory.data, companyId, branch)
      : null;
  const key = [
    "live",
    epoch,
    user?.id,
    "scope",
    companyId,
    branch,
    identity,
  ] as const;
  useEffect(() => {
    const filters = {
      predicate: (query: { queryKey: readonly unknown[] }) =>
        query.queryKey[0] === "live" &&
        query.queryKey[3] === "scope" &&
        (query.queryKey[4] !== companyId ||
          query.queryKey[5] !== branch ||
          query.queryKey[6] !== identity),
    };
    void client.cancelQueries(filters);
    client.removeQueries(filters);
  }, [client, companyId, branch, identity]);
  return (
    <Context
      value={{
        directory: directory.data ?? null,
        company:
          directory.data?.companies.find((c) => String(c.id) === companyId) ??
          null,
        companyId,
        branch,
        key,
        error: directory.error ?? (scopeError ? new Error(scopeError) : null),
        pending: directory.isPending,
        navigate: (url) => {
          void client.cancelQueries({
            predicate: (q) => q.queryKey[3] === "scope",
          });
          client.removeQueries({ predicate: (q) => q.queryKey[3] === "scope" });
          router.push(url);
        },
        retry: () => {
          void directory.refetch();
        },
      }}
    >
      {children}
    </Context>
  );
}
export function useLiveContext() {
  const scope = useContext(Context);
  if (!scope) throw new Error("Organization provider missing");
  return scope;
}

const BRANCH_SWITCH_PRESERVED_PARAMS = [
  "tab",
  "flow",
  "sort",
  "dir",
  "dsort",
  "ddir",
] as const;

/**
 * Computes the destination href when switching branches in the live shell:
 * - On list/tabbed pages, stays on the current route & tab while preserving sort order
 *   and clearing pagination/search/filter params.
 * - On branch-scoped record detail/edit/new pages, navigates up to the parent module list/tab
 *   so users never hit a 404 "unavailable in the selected context" error.
 */
export function buildBranchSwitchHref(
  companyId: string,
  pathname: string,
  currentSearch: URLSearchParams | string,
  nextBranch: string,
): string {
  const prefix = `/companies/${companyId}/`;
  const params = new URLSearchParams();
  const source =
    typeof currentSearch === "string"
      ? new URLSearchParams(currentSearch)
      : currentSearch;

  if (!pathname.startsWith(prefix)) {
    params.set("branch", nextBranch);
    return `/companies/${companyId}/dashboard?${params.toString()}`;
  }

  const subPath = pathname.slice(prefix.length).replace(/\/+$/, "");

  // List/tabbed top-level routes stay in place and keep tab/flow/sort state
  if (
    /^(dashboard|operations|vehicles|customers|rentals|quotations|maintenance|inventory|finance|procurement|reports|users|setup|modules\/[^/]+)$/.test(
      subPath,
    )
  ) {
    for (const key of BRANCH_SWITCH_PRESERVED_PARAMS) {
      const value = source.get(key);
      if (value) params.set(key, value);
    }
    params.set("branch", nextBranch);
    return `${prefix}${subPath}?${params.toString()}`;
  }

  // Record detail/edit/new routes fall back cleanly to their parent module list/tab
  if (subPath.startsWith("customers/")) {
    params.set("branch", nextBranch);
    return `${prefix}customers?${params.toString()}`;
  }
  if (subPath.startsWith("vehicles/")) {
    params.set("branch", nextBranch);
    return `${prefix}vehicles?${params.toString()}`;
  }
  if (subPath.startsWith("rentals/")) {
    params.set("tab", "rentals");
    params.set("branch", nextBranch);
    return `${prefix}rentals?${params.toString()}`;
  }
  if (subPath.startsWith("reservations/")) {
    params.set("tab", "reservations");
    params.set("branch", nextBranch);
    return `${prefix}rentals?${params.toString()}`;
  }
  if (subPath.startsWith("quotations/")) {
    params.set("tab", "quotations");
    params.set("branch", nextBranch);
    return `${prefix}rentals?${params.toString()}`;
  }
  if (subPath.startsWith("maintenance/")) {
    params.set("branch", nextBranch);
    return `${prefix}maintenance?${params.toString()}`;
  }
  if (subPath.startsWith("procurement/")) {
    params.set("tab", "purchase-orders");
    params.set("branch", nextBranch);
    return `${prefix}procurement?${params.toString()}`;
  }
  if (subPath.startsWith("finance/")) {
    params.set("tab", "invoices");
    params.set("branch", nextBranch);
    return `${prefix}finance?${params.toString()}`;
  }

  params.set("branch", nextBranch);
  return `${prefix}dashboard?${params.toString()}`;
}
