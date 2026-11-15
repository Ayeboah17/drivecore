"use client";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "@/features/live/context";
import { StatePanel } from "@/components/layout/state-panel";
import { SetupForm } from "./setup-form";
import { canCreateBranch } from "./contracts";
import Link from "next/link";
export function BranchSetup() {
  const { user } = useSession();
  const scope = useLiveContext();
  const branches =
    scope.directory?.branches.filter(
      (branch) => String(branch.company_id) === scope.companyId,
    ) ?? [];
  if (!user || !canCreateBranch(user, scope.companyId))
    return (
      <StatePanel title="Branch setup unavailable">
        Creating branches requires branch-management permission and
        whole-company access. Contact your administrator.
      </StatePanel>
    );
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-page-title font-extrabold tracking-tight">
          Set up branches
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create a branch for {scope.company?.name}, then open the workspace to
          add customers and vehicles.
        </p>
      </div>
      <section
        aria-label="Company setup"
        className="dc-shadow-card max-w-xl space-y-2 rounded-2xl border bg-surface p-card"
      >
        <h2 className="text-section-heading">Company</h2>
        <p className="font-semibold">{scope.company?.name}</p>
        {scope.company?.currency ? (
          <p className="text-sm text-muted-foreground">
            Currency:{" "}
            <span className="ml-1 rounded-md bg-structural px-1.5 py-0.5 font-mono text-xs font-semibold text-structural-foreground">
              {scope.company.currency}
            </span>
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          Add at least one branch before continuing to the workspace. You can
          add more branches here or from the dashboard.
        </p>
      </section>
      {!scope.directory?.branchesAvailable ? (
        <StatePanel title="Branch directory unavailable">
          Your account can create branches but cannot list them. Contact your
          administrator for directory access before managing branch-scoped
          records.
        </StatePanel>
      ) : branches.length ? (
        <section
          aria-label="Existing branches"
          className="dc-shadow-card max-w-xl rounded-2xl border bg-surface p-card"
        >
          <h2 className="text-section-heading">Existing branches</h2>
          <ul className="mt-3 space-y-2">
            {branches.map((branch) => (
              <li
                key={branch.id}
                className="flex items-center justify-between rounded-xl border bg-muted/40 px-3 py-2 text-sm font-medium"
              >
                <span>{branch.name}</span>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  #{branch.id}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <StatePanel title="No branches yet">
          Create the first branch to start adding records in this company.
        </StatePanel>
      )}
      <SetupForm key={scope.companyId} kind="branch" />
      {scope.directory?.branchesAvailable && branches.length ? (
        <Link
          className="inline-block text-link"
          href={`/companies/${scope.companyId}/dashboard?branch=all`}
        >
          Continue to dashboard
        </Link>
      ) : null}
    </div>
  );
}
