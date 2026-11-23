"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import {
  MAX_VEHICLE_FUNCTIONS,
  MAX_VEHICLE_FUNCTION_LENGTH,
  canonicalVehicleFunctionKey,
  defaultVehicleFunctionSuggestions,
  formatVehicleFunction,
  mergeVehicleFunctions,
  normalizeVehicleFunction,
} from "@/lib/api/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Shared custom tag input with fleet-discovered & preset suggestions for Live and Demo modes. */
export function VehicleFunctionsInput({
  id,
  value,
  onChange,
  suggestions = [],
  draft: controlledDraft,
  onDraftChange,
  disabled = false,
  error,
  ariaDescribedBy,
}: {
  id?: string;
  value: readonly string[];
  onChange: (next: string[]) => void;
  suggestions?: readonly string[];
  draft?: string;
  onDraftChange?: (next: string) => void;
  disabled?: boolean;
  error?: string;
  ariaDescribedBy?: string;
}) {
  const [internalDraft, setInternalDraft] = useState("");
  const [localError, setLocalError] = useState("");

  const draft = controlledDraft !== undefined ? controlledDraft : internalDraft;
  const setDraft = (next: string) => {
    if (onDraftChange) onDraftChange(next);
    else setInternalDraft(next);
  };

  function commitRaw(raw: string) {
    const { next, error: mergeError } = mergeVehicleFunctions(value, raw);
    setLocalError(mergeError ?? "");
    if (next.length !== value.length) {
      onChange(next);
    }
    if (!mergeError) setDraft("");
  }

  function removeAt(index: number) {
    setLocalError("");
    onChange(value.filter((_, idx) => idx !== index));
  }

  const selectedKeys = new Set(
    value.map((item) => canonicalVehicleFunctionKey(item)),
  );
  const availableSuggestions: string[] = [];
  const seenSuggestions = new Set<string>();
  for (const raw of [...suggestions, ...defaultVehicleFunctionSuggestions]) {
    const label = formatVehicleFunction(raw);
    const key = canonicalVehicleFunctionKey(label);
    if (!label || selectedKeys.has(key) || seenSuggestions.has(key)) continue;
    seenSuggestions.add(key);
    availableSuggestions.push(label);
  }

  const atLimit = value.length >= MAX_VEHICLE_FUNCTIONS;
  const shownError = error || localError;

  return (
    <div
      id={id}
      aria-describedby={ariaDescribedBy}
      className="space-y-3 rounded-xl border bg-muted/20 p-3"
    >
      {/* Attached custom & preset function tags */}
      <div className="flex flex-wrap items-center gap-2">
        {value.length === 0 ? (
          <span className="text-xs text-muted-foreground">
            No functions added yet. Type a custom function below or pick a
            suggestion.
          </span>
        ) : (
          value.map((item, index) => {
            const label = formatVehicleFunction(item);
            return (
              <span
                key={`${canonicalVehicleFunctionKey(item)}-${index}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-structural px-3 py-1 text-xs font-semibold text-structural-foreground shadow-2xs"
              >
                <span>{label}</span>
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={`Remove ${label}`}
                  onClick={() => removeAt(index)}
                  className="rounded-full p-0.5 transition-colors hover:bg-surface/20 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </span>
            );
          })
        )}
        <span className="ml-auto font-mono text-[11px] text-muted-foreground tabular-nums">
          {value.length} / {MAX_VEHICLE_FUNCTIONS}
        </span>
      </div>

      {/* Free-form custom tag composer */}
      <div className="flex gap-2">
        <Input
          type="text"
          value={draft}
          disabled={disabled || atLimit}
          maxLength={MAX_VEHICLE_FUNCTION_LENGTH}
          aria-label="Add custom vehicle function"
          placeholder={
            atLimit
              ? `Maximum ${MAX_VEHICLE_FUNCTIONS} functions reached`
              : "Add custom function (e.g. Roof Rack, VIP Chauffeur)…"
          }
          onChange={(event) => {
            const next = event.target.value;
            setLocalError("");
            if (next.includes(",")) {
              commitRaw(next);
            } else {
              setDraft(next);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (normalizeVehicleFunction(draft)) {
                commitRaw(draft);
              }
            } else if (
              event.key === "Backspace" &&
              draft === "" &&
              value.length > 0
            ) {
              removeAt(value.length - 1);
            }
          }}
          className="rounded-xl bg-surface text-sm"
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled || atLimit || !normalizeVehicleFunction(draft)}
          onClick={() => commitRaw(draft)}
          className="shrink-0 gap-1 rounded-xl"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Add
        </Button>
      </div>

      {/* Quick-add fleet-discovered + starter suggestions */}
      {availableSuggestions.length > 0 && !atLimit ? (
        <div className="space-y-1.5">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Suggestions
          </p>
          <div className="flex flex-wrap gap-1.5">
            {availableSuggestions.slice(0, 12).map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                disabled={disabled}
                onClick={() => commitRaw(suggestion)}
                className="inline-flex items-center gap-1 rounded-full border bg-surface px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/60 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
              >
                <Plus className="size-3 text-muted-foreground" aria-hidden="true" />
                <span>{suggestion}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {shownError ? (
        <p role="alert" className="text-xs text-danger-foreground">
          {shownError}
        </p>
      ) : null}
    </div>
  );
}
