export class DataAccessError extends Error {
  constructor(
    public readonly kind: "denied" | "unavailable" | "request",
    message: string,
  ) {
    super(message);
    this.name = "DataAccessError";
  }
}
export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  retrievedAt: string;
}
export function isCancellation(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}
