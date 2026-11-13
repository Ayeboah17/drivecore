"use client";
import { createContext, useContext, useEffect, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDevelopment } from "@/mocks/development-provider";
import { dashboardPath, parseScope, scopedPath } from "./url";
import { branchValue, type BranchScope, type ResolvedContext } from "./types";
import { writePreference } from "./preferences";
const Context = createContext<{
  context: ResolvedContext | null;
  pending: boolean;
  error: Error | null;
  directory: ResolvedContext["company"][];
  directoryPending: boolean;
  directoryError: Error | null;
  changeCompany: (id: string) => void;
  changeBranch: (branch: BranchScope) => void;
  navigate: (url: string) => void;
  retry: () => void;
} | null>(null);
export function ContextProvider({ children }: { children: React.ReactNode }) {
  const { profile, scenario, source } = useDevelopment();
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const client = useQueryClient();
  const companyId = pathname.match(/^\/companies\/([^/]+)\//)?.[1] ?? "";
  const parsed = companyId
    ? parseScope(companyId, new URLSearchParams(search.toString()))
    : null;
  const scope = parsed ? branchValue(parsed.branch) : "invalid";
  const [pendingNavigation, startTransition] = useTransition();
  const directory = useQuery({
    queryKey: ["directory", profile.id, scenario],
    queryFn: ({ signal }) => source.directory(signal),
  });
  const resolution = useQuery({
    queryKey: ["context", profile.id, scenario, companyId, scope],
    queryFn: ({ signal }) => source.resolveContext(companyId, scope, signal),
    enabled: !!parsed,
  });
  // A render-time boundary handles Back/Forward too; it never substitutes previous scope data.
  useEffect(() => {
    void client.cancelQueries({
      predicate: (query) =>
        query.queryKey[0] === "scope" &&
        (query.queryKey[3] !== companyId || query.queryKey[4] !== scope),
    });
    client.removeQueries({
      predicate: (query) =>
        query.queryKey[0] === "scope" &&
        (query.queryKey[3] !== companyId || query.queryKey[4] !== scope),
    });
  }, [client, companyId, scope, profile.id, scenario]);
  useEffect(() => {
    if (companyId && parsed && !search.has("branch"))
      router.replace(
        pathname +
          "?" +
          new URLSearchParams({
            ...Object.fromEntries(search),
            branch: "all",
          }).toString(),
      );
  }, [companyId, parsed, pathname, router, search]);
  const navigate = (url: string) => {
    void client.cancelQueries({ predicate: (q) => q.queryKey[0] === "scope" });
    client.removeQueries({ predicate: (q) => q.queryKey[0] === "scope" });
    startTransition(() => router.push(url));
  };
  const context =
    !pendingNavigation && parsed && resolution.isSuccess
      ? resolution.data
      : null;
  return (
    <Context
      value={{
        context,
        pending:
          !!companyId &&
          (pendingNavigation || (!!parsed && resolution.isPending)),
        error:
          companyId && !parsed
            ? new Error("Invalid company or branch URL.")
            : resolution.error,
        directory: directory.data ?? [],
        directoryPending: directory.isPending,
        directoryError: directory.error,
        changeCompany: (id) => {
          writePreference("company", id);
          navigate(dashboardPath(id));
        },
        changeBranch: (branch) => {
          const moduleKey = pathname.match(/\/modules\/([a-z-]+)$/)?.[1];
          navigate(
            moduleKey
              ? scopedPath(companyId, `modules/${moduleKey}`, branch)
              : dashboardPath(companyId, branch),
          );
        },
        navigate,
        retry: () => {
          void directory.refetch();
          void resolution.refetch();
        },
      }}
    >
      {children}
    </Context>
  );
}
export function useOrganization() {
  const value = useContext(Context);
  if (!value) throw new Error("Context provider missing");
  return value;
}
export function useResolvedContext() {
  const { context } = useOrganization();
  if (!context)
    throw new Error("Scoped content rendered before context resolution");
  return context;
}
