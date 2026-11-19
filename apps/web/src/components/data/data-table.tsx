"use client";

import * as React from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface ActiveFilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

/** Shared DriveCore data card + filter toolbar + active chip strip for Demo & Live tables. */
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
        "dc-shadow-card overflow-hidden rounded-2xl border bg-surface",
        className,
      )}
    >
      {toolbar ? (
        <div className="space-y-3 border-b bg-muted/20 p-card">
          {toolbar}
          {chips.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <SlidersHorizontal className="size-3" aria-hidden="true" />
                Active filters:
              </span>
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.onRemove}
                  className="inline-flex items-center gap-1 rounded-full border bg-surface px-2.5 py-0.5 text-xs font-medium text-foreground transition-colors hover:border-primary/60 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <span>{chip.label}</span>
                  <X className="size-3 text-muted-foreground" aria-hidden="true" />
                </button>
              ))}
              {onClearAll ? (
                <button
                  type="button"
                  onClick={onClearAll}
                  className="text-xs font-semibold text-link hover:text-link-hover hover:underline"
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/15 px-card py-3.5 text-label text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

/** Shared search bar with crisp leading icon and Submit trigger. */
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
      <label className="min-w-0 flex-1 space-y-1.5 text-label font-semibold">
        {label}
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
            className="rounded-xl pl-9"
          />
        </div>
      </label>
      <Button type="submit" variant="outline" className="rounded-xl">
        Search
      </Button>
    </form>
  );
}
