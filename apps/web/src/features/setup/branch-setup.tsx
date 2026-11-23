"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Building2, CheckCircle2, MapPin } from "lucide-react";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "@/features/live/context";
import { StatePanel } from "@/components/layout/state-panel";
import { ViewFadeIn } from "@/components/motion/primitives";
import { SetupForm } from "./setup-form";
import { canCreateBranch } from "./contracts";

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
    <ViewFadeIn className="space-y-6">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border bg-surface px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <MapPin className="size-3.5 text-link" aria-hidden="true" />
          Workspace Provisioning
        </div>
        <h1 className="text-page-title font-extrabold tracking-tight">
          Set up branches
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create a branch for {scope.company?.name}, then open the workspace to
          add customers and vehicles.
        </p>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
        aria-label="Company setup"
        className="dc-shadow-card max-w-xl space-y-2.5 rounded-2xl border bg-surface p-card"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-section-heading">Company</h2>
          <span className="flex size-8 items-center justify-center rounded-xl border bg-muted text-muted-foreground">
            <Building2 className="size-4" aria-hidden="true" />
          </span>
        </div>
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
      </motion.section>

      {!scope.directory?.branchesAvailable ? (
        <StatePanel title="Branch directory unavailable">
          Your account can create branches but cannot list them. Contact your
          administrator for directory access before managing branch-scoped
          records.
        </StatePanel>
      ) : branches.length ? (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, delay: 0.04, ease: [0.23, 1, 0.32, 1] }}
          aria-label="Existing branches"
          className="dc-shadow-card max-w-xl rounded-2xl border bg-surface p-card"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-section-heading">Existing branches</h2>
            <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-muted-foreground tabular-nums">
              {branches.length}
            </span>
          </div>
          <ul className="mt-3 space-y-2">
            {branches.map((branch, index) => (
              <motion.li
                key={branch.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.2,
                  delay: Math.min(index * 0.035, 0.2),
                  ease: [0.23, 1, 0.32, 1],
                }}
                className="flex items-center justify-between rounded-xl border bg-muted/40 px-3 py-2 text-sm font-medium"
              >
                <span className="flex items-center gap-2">
                  <CheckCircle2
                    className="size-3.5 text-success"
                    aria-hidden="true"
                  />
                  <span>{branch.name}</span>
                </span>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  #{branch.id}
                </span>
              </motion.li>
            ))}
          </ul>
        </motion.section>
      ) : (
        <StatePanel title="No branches yet">
          Create the first branch to start adding records in this company.
        </StatePanel>
      )}

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, delay: 0.08, ease: [0.23, 1, 0.32, 1] }}
      >
        <SetupForm key={scope.companyId} kind="branch" />
      </motion.div>

      {scope.directory?.branchesAvailable && branches.length ? (
        <Link
          className="inline-block font-medium text-link hover:text-link-hover hover:underline"
          href={`/companies/${scope.companyId}/dashboard?branch=all`}
        >
          Continue to dashboard
        </Link>
      ) : null}
    </ViewFadeIn>
  );
}
