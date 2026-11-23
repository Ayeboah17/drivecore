"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { SortDirection } from "@/lib/table-sort";
import { cn } from "@/lib/utils";

export interface ActiveFilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

/** Shared DriveCore data frame with calm hairline toolbar, nested-radius chips, and pagination footer. */
export function DataTableFrame({
  ariaLabel,
  toolbar,
  chips = [],
  onClearAll,
  footer,
  children,
  className,
}: {
  ariaLabel: string;
  toolbar?: React.ReactNode;
  chips?: readonly ActiveFilterChip[];
  onClearAll?: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={ariaLabel}
      className={cn(
        "dc-shadow-card overflow-hidden rounded-2xl border border-border/80 bg-surface",
        className,
      )}
    >
      {toolbar ? (
        <div className="space-y-3 border-b border-border/70 bg-muted/20 px-4 py-4 sm:px-5">
          {toolbar}
          {chips.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <SlidersHorizontal className="size-3.5" aria-hidden="true" />
                Active filters
              </span>
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.onRemove}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-surface px-2.5 py-1 text-xs font-medium text-foreground transition-[background-color,border-color,transform] duration-150 ease-out hover:border-foreground/25 hover:bg-muted/50 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <span>{chip.label}</span>
                  <X
                    className="size-3 text-muted-foreground"
                    aria-hidden="true"
                  />
                </button>
              ))}
              {onClearAll ? (
                <button
                  type="button"
                  onClick={onClearAll}
                  className="px-1 text-xs font-medium text-link transition-colors duration-150 hover:text-link-hover hover:underline"
                >
                  Clear all
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {children}
      {footer ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 bg-muted/15 px-4 py-3 text-xs text-muted-foreground sm:px-5">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

/** Shared search bar with quiet leading icon and tactile Submit button. */
export function DataSearchForm({
  label,
  placeholder,
  defaultValue,
  formKey,
  onSubmitQuery,
}: {
  label: string;
  placeholder: string;
  defaultValue: string;
  formKey: string;
  onSubmitQuery: (query: string) => void;
}) {
  return (
    <form
      key={formKey}
      className="flex min-w-0 flex-1 items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onSubmitQuery(String(data.get("query") ?? ""));
      }}
    >
      <label className="min-w-0 flex-1 space-y-1.5 text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            name="query"
            type="search"
            defaultValue={defaultValue}
            placeholder={placeholder}
            className="rounded-xl bg-surface pl-9 text-foreground"
          />
        </div>
      </label>
      <Button
        type="submit"
        variant="outline"
        className="rounded-xl transition-transform duration-150 ease-out active:scale-[0.98]"
      >
        Search
      </Button>
    </form>
  );
}

/** Semantic responsive table wrapper with smooth horizontal overflow. */
export function DataTable({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table
        className={cn(
          "w-full border-collapse text-left text-sm text-foreground",
          className,
        )}
      >
        {children}
      </table>
    </div>
  );
}

/** Calm sentence-case table header band with hairline bottom border. */
export function DataTableHead({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <thead
      className={cn(
        "border-b border-border/70 bg-muted/30 text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </thead>
  );
}

export function DataTableHeaderCell({
  children,
  align = "left",
  sortKey,
  activeSort,
  activeDir,
  onSort,
  className,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  sortKey?: string;
  activeSort?: string;
  activeDir?: SortDirection | "";
  onSort?: (key: string) => void;
  className?: string;
}) {
  const sortable = Boolean(sortKey && onSort);
  const isActive = sortable && activeSort === sortKey && Boolean(activeDir);
  const ariaSort = sortable
    ? isActive
      ? activeDir === "desc"
        ? "descending"
        : "ascending"
      : "none"
    : undefined;

  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={cn(
        "px-4 py-3 font-medium whitespace-nowrap first:pl-5 last:pr-5",
        align === "right" && "text-right",
        className,
      )}
    >
      {sortable && sortKey && onSort ? (
        <button
          type="button"
          onClick={() => onSort(sortKey)}
          className={cn(
            "group/sort inline-flex items-center gap-1.5 rounded-md py-0.5 font-medium transition-colors duration-150 ease-out hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
            align === "right" && "ml-auto flex-row-reverse",
            isActive ? "text-foreground" : "text-muted-foreground",
          )}
        >
          <span>{children}</span>
          {isActive ? (
            activeDir === "desc" ? (
              <ArrowDown
                className="size-3.5 shrink-0 text-link"
                aria-hidden="true"
              />
            ) : (
              <ArrowUp
                className="size-3.5 shrink-0 text-link"
                aria-hidden="true"
              />
            )
          ) : (
            <ArrowUpDown
              className="size-3.5 shrink-0 opacity-40 transition-opacity duration-150 group-hover/sort:opacity-100"
              aria-hidden="true"
            />
          )}
        </button>
      ) : (
        children
      )}
    </th>
  );
}

export function DataTableBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <tbody className={cn("divide-y divide-border/60", className)}>
      {children}
    </tbody>
  );
}

export function DataTableRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <tr
      className={cn(
        "group transition-colors duration-150 ease-out hover:bg-muted/35 focus-within:bg-muted/35",
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function DataTableCell({
  children,
  align = "left",
  numeric = false,
  className,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  numeric?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "px-4 py-3.5 align-middle first:pl-5 last:pr-5",
        align === "right" && "text-right",
        numeric && "font-mono text-xs tabular-nums",
        className,
      )}
    >
      {children}
    </td>
  );
}

/** DriveCore's signature framed registration plate chip. */
export function PlateTag({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-md border border-border/80 bg-muted/50 px-2 py-0.5 font-mono text-xs font-semibold tracking-wide text-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

export type StatusDotTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

const DOT_TONES: Record<
  StatusDotTone,
  { pill: string; dot: string }
> = {
  success: {
    pill: "border-success/30 bg-success/10 text-success-foreground",
    dot: "bg-success",
  },
  warning: {
    pill: "border-warning/35 bg-warning/10 text-warning-foreground",
    dot: "bg-warning",
  },
  danger: {
    pill: "border-danger/30 bg-danger/10 text-danger-foreground",
    dot: "bg-danger",
  },
  info: {
    pill: "border-link/30 bg-link/10 text-link",
    dot: "bg-link",
  },
  neutral: {
    pill: "border-border/80 bg-muted/40 text-muted-foreground",
    dot: "bg-muted-foreground/70",
  },
};

/** Quiet semantic status pill with a 6px status dot for instant scannability. */
export function StatusDotBadge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: StatusDotTone;
  children: React.ReactNode;
  className?: string;
}) {
  const styles = DOT_TONES[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        styles.pill,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 shrink-0 rounded-full", styles.dot)}
      />
      <span>{children}</span>
    </span>
  );
}

/** Column-matched skeleton table rows so loading states preserve exact layout geometry. */
export function DataTableSkeleton({
  columns,
  rows = 4,
  label = "Loading records…",
}: {
  columns: number;
  rows?: number;
  label?: string;
}) {
  return (
    <div role="status" aria-label={label} className="overflow-x-auto">
      <p className="sr-only">{label}</p>
      <table className="w-full border-collapse text-left">
        <thead className="border-b border-border/70 bg-muted/30">
          <tr>
            {Array.from({ length: columns }).map((_, colIdx) => (
              <th
                key={colIdx}
                className="px-4 py-3 first:pl-5 last:pr-5"
              >
                <Skeleton className="h-3.5 w-16 rounded" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr key={rowIdx}>
              {Array.from({ length: columns }).map((__, colIdx) => (
                <td
                  key={colIdx}
                  className="px-4 py-3.5 first:pl-5 last:pr-5"
                >
                  <Skeleton
                    className={cn(
                      "h-4 rounded-md",
                      colIdx === 0
                        ? "w-28"
                        : colIdx === columns - 1
                          ? "ml-auto w-14"
                          : "w-24",
                    )}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
