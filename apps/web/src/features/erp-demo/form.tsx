"use client";

import { useId, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DriveCoreSelect } from "@/components/ui/drivecore-select";
import { DriveCoreDateTimeField } from "@/components/ui/drivecore-calendar";
import { VehicleFunctionsInput } from "@/components/ui/vehicle-functions-input";
import { mergeVehicleFunctions } from "@/lib/api/contracts";
import {
  DemoError,
  entities,
  valueOf,
  type Database,
  type DemoContext,
  type Entity,
  type Values,
} from "@/lib/demo/types";
import {
  inScope,
  branchOptions,
  allowed,
  kindModule,
  modules,
} from "@/lib/demo/permissions";
import { label, money } from "@/lib/demo/selectors";
import {
  companyDiscountThreshold,
  companyVatRate,
  computeFinancialTotals,
  rentalPrice,
  vehicleStatus,
} from "@/lib/demo/rules";
import { formSchema, type Field } from "./config";

export const selectClass =
  "h-control w-full min-w-0 rounded-xl border border-input bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring";

const moneyKeys = new Set([
  "dailyRate",
  "unitCost",
  "total",
  "amount",
  "labourCost",
  "additionalCharge",
]);

function localTime(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

function initial(
  db: Database,
  ctx: DemoContext,
  fields: Field[],
  record?: Entity,
) {
  const branch =
    record?.branchId ||
    (ctx.branchId !== "all"
      ? ctx.branchId
      : (branchOptions(db, ctx)[0]?.id ?? ""));
  const values: Values = { branchId: branch };
  for (const field of fields) {
    const existing = record ? valueOf(record, field.key) : "";
    if (record && existing !== "")
      values[field.key] = Array.isArray(existing)
        ? existing.join(",")
        : field.type === "money" && typeof existing === "number"
          ? String(existing / 100)
          : field.type === "datetime" && typeof existing === "string"
            ? localTime(existing)
            : String(existing);
    else if (field.key === "odometer" && record && "vehicleId" in record)
      values[field.key] = String(
        entities(db, "vehicle").find((v) => v.id === record.vehicleId)
          ?.odometer ?? 0,
      );
    else if (field.type === "datetime" && !field.optional)
      values[field.key] = localTime(
        new Date(
          Date.now() + (field.key === "startsAt" ? 0 : 86400000),
        ).toISOString(),
      );
    else if (field.type === "vehiclesMulti") {
      const candidates = entities(db, "vehicle").filter(
        (v) => inScope(db, ctx, v) && (!v.branchId || v.branchId === branch),
      );
      const available =
        candidates.find((v) => vehicleStatus(db, v) === "available") ??
        candidates[0];
      values[field.key] = available?.id ?? "";
    } else if (field.relation && !field.optional) {
      const candidates = db.entities.filter(
        (e) =>
          (field.relation === "record"
            ? ["customer", "vehicle", "rental"].includes(e.kind)
            : e.kind === field.relation) &&
          inScope(db, ctx, e) &&
          allowed(db, ctx, kindModule[e.kind]) &&
          (!e.branchId || e.branchId === branch),
      );
      values[field.key] = candidates[0]?.id ?? "";
    } else values[field.key] = field.default ?? "";
  }
  if (record?.kind === "quotation" && !values.vehicleIds && record.vehicleId)
    values.vehicleIds = record.vehicleId;
  if (record?.kind === "user")
    values.assignedBranchId = record.branchIds[0] ?? "";
  return values;
}

export function DemoForm({
  db,
  ctx,
  fields,
  record,
  branchRequired = false,
  onSave,
  onBusy,
}: {
  db: Database;
  ctx: DemoContext;
  fields: Field[];
  record?: Entity;
  branchRequired?: boolean;
  onSave: (values: Values) => Promise<void>;
  onBusy: (busy: boolean) => void;
}) {
  const formId = useId(),
    lock = useRef(false);
  const [failure, setFailure] = useState("");
  const [fnDraft, setFnDraft] = useState("");
  const combined: Field[] =
    branchRequired && !record
      ? [{ key: "branchId", label: "Branch", relation: "branch" }, ...fields]
      : fields;
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(formSchema(combined)),
    defaultValues: initial(db, ctx, combined, record),
  });
  const formValues = useWatch({ control });
  const branch =
    record?.branchId ||
    formValues.branchId ||
    (ctx.branchId !== "all"
      ? ctx.branchId
      : (branchOptions(db, ctx)[0]?.id ?? ""));

  // Live financial preview when editing/creating a quotation.
  const hasQuotationPreview = combined.some((f) => f.key === "vehicleIds");
  let quotePreview: ReturnType<typeof computeFinancialTotals> | null = null;
  const threshold = companyDiscountThreshold(db, ctx.companyId);
  const vatRate = companyVatRate(db, ctx.companyId);
  if (hasQuotationPreview) {
    const selectedIds = (formValues.vehicleIds ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const chosenVehicles = selectedIds
      .map((id) => entities(db, "vehicle").find((v) => v.id === id))
      .filter((v): v is NonNullable<typeof v> => !!v);
    if (
      chosenVehicles.length > 0 &&
      formValues.startsAt &&
      formValues.endsAt &&
      Date.parse(formValues.endsAt) > Date.parse(formValues.startsAt)
    ) {
      try {
        const startsAt = formValues.startsAt ?? "";
        const endsAt = formValues.endsAt ?? "";
        const sub = chosenVehicles.reduce(
          (sum, v) => sum + rentalPrice(startsAt, endsAt, v.dailyRate),
          0,
        );
        const pct = Math.min(
          100,
          Math.max(0, Number(formValues.discountPct || 0) || 0),
        );
        quotePreview = computeFinancialTotals(sub, pct, vatRate);
      } catch {
        quotePreview = null;
      }
    }
  }

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(event) => {
        void handleSubmit(async (values) => {
          if (lock.current) return;
          const fnField = combined.find((f) => f.type === "vehicleFunctions");
          const payload: Values = { ...values };
          if (fnField && fnDraft.trim()) {
            const currentList = (payload[fnField.key] ?? "")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            const merged = mergeVehicleFunctions(currentList, fnDraft);
            if (merged.error) {
              setError(fnField.key, { type: "manual", message: merged.error });
              return;
            }
            payload[fnField.key] = merged.next.join(",");
            setValue(fnField.key, payload[fnField.key], {
              shouldValidate: true,
            });
            setFnDraft("");
          }
          lock.current = true;
          onBusy(true);
          setFailure("");
          try {
            await onSave(payload);
          } catch (error) {
            if (error instanceof DemoError)
              for (const [key, message] of Object.entries(error.fields))
                setError(key, { type: "service", message });
            setFailure(
              error instanceof Error
                ? error.message
                : "The demo change was not saved.",
            );
          } finally {
            lock.current = false;
            onBusy(false);
          }
        })(event);
      }}
    >
      <fieldset
        disabled={isSubmitting}
        className="grid gap-x-5 gap-y-4 sm:grid-cols-2"
      >
        {combined.map((field) => {
          const id = `${formId}-${field.key}`;
          const choices =
            field.key === "branchId" || field.relation === "branch"
              ? branchOptions(db, ctx)
              : field.type === "vehiclesMulti"
                ? entities(db, "vehicle").filter(
                    (v) =>
                      inScope(db, ctx, v) &&
                      (!v.branchId || !branch || v.branchId === branch),
                  )
                : db.entities.filter(
                    (e) =>
                      (field.relation === "record"
                        ? ["customer", "vehicle", "rental"].includes(e.kind)
                        : e.kind === field.relation) &&
                      inScope(db, ctx, e) &&
                      allowed(db, ctx, kindModule[e.kind]) &&
                      (!e.branchId || !branch || e.branchId === branch),
                  );
          const spanTwo = [
            "textarea",
            "permissions",
            "vehicleFunctions",
            "vehiclesMulti",
          ].includes(field.type ?? "");
          const currentVal = String(formValues[field.key] ?? "");

          return (
            <div
              key={field.key}
              className={`min-w-0 space-y-2 ${spanTwo ? "sm:col-span-2" : ""}`}
            >
              <label htmlFor={id} className="text-sm font-medium">
                {field.label}
                {field.optional ? " (optional)" : ""}
              </label>

              {field.type === "permissions" ? (
                <fieldset
                  id={id}
                  className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto rounded-xl border p-3 sm:grid-cols-2"
                >
                  <legend className="sr-only">Capabilities</legend>
                  {[
                    "*",
                    ...modules.flatMap((m) => [`${m}.read`, `${m}.write`]),
                  ].map((permission) => (
                    <label
                      key={permission}
                      className="flex items-center gap-2 text-label"
                    >
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={(getValues(field.key) ?? "")
                          .split(",")
                          .includes(permission)}
                        onChange={(e) => {
                          const set = new Set(
                            (getValues(field.key) ?? "")
                              .split(",")
                              .filter(Boolean),
                          );
                          if (e.target.checked) set.add(permission);
                          else set.delete(permission);
                          setValue(field.key, [...set].join(","), {
                            shouldValidate: true,
                          });
                        }}
                      />
                      {permission === "*"
                        ? "Platform scope (all capabilities)"
                        : permission}
                    </label>
                  ))}
                </fieldset>
              ) : field.type === "vehicleFunctions" ? (
                <VehicleFunctionsInput
                  id={id}
                  value={currentVal
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)}
                  onChange={(next) =>
                    setValue(field.key, next.join(","), {
                      shouldValidate: true,
                    })
                  }
                  suggestions={entities(db, "vehicle")
                    .filter((v) => inScope(db, ctx, v))
                    .flatMap((v) => v.functions)}
                  draft={fnDraft}
                  onDraftChange={setFnDraft}
                  disabled={isSubmitting}
                  error={errors[field.key]?.message}
                  ariaDescribedBy={`${id}-error`}
                />
              ) : field.type === "vehiclesMulti" ? (
                <fieldset
                  id={id}
                  className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto rounded-xl border bg-muted/20 p-3 sm:grid-cols-2"
                >
                  <legend className="sr-only">Vehicles</legend>
                  {choices.map((e) => {
                    if (e.kind !== "vehicle") return null;
                    const selectedSet = new Set(
                      currentVal.split(",").map((s) => s.trim()).filter(Boolean),
                    );
                    const active = selectedSet.has(e.id);
                    const st = vehicleStatus(db, e);
                    return (
                      <label
                        key={e.id}
                        className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs transition-colors ${
                          active
                            ? "border-primary/60 bg-accent/35 font-semibold"
                            : "bg-surface hover:bg-muted/50"
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <input
                            type="checkbox"
                            className="accent-primary"
                            checked={active}
                            onChange={(ev) => {
                              if (ev.target.checked) selectedSet.add(e.id);
                              else selectedSet.delete(e.id);
                              setValue(field.key, [...selectedSet].join(","), {
                                shouldValidate: true,
                              });
                            }}
                          />
                          <span className="truncate">
                            <span className="font-mono font-bold">
                              {e.registration}
                            </span>{" "}
                            · {e.make} {e.model}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                          {money(db, ctx.companyId, e.dailyRate)}/d · {st}
                        </span>
                      </label>
                    );
                  })}
                </fieldset>
              ) : field.relation ? (
                <DriveCoreSelect
                  id={id}
                  value={currentVal}
                  ariaLabel={field.label}
                  ariaInvalid={!!errors[field.key]}
                  ariaDescribedBy={`${id}-error`}
                  onValueChange={(next) => {
                    setValue(field.key, next, { shouldValidate: true });
                    if (field.key === "branchId") {
                      for (const f of fields) {
                        if (
                          (f.relation &&
                            f.relation !== "role" &&
                            f.relation !== "branch") ||
                          f.type === "vehiclesMulti"
                        ) {
                          setValue(f.key, "");
                        }
                      }
                    }
                  }}
                  options={[
                    ...(field.optional || currentVal === ""
                      ? [
                          {
                            value: "",
                            label: field.optional
                              ? "All accessible branches / none"
                              : "Select a record",
                          },
                        ]
                      : []),
                    ...choices.map((e) => ({
                      value: e.id,
                      label: label(e),
                    })),
                  ]}
                />
              ) : field.options ? (
                <DriveCoreSelect
                  id={id}
                  value={currentVal}
                  ariaLabel={field.label}
                  ariaInvalid={!!errors[field.key]}
                  ariaDescribedBy={`${id}-error`}
                  onValueChange={(next) =>
                    setValue(field.key, next, { shouldValidate: true })
                  }
                  options={field.options.map((option) => ({
                    value: option,
                    label:
                      option === "true"
                        ? "Active"
                        : option === "false"
                          ? "Inactive"
                          : option.charAt(0).toUpperCase() + option.slice(1),
                  }))}
                />
              ) : field.type === "datetime" ? (
                <DriveCoreDateTimeField
                  id={id}
                  label={field.label}
                  value={currentVal}
                  optional={field.optional}
                  ariaInvalid={!!errors[field.key]}
                  ariaDescribedBy={`${id}-error`}
                  onChange={(next) =>
                    setValue(field.key, next, { shouldValidate: true })
                  }
                />
              ) : field.type === "textarea" ? (
                <Textarea
                  id={id}
                  {...register(field.key)}
                  aria-invalid={!!errors[field.key]}
                  aria-describedby={`${id}-error`}
                  maxLength={10000}
                />
              ) : (
                <Input
                  id={id}
                  type={field.type === "email" ? "email" : "text"}
                  inputMode={
                    field.type === "money"
                      ? "decimal"
                      : field.type === "number"
                        ? "numeric"
                        : undefined
                  }
                  autoComplete="off"
                  {...register(field.key)}
                  aria-invalid={!!errors[field.key]}
                  aria-describedby={`${id}-error`}
                />
              )}

              <p
                id={`${id}-error`}
                className="text-label text-danger-foreground"
              >
                {errors[field.key]?.message}
              </p>
              {field.help ? (
                <p className="text-label text-muted-foreground">{field.help}</p>
              ) : null}
            </div>
          );
        })}
      </fieldset>

      {quotePreview ? (
        <div className="space-y-2 rounded-2xl border bg-muted/25 p-4 font-mono text-xs">
          <div className="flex items-center justify-between">
            <span className="font-sans text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Quotation Pricing Summary
            </span>
            {quotePreview.discountPct > threshold ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-warning bg-warning/10 px-2 py-0.5 text-[10px] font-bold text-warning-foreground">
                <ShieldAlert className="size-3" aria-hidden="true" />
                Exceeds {threshold}% — Manager approval required
              </span>
            ) : null}
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">
              {money(db, ctx.companyId, quotePreview.subtotal)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Discount ({quotePreview.discountPct}%)
            </span>
            <span className="text-link tabular-nums">
              -{money(db, ctx.companyId, quotePreview.discountAmount)}
            </span>
          </div>
          <div className="flex justify-between border-b pb-1.5">
            <span className="text-muted-foreground">
              VAT ({quotePreview.vatRate}%)
            </span>
            <span className="tabular-nums">
              {money(db, ctx.companyId, quotePreview.vatAmount)}
            </span>
          </div>
          <div className="flex justify-between text-sm font-extrabold">
            <span>Total</span>
            <span className="tabular-nums">
              {money(db, ctx.companyId, quotePreview.total)}
            </span>
          </div>
        </div>
      ) : null}

      {combined.some((f) => moneyKeys.has(f.key)) ? (
        <p className="text-label text-muted-foreground">
          Amounts use this company’s currency ({vatRate}% company VAT rate).
          Demo calculations are client-side simulations.
        </p>
      ) : null}
      {failure ? (
        <p role="alert" className="text-sm text-danger-foreground">
          {failure}
        </p>
      ) : null}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Save demo change"}
      </Button>
    </form>
  );
}
