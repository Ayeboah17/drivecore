export const scenarioOptions = [
  { id: "normal", label: "Normal data" },
  { id: "empty", label: "Empty queues" },
  { id: "slow", label: "Slow requests" },
  { id: "refresh-error", label: "Refresh fails after first load" },
  { id: "returns-error", label: "Returns fail" },
  { id: "departures-error", label: "Departures fail" },
  { id: "search-error", label: "Search fails" },
  { id: "unavailable", label: "Records unavailable" },
  { id: "access-lost", label: "Company access removed" },
] as const;
export type Scenario = (typeof scenarioOptions)[number]["id"];
export function waitForMock(signal?: AbortSignal, delay = 0): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Request cancelled", "AbortError"));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Request cancelled", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delay);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
