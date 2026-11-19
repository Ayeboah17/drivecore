"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface DriveCoreSelectOption {
  value: string;
  label: string;
  hint?: string;
}

const EMPTY_SENTINEL = "__drivecore_empty__";

/** Unified custom DriveCore select wrapping Base UI Select cleanly (supports empty value sentinel). */
export function DriveCoreSelect({
  id,
  name,
  ariaLabel,
  ariaInvalid,
  ariaDescribedBy,
  "aria-describedby": ariaDescribedByAttr,
  value,
  onValueChange,
  options,
  placeholder = "Select an option",
  disabled = false,
  className,
}: {
  id?: string;
  name?: string;
  ariaLabel?: string;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  "aria-describedby"?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly DriveCoreSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const internalValue = value === "" ? EMPTY_SENTINEL : value;
  const selected = options.find((opt) => opt.value === value);

  return (
    <>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <Select
        value={internalValue}
        disabled={disabled}
        onValueChange={(next) => {
          if (next === null) return;
          onValueChange(next === EMPTY_SENTINEL ? "" : next);
        }}
      >
        <SelectTrigger
          id={id}
          aria-label={ariaLabel}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy ?? ariaDescribedByAttr}
          className={cn(
            "h-control w-full min-w-0 rounded-xl border border-input bg-surface px-3 text-sm font-medium transition-colors hover:border-ring/60",
            className,
          )}
        >
          <SelectValue placeholder={placeholder}>
            {selected ? selected.label : placeholder}
          </SelectValue>
        </SelectTrigger>
        <SelectContent
          align="start"
          alignItemWithTrigger={false}
          className="min-w-(--anchor-width) rounded-2xl border p-1 shadow-lg"
        >
          {options.map((opt) => (
            <SelectItem
              key={opt.value === "" ? EMPTY_SENTINEL : opt.value}
              value={opt.value === "" ? EMPTY_SENTINEL : opt.value}
              className="rounded-xl py-2 pr-8 pl-2.5 text-sm"
            >
              <span className="flex flex-col">
                <span>{opt.label}</span>
                {opt.hint ? (
                  <span className="text-[11px] text-muted-foreground">
                    {opt.hint}
                  </span>
                ) : null}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
