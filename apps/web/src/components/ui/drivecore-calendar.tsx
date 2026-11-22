"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DriveCoreSelect } from "./drivecore-select";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const HOURS = Array.from({ length: 24 }, (_, i) => {
  const v = String(i).padStart(2, "0");
  return { value: v, label: `${v}:00`.slice(0, 2) };
});
const MINUTES = ["00", "15", "30", "45"].map((m) => ({ value: m, label: m }));

function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseIsoDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, day] = value.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  return Number.isFinite(d.getTime()) ? d : null;
}

function formatDayShort(value: string) {
  const d = parseIsoDay(value);
  if (!d) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** Custom calendar month grid reused across date-range and date-time pickers. */
function CalendarGrid({
  cursor,
  onCursor,
  selectedStart,
  selectedEnd,
  onSelectDay,
}: {
  cursor: Date;
  onCursor: (next: Date) => void;
  selectedStart: string;
  selectedEnd?: string;
  onSelectDay: (day: string) => void;
}) {
  const cells = useMemo(
    () => monthGrid(cursor.getFullYear(), cursor.getMonth()),
    [cursor],
  );
  const title = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(cursor);
  const today = isoDay(new Date());

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Previous month"
          className="size-8 rounded-xl"
          onClick={() =>
            onCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
          }
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
        <span className="text-sm font-bold tracking-tight">{title}</span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Next month"
          className="size-8 rounded-xl"
          onClick={() =>
            onCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
          }
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="py-1 font-mono text-[10px] font-semibold uppercase text-muted-foreground"
          >
            {w}
          </div>
        ))}
        {cells.map((cell, index) => {
          if (!cell) return <div key={`blank-${index}`} />;
          const key = isoDay(cell);
          const isStart = key === selectedStart;
          const isEnd = selectedEnd ? key === selectedEnd : false;
          const inRange =
            !!selectedStart &&
            !!selectedEnd &&
            key > selectedStart &&
            key < selectedEnd;
          const isToday = key === today;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDay(key)}
              aria-label={formatDayShort(key)}
              aria-pressed={isStart || isEnd}
              className={cn(
                "flex h-9 items-center justify-center rounded-xl font-mono text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                isStart || isEnd
                  ? "bg-primary font-bold text-primary-foreground shadow-2xs"
                  : inRange
                    ? "bg-accent text-accent-foreground"
                    : isToday
                      ? "border border-primary/50 text-foreground hover:bg-muted"
                      : "text-foreground hover:bg-muted",
              )}
            >
              {cell.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Custom modal date-range selector replacing HTML5 <input type="date"> controls. */
export function DriveCoreDateRangePicker({
  from,
  to,
  onChange,
  className,
}: {
  from: string;
  to: string;
  onChange: (next: { from: string; to: string }) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [cursor, setCursor] = useState(
    () => parseIsoDay(from) ?? new Date(),
  );

  function openModal() {
    setDraftFrom(from);
    setDraftTo(to);
    setCursor(parseIsoDay(from) ?? new Date());
    setOpen(true);
  }

  function handleDay(day: string) {
    if (!draftFrom || (draftFrom && draftTo)) {
      setDraftFrom(day);
      setDraftTo("");
      return;
    }
    if (day < draftFrom) {
      setDraftTo(draftFrom);
      setDraftFrom(day);
      return;
    }
    setDraftTo(day);
  }

  function applyPreset(daysBack: number | "month") {
    const end = new Date();
    const start =
      daysBack === "month"
        ? new Date(end.getFullYear(), end.getMonth(), 1)
        : new Date(end.getTime() - daysBack * 86400000);
    setDraftFrom(isoDay(start));
    setDraftTo(isoDay(end));
    setCursor(start);
  }

  const label =
    from || to
      ? `${from ? formatDayShort(from) : "Start"} – ${to ? formatDayShort(to) : "Today"}`
      : "All dates";

  return (
    <>
      <div className={cn("inline-flex items-center gap-1.5", className)}>
        <Button
          type="button"
          variant="outline"
          onClick={openModal}
          aria-label="Select date range"
          className="h-control gap-2 rounded-xl bg-surface px-3 text-xs font-medium"
        >
          <CalendarIcon
            className="size-3.5 text-link"
            aria-hidden="true"
          />
          <span className="font-mono">{label}</span>
        </Button>
        {from || to ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Clear dates"
            onClick={() => onChange({ from: "", to: "" })}
            className="size-9 rounded-xl"
          >
            <X className="size-3.5" aria-hidden="true" />
          </Button>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-2xl p-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="size-4 text-link" aria-hidden="true" />
              Filter Date Range
            </DialogTitle>
            <DialogDescription>
              Pick start and end dates or choose a preset window.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-xl text-xs"
              onClick={() => applyPreset(0)}
            >
              Today
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-xl text-xs"
              onClick={() => applyPreset(6)}
            >
              Last 7 days
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-xl text-xs"
              onClick={() => applyPreset("month")}
            >
              This month
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-xl text-xs"
              onClick={() => applyPreset(29)}
            >
              Last 30 days
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-xl text-xs"
              onClick={() => applyPreset(89)}
            >
              Last 90 days
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-xl border bg-muted/40 p-2.5 text-xs">
            <div>
              <span className="text-muted-foreground">From</span>
              <p className="font-mono font-semibold">
                {draftFrom ? formatDayShort(draftFrom) : "Any date"}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">To</span>
              <p className="font-mono font-semibold">
                {draftTo ? formatDayShort(draftTo) : "Any date"}
              </p>
            </div>
          </div>

          <CalendarGrid
            cursor={cursor}
            onCursor={setCursor}
            selectedStart={draftFrom}
            selectedEnd={draftTo}
            onSelectDay={handleDay}
          />

          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setDraftFrom("");
                setDraftTo("");
                onChange({ from: "", to: "" });
                setOpen(false);
              }}
            >
              Clear dates
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onChange({ from: draftFrom, to: draftTo || draftFrom });
                  setOpen(false);
                }}
              >
                Apply range
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Custom modal calendar + time selector replacing HTML5 <input type="datetime-local">. */
export function DriveCoreDateTimeField({
  id,
  label,
  value,
  onChange,
  optional = false,
  ariaInvalid,
  ariaDescribedBy,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  optional?: boolean;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
}) {
  const [open, setOpen] = useState(false);
  const [datePart, timePart] = (value ?? "").split("T");
  const [draftDate, setDraftDate] = useState(datePart || isoDay(new Date()));
  const [draftHour, setDraftHour] = useState(
    (timePart ?? "09:00").slice(0, 2) || "09",
  );
  const [draftMinute, setDraftMinute] = useState(() => {
    const raw = (timePart ?? "09:00").slice(3, 5) || "00";
    return ["00", "15", "30", "45"].includes(raw) ? raw : "00";
  });
  const [cursor, setCursor] = useState(
    () => parseIsoDay(datePart ?? "") ?? new Date(),
  );

  function openPicker() {
    const [d, t] = (value ?? "").split("T");
    const fallback = isoDay(new Date());
    setDraftDate(d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : fallback);
    const hh = (t ?? "").slice(0, 2);
    const mm = (t ?? "").slice(3, 5);
    setDraftHour(/^\d{2}$/.test(hh) ? hh : "09");
    setDraftMinute(["00", "15", "30", "45"].includes(mm) ? mm : "00");
    setCursor(parseIsoDay(d ?? "") ?? new Date());
    setOpen(true);
  }

  const formatted = useMemo(() => {
    if (!value) return "Select date & time";
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(parsed);
  }, [value]);

  return (
    <>
      <div className="flex items-center gap-1.5">
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          onClick={openPicker}
          className={cn(
            "h-control min-w-0 flex-1 justify-start gap-2 rounded-xl bg-surface px-3 font-mono text-xs font-medium",
            !value && "text-muted-foreground",
            ariaInvalid && "border-destructive",
          )}
        >
          <CalendarIcon
            className="size-3.5 shrink-0 text-link"
            aria-hidden="true"
          />
          <span className="truncate">{formatted}</span>
        </Button>
        {optional && value ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Clear ${label}`}
            onClick={() => onChange("")}
            className="size-9 shrink-0 rounded-xl"
          >
            <X className="size-3.5" aria-hidden="true" />
          </Button>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-2xl p-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="size-4 text-link" aria-hidden="true" />
              {label}
            </DialogTitle>
            <DialogDescription>
              Choose a date and time for this record.
            </DialogDescription>
          </DialogHeader>

          <CalendarGrid
            cursor={cursor}
            onCursor={setCursor}
            selectedStart={draftDate}
            onSelectDay={setDraftDate}
          />

          <div className="grid grid-cols-2 gap-3 border-t pt-3">
            <div className="space-y-1">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Clock className="size-3.5" aria-hidden="true" />
                Hour
              </span>
              <DriveCoreSelect
                ariaLabel="Hour"
                value={draftHour}
                onValueChange={setDraftHour}
                options={HOURS}
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">
                Minute
              </span>
              <DriveCoreSelect
                ariaLabel="Minute"
                value={draftMinute}
                onValueChange={setDraftMinute}
                options={MINUTES}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <div className="flex gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const n = new Date();
                  setDraftDate(isoDay(n));
                  setDraftHour(String(n.getHours()).padStart(2, "0"));
                  setDraftMinute("00");
                  setCursor(n);
                }}
              >
                Now
              </Button>
              {optional ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  Clear
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onChange(`${draftDate}T${draftHour}:${draftMinute}`);
                  setOpen(false);
                }}
              >
                Apply date & time
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Custom modal single-date selector replacing HTML5 <input type="date">. */
export function DriveCoreDateField({
  id,
  label,
  value,
  onChange,
  optional = false,
  disabled = false,
  placeholder,
  ariaInvalid,
  ariaDescribedBy,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  optional?: boolean;
  disabled?: boolean;
  placeholder?: string;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
}) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => parseIsoDay(value) ?? new Date());

  function openPicker() {
    if (disabled) return;
    setCursor(parseIsoDay(value) ?? new Date());
    setOpen(true);
  }

  function handleSelect(day: string) {
    onChange(day);
    setOpen(false);
  }

  const formatted = useMemo(() => {
    const parsed = parseIsoDay(value);
    if (!parsed) return placeholder ?? "Select date";
    return parsed.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [value, placeholder]);

  return (
    <>
      <div className="flex items-center gap-1.5">
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          onClick={openPicker}
          className={cn(
            "h-control min-w-0 flex-1 justify-start gap-2 rounded-xl bg-surface px-3 font-mono text-xs font-medium",
            !value && "text-muted-foreground",
            ariaInvalid && "border-destructive",
          )}
        >
          <CalendarIcon
            className="size-3.5 shrink-0 text-link"
            aria-hidden="true"
          />
          <span className="truncate">{formatted}</span>
        </Button>
        {optional && value && !disabled ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Clear ${label}`}
            onClick={() => onChange("")}
            className="size-9 shrink-0 rounded-xl"
          >
            <X className="size-3.5" aria-hidden="true" />
          </Button>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-2xl p-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="size-4 text-link" aria-hidden="true" />
              {label}
            </DialogTitle>
            <DialogDescription>
              Select a date from the calendar.
            </DialogDescription>
          </DialogHeader>

          <CalendarGrid
            cursor={cursor}
            onCursor={setCursor}
            selectedStart={value}
            onSelectDay={handleSelect}
          />

          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <div className="flex gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleSelect(isoDay(new Date()))}
              >
                Today
              </Button>
              {optional ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  Clear
                </Button>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
