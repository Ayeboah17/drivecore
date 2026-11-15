import Link from "next/link";
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
import { formatTime } from "@/lib/time/company-time";
import { Pagination } from "./queue-controls";
import type { ReturnQueueItem } from "./models";
import type { PageResult } from "@/lib/data/models";
interface Props {
  data?: PageResult<ReturnQueueItem>;
  pending: boolean;
  error: boolean;
  timezone: string;
  onRetry: () => void;
  onPage: (page: number) => void;
  departureHref: (id: string) => string;
}
export function ReturnsQueue({
  data,
  pending,
  error,
  timezone,
  onRetry,
  onPage,
  departureHref,
}: Props) {
  if (pending)
    return (
      <div role="status" aria-label="Loading returns" className="p-card">
        <Skeleton className="h-36" />
      </div>
    );
  if (!data)
    return (
      <div className="p-card">
        <StatePanel title="Returns unavailable" onRetry={onRetry}>
          Departures remain available while this queue is retried.
        </StatePanel>
      </div>
    );
  if (!data.items.length)
    return (
      <div className="p-card">
        <StatePanel title="No returns today">
          No mock returns are scheduled in this scope today.
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
          Refresh failed · showing stale returns.{" "}
          <button className="underline" onClick={onRetry}>
            Retry
          </button>
        </p>
      )}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-card">Return</TableHead>
              <TableHead>Vehicle / branch</TableHead>
              <TableHead>Related departure</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="pl-card font-medium">
                  {item.reference}
                </TableCell>
                <TableCell className="py-3">
                  {item.vehicle}
                  <p className="text-label text-muted-foreground">
                    {item.branchName}
                  </p>
                </TableCell>
                <TableCell>
                  {item.relatedDepartureId ? (
                    <Link
                      className="rounded-sm text-link hover:text-link-hover hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                      href={departureHref(item.relatedDepartureId)}
                    >
                      {item.relatedDepartureReference}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">None recorded</span>
                  )}
                </TableCell>
                <TableCell className="pr-card tabular-nums">
                  <time dateTime={item.scheduledAt}>
                    {formatTime(item.scheduledAt, timezone)}
                  </time>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul aria-label="Return records" className="divide-y md:hidden">
        {data.items.map((item) => (
          <li key={item.id} className="space-y-2 p-card">
            <div className="flex justify-between gap-2">
              <span className="font-medium">{item.reference}</span>
              <time dateTime={item.scheduledAt}>
                {formatTime(item.scheduledAt, timezone)}
              </time>
            </div>
            <p className="text-label text-muted-foreground">
              {item.vehicle} · {item.branchName}
            </p>
            {item.relatedDepartureId && (
              <Link
                className="text-link hover:text-link-hover underline"
                href={departureHref(item.relatedDepartureId)}
              >
                Related departure {item.relatedDepartureReference}
              </Link>
            )}
          </li>
        ))}
      </ul>
      <Pagination
        label="Returns"
        page={data.page}
        total={data.total}
        pageSize={data.pageSize}
        onPage={onPage}
      />
      <p className="px-card pb-3 text-[11px] text-muted-foreground">
        Relationships are mock-provided; availability and turnaround are not
        calculated
      </p>
    </>
  );
}
