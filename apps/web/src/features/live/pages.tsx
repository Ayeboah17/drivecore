"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  Building2,
  CalendarRange,
  CarFront,
  ClipboardList,
  Compass,
  MapPin,
  Settings2,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { StatePanel } from "@/components/layout/state-panel";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ViewFadeIn } from "@/components/motion/primitives";
import { useLiveContext } from "./context";
import { useSession } from "@/features/auth/session-provider";
import {
  can,
  canAccessOperations,
  canAccessRentals,
  canAccessUserAdmin,
} from "@/lib/api/contracts";
import {
  canCreateBranch,
  canCreateCompany,
  hasWholeCompanyDirectory,
} from "@/features/setup/contracts";
import { CreateCompanyDialog } from "./create-company-dialog";

export function CompaniesPage() {
  const scope = useLiveContext();
  const { user } = useSession();

  return (
    <ViewFadeIn className="space-y-8">
      <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border bg-surface px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
            Live Organization Directory
          </div>
          <h1 className="text-page-title font-extrabold tracking-tight">
            Your workspace
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Select a company to continue to its workspace.
          </p>
        </div>
        {user && canCreateCompany(user) ? <CreateCompanyDialog /> : null}
      </div>

      {scope.pending ? (
        <section
          role="status"
          aria-label="Loading companies"
          className="space-y-4"
        >
          <p className="text-sm text-muted-foreground">Loading companies…</p>
          <div aria-hidden="true" className="grid gap-5 sm:grid-cols-2">
            {[0, 1].map((index) => (
              <div
                key={index}
                className="dc-shadow-card space-y-5 rounded-2xl border bg-surface p-card"
              >
                <Skeleton className="size-control" />
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-10 w-36" />
              </div>
            ))}
          </div>
        </section>
      ) : scope.error ? (
        <StatePanel title="Directory unavailable" onRetry={scope.retry}>
          {scope.error.message}
        </StatePanel>
      ) : !scope.directory?.companies.length ? (
        <StatePanel
          title={
            user?.is_platform_admin
              ? "No companies registered"
              : "No accessible companies"
          }
        >
          {user?.is_platform_admin
            ? "Use Create company to set up your first workspace, then add its branches."
            : "Your account has no company memberships. Ask your administrator to assign company and branch access."}
        </StatePanel>
      ) : (
        <ul
          aria-label="Company workspaces"
          className={`grid gap-5 ${scope.directory.companies.length > 1 ? "sm:grid-cols-2 lg:grid-cols-3" : ""}`}
        >
          {scope.directory.companies.map((company) => (
            <li key={company.id} className="min-w-0">
              <article
                data-testid={`workspace-card-${company.id}`}
                aria-labelledby={`company-${company.id}`}
                className="dc-shadow-card flex h-full min-w-0 flex-col rounded-2xl border bg-surface p-card transition-colors hover:border-input focus-within:border-ring motion-reduce:transition-none"
              >
                <div className="flex min-w-0 items-start gap-4">
                  <span
                    aria-hidden="true"
                    className="flex size-control shrink-0 items-center justify-center rounded-xl border bg-muted"
                  >
                    <Building2 className="size-5 text-muted-foreground" />
                  </span>
                  <div className="min-w-0 space-y-1">
                    <h2
                      id={`company-${company.id}`}
                      className="break-words text-section-heading"
                    >
                      {company.name}
                    </h2>
                    <p className="font-mono text-label text-muted-foreground tabular-nums">
                      Company ID: {company.id}
                    </p>
                  </div>
                </div>
                {company.currency ? (
                  <p className="mt-5 text-sm text-muted-foreground">
                    Currency{" "}
                    <span className="ml-2 rounded-md bg-structural px-2 py-0.5 font-mono text-xs font-semibold text-structural-foreground">
                      {company.currency}
                    </span>
                  </p>
                ) : null}
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                  <Link
                    className={buttonVariants({ size: "default" })}
                    aria-label={`Open workspace: ${company.name}`}
                    href={`/companies/${company.id}/dashboard?branch=all`}
                  >
                    Open workspace
                  </Link>
                  {user && canCreateBranch(user, String(company.id)) ? (
                    <Link
                      className="rounded-sm text-sm text-link hover:text-link-hover hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                      href={`/companies/${company.id}/setup?branch=all`}
                      aria-label={`Set up branches for ${company.name}`}
                    >
                      Set up branches
                    </Link>
                  ) : null}
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      <footer className="dc-shadow-card flex flex-col items-start justify-between gap-4 rounded-2xl border bg-surface p-card sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold">Explore the interactive ERP demo</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try the interactive workspace with synthetic data. Live records stay separate.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/demo/erp"
            prefetch={false}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Explore full ERP demo
          </Link>
        </div>
      </footer>
    </ViewFadeIn>
  );
}

export function UnavailablePage({ title }: { title?: string }) {
  const path = usePathname();
  const scope = useLiveContext();
  const { user } = useSession();
  const moduleKey = path.split("/").filter(Boolean).at(-1) ?? "Module";
  const resolvedTitle =
    title ?? moduleKey.charAt(0).toUpperCase() + moduleKey.slice(1);
  const isDashboard = resolvedTitle === "Dashboard";

  const scopedBranches =
    scope.directory?.branches.filter(
      (b) => String(b.company_id) === scope.companyId,
    ) ?? [];
  const activeBranchLabel =
    scope.branch === "all"
      ? "All accessible branches"
      : (scopedBranches.find((b) => String(b.id) === scope.branch)?.name ??
        `Assigned branch #${scope.branch}`);

  const canViewVehicles = user ? can(user, "vehicles.view") : false;
  const canViewCustomers = user ? can(user, "customers.view") : false;
  const canViewRentals = user ? canAccessRentals(user) : false;
  const canViewOperations = user ? canAccessOperations(user) : false;
  const canViewUsers = user ? canAccessUserAdmin(user, scope.companyId) : false;
  const canManageBranches =
    !!(user && scope.company && canCreateBranch(user, scope.companyId));

  return (
    <ViewFadeIn className="space-y-6">
      {/* Page Title & Live Admin Actions Band */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-page-title font-extrabold tracking-tight">
              {resolvedTitle}
            </h1>
            <span className="rounded-md bg-structural px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-structural-foreground">
              {isDashboard ? "Live Workspace" : "Planned Module"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {scope.company?.name} · {activeBranchLabel}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {user && canCreateCompany(user) ? <CreateCompanyDialog /> : null}
          {canManageBranches ? (
            <Link
              className={buttonVariants({ variant: "outline" })}
              href={`/companies/${scope.companyId}/setup?branch=${scope.branch}`}
            >
              Set up branches
            </Link>
          ) : null}
        </div>
      </div>

      {/* Honest Live Workspace Summary Grid (Dashboard only, strictly derived from session & directory context) */}
      {isDashboard ? (
        <section
          aria-label="Live workspace overview"
          className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
        >
          {/* Card 1: Organization & Branch Scope */}
          <article className="dc-shadow-card flex flex-col justify-between space-y-4 rounded-2xl border bg-surface p-card">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Active Organization Scope
                </span>
                <span className="flex size-8 items-center justify-center rounded-xl border bg-muted text-muted-foreground">
                  <Building2 className="size-4" aria-hidden="true" />
                </span>
              </div>
              <div>
                <h2 className="text-section-heading">{scope.company?.name}</h2>
                <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">
                  Company ID #{scope.companyId}
                  {scope.company?.currency
                    ? ` · ${scope.company.currency}`
                    : ""}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <MapPin className="size-3.5 text-link" aria-hidden="true" />
                {activeBranchLabel}
              </span>
              {scope.directory?.branchesAvailable ? (
                <span className="font-mono tabular-nums">
                  {scopedBranches.length}{" "}
                  {scopedBranches.length === 1 ? "branch" : "branches"}
                </span>
              ) : null}
            </div>
          </article>

          {/* Card 2: Connected Live Modules (Permission-Gated Links Only) */}
          <article className="dc-shadow-card flex flex-col justify-between space-y-4 rounded-2xl border bg-surface p-card">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Connected Live Records
                </span>
                <span className="flex size-8 items-center justify-center rounded-xl border bg-muted text-muted-foreground">
                  <ShieldCheck className="size-4" aria-hidden="true" />
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Open record lookup, creation, and editing for endpoints connected
                to Laravel.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5 border-t pt-3">
              {canViewVehicles ? (
                <Link
                  href={`/companies/${scope.companyId}/vehicles?branch=${scope.branch}`}
                  className={buttonVariants({ size: "sm" })}
                >
                  <CarFront className="size-4" aria-hidden="true" />
                  Open Fleet
                </Link>
              ) : null}
              {canViewCustomers ? (
                <Link
                  href={`/companies/${scope.companyId}/customers?branch=${scope.branch}`}
                  className={buttonVariants({
                    size: "sm",
                    variant: canViewVehicles ? "outline" : "default",
                  })}
                >
                  <UsersRound className="size-4" aria-hidden="true" />
                  Open Customers
                </Link>
              ) : null}
              {canViewRentals ? (
                <Link
                  href={`/companies/${scope.companyId}/rentals?branch=${scope.branch}`}
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                >
                  <CalendarRange className="size-4" aria-hidden="true" />
                  Open Rentals
                </Link>
              ) : null}
              {canViewOperations ? (
                <Link
                  href={`/companies/${scope.companyId}/operations?branch=${scope.branch}`}
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                >
                  <ClipboardList className="size-4" aria-hidden="true" />
                  Open Operations
                </Link>
              ) : null}
              {canViewUsers ? (
                <Link
                  href={`/companies/${scope.companyId}/users?branch=${scope.branch}`}
                  className={buttonVariants({
                    size: "sm",
                    variant:
                      canViewVehicles || canViewCustomers
                        ? "outline"
                        : "default",
                  })}
                >
                  <Settings2 className="size-4" aria-hidden="true" />
                  Open Administration
                </Link>
              ) : null}
              {!canViewVehicles &&
              !canViewCustomers &&
              !canViewRentals &&
              !canViewOperations &&
              !canViewUsers ? (
                <span className="text-xs text-muted-foreground">
                  Your account has no record directory permissions in this
                  workspace.
                </span>
              ) : null}
            </div>
          </article>

          {/* Card 3: Interactive Simulation Sandbox */}
          <article className="dc-shadow-card flex flex-col justify-between space-y-4 rounded-2xl border bg-structural p-card text-structural-foreground md:col-span-2 xl:col-span-1">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-structural-foreground/75">
                  Interactive ERP Preview
                </span>
                <span className="flex size-8 items-center justify-center rounded-xl bg-surface/10 text-structural-foreground">
                  <Compass className="size-4" aria-hidden="true" />
                </span>
              </div>
              <p className="text-sm text-structural-foreground/90">
                Explore the full telematics map, rental lifecycle, workshop, and
                GL demo powered by synthetic local data.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-structural-foreground/15 pt-3">
              <Link
                href="/demo/erp"
                prefetch={false}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-ring"
              >
                Explore full ERP demo
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
          </article>
        </section>
      ) : null}

      <StatePanel title="Live data unavailable">
        This workflow is not connected to a supported live API contract. No
        operational records or counts are displayed.
      </StatePanel>

      {scope.directory &&
      user &&
      (!scope.directory.branchesAvailable ||
        !hasWholeCompanyDirectory(user, scope.companyId)) ? (
        <StatePanel title="Branch directory limited">
          Your profile provides company membership and assigned branch IDs. A
          complete branch directory is not available to this account. Creation
          is available only when an authorized branch is known.
        </StatePanel>
      ) : null}

      <p className="text-sm text-muted-foreground">
        Search and notifications for live records are not available yet.
      </p>
    </ViewFadeIn>
  );
}
