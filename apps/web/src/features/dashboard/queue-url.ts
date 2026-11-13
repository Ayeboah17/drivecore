import type { DepartureQueueInput, ReturnQueueInput } from "./models";
function page(value: string | null) {
  return value && /^[1-9]\d{0,5}$/.test(value) ? Number(value) : 1;
}
export function parseQueueState(params: URLSearchParams): {
  departures: DepartureQueueInput;
  returns: ReturnQueueInput;
} {
  const filter = params.get("depFilter");
  const sort = params.get("depSort");
  return {
    departures: {
      filter:
        filter === "blocked" || filter === "soon" || filter === "earlier"
          ? filter
          : "all",
      sort: sort === "time" ? "time" : "priority",
      query: (params.get("depQuery") ?? "").slice(0, 100),
      page: page(params.get("depPage")),
      pageSize: 10,
    },
    returns: {
      sort: params.get("retSort") === "time-desc" ? "time-desc" : "time",
      page: page(params.get("retPage")),
      pageSize: 10,
    },
  };
}
