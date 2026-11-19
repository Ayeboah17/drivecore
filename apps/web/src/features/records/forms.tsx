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
  useWatch,
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
import {
  formatMinorToInput,
  mergeVehicleFunctions,
  parseMajorToMinor,
  type Customer,
  type Vehicle,
  type Domain,
} from "@/lib/api/contracts";
import { saveRecord } from "./service";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DriveCoreSelect } from "@/components/ui/drivecore-select";
import { VehicleFunctionsInput } from "@/components/ui/vehicle-functions-input";

import { customerFormSchema, liveVehicleFormSchema } from "./schemas";
export { customerFormSchema, vehicleFormSchema } from "./schemas";
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
        <DriveCoreSelect
          id="branch_id"
          value={selected}
          onValueChange={setBranch}
          placeholder="Select a branch"
          options={[
            { value: "", label: "Select a branch" },
            ...options.map((b) => ({ value: b.id, label: b.label })),
          ]}
        />
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
      let committed = false;
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
        committed = true;
        if (!active.current || controller.current.signal.aborted) return;
        await client.invalidateQueries({
          // Mark stale without replacing a mounted edit form during its save.
          // Navigation then fetches the authoritative detail in the same scope.
          refetchType: "none",
          queryKey: [
            "live",
            session.epoch,
            session.user!.id,
            "scope",
            scope.companyId,
          ],
          predicate: (query) => query.queryKey[7] === domain,
        });
        if (!active.current || controller.current.signal.aborted) return;
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
        if (!committed) lock.current = false;
        if (active.current) setBusy(committed);
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
    setValue,
    control,
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
  const customerType = useWatch({ control, name: "type" });
  return (
    <form
      noValidate
      aria-busy={save.busy}
      className="dc-shadow-card max-w-xl space-y-4 rounded-2xl border bg-surface p-card"
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
      <fieldset disabled={isSubmitting || save.busy} className="space-y-4">
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
          <DriveCoreSelect
            id="type"
            value={customerType}
            onValueChange={(val) =>
              setValue("type", val as "individual" | "corporate", {
                shouldValidate: true,
              })
            }
            ariaInvalid={!!errors.type}
            options={[
              { value: "individual", label: "Individual" },
              { value: "corporate", label: "Corporate" },
            ]}
          />
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
      </fieldset>
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
  const scope = useLiveContext();
  const client = useQueryClient();
  const save = useSave("vehicles", record);
  const [fnDraft, setFnDraft] = useState("");
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof liveVehicleFormSchema>>({
    resolver: zodResolver(liveVehicleFormSchema),
    defaultValues: record
      ? {
          registration: record.registration,
          make: record.make,
          model: record.model,
          year: record.year === null ? "" : String(record.year),
          odometer: String(record.odometer),
          daily_rate: formatMinorToInput(record.daily_rate_minor),
          functions: [...record.functions],
          status: record.status === "rented" ? "available" : record.status,
        }
      : {
          registration: "",
          make: "",
          model: "",
          year: "",
          odometer: "0",
          daily_rate: "",
          functions: [],
          status: "available",
        },
  });
  const vehicleStatus = useWatch({ control, name: "status" });
  const selectedFunctions = useWatch({ control, name: "functions" }) ?? [];
  const currency = scope.company?.currency;
  const functionsId = useId();

  const cachedFleetLists = client.getQueriesData<{ items?: Vehicle[] }>({
    queryKey: [...scope.key, "vehicles", "list"],
  });
  const fleetFunctionSuggestions = cachedFleetLists.flatMap(
    ([, page]) => page?.items?.flatMap((item) => item.functions ?? []) ?? [],
  );

  return (
    <form
      noValidate
      aria-busy={save.busy}
      className="dc-shadow-card max-w-2xl space-y-4 rounded-2xl border bg-surface p-card"
      onSubmit={handleSubmit(async (values) => {
        const merged = mergeVehicleFunctions(values.functions, fnDraft);
        if (merged.error) {
          setError("functions", { type: "manual", message: merged.error });
          return;
        }
        if (fnDraft.trim()) {
          setValue("functions", merged.next, { shouldValidate: true });
          setFnDraft("");
        }
        try {
          await save.save({
            registration: values.registration,
            make: values.make,
            model: values.model,
            year: values.year === "" ? null : Number(values.year),
            odometer: Number(values.odometer),
            odometer_unit: "km",
            daily_rate_minor: parseMajorToMinor(values.daily_rate) ?? 0,
            functions: merged.next,
            status: values.status,
          });
        } catch (error) {
          applyFieldErrors(
            error,
            ["registration", "make", "model", "year", "odometer", "status"],
            setError,
          );
          if (error instanceof ApiError && error.status === 422) {
            if (error.fields.daily_rate_minor?.[0]) {
              setError("daily_rate", {
                type: "server",
                message: error.fields.daily_rate_minor[0],
              });
            }
            const fnFieldError = Object.entries(error.fields).find(
              ([key, messages]) =>
                (key === "functions" || key.startsWith("functions.")) &&
                messages.length > 0,
            );
            if (fnFieldError) {
              setError("functions", {
                type: "server",
                message: fnFieldError[1][0],
              });
            }
          }
        }
      })}
    >
      <fieldset
        disabled={isSubmitting || save.busy || record?.status === "rented"}
        className="grid gap-4 sm:grid-cols-2"
      >
        {(["registration", "make", "model", "year"] as const).map((name) => (
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
              inputMode={name === "year" ? "numeric" : "text"}
              {...register(name)}
              aria-invalid={!!errors[name]}
              aria-describedby={`${name}-error`}
            />
          </Field>
        ))}

        <Field
          name="odometer"
          label="Odometer (km)"
          error={errors.odometer?.message}
        >
          <Input
            id="odometer"
            inputMode="numeric"
            {...register("odometer")}
            aria-invalid={!!errors.odometer}
            aria-describedby="odometer-error"
          />
        </Field>

        <Field
          name="daily_rate"
          label={`Daily rate${currency ? ` (${currency})` : ""} (optional)`}
          error={errors.daily_rate?.message}
        >
          <Input
            id="daily_rate"
            inputMode="decimal"
            placeholder="0.00"
            {...register("daily_rate")}
            aria-invalid={!!errors.daily_rate}
            aria-describedby="daily_rate-error"
          />
        </Field>

        <Field name="status" label="Status" error={errors.status?.message}>
          <DriveCoreSelect
            id="status"
            value={vehicleStatus}
            onValueChange={(val) =>
              setValue(
                "status",
                val as "available" | "maintenance" | "damaged",
                { shouldValidate: true },
              )
            }
            ariaInvalid={!!errors.status}
            options={[
              { value: "available", label: "Available" },
              { value: "maintenance", label: "Maintenance" },
              { value: "damaged", label: "Damaged" },
            ]}
          />
        </Field>

        <div className="sm:col-span-2">{save.branchControl}</div>

        <div className="space-y-2 sm:col-span-2">
          <label htmlFor={functionsId} className="text-sm font-medium">
            Vehicle functions (optional)
          </label>
          <VehicleFunctionsInput
            id={functionsId}
            value={selectedFunctions}
            onChange={(next) =>
              setValue("functions", next, { shouldValidate: true })
            }
            suggestions={fleetFunctionSuggestions}
            draft={fnDraft}
            onDraftChange={setFnDraft}
            disabled={isSubmitting || save.busy || record?.status === "rented"}
            error={errors.functions?.message}
            ariaDescribedBy={`${functionsId}-error`}
          />
          <p className="text-xs text-muted-foreground">
            {record
              ? "Odometer cannot decrease below the recorded kilometre reading. Leave daily rate blank or 0 if unset."
              : "Distance unit is kilometres (km). Leave daily rate blank or 0 if unset."}
          </p>
          <p
            id={`${functionsId}-error`}
            className="text-sm text-danger-foreground"
          >
            {errors.functions?.message}
          </p>
        </div>
      </fieldset>
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
