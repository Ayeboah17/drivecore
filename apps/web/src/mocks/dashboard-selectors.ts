import type {
  DepartureQueueInput,
  DepartureQueueItem,
  ReturnQueueItem,
  ReturnQueueInput,
} from "../features/dashboard/models";
import { companyDate, isDueSoon, timeBand } from "../lib/time/company-time";
import type { PageResult } from "../lib/data/models";
export function today<T extends { scheduledAt: string }>(
  items: T[],
  now: string,
  timezone: string,
) {
  return items.filter(
    (i) => companyDate(i.scheduledAt, timezone) === companyDate(now, timezone),
  );
}
export function paginate<T>(
  items: T[],
  requestedPage: number,
  pageSize: number,
): PageResult<T> {
  const page = Math.min(
    Math.max(1, requestedPage),
    Math.max(1, Math.ceil(items.length / pageSize)),
  );
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    total: items.length,
    page,
    pageSize,
    retrievedAt: new Date().toISOString(),
  };
}
export function selectDepartures(
  items: DepartureQueueItem[],
  input: DepartureQueueInput,
  now: string,
) {
  const query = input.query.trim().toLowerCase();
  const filtered = items.filter(
    (i) =>
      (!query ||
        `${i.bookingReference} ${i.vehicle ?? ""}`
          .toLowerCase()
          .includes(query)) &&
      (input.filter === "all" ||
        (input.filter === "blocked" && i.blockers.length > 0) ||
        (input.filter === "soon" && isDueSoon(i.scheduledAt, now)) ||
        (input.filter === "earlier" && timeBand(i, now) === 0)),
  );
  filtered.sort(
    (a, b) =>
      (input.sort === "priority"
        ? timeBand(a, now) - timeBand(b, now) || a.priority - b.priority
        : 0) ||
      Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt) ||
      a.id.localeCompare(b.id),
  );
  return paginate(filtered, input.page, input.pageSize);
}
export function selectReturns(
  items: ReturnQueueItem[],
  input: ReturnQueueInput,
) {
  return paginate(
    [...items].sort(
      (a, b) =>
        (Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt)) *
          (input.sort === "time-desc" ? -1 : 1) || a.id.localeCompare(b.id),
    ),
    input.page,
    input.pageSize,
  );
}
