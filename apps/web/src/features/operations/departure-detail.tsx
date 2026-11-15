"use client";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useResolvedContext } from "@/lib/context/context-provider";
import { safeReturnPath } from "@/lib/context/url";
import { recordPath } from "@/lib/navigation/routes";
import { formatDay, formatTime } from "@/lib/time/company-time";
import { PageLayout } from "@/components/layout/page-layout";
import { PageHeader } from "@/components/layout/page-header";
import { StatePanel } from "@/components/layout/state-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeparture } from "./queries";
import { ResolutionDestination } from "./resolution-destination";
export function DepartureDetailPage() {
  const context = useResolvedContext();
  const { departureId } = useParams<{ departureId: string }>();
  const search = useSearchParams();
  const from = safeReturnPath(
    search.get("from"),
    context.company.id,
    context.branch,
  );
  const result = useDeparture(departureId);
  const data = result.data;
  return (
    <PageLayout>
      <Link
        className="inline-flex items-center gap-2 rounded-sm text-sm text-link hover:text-link-hover hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        href={from}
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to dashboard queue
      </Link>
      {result.isPending ? (
        <div role="status" aria-label="Loading departure">
          <Skeleton className="h-64" />
        </div>
      ) : !data ? (
        <StatePanel
          title="Departure unavailable"
          onRetry={() => void result.refetch()}
        >
          This mock departure is unavailable in the selected company, branch or
          simulated access profile.
        </StatePanel>
      ) : (
        <>
          <PageHeader
            title={data.bookingReference}
            description="Read-only departure details · Mock data"
          />
          {result.isError && (
            <p role="status" className="text-warning-foreground">
              Refresh failed · showing stale details.
            </p>
          )}
          <section
            aria-labelledby="departure-context"
            className="rounded-card border bg-surface p-card"
          >
            <h2 id="departure-context" className="text-section-heading">
              Departure context
            </h2>
            <dl className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {[
                ["Company", context.company.name],
                ["Assigned branch", data.branchName],
                [
                  "Scheduled departure",
                  `${formatDay(data.scheduledAt, context.company.timezone)}, ${formatTime(data.scheduledAt, context.company.timezone)}`,
                ],
                ["Business timezone", context.company.timezone],
                ["Vehicle", data.vehicle ?? "No vehicle allocated"],
                ["Operational status (mock)", data.displayStatus],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-label text-muted-foreground">{label}</dt>
                  <dd className="mt-1 break-words font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section aria-labelledby="preparation-heading" className="space-y-3">
            <h2 id="preparation-heading" className="text-section-heading">
              Preparation issues
            </h2>
            {data.blockers.length ? (
              data.blockers.map((blocker) => (
                <article
                  key={blocker.id}
                  className="rounded-card border bg-surface p-card"
                >
                  <p
                    className={`text-label ${blocker.tone === "danger" ? "text-danger-foreground" : "text-warning-foreground"}`}
                  >
                    {blocker.severity} · Provisional
                  </p>
                  <h3 className="mt-1 text-card-heading">
                    <Link
                      className="rounded-sm text-link hover:text-link-hover hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                      href={recordPath(context, "blockers", blocker.id, from)}
                    >
                      {blocker.description}
                    </Link>
                  </h3>
                  <ResolutionDestination destination={blocker.resolution} />
                </article>
              ))
            ) : (
              <p className="rounded-card border bg-surface p-card text-muted-foreground">
                No issues are recorded in this mock fixture. This is not
                confirmation that the vehicle is safe or authorized to depart.
              </p>
            )}
          </section>
          <p className="text-label text-muted-foreground">
            Status definitions and release decisions require backend
            confirmation. This page performs no operational actions.
          </p>
        </>
      )}
    </PageLayout>
  );
}
