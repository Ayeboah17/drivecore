"use client";
import { useDashboardSummary } from "./queries";
import { Skeleton } from "@/components/ui/skeleton";
import { StatePanel } from "@/components/layout/state-panel";
export function OperationalSummary() {
  const result = useDashboardSummary();
  if (result.isPending)
    return (
      <div
        role="status"
        aria-label="Loading operational summary"
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        {[0, 1, 2, 3].map((n) => (
          <Skeleton key={n} className="h-24" />
        ))}
      </div>
    );
  if (!result.data)
    return (
      <StatePanel
        title="Summary unavailable"
        onRetry={() => void result.refetch()}
      >
        Counts could not be loaded. Unavailable counts are not zero.
      </StatePanel>
    );
  const data = result.data;
  const cards = [
    {
      label: "Departures today",
      count: data.departures,
      note: "Scheduled in this scope",
    },
    {
      label: "Departures with blockers",
      count: data.affectedDepartures,
      note: `${data.issues} individual issues`,
      accent: true,
    },
    {
      label: "Departures due soon",
      count: data.dueSoon,
      note: "Within the next 120 minutes",
    },
    {
      label: "Returns today",
      count: data.returns,
      note: "Secondary operational queue",
    },
  ];
  return (
    <section aria-label="Operational summary">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-card border bg-surface p-card">
            <p className="text-label text-muted-foreground">{c.label}</p>
            <p
              className={`mt-2 text-2xl font-semibold tabular-nums ${c.accent && c.count ? "text-danger-foreground" : "text-foreground"}`}
            >
              {c.count}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{c.note}</p>
          </div>
        ))}
      </div>
      {result.isError && (
        <p role="status" className="mt-2 text-sm text-warning-foreground">
          Refresh failed · showing stale summary.{" "}
          <button className="underline" onClick={() => void result.refetch()}>
            Retry
          </button>
        </p>
      )}
    </section>
  );
}
