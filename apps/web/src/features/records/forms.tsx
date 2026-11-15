"use client";
import {
  cloneElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
} from "react";
import {
  useForm,
  type FieldValues,
  type Path,
  type UseFormSetError,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "@/features/live/context";
import { ApiError, errorText, initializeCsrf } from "@/lib/api/client";
import { type Customer, type Vehicle, type Domain } from "@/lib/api/contracts";
import { saveRecord } from "./service";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { customerFormSchema, vehicleFormSchema } from "./schemas";
export { customerFormSchema, vehicleFormSchema } from "./schemas";
const selectClass =
  "h-control w-full rounded-control border border-input bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring";
function Field({
  name,
  label,
  error,
  children,
}: {
  name: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  const unique = `${useId()}-${name}`;
  return (
    <div className="space-y-2">
      <label htmlFor={unique} className="text-sm font-medium">
        {label}
      </label>
      {cloneElement(
        children as ReactElement<{ id: string; "aria-describedby": string }>,
        { id: unique, "aria-describedby": `${unique}-error` },
      )}
      <p id={`${unique}-error`} className="text-sm text-danger-foreground">
        {error}
      </p>
    </div>
  );
}
export function applyFieldErrors<T extends FieldValues>(
  error: unknown,
  known: readonly string[],
  setError: UseFormSetError<T>,
) {
  if (error instanceof ApiError && error.status === 422)
    for (const [name, messages] of Object.entries(error.fields))
      if (known.includes(name))
        setError(name as Path<T>, { type: "server", message: messages[0] });
}
function useSave(domain: Domain, record?: Customer | Vehicle) {
  const scope = useLiveContext();
  const session = useSession();
  const client = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [branch, setBranch] = useState(
    scope.branch === "all" ? "" : scope.branch,
  );
  const active = useRef(true);
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      controller.current?.abort();
    };
  }, []);
  const membership = session.user!.companies.find(
    (c) => String(c.id) === scope.companyId,
  );
  const knownBranches =
    scope.directory?.branches.filter(
      (b) =>
        String(b.company_id) === scope.companyId &&
        (scope.branch === "all" || String(b.id) === scope.branch),
    ) ?? [];
  const assigned = !session.user!.is_platform_admin
    ? membership?.branch_id
    : null;
  const options = knownBranches.map((b) => ({
    id: String(b.id),
    label: b.name,
  }));
  if (assigned && !options.some((b) => b.id === String(assigned)))
    options.push({
      id: String(assigned),
      label: `Assigned branch #${assigned}`,
    });
  const selected = record
    ? String(record.branch_id)
    : branch || (options.length === 1 ? options[0].id : "");
  return {
    error,
    busy,
    canCreate: !!options.length,
    branchControl: record ? (
      <p className="text-sm text-muted-foreground">
        Company and branch ownership cannot be changed.
      </p>
    ) : (
      <Field name="branch_id" label="Branch">
        <select
          id="branch_id"
          className={selectClass}
          value={selected}
          onChange={(event) => setBranch(event.target.value)}
          required
        >
          <option value="">Select a branch</option>
          {options.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
      </Field>
    ),
    save: async (values: unknown) => {
      if (lock.current) return;
      if (!record && !options.some((b) => b.id === selected)) {
        setError(
          new Error(
            "Choose an authorized branch. Branch lookup may be unavailable for this account.",
          ),
        );
        return;
      }
      lock.current = true;
      setBusy(true);
      setError(null);
      controller.current = new AbortController();
      try {
        const body = record
          ? values
          : {
              ...(values as object),
              company_id: Number(scope.companyId),
              branch_id: Number(selected),
            };
        const saved = await saveRecord(
          domain,
          record ? String(record.id) : undefined,
          body,
          scope.companyId,
          record ? scope.branch : selected,
          controller.current.signal,
        );
        if (!active.current) return;
        await client.invalidateQueries({
          queryKey: [
            "live",
            session.epoch,
            session.user!.id,
            "scope",
            scope.companyId,
          ],
        });
        scope.navigate(
          `/companies/${scope.companyId}/${domain}/${saved.id}?branch=${scope.branch}`,
        );
      } catch (failure) {
        if (!active.current) return;
        if (failure instanceof ApiError && failure.status === 401)
          session.expire();
        setError(failure);
        throw failure;
      } finally {
        lock.current = false;
        if (active.current) setBusy(false);
      }
    },
    feedback: error ? (
      <div role="alert" className="space-y-2 text-sm text-danger-foreground">
        <p>{errorText(error)}</p>
        {error instanceof ApiError && error.status === 422 ? (
          <ul>
            {Object.entries(error.fields).map(([name, messages]) => (
              <li key={name}>
                {name}: {messages.join(" ")}
              </li>
            ))}
          </ul>
        ) : null}
        {error instanceof ApiError && error.status === 419 ? (
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              try {
                await initializeCsrf();
                setError(
                  new Error(
                    "CSRF protection renewed. Submit again when ready.",
                  ),
                );
              } catch (failure) {
                setError(failure);
              }
            }}
          >
            Renew CSRF protection
          </Button>
        ) : null}
        {record ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void client.invalidateQueries({ queryKey: scope.key });
            }}
          >
            Refresh current record
          </Button>
        ) : null}
      </div>
    ) : null,
  };
}
export function CustomerForm({ record }: { record?: Customer }) {
  const save = useSave("customers", record);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof customerFormSchema>>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: record
      ? {
          name: record.name,
          type: record.type,
          email: record.email ?? "",
          phone: record.phone ?? "",
        }
      : { name: "", type: "individual", email: "", phone: "" },
  });
  return (
    <form
      className="max-w-xl space-y-4 rounded-card border bg-surface p-card"
      onSubmit={handleSubmit(async (values) => {
        try {
          await save.save({
            ...values,
            email: values.email || null,
            phone: values.phone || null,
          });
        } catch (error) {
          applyFieldErrors(error, ["name", "type", "email", "phone"], setError);
        }
      })}
    >
      <Field name="name" label="Name" error={errors.name?.message}>
        <Input
          id="name"
          autoComplete="off"
          maxLength={255}
          {...register("name")}
          aria-invalid={!!errors.name}
          aria-describedby="name-error"
        />
      </Field>
      <Field name="type" label="Customer type" error={errors.type?.message}>
        <select id="type" className={selectClass} {...register("type")}>
          <option value="individual">Individual</option>
          <option value="corporate">Corporate</option>
        </select>
      </Field>
      <Field
        name="email"
        label="Email (optional)"
        error={errors.email?.message}
      >
        <Input
          id="email"
          type="email"
          maxLength={255}
          {...register("email")}
          aria-invalid={!!errors.email}
          aria-describedby="email-error"
        />
      </Field>
      <Field
        name="phone"
        label="Phone (optional)"
        error={errors.phone?.message}
      >
        <Input
          id="phone"
          type="tel"
          maxLength={50}
          {...register("phone")}
          aria-invalid={!!errors.phone}
          aria-describedby="phone-error"
        />
      </Field>
      {save.branchControl}
      {save.feedback}
      {!record && !save.canCreate ? (
        <p role="status">
          Creation requires an authorized branch. The branch directory is
          unavailable for this account.
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={isSubmitting || save.busy || (!record && !save.canCreate)}
      >
        {save.busy ? "Saving…" : record ? "Save customer" : "Create customer"}
      </Button>
    </form>
  );
}
export function VehicleForm({ record }: { record?: Vehicle }) {
  const save = useSave("vehicles", record);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof vehicleFormSchema>>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: record
      ? {
          registration: record.registration,
          make: record.make,
          model: record.model,
          year: record.year === null ? "" : String(record.year),
          odometer: String(record.odometer),
          status: record.status === "rented" ? "available" : record.status,
        }
      : {
          registration: "",
          make: "",
          model: "",
          year: "",
          odometer: "0",
          status: "available",
        },
  });
  return (
    <form
      className="max-w-xl space-y-4 rounded-card border bg-surface p-card"
      onSubmit={handleSubmit(async (values) => {
        try {
          await save.save({
            ...values,
            year: values.year === "" ? null : Number(values.year),
            odometer: Number(values.odometer),
          });
        } catch (error) {
          applyFieldErrors(
            error,
            ["registration", "make", "model", "year", "odometer", "status"],
            setError,
          );
        }
      })}
    >
      {(["registration", "make", "model", "year", "odometer"] as const).map(
        (name) => (
          <Field
            key={name}
            name={name}
            label={
              name === "year"
                ? "Year (optional)"
                : name.charAt(0).toUpperCase() + name.slice(1)
            }
            error={errors[name]?.message}
          >
            <Input
              id={name}
              inputMode={
                name === "year" || name === "odometer" ? "numeric" : "text"
              }
              {...register(name)}
              aria-invalid={!!errors[name]}
              aria-describedby={`${name}-error`}
            />
          </Field>
        ),
      )}
      <Field name="status" label="Status" error={errors.status?.message}>
        <select id="status" className={selectClass} {...register("status")}>
          <option value="available">Available</option>
          <option value="maintenance">Maintenance</option>
          <option value="damaged">Damaged</option>
        </select>
      </Field>
      {save.branchControl}
      {save.feedback}
      {!record && !save.canCreate ? (
        <p role="status">
          Creation requires an authorized branch. The branch directory is
          unavailable for this account.
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={
          isSubmitting ||
          save.busy ||
          record?.status === "rented" ||
          (!record && !save.canCreate)
        }
      >
        {save.busy ? "Saving…" : record ? "Save vehicle" : "Create vehicle"}
      </Button>
    </form>
  );
}
