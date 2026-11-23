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
  humanizeFieldLabel,
  humanizeFieldMessage,
} from "@/lib/api/error-format";
import {
  can,
  formatMinorToInput,
  mergeVehicleFunctions,
  parseMajorToMinor,
  vehicleCategories,
  vehicleCategoryLabels,
  vehicleFinancingLabels,
  vehicleFinancingTypes,
  vehicleFuelTypeLabels,
  vehicleFuelTypes,
  vehicleTransmissionLabels,
  vehicleTransmissions,
  type Customer,
  type Vehicle,
  type Domain,
} from "@/lib/api/contracts";
import { saveRecord } from "./service";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DriveCoreDateField } from "@/components/ui/drivecore-calendar";
import { DriveCoreSelect } from "@/components/ui/drivecore-select";
import { VehicleFunctionsInput } from "@/components/ui/vehicle-functions-input";

import {
  customerFormSchema,
  liveVehicleFormSchema,
  manualVehicleStatuses,
} from "./schemas";
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
        setError(name as Path<T>, {
          type: "server",
          message: messages[0] ? humanizeFieldMessage(messages[0]) : undefined,
        });
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
                {humanizeFieldLabel(name)}:{" "}
                {messages.map(humanizeFieldMessage).join(" ")}
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
  const scope = useLiveContext();
  const { user } = useSession();
  const save = useSave("customers", record);
  const canEditFinance =
    !!user &&
    (can(user, "invoices.manage") || can(user, "credit_control.manage"));
  const currency = scope.company?.currency;
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
          id_number: record.id_number ?? "",
          driver_licence_number: record.driver_licence_number ?? "",
          driver_licence_expires_at: record.driver_licence_expires_at ?? "",
          company_registration: record.company_registration ?? "",
          tin: record.tin ?? "",
          contact_person_name: record.contact_person_name ?? "",
          contact_person_phone: record.contact_person_phone ?? "",
          billing_address: record.billing_address ?? "",
          credit_limit:
            record.credit_limit_minor != null
              ? formatMinorToInput(record.credit_limit_minor)
              : "",
          payment_terms_days:
            record.payment_terms_days != null
              ? String(record.payment_terms_days)
              : "",
        }
      : {
          name: "",
          type: "individual",
          email: "",
          phone: "",
          id_number: "",
          driver_licence_number: "",
          driver_licence_expires_at: "",
          company_registration: "",
          tin: "",
          contact_person_name: "",
          contact_person_phone: "",
          billing_address: "",
          credit_limit: "",
          payment_terms_days: "",
        },
  });
  const customerType = useWatch({ control, name: "type" });
  const licenceExpiry = useWatch({ control, name: "driver_licence_expires_at" }) ?? "";
  return (
    <form
      noValidate
      aria-busy={save.busy}
      className="dc-shadow-card max-w-2xl space-y-5 rounded-2xl border bg-surface p-card"
      onSubmit={handleSubmit(async (values) => {
        try {
          const payload: Record<string, unknown> = {
            name: values.name,
            type: values.type,
            email: values.email || null,
            phone: values.phone || null,
          };
          const optionalTextFields = [
            "id_number",
            "driver_licence_number",
            "driver_licence_expires_at",
            "company_registration",
            "tin",
            "contact_person_name",
            "contact_person_phone",
            "billing_address",
          ] as const;
          for (const key of optionalTextFields) {
            const val = values[key]?.trim() || "";
            if (val || record?.[key]) {
              payload[key] = val || null;
            }
          }
          if (canEditFinance) {
            const cl = values.credit_limit?.trim() || "";
            if (cl || record?.credit_limit_minor != null) {
              payload.credit_limit_minor = cl ? parseMajorToMinor(cl) : null;
            }
            const pt = values.payment_terms_days?.trim() || "";
            if (pt || record?.payment_terms_days != null) {
              payload.payment_terms_days = pt ? Number(pt) : null;
            }
          }
          await save.save(payload);
        } catch (error) {
          applyFieldErrors(
            error,
            [
              "name",
              "type",
              "email",
              "phone",
              "id_number",
              "driver_licence_number",
              "company_registration",
              "tin",
              "contact_person_name",
              "contact_person_phone",
              "billing_address",
              "payment_terms_days",
            ],
            setError,
          );
        }
      })}
    >
      <fieldset
        disabled={isSubmitting || save.busy}
        className="grid gap-4 sm:grid-cols-2"
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

        <div className="border-t pt-4 sm:col-span-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {customerType === "corporate"
              ? "Corporate registration & contact"
              : "KYC & driver licence details"}
          </h3>
        </div>

        {customerType === "individual" ? (
          <>
            <Field
              name="id_number"
              label="National ID / Passport (optional)"
              error={errors.id_number?.message}
            >
              <Input
                id="id_number"
                maxLength={80}
                placeholder="e.g. GHA-123456789-0"
                {...register("id_number")}
              />
            </Field>
            <Field
              name="driver_licence_number"
              label="Driver licence # (optional)"
              error={errors.driver_licence_number?.message}
            >
              <Input
                id="driver_licence_number"
                maxLength={80}
                placeholder="e.g. DL-2026-88412"
                {...register("driver_licence_number")}
              />
            </Field>
            <div className="space-y-1">
              <DriveCoreDateField
                label="Driver licence expiry (optional)"
                value={licenceExpiry}
                onChange={(v) => setValue("driver_licence_expires_at", v)}
              />
            </div>
          </>
        ) : (
          <>
            <Field
              name="company_registration"
              label="Company registration # (optional)"
              error={errors.company_registration?.message}
            >
              <Input
                id="company_registration"
                maxLength={80}
                placeholder="e.g. CS-2019-00412"
                {...register("company_registration")}
              />
            </Field>
            <Field
              name="tin"
              label="Tax ID / TIN (optional)"
              error={errors.tin?.message}
            >
              <Input
                id="tin"
                maxLength={80}
                placeholder="e.g. C0049182711"
                {...register("tin")}
              />
            </Field>
            <Field
              name="contact_person_name"
              label="Primary contact person (optional)"
              error={errors.contact_person_name?.message}
            >
              <Input
                id="contact_person_name"
                maxLength={120}
                placeholder="Fleet coordinator name"
                {...register("contact_person_name")}
              />
            </Field>
            <Field
              name="contact_person_phone"
              label="Contact person phone (optional)"
              error={errors.contact_person_phone?.message}
            >
              <Input
                id="contact_person_phone"
                type="tel"
                maxLength={50}
                {...register("contact_person_phone")}
              />
            </Field>
          </>
        )}

        <div className="sm:col-span-2">
          <Field
            name="billing_address"
            label="Billing address (optional)"
            error={errors.billing_address?.message}
          >
            <Input
              id="billing_address"
              maxLength={500}
              placeholder="Street, city, postal code"
              {...register("billing_address")}
            />
          </Field>
        </div>

        {canEditFinance ? (
          <>
            <div className="border-t pt-4 sm:col-span-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Credit &amp; billing terms (finance-managed)
              </h3>
            </div>
            <Field
              name="credit_limit"
              label={`Credit limit${currency ? ` (${currency})` : ""} (optional)`}
              error={errors.credit_limit?.message}
            >
              <Input
                id="credit_limit"
                inputMode="decimal"
                placeholder="0.00"
                {...register("credit_limit")}
              />
            </Field>
            <Field
              name="payment_terms_days"
              label="Payment terms (days, optional)"
              error={errors.payment_terms_days?.message}
            >
              <Input
                id="payment_terms_days"
                inputMode="numeric"
                placeholder="30"
                {...register("payment_terms_days")}
              />
            </Field>
          </>
        ) : null}

        <div className="sm:col-span-2">{save.branchControl}</div>
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
  const { user } = useSession();
  const client = useQueryClient();
  const save = useSave("vehicles", record);
  const [fnDraft, setFnDraft] = useState("");
  const canEditFinance =
    !!user && (can(user, "invoices.manage") || can(user, "expenses.manage"));

  const initialStatus =
    record &&
    (manualVehicleStatuses as readonly string[]).includes(record.status)
      ? (record.status as (typeof manualVehicleStatuses)[number])
      : "available";

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
          vin: record.vin ?? "",
          make: record.make,
          model: record.model,
          year: record.year === null ? "" : String(record.year),
          category: record.category ?? "",
          fuel_type: record.fuel_type ?? "",
          transmission: record.transmission ?? "",
          current_location: record.current_location ?? "",
          odometer: String(record.odometer),
          daily_rate: formatMinorToInput(record.daily_rate_minor),
          functions: [...record.functions],
          status: initialStatus,
          acquisition_date: record.acquisition_date ?? "",
          acquisition_cost:
            record.acquisition_cost_minor != null
              ? formatMinorToInput(record.acquisition_cost_minor)
              : "",
          financing_type: record.financing_type ?? "",
          financing_provider: record.financing_provider ?? "",
          financing_monthly:
            record.financing_monthly_minor != null
              ? formatMinorToInput(record.financing_monthly_minor)
              : "",
          financing_end_date: record.financing_end_date ?? "",
          current_book_value:
            record.current_book_value_minor != null
              ? formatMinorToInput(record.current_book_value_minor)
              : "",
          residual_value:
            record.residual_value_minor != null
              ? formatMinorToInput(record.residual_value_minor)
              : "",
          insurance_provider: record.insurance_provider ?? "",
          insurance_policy_number: record.insurance_policy_number ?? "",
          insurance_expires_at: record.insurance_expires_at ?? "",
          roadworthy_expires_at: record.roadworthy_expires_at ?? "",
          licence_expires_at: record.licence_expires_at ?? "",
        }
      : {
          registration: "",
          vin: "",
          make: "",
          model: "",
          year: "",
          category: "",
          fuel_type: "",
          transmission: "",
          current_location: "",
          odometer: "0",
          daily_rate: "",
          functions: [],
          status: "available",
          acquisition_date: "",
          acquisition_cost: "",
          financing_type: "",
          financing_provider: "",
          financing_monthly: "",
          financing_end_date: "",
          current_book_value: "",
          residual_value: "",
          insurance_provider: "",
          insurance_policy_number: "",
          insurance_expires_at: "",
          roadworthy_expires_at: "",
          licence_expires_at: "",
        },
  });
  const vehicleStatus = useWatch({ control, name: "status" });
  const vehicleCategory = useWatch({ control, name: "category" }) ?? "";
  const vehicleFuelType = useWatch({ control, name: "fuel_type" }) ?? "";
  const vehicleTransmission = useWatch({ control, name: "transmission" }) ?? "";
  const financingType = useWatch({ control, name: "financing_type" }) ?? "";
  const acquisitionDate = useWatch({ control, name: "acquisition_date" }) ?? "";
  const financingEndDate = useWatch({ control, name: "financing_end_date" }) ?? "";
  const insuranceExpiresAt = useWatch({ control, name: "insurance_expires_at" }) ?? "";
  const roadworthyExpiresAt = useWatch({ control, name: "roadworthy_expires_at" }) ?? "";
  const licenceExpiresAt = useWatch({ control, name: "licence_expires_at" }) ?? "";
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
      className="dc-shadow-card max-w-3xl space-y-5 rounded-2xl border bg-surface p-card"
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
          const payload: Record<string, unknown> = {
            registration: values.registration,
            make: values.make,
            model: values.model,
            year: values.year === "" ? null : Number(values.year),
            odometer: Number(values.odometer),
            odometer_unit: "km",
            daily_rate_minor: parseMajorToMinor(values.daily_rate) ?? 0,
            functions: merged.next,
            status: values.status,
          };
          const optionalVehStrings = [
            "vin",
            "category",
            "fuel_type",
            "transmission",
            "current_location",
            "insurance_provider",
            "insurance_policy_number",
            "insurance_expires_at",
            "roadworthy_expires_at",
            "licence_expires_at",
          ] as const;
          for (const key of optionalVehStrings) {
            const val = values[key]?.trim() || "";
            if (val || record?.[key]) {
              payload[key] = val || null;
            }
          }
          // Financial valuation & acquisition fields are finance-gated; omit for
          // non-finance callers so Operations edits never clobber accounting values.
          if (canEditFinance) {
            const optFinStrings = [
              "acquisition_date",
              "financing_type",
              "financing_provider",
              "financing_end_date",
            ] as const;
            for (const key of optFinStrings) {
              const val = values[key]?.trim() || "";
              if (val || record?.[key]) {
                payload[key] = val || null;
              }
            }
            const optFinMoney = [
              ["acquisition_cost", "acquisition_cost_minor"],
              ["financing_monthly", "financing_monthly_minor"],
              ["current_book_value", "current_book_value_minor"],
              ["residual_value", "residual_value_minor"],
            ] as const;
            for (const [formKey, apiKey] of optFinMoney) {
              const val = values[formKey]?.trim() || "";
              if (val || record?.[apiKey] != null) {
                payload[apiKey] = val ? parseMajorToMinor(val) : null;
              }
            }
          }
          await save.save(payload);
        } catch (error) {
          applyFieldErrors(
            error,
            [
              "registration",
              "vin",
              "make",
              "model",
              "year",
              "odometer",
              "status",
              "current_location",
            ],
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
        <div className="sm:col-span-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Vehicle identity &amp; specifications
          </h3>
        </div>
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
          name="vin"
          label="VIN / Chassis number (optional)"
          error={errors.vin?.message}
        >
          <Input
            id="vin"
            maxLength={64}
            placeholder="17-character VIN"
            {...register("vin")}
          />
        </Field>

        <Field
          name="category"
          label="Vehicle category (optional)"
          error={errors.category?.message}
        >
          <DriveCoreSelect
            id="category"
            value={vehicleCategory}
            onValueChange={(v) =>
              setValue(
                "category",
                v as z.infer<typeof liveVehicleFormSchema>["category"],
              )
            }
            options={[
              { value: "", label: "Not specified" },
              ...vehicleCategories.map((c) => ({
                value: c,
                label: vehicleCategoryLabels[c],
              })),
            ]}
          />
        </Field>

        <Field
          name="fuel_type"
          label="Fuel type (optional)"
          error={errors.fuel_type?.message}
        >
          <DriveCoreSelect
            id="fuel_type"
            value={vehicleFuelType}
            onValueChange={(v) =>
              setValue(
                "fuel_type",
                v as z.infer<typeof liveVehicleFormSchema>["fuel_type"],
              )
            }
            options={[
              { value: "", label: "Not specified" },
              ...vehicleFuelTypes.map((f) => ({
                value: f,
                label: vehicleFuelTypeLabels[f],
              })),
            ]}
          />
        </Field>

        <Field
          name="transmission"
          label="Transmission (optional)"
          error={errors.transmission?.message}
        >
          <DriveCoreSelect
            id="transmission"
            value={vehicleTransmission}
            onValueChange={(v) =>
              setValue(
                "transmission",
                v as z.infer<typeof liveVehicleFormSchema>["transmission"],
              )
            }
            options={[
              { value: "", label: "Not specified" },
              ...vehicleTransmissions.map((t) => ({
                value: t,
                label: vehicleTransmissionLabels[t],
              })),
            ]}
          />
        </Field>

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
                val as (typeof manualVehicleStatuses)[number],
                { shouldValidate: true },
              )
            }
            ariaInvalid={!!errors.status}
            options={[
              { value: "available", label: "Available" },
              { value: "maintenance", label: "Maintenance" },
              { value: "damaged", label: "Damaged" },
              { value: "accident", label: "Accident" },
              { value: "awaiting_inspection", label: "Awaiting inspection" },
              { value: "awaiting_repair", label: "Awaiting repair" },
            ]}
          />
        </Field>

        <Field
          name="current_location"
          label="Current location / bay (optional)"
          error={errors.current_location?.message}
        >
          <Input
            id="current_location"
            maxLength={160}
            placeholder="e.g. Airport Yard Bay 4"
            {...register("current_location")}
          />
        </Field>

        <div className="sm:col-span-2">{save.branchControl}</div>

        <div className="border-t pt-4 sm:col-span-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Insurance, roadworthy &amp; licensing
          </h3>
        </div>

        <Field
          name="insurance_provider"
          label="Insurance provider (optional)"
          error={errors.insurance_provider?.message}
        >
          <Input
            id="insurance_provider"
            maxLength={120}
            placeholder="e.g. Enterprise Insurance"
            {...register("insurance_provider")}
          />
        </Field>

        <Field
          name="insurance_policy_number"
          label="Insurance policy # (optional)"
          error={errors.insurance_policy_number?.message}
        >
          <Input
            id="insurance_policy_number"
            maxLength={80}
            placeholder="e.g. POL-2026-00921"
            {...register("insurance_policy_number")}
          />
        </Field>

        <div className="space-y-1">
          <DriveCoreDateField
            label="Insurance expiry (optional)"
            value={insuranceExpiresAt}
            onChange={(v) => setValue("insurance_expires_at", v)}
          />
        </div>

        <div className="space-y-1">
          <DriveCoreDateField
            label="Roadworthy expiry (optional)"
            value={roadworthyExpiresAt}
            onChange={(v) => setValue("roadworthy_expires_at", v)}
          />
        </div>

        <div className="space-y-1">
          <DriveCoreDateField
            label="Licence / registration expiry (optional)"
            value={licenceExpiresAt}
            onChange={(v) => setValue("licence_expires_at", v)}
          />
        </div>

        {canEditFinance ? (
          <>
            <div className="border-t pt-4 sm:col-span-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Acquisition, financing &amp; valuation (finance-managed)
              </h3>
            </div>
            <div className="space-y-1">
              <DriveCoreDateField
                label="Acquisition date (optional)"
                value={acquisitionDate}
                onChange={(v) => setValue("acquisition_date", v)}
              />
            </div>
            <Field
              name="acquisition_cost"
              label={`Acquisition cost${currency ? ` (${currency})` : ""} (optional)`}
              error={errors.acquisition_cost?.message}
            >
              <Input
                id="acquisition_cost"
                inputMode="decimal"
                placeholder="0.00"
                {...register("acquisition_cost")}
              />
            </Field>
            <Field
              name="financing_type"
              label="Financing arrangement (optional)"
              error={errors.financing_type?.message}
            >
              <DriveCoreSelect
                id="financing_type"
                value={financingType}
                onValueChange={(v) =>
                  setValue(
                    "financing_type",
                    v as z.infer<typeof liveVehicleFormSchema>["financing_type"],
                  )
                }
                options={[
                  { value: "", label: "Not specified" },
                  ...vehicleFinancingTypes.map((f) => ({
                    value: f,
                    label: vehicleFinancingLabels[f],
                  })),
                ]}
              />
            </Field>
            <Field
              name="financing_provider"
              label="Financing bank / lessor (optional)"
              error={errors.financing_provider?.message}
            >
              <Input
                id="financing_provider"
                maxLength={120}
                placeholder="e.g. Stanbic Asset Finance"
                {...register("financing_provider")}
              />
            </Field>
            <Field
              name="financing_monthly"
              label={`Monthly financing payment${currency ? ` (${currency})` : ""} (optional)`}
              error={errors.financing_monthly?.message}
            >
              <Input
                id="financing_monthly"
                inputMode="decimal"
                placeholder="0.00"
                {...register("financing_monthly")}
              />
            </Field>
            <div className="space-y-1">
              <DriveCoreDateField
                label="Financing maturity date (optional)"
                value={financingEndDate}
                onChange={(v) => setValue("financing_end_date", v)}
              />
            </div>
            <Field
              name="current_book_value"
              label={`Current book value${currency ? ` (${currency})` : ""} (optional)`}
              error={errors.current_book_value?.message}
            >
              <Input
                id="current_book_value"
                inputMode="decimal"
                placeholder="0.00"
                {...register("current_book_value")}
              />
            </Field>
            <Field
              name="residual_value"
              label={`Residual value${currency ? ` (${currency})` : ""} (optional)`}
              error={errors.residual_value?.message}
            >
              <Input
                id="residual_value"
                inputMode="decimal"
                placeholder="0.00"
                {...register("residual_value")}
              />
            </Field>
          </>
        ) : null}

        <div className="space-y-2 border-t pt-4 sm:col-span-2">
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
