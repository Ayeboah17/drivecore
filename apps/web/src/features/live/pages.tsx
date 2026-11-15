"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { StatePanel } from "@/components/layout/state-panel";
import { useLiveContext } from "./context";
export function CompaniesPage() {
  const scope = useLiveContext();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-section-heading">Choose a company</h2>
        <p className="mt-2 text-muted-foreground">
          Open an accessible company workspace.
        </p>
      </div>
      {scope.pending ? (
        <p role="status">Loading companies…</p>
      ) : scope.error ? (
        <StatePanel title="Directory unavailable" onRetry={scope.retry}>
          {scope.error.message}
        </StatePanel>
      ) : !scope.directory?.companies.length ? (
        <StatePanel title="No accessible companies">
          Your account has no accessible companies. Contact your administrator.
        </StatePanel>
      ) : (
        <ul className="max-w-2xl divide-y rounded-card border bg-surface">
          {scope.directory.companies.map((c) => (
            <li key={c.id}>
              <Link
                className="block rounded-control p-card text-link hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                href={`/companies/${c.id}/dashboard?branch=all`}
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
export function UnavailablePage({ title }: { title?: string }) {
  const path = usePathname();
  const scope = useLiveContext();
  const moduleKey = path.split("/").filter(Boolean).at(-1) ?? "Module";
  return (
    <>
      <h1 className="text-page-title">
        {title ?? moduleKey.charAt(0).toUpperCase() + moduleKey.slice(1)}
      </h1>
      <StatePanel title="Live data unavailable">
        This workflow is not connected to a supported live API contract. No
        operational records or counts are displayed.
      </StatePanel>
      {scope.directory && !scope.directory.branchesAvailable ? (
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
