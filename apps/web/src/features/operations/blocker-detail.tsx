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
import { useBlocker } from "./queries";
import { ResolutionDestination } from "./resolution-destination";
export function BlockerDetailPage() {
  const context = useResolvedContext();
  const { blockerId } = useParams<{ blockerId: string }>();
  const search = useSearchParams();
  const from = safeReturnPath(
    search.get("from"),
    context.company.id,
    context.branch,
  );
  const result = useBlocker(blockerId);
  const data = result.data;
  return (
    <PageLayout>
      <Link
        href={from}
        className="inline-flex items-center gap-2 rounded-sm text-sm text-link hover:text-link-hover hover:underline focus-visible:outline-2 focus-visible:outline-ring"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to dashboard queue
      </Link>
      {result.isPending ? (
        <div role="status" aria-label="Loading blocker">
          <Skeleton className="h-64" />
        </div>
      ) : !data ? (
        <StatePanel
          title="Blocker unavailable"
          onRetry={() => void result.refetch()}
        >
          This mock issue is unavailable in the selected organizational context.
        </StatePanel>
      ) : (
        <>
          <PageHeader
            title={data.description}
            description="Read-only preparation issue · Mock data"
          />
          {result.isError && (
            <p role="status" className="text-warning-foreground">
              Refresh failed · showing stale details.
            </p>
          )}
          <section className="max-w-3xl rounded-card border bg-surface p-card">
            <h2 className="text-section-heading">Operational context</h2>
            <p
              className={`mt-3 text-sm ${data.tone === "danger" ? "text-danger-foreground" : "text-warning-foreground"}`}
            >
              {data.severity} · Mock severity, pending business confirmation
            </p>
            <dl className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <dt className="text-label text-muted-foreground">
                  Affected departure
                </dt>
                <dd className="mt-1">
                  <Link
                    className="rounded-sm text-link hover:text-link-hover hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                    href={recordPath(
                      context,
                      "departures",
                      data.departureId,
                      from,
                    )}
                  >
                    {data.bookingReference}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-label text-muted-foreground">
                  Company / branch
                </dt>
                <dd className="mt-1">
                  {context.company.name} · {data.branchName}
                </dd>
              </div>
              <div>
                <dt className="text-label text-muted-foreground">
                  Scheduled departure
                </dt>
                <dd className="mt-1">
                  {formatDay(data.scheduledAt, context.company.timezone)} ·{" "}
                  {formatTime(data.scheduledAt, context.company.timezone)} ·{" "}
                  {context.company.timezone}
                </dd>
              </div>
              <div>
                <dt className="text-label text-muted-foreground">
                  Affected vehicle
                </dt>
                <dd className="mt-1">
                  {data.vehicle ?? "No vehicle allocated"}
                </dd>
              </div>
            </dl>
            <ResolutionDestination destination={data.resolution} />
          </section>
        </>
      )}
    </PageLayout>
  );
}
