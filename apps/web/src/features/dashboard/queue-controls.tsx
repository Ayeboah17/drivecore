"use client";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
export function Pagination({
  label,
  page,
  total,
  pageSize,
  onPage,
}: {
  label: string;
  page: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav
      aria-label={`${label} pagination`}
      className="flex flex-wrap items-center justify-between gap-3 border-t px-card py-3"
    >
      <span className="text-label text-muted-foreground">
        {total} {label.toLowerCase()} · Page {page} of {pages}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label={`Previous ${label.toLowerCase()} page`}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          aria-label={`Next ${label.toLowerCase()} page`}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
export function NativeFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex w-full min-w-0 flex-col gap-1 text-label sm:w-auto text-muted-foreground">
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-control min-w-0 rounded-control border border-input bg-surface px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function QueueSearch({
  query,
  onChange,
}: {
  query: string;
  onChange: (value: string) => void;
}) {
  const [value, setValue] = useState(query);
  const [previous, setPrevious] = useState(query);
  if (query !== previous) {
    setPrevious(query);
    setValue(query);
  }
  useEffect(() => {
    if (value === query) return;
    const timer = setTimeout(() => onChange(value), 200);
    return () => clearTimeout(timer);
  }, [value, query, onChange]);
  return (
    <label className="flex w-full min-w-0 flex-1 flex-col gap-1 text-label sm:w-auto sm:min-w-[180px] text-muted-foreground">
      Find in departures
      <Input
        aria-label="Find in departures"
        className="min-w-0"
        placeholder="Booking reference or registration"
        value={value}
        maxLength={100}
        onChange={(e) => setValue(e.target.value)}
      />
    </label>
  );
}
