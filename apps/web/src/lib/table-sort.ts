export type SortDirection = "asc" | "desc";

export type SortableValue = string | number | boolean | null | undefined;

/** 3-state sort cycle: none -> asc -> desc -> none (new column starts at asc). */
export function nextSortState(
  currentSort: string,
  currentDir: SortDirection | "",
  clickedKey: string,
): { sort: string; dir: SortDirection | "" } {
  if (currentSort !== clickedKey) {
    return { sort: clickedKey, dir: "asc" };
  }
  if (currentDir === "asc") {
    return { sort: clickedKey, dir: "desc" };
  }
  return { sort: "", dir: "" };
}

/** Validates URL sort/dir parameters against an explicit per-table column allowlist. */
export function parseSortParams<K extends string>(
  rawSort: string | null | undefined,
  rawDir: string | null | undefined,
  allowed: readonly K[],
): { sort: K | ""; dir: SortDirection | "" } {
  if (!rawSort || !allowed.includes(rawSort as K)) {
    return { sort: "", dir: "" };
  }
  const dir: SortDirection = rawDir === "desc" ? "desc" : "asc";
  return { sort: rawSort as K, dir };
}

function isEmptySortValue(value: SortableValue): boolean {
  return value === null || value === undefined || value === "";
}

/**
 * Deterministic client-side sort (nulls/empty strings always sort last regardless of direction).
 * Used as an immediate fallback alongside server-side ?sort=&dir= ordering.
 */
export function sortRows<T>(
  items: readonly T[],
  sortKey: string,
  dir: SortDirection | "",
  accessors: Record<string, (row: T) => SortableValue>,
): T[] {
  if (!sortKey || !dir) return [...items];
  const accessor = accessors[sortKey];
  if (!accessor) return [...items];

  const multiplier = dir === "desc" ? -1 : 1;
  return items
    .map((item, index) => ({ item, index, value: accessor(item) }))
    .sort((a, b) => {
      const aEmpty = isEmptySortValue(a.value);
      const bEmpty = isEmptySortValue(b.value);
      if (aEmpty && bEmpty) return a.index - b.index;
      if (aEmpty) return 1;
      if (bEmpty) return -1;

      let cmp = 0;
      if (typeof a.value === "number" && typeof b.value === "number") {
        cmp = a.value - b.value;
      } else if (typeof a.value === "boolean" && typeof b.value === "boolean") {
        cmp = Number(a.value) - Number(b.value);
      } else {
        cmp = String(a.value).localeCompare(String(b.value), undefined, {
          numeric: true,
          sensitivity: "base",
        });
      }
      if (cmp !== 0) return cmp * multiplier;
      return a.index - b.index;
    })
    .map((entry) => entry.item);
}
