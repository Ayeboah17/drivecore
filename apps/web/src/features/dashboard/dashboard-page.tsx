"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { scopeKey } from "@/lib/data/query-keys";
import { RefreshCw } from "lucide-react";
import { useDevelopment } from "@/mocks/development-provider";
import { useResolvedContext } from "@/lib/context/context-provider";
import { recordPath } from "@/lib/navigation/routes";
import { PageLayout } from "@/components/layout/page-layout";
import { PageHeader } from "@/components/layout/page-header";
import { StatePanel } from "@/components/layout/state-panel";
import { Button } from "@/components/ui/button";
import { formatDay, formatTime } from "@/lib/time/company-time";
import { useDepartures, useReturns } from "./queries";
import { parseQueueState } from "./queue-url";
import { OperationalSummary } from "./operational-summary";
import { DeparturesQueue } from "./departures-queue";
import { ReturnsQueue } from "./returns-queue";
import { NativeFilter, QueueSearch } from "./queue-controls";
export function DashboardPage() {
  const { profile } = useDevelopment();
  return profile.modules.includes("dashboard") ? (
    <DashboardContent />
  ) : (
    <PageLayout>
      <StatePanel title="Access denied">
        This simulated profile cannot view the dashboard.
      </StatePanel>
    </PageLayout>
  );
}
function DashboardContent() {
  const context = useResolvedContext();
  const { source, profile, scenario } = useDevelopment();
  const client = useQueryClient();
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const state = parseQueueState(new URLSearchParams(params.toString()));
  const departures = useDepartures(state.departures);
  const returns = useReturns(state.returns);
  const update = (values: Record<string, string>, replace = false) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const url = pathname + "?" + next.toString();
    if (replace) router.replace(url, { scroll: false });
    else router.push(url, { scroll: false });
  };
  const from = pathname + "?" + params.toString();
  const timezone = context.company.timezone;
  const departureHref = (id: string) =>
    recordPath(context, "departures", id, from);
  const blockerHref = (id: string) => recordPath(context, "blockers", id, from);
  return (
    <PageLayout>
      <PageHeader
        title="Today's departures"
        description={`${formatDay(source.referenceTime, timezone)} · ${timezone}`}
      >
        <Button
          variant="outline"
          onClick={() => {
            void client.refetchQueries({
              queryKey: scopeKey(profile.id, scenario, context),
              type: "active",
            });
          }}
        >
          <RefreshCw />
          Refresh queues
        </Button>
      </PageHeader>
      <div className="flex flex-wrap justify-between gap-2 border-l-2 border-primary pl-3 text-label text-muted-foreground">
        <p>
          Mock operational data · Demo clock{" "}
          <strong className="font-medium text-foreground">
            {formatTime(source.referenceTime, timezone)}
          </strong>{" "}
          · Time is fixed for repeatable testing
        </p>
        <p>
          {context.branch.kind === "all"
            ? "All authorized branches"
            : context.company.branches.find(
                (b) =>
                  context.branch.kind === "branch" &&
                  b.id === context.branch.branchId,
              )?.name}
        </p>
      </div>
      <OperationalSummary />
      <section
        aria-labelledby="departures-heading"
        className="overflow-hidden rounded-card border bg-surface"
      >
        <div className="border-b p-card">
          <div className="flex flex-wrap justify-between gap-2">
            <h2 id="departures-heading" className="text-section-heading">
              Departures & handovers
            </h2>
            <span className="text-label text-muted-foreground">
              Primary operational queue
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Resolve departure blockers first. Each booking appears once.
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <NativeFilter
              label="Departure filter"
              value={state.departures.filter}
              options={[
                { value: "all", label: "All departures" },
                { value: "blocked", label: "With blockers" },
                { value: "soon", label: "Due within 120 minutes" },
                { value: "earlier", label: "Outstanding earlier departures" },
              ]}
              onChange={(value) => update({ depFilter: value, depPage: "" })}
            />
            <NativeFilter
              label="Departure sort"
              value={state.departures.sort}
              options={[
                { value: "priority", label: "Operational priority" },
                { value: "time", label: "Departure time" },
              ]}
              onChange={(value) => update({ depSort: value, depPage: "" })}
            />
            <QueueSearch
              query={state.departures.query}
              onChange={(value) =>
                update({ depQuery: value, depPage: "" }, true)
              }
            />
          </div>
        </div>
        <DeparturesQueue
          data={departures.data}
          pending={departures.isPending}
          error={departures.isError}
          filtered={
            state.departures.filter !== "all" || !!state.departures.query
          }
          timezone={timezone}
          onRetry={() => void departures.refetch()}
          onClear={() => update({ depFilter: "", depQuery: "", depPage: "" })}
          onPage={(page) => update({ depPage: String(page) })}
          departureHref={departureHref}
          blockerHref={blockerHref}
        />
      </section>
      <section
        aria-labelledby="returns-heading"
        className="overflow-hidden rounded-card border bg-surface"
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b p-card">
          <div>
            <h2 id="returns-heading" className="text-section-heading">
              Today&apos;s returns
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Monitor incoming vehicles and explicitly recorded departure
              dependencies.
            </p>
          </div>
          <NativeFilter
            label="Return sort"
            value={state.returns.sort}
            options={[
              { value: "time", label: "Earliest return first" },
              { value: "time-desc", label: "Latest return first" },
            ]}
            onChange={(value) => update({ retSort: value, retPage: "" })}
          />
        </div>
        <ReturnsQueue
          data={returns.data}
          pending={returns.isPending}
          error={returns.isError}
          timezone={timezone}
          onRetry={() => void returns.refetch()}
          onPage={(page) => update({ retPage: String(page) })}
          departureHref={departureHref}
        />
      </section>
    </PageLayout>
  );
}
