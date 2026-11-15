import Link from "next/link";
import { ArrowUpRight, CircleAlert } from "lucide-react";
import {
  Table,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
  TableHeader,
} from "@/components/ui/table";
import { StatePanel } from "@/components/layout/state-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "./queue-controls";
import { formatTime } from "@/lib/time/company-time";
import type { DepartureQueueItem } from "./models";
import type { PageResult } from "@/lib/data/models";
export function BlockerLinks({
  item,
  blockerHref,
}: {
  item: DepartureQueueItem;
  blockerHref: (id: string) => string;
}) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      {item.blockers.length ? (
        item.blockers.map((b) => (
          <Link
            key={b.id}
            href={blockerHref(b.id)}
            className="max-w-full rounded-sm text-[13px] leading-5 text-link underline-offset-4 hover:text-link-hover hover:underline focus-visible:outline-2 focus-visible:outline-ring"
          >
            <span className={b.tone === "danger" ? "text-danger-foreground" : "text-warning-foreground"}>
              <CircleAlert className="mr-1 inline size-3.5" aria-hidden="true" />
              {b.severity}:{" "}
            </span>
            {b.description}
          </Link>
        ))
      ) : (
        <span className="text-label text-muted-foreground">
          No mock issues recorded
        </span>
      )}
    </div>
  );
}
interface Props {
  data?: PageResult<DepartureQueueItem>;
  pending: boolean;
  error: boolean;
  filtered: boolean;
  timezone: string;
  onRetry: () => void;
  onClear: () => void;
  onPage: (page: number) => void;
  departureHref: (id: string) => string;
  blockerHref: (id: string) => string;
}
export function DeparturesQueue({
  data,
  pending,
  error,
  filtered,
  timezone,
  onRetry,
  onClear,
  onPage,
  departureHref,
  blockerHref,
}: Props) {
  if (pending)
    return (
      <div
        className="space-y-3 p-card"
        role="status"
        aria-label="Loading departures"
      >
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    );
  if (!data)
    return (
      <div className="p-card">
        <StatePanel title="Departures unavailable" onRetry={onRetry}>
          The primary queue could not load. Try again.
        </StatePanel>
      </div>
    );
  if (!data.items.length)
    return (
      <div className="p-card">
        <StatePanel
          title={filtered ? "No matching departures" : "No departures today"}
        >
          {filtered ? (
            <p>
              Try a different filter.{" "}
              <button className="text-link hover:text-link-hover underline" onClick={onClear}>
                Clear departure filters
              </button>
            </p>
          ) : (
            "There are no mock departures scheduled for this scope today."
          )}
        </StatePanel>
      </div>
    );
  return (
    <>
      {error && (
        <p
          role="status"
          className="px-card pt-3 text-sm text-warning-foreground"
        >
          Refresh failed · showing stale departures.{" "}
          <button className="underline" onClick={onRetry}>
            Retry
          </button>
        </p>
      )}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-card">Departure</TableHead>
              <TableHead>Vehicle / branch</TableHead>
              <TableHead>Preparation / blockers</TableHead>
              <TableHead className="pr-card">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((item) => (
              <TableRow key={item.id} data-testid={`departure-${item.id}`}>
                <TableCell className="py-4 pl-card align-top">
                  <Link
                    href={departureHref(item.id)}
                    className="inline-flex items-center gap-1 rounded-sm font-medium text-link hover:text-link-hover underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {item.bookingReference}
                    <ArrowUpRight className="size-3" aria-hidden="true" />
                  </Link>
                  <p className="mt-1 text-label text-muted-foreground">
                    {item.displayStatus}
                  </p>
                </TableCell>
                <TableCell className="py-4 align-top">
                  <span
                    className={item.vehicle ? "" : "text-danger-foreground"}
                  >
                    {item.vehicle ?? "Not allocated"}
                  </span>
                  <p className="mt-1 text-label text-muted-foreground">
                    {item.branchName}
                  </p>
                </TableCell>
                <TableCell className="max-w-[360px] py-4 align-top whitespace-normal">
                  <BlockerLinks item={item} blockerHref={blockerHref} />
                </TableCell>
                <TableCell className="py-4 pr-card align-top tabular-nums">
                  <time dateTime={item.scheduledAt}>
                    {formatTime(item.scheduledAt, timezone)}
                  </time>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="divide-y md:hidden" aria-label="Departure records">
        {data.items.map((item) => (
          <li key={item.id} className="space-y-3 p-card">
            <div className="flex items-start justify-between gap-2">
              <Link
                href={departureHref(item.id)}
                className="rounded-sm font-medium text-link hover:text-link-hover underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
              >
                {item.bookingReference}
              </Link>
              <time className="tabular-nums" dateTime={item.scheduledAt}>
                {formatTime(item.scheduledAt, timezone)}
              </time>
            </div>
            <p className="text-label text-muted-foreground">
              {item.branchName} · {item.vehicle ?? "Not allocated"}
              <br />
              {item.displayStatus}
            </p>
            <BlockerLinks item={item} blockerHref={blockerHref} />
          </li>
        ))}
      </ul>
      <Pagination
        label="Departures"
        page={data.page}
        total={data.total}
        pageSize={data.pageSize}
        onPage={onPage}
      />
      <p className="px-card pb-3 text-[11px] text-muted-foreground">
        Retrieved {formatTime(data.retrievedAt, timezone)} · Mock status labels
        are provisional
      </p>
    </>
  );
}
