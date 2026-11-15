"use client";
import { useId, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
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
import { label } from "@/lib/demo/selectors";
import { formSchema, type Field } from "./config";
export const selectClass =
  "h-control w-full min-w-0 rounded-control border border-input bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring";
const moneyKeys = new Set([
  "dailyRate",
  "unitCost",
  "total",
  "amount",
  "labourCost",
  "additionalCharge",
]);
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
    else if (field.relation && !field.optional) {
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
  if (record?.kind === "user")
    values.assignedBranchId = record.branchIds[0] ?? "";
  return values;
}
function localTime(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
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
  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(event) => {
        void handleSubmit(async (values) => {
          if (lock.current) return;
          lock.current = true;
          onBusy(true);
          setFailure("");
          try {
            await onSave(values);
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
              : db.entities.filter(
                  (e) =>
                    (field.relation === "record"
                      ? ["customer", "vehicle", "rental"].includes(e.kind)
                      : e.kind === field.relation) &&
                    inScope(db, ctx, e) &&
                    allowed(db, ctx, kindModule[e.kind]) &&
                    (!e.branchId || !branch || e.branchId === branch),
                );
          return (
            <div
              key={field.key}
              className={`min-w-0 space-y-2 ${["textarea", "permissions"].includes(field.type ?? "") ? "sm:col-span-2" : ""}`}
            >
              <label htmlFor={id} className="text-sm font-medium">
                {field.label}
                {field.optional ? " (optional)" : ""}
              </label>
              {field.type === "permissions" ? (
                <fieldset
                  id={id}
                  className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto rounded-control border p-3 sm:grid-cols-2"
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
                          setValue(field.key, [...set].join(","));
                        }}
                      />
                      {permission === "*"
                        ? "Platform scope (all capabilities)"
                        : permission}
                    </label>
                  ))}
                </fieldset>
              ) : field.relation ? (
                <select
                  id={id}
                  className={selectClass}
                  {...register(field.key, {
                    onChange:
                      field.key === "branchId"
                        ? () => {
                            for (const f of fields)
                              if (
                                f.relation &&
                                f.relation !== "role" &&
                                f.relation !== "branch"
                              )
                                setValue(f.key, "");
                          }
                        : undefined,
                  })}
                  aria-invalid={!!errors[field.key]}
                  aria-describedby={`${id}-error`}
                >
                  <option value="">
                    {field.optional
                      ? "All accessible branches / none"
                      : "Select a record"}
                  </option>
                  {choices.map((e) => (
                    <option key={e.id} value={e.id}>
                      {label(e)}
                    </option>
                  ))}
                </select>
              ) : field.options ? (
                <select
                  id={id}
                  className={selectClass}
                  {...register(field.key)}
                  aria-invalid={!!errors[field.key]}
                  aria-describedby={`${id}-error`}
                >
                  {field.options.map((option) => (
                    <option key={option} value={option}>
                      {option === "true"
                        ? "Active"
                        : option === "false"
                          ? "Inactive"
                          : option.charAt(0).toUpperCase() + option.slice(1)}
                    </option>
                  ))}
                </select>
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
                  type={
                    field.type === "email"
                      ? "email"
                      : field.type === "datetime"
                        ? "datetime-local"
                        : "text"
                  }
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
      {combined.some((f) => moneyKeys.has(f.key)) ? (
        <p className="text-label text-muted-foreground">
          Amounts use this company’s currency. Pricing and ledger calculations
          are demo simulations without tax.
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
