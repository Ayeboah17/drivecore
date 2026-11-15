"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2 } from "lucide-react";
import { StatePanel } from "@/components/layout/state-panel";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLiveContext } from "./context";
import { useSession } from "@/features/auth/session-provider";
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
    <div className="space-y-8">
      <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
        <div className="space-y-2">
          <h1 className="text-page-title">Your workspace</h1>
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
                className="space-y-5 rounded-card border bg-surface p-card"
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
          className={`grid gap-5 ${scope.directory.companies.length > 1 ? "sm:grid-cols-2" : ""}`}
        >
          {scope.directory.companies.map((company) => (
            <li key={company.id} className="min-w-0">
              <article
                data-testid={`workspace-card-${company.id}`}
                aria-labelledby={`company-${company.id}`}
                className="flex h-full min-w-0 flex-col rounded-card border bg-surface p-card transition-colors hover:border-input focus-within:border-ring motion-reduce:transition-none"
              >
                <div className="flex min-w-0 items-start gap-4">
                  <span
                    aria-hidden="true"
                    className="flex size-control shrink-0 items-center justify-center rounded-control border bg-muted"
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
                    <p className="text-label text-muted-foreground">
                      Company ID: {company.id}
                    </p>
                  </div>
                </div>
                {company.currency ? (
                  <p className="mt-5 text-sm text-muted-foreground">
                    Currency{" "}
                    <span className="ml-2 font-medium text-foreground">
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
      <footer className="flex flex-col items-start justify-between gap-3 border-t pt-6 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium">Explore the workflow</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try the setup demo with fictional data. Live records stay separate.
          </p>
        </div>
        <Link
          href="/demo/workflow"
          prefetch={false}
          className="shrink-0 rounded-sm text-sm text-link hover:text-link-hover hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          Try workflow demo
        </Link>
        <Link
          href="/demo/erp"
          prefetch={false}
          className="text-sm font-medium text-link"
        >
          Explore full ERP demo
        </Link>
      </footer>
    </div>
  );
}
export function UnavailablePage({ title }: { title?: string }) {
  const path = usePathname();
  const scope = useLiveContext();
  const { user } = useSession();
  const moduleKey = path.split("/").filter(Boolean).at(-1) ?? "Module";
  return (
    <>
      <h1 className="text-page-title">
        {title ?? moduleKey.charAt(0).toUpperCase() + moduleKey.slice(1)}
      </h1>
      {user && canCreateCompany(user) ? <CreateCompanyDialog /> : null}
      {user && scope.company && canCreateBranch(user, scope.companyId) ? (
        <Link
          className="inline-block text-link"
          href={`/companies/${scope.companyId}/setup?branch=all`}
        >
          Set up branches
        </Link>
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
    </>
  );
}
