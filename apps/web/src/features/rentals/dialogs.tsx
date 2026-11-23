"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarPlus,
  CarFront,
  Clock,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  UserCheck,
  UserPlus,
  X,
} from "lucide-react";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "@/features/live/context";
import { customerFormSchema } from "@/features/records/schemas";
import { listRecords, saveRecord } from "@/features/records/service";
import { createUserSchema } from "@/features/users/schemas";
import { createUser, listUsers } from "@/features/users/service";
import { ApiError, errorText, initializeCsrf } from "@/lib/api/client";
import {
  can,
  canAccessUserAdmin,
  canManageUsers,
  parseMajorToMinor,
  type Customer,
  type Rental,
  type Reservation,
  type Vehicle,
} from "@/lib/api/contracts";
import {
  humanizeFieldLabel,
  humanizeFieldMessage,
} from "@/lib/api/error-format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DriveCoreDateTimeField } from "@/components/ui/drivecore-calendar";
import { DriveCoreSelect } from "@/components/ui/drivecore-select";
import { Input } from "@/components/ui/input";
import { DigitalSignaturePad } from "@/components/ui/signature-pad";
import { Textarea } from "@/components/ui/textarea";
import {
  listInspections,
} from "@/features/operations-srs/service";
import {
  assignRentalDriver,
  createRental,
  createReservation,
  extendRental,
  transitionRental,
} from "./service";
import { evaluateTransitionTiming, generateDriverPassword } from "./timing";

function localDateTimeOffset(hoursFromNow: number) {
  const d = new Date(Date.now() + hoursFromNow * 3600000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function FormErrorBanner({
  error,
  conflictMessage,
  onClearError,
}: {
  error: unknown;
  conflictMessage?: string;
  onClearError: (next: unknown) => void;
}) {
  if (!error) return null;
  const text =
    error instanceof ApiError && error.status === 409 && conflictMessage
      ? conflictMessage
      : errorText(error);
  return (
    <div
      role="alert"
      className="space-y-2 rounded-xl border border-danger bg-danger/10 p-3 text-sm text-danger-foreground"
    >
      <p>{text}</p>
      {error instanceof ApiError && error.status === 422 ? (
        <ul className="list-disc pl-4 text-xs">
          {Object.entries(error.fields).map(([field, msgs]) => (
            <li key={field}>
              {humanizeFieldLabel(field)}:{" "}
              {msgs.map(humanizeFieldMessage).join(" ")}
            </li>
          ))}
        </ul>
      ) : null}
      {error instanceof ApiError && error.status === 419 ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={async () => {
            try {
              await initializeCsrf();
              onClearError(
                new Error("CSRF protection renewed. Submit again."),
              );
            } catch (csrfErr) {
              onClearError(csrfErr);
            }
          }}
        >
          Renew CSRF protection
        </Button>
      ) : null}
    </div>
  );
}

function DriverPickerField({
  id,
  label = "Assign driver (optional)",
  labelClassName = "text-sm font-medium",
  branchId,
  value,
  disabled = false,
  onBusyChange,
  onChange,
}: {
  id: string;
  label?: string;
  labelClassName?: string;
  branchId: number;
  value: string;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  onChange: (next: string) => void;
}) {
  const scope = useLiveContext();
  const session = useSession();
  const client = useQueryClient();
  const inlineId = useId();

  const canQueryDrivers =
    !!session.user && canAccessUserAdmin(session.user, scope.companyId);
  const canManageDrivers =
    !!session.user && canManageUsers(session.user, scope.companyId);

  const [showNewDriver, setShowNewDriver] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newBranchId, setNewBranchId] = useState(String(branchId));
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [creatingDriver, setCreatingDriver] = useState(false);
  const [createError, setCreateError] = useState<unknown>(null);
  const [createdNotice, setCreatedNotice] = useState("");
  const [lastCreatedPassword, setLastCreatedPassword] = useState("");
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [createdDrivers, setCreatedDrivers] = useState<
    Array<{ id: number; name: string; email: string; branch_id: number | null }>
  >([]);

  const driverLock = useRef(false);
  const driverController = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      driverController.current?.abort();
    };
  }, []);

  const drivers = useQuery({
    queryKey: [...scope.key, "drivers", "picker", branchId],
    queryFn: ({ signal }) =>
      listUsers(
        {
          companyId: scope.companyId,
          branch: "all",
          q: "",
          role: "driver",
          isActive: "1",
          page: 1,
        },
        signal,
      ),
    enabled: canQueryDrivers,
  });

  const rentalBranchName =
    scope.directory?.branches.find((b) => b.id === branchId)?.name ??
    `Branch #${branchId}`;

  const driverMap = new Map<
    number,
    { id: number; name: string; email: string; branch_id: number | null }
  >();
  for (const u of drivers.data?.items ?? []) {
    if (u.branch_id === null || u.branch_id === branchId) {
      driverMap.set(u.id, {
        id: u.id,
        name: u.name,
        email: u.email,
        branch_id: u.branch_id,
      });
    }
  }
  for (const d of createdDrivers) {
    if (d.branch_id === null || d.branch_id === branchId) {
      driverMap.set(d.id, d);
    }
  }
  const eligible = Array.from(driverMap.values());

  async function handleCreateInlineDriver() {
    if (driverLock.current || disabled) return;
    const parsed = createUserSchema.safeParse({
      name: newName,
      email: newEmail,
      password: newPassword,
      password_confirmation: newPassword,
      role: "driver",
      branch_id: newBranchId,
    });
    if (!parsed.success) {
      setCreateError(
        new Error(parsed.error.issues[0]?.message ?? "Check driver details."),
      );
      return;
    }

    driverLock.current = true;
    setCreatingDriver(true);
    onBusyChange?.(true);
    setCreateError(null);
    driverController.current = new AbortController();
    const submittedPassword = parsed.data.password;
    const resolvedBranchId = parsed.data.branch_id
      ? Number(parsed.data.branch_id)
      : null;
    try {
      const created = await createUser(
        {
          company_id: Number(scope.companyId),
          branch_id: resolvedBranchId,
          name: parsed.data.name,
          email: parsed.data.email.toLowerCase(),
          password: submittedPassword,
          password_confirmation: submittedPassword,
          role: "driver",
        },
        driverController.current.signal,
      );
      setCreatedDrivers((prev) => [
        {
          id: created.id,
          name: created.name,
          email: created.email,
          branch_id: resolvedBranchId,
        },
        ...prev.filter((d) => d.id !== created.id),
      ]);
      onChange(String(created.id));
      setShowNewDriver(false);
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setShowPassword(false);
      setCreateError(null);
      setLastCreatedPassword(submittedPassword);
      setCopiedNotice(false);
      setCreatedNotice(`Driver "${created.name}" added and selected.`);
      void client.invalidateQueries({ queryKey: [...scope.key, "drivers"] });
      void client.invalidateQueries({ queryKey: [...scope.key, "users"] });
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        session.expire();
      }
      setCreateError(failure);
    } finally {
      driverLock.current = false;
      setCreatingDriver(false);
      onBusyChange?.(false);
    }
  }

  async function copyPassword(text: string) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedNotice(true);
    } catch {
      // Clipboard API may be unavailable in non-secure contexts
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className={labelClassName}>
          {label}
        </label>
        {canManageDrivers ? (
          <button
            type="button"
            disabled={disabled || creatingDriver}
            onClick={() => {
              setShowNewDriver((prev) => !prev);
              setCreateError(null);
            }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-link hover:underline disabled:opacity-50"
          >
            {showNewDriver ? (
              <>
                <X className="size-3" aria-hidden="true" />
                Close
              </>
            ) : (
              <>
                <UserPlus className="size-3" aria-hidden="true" />
                + New driver
              </>
            )}
          </button>
        ) : null}
      </div>

      {canQueryDrivers ? (
        <DriveCoreSelect
          id={id}
          value={value}
          disabled={disabled || creatingDriver}
          onValueChange={(next) => {
            onChange(next);
            setCreatedNotice("");
            setLastCreatedPassword("");
          }}
          options={[
            { value: "", label: "Unassigned" },
            ...eligible.map((d) => ({
              value: String(d.id),
              label: `${d.name} (${d.email})`,
            })),
          ]}
        />
      ) : (
        <Input
          id={id}
          inputMode="numeric"
          disabled={disabled}
          placeholder="Optional driver ID (leave blank for unassigned)"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {createdNotice ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-success/40 bg-success/10 px-2.5 py-1.5 text-xs text-success-foreground"
        >
          <span className="min-w-0 truncate" title={createdNotice}>
            {createdNotice}
          </span>
          {lastCreatedPassword ? (
            <button
              type="button"
              onClick={() => {
                void copyPassword(lastCreatedPassword);
              }}
              className="inline-flex shrink-0 items-center gap-1 font-semibold underline hover:no-underline"
            >
              <Copy className="size-3" aria-hidden="true" />
              {copiedNotice ? "Password copied" : "Copy password"}
            </button>
          ) : null}
        </div>
      ) : null}

      {showNewDriver && canManageDrivers ? (
        <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Quick add driver
            </p>
            <span className="text-[11px] text-muted-foreground">
              Creates a driver account
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label
                htmlFor={`${inlineId}-name`}
                className="text-xs font-medium"
              >
                Driver full name
              </label>
              <Input
                id={`${inlineId}-name`}
                placeholder="Driver full name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor={`${inlineId}-email`}
                className="text-xs font-medium"
              >
                Driver email
              </label>
              <Input
                id={`${inlineId}-email`}
                type="email"
                placeholder="driver@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor={`${inlineId}-branch`}
                className="text-xs font-medium"
              >
                Driver branch scope
              </label>
              <DriveCoreSelect
                id={`${inlineId}-branch`}
                value={newBranchId}
                onValueChange={setNewBranchId}
                options={[
                  { value: String(branchId), label: rentalBranchName },
                  { value: "", label: "All company branches" },
                ]}
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor={`${inlineId}-password`}
                  className="text-xs font-medium"
                >
                  Temporary password
                </label>
                <button
                  type="button"
                  disabled={creatingDriver}
                  onClick={() => {
                    const generated = generateDriverPassword();
                    setNewPassword(generated);
                    setShowPassword(true);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-link hover:underline disabled:opacity-50"
                >
                  <RefreshCw className="size-3" aria-hidden="true" />
                  Generate
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <Input
                  id={`${inlineId}-password`}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Min 12 chars (letters & numbers)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="min-w-0 flex-1 font-mono text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="px-2"
                >
                  {showPassword ? (
                    <EyeOff className="size-3.5" aria-hidden="true" />
                  ) : (
                    <Eye className="size-3.5" aria-hidden="true" />
                  )}
                </Button>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Minimum 12 characters containing both letters and numbers. Share
            this temporary password with the driver after saving.
          </p>
          <FormErrorBanner error={createError} onClearError={setCreateError} />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={creatingDriver}
              onClick={() => {
                setShowNewDriver(false);
                setCreateError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={creatingDriver}
              onClick={() => {
                void handleCreateInlineDriver();
              }}
            >
              {creatingDriver ? "Saving driver…" : "Save driver"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CreateReservationForm({
  onBusyChange,
  onCancel,
  onCreated,
}: {
  onBusyChange: (busy: boolean) => void;
  onCancel: () => void;
  onCreated: (
    reservation: Reservation,
    rental?: Rental,
    warning?: string,
  ) => void;
}) {
  const scope = useLiveContext();
  const session = useSession();
  const client = useQueryClient();
  const formId = useId();
  const lock = useRef(false);
  const custLock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const custController = useRef<AbortController | null>(null);

  const canManageCustomers =
    !!session.user && can(session.user, "customers.manage");
  const canManageRentals =
    !!session.user && can(session.user, "rentals.manage");

  const companyBranches =
    scope.directory?.branches.filter(
      (b) => String(b.company_id) === scope.companyId,
    ) ?? [];
  const defaultBranch =
    scope.branch !== "all"
      ? scope.branch
      : companyBranches.length === 1
        ? String(companyBranches[0].id)
        : "";

  const [branchId, setBranchId] = useState(defaultBranch);
  const [customerId, setCustomerId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [startsAt, setStartsAt] = useState(() => localDateTimeOffset(1));
  const [endsAt, setEndsAt] = useState(() => localDateTimeOffset(25));
  const [startImmediately, setStartImmediately] = useState(false);
  const [driverId, setDriverId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustType, setNewCustType] = useState<"individual" | "corporate">(
    "individual",
  );
  const [newCustEmail, setNewCustEmail] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [creatingDriver, setCreatingDriver] = useState(false);
  const [newCustError, setNewCustError] = useState<unknown>(null);
  const [customerNotice, setCustomerNotice] = useState("");
  const [createdCustomers, setCreatedCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    return () => {
      controller.current?.abort();
      custController.current?.abort();
    };
  }, []);

  const queryBranch = branchId || scope.branch;
  const customers = useQuery({
    queryKey: [...scope.key, "customers", "picker", queryBranch],
    queryFn: ({ signal }) =>
      listRecords(
        "customers",
        {
          companyId: scope.companyId,
          branch: queryBranch,
          q: "",
          filter: "",
          page: 1,
        },
        signal,
      ),
    enabled: !!queryBranch,
  });

  const vehicles = useQuery({
    queryKey: [...scope.key, "vehicles", "picker", queryBranch],
    queryFn: ({ signal }) =>
      listRecords(
        "vehicles",
        {
          companyId: scope.companyId,
          branch: queryBranch,
          q: "",
          filter: "available",
          page: 1,
        },
        signal,
      ),
    enabled: !!queryBranch,
  });

  const fetchedCustomers = (customers.data?.items ?? []) as Customer[];
  const customerMap = new Map<number, Customer>();
  for (const c of fetchedCustomers) customerMap.set(c.id, c);
  for (const c of createdCustomers) {
    if (!branchId || String(c.branch_id) === branchId) {
      customerMap.set(c.id, c);
    }
  }
  const customerItems = Array.from(customerMap.values());
  const vehicleItems = (vehicles.data?.items ?? []) as Vehicle[];

  async function handleCreateInlineCustomer() {
    if (custLock.current || lock.current) return;
    if (!branchId) {
      setNewCustError(new Error("Select a branch before adding a customer."));
      return;
    }
    const parsed = customerFormSchema.safeParse({
      name: newCustName,
      type: newCustType,
      email: newCustEmail.trim(),
      phone: newCustPhone.trim(),
    });
    if (!parsed.success) {
      setNewCustError(
        new Error(parsed.error.issues[0]?.message ?? "Check customer details."),
      );
      return;
    }

    custLock.current = true;
    setCreatingCustomer(true);
    onBusyChange(true);
    setNewCustError(null);
    custController.current = new AbortController();
    try {
      const created = (await saveRecord(
        "customers",
        undefined,
        {
          name: parsed.data.name,
          type: parsed.data.type,
          email: parsed.data.email || null,
          phone: parsed.data.phone || null,
          company_id: Number(scope.companyId),
          branch_id: Number(branchId),
        },
        scope.companyId,
        branchId,
        custController.current.signal,
      )) as Customer;
      setCreatedCustomers((prev) => [
        created,
        ...prev.filter((c) => c.id !== created.id),
      ]);
      setCustomerId(String(created.id));
      setShowNewCustomer(false);
      setNewCustName("");
      setNewCustType("individual");
      setNewCustEmail("");
      setNewCustPhone("");
      setNewCustError(null);
      setCustomerNotice(`Customer "${created.name}" added and selected.`);
      void client.invalidateQueries({
        queryKey: [...scope.key, "customers"],
      });
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        session.expire();
      }
      setNewCustError(failure);
    } finally {
      custLock.current = false;
      setCreatingCustomer(false);
      onBusyChange(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current || custLock.current) return;
    if (!branchId) {
      setError(new Error("Select a branch."));
      return;
    }
    if (!customerId) {
      setError(new Error("Select a customer."));
      return;
    }
    if (!vehicleId) {
      setError(new Error("Select an available vehicle."));
      return;
    }
    const startMs = Date.parse(startsAt);
    const endMs = Date.parse(endsAt);
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
      setError(new Error("Expected return must be after departure."));
      return;
    }
    if (
      startImmediately &&
      canManageRentals &&
      driverId.trim() &&
      !/^[1-9]\d*$/.test(driverId.trim())
    ) {
      setError(new Error("Enter a valid positive driver ID."));
      return;
    }

    lock.current = true;
    setBusy(true);
    onBusyChange(true);
    setError(null);
    controller.current = new AbortController();
    try {
      const created = await createReservation(
        {
          company_id: Number(scope.companyId),
          branch_id: Number(branchId),
          customer_id: Number(customerId),
          vehicle_id: Number(vehicleId),
          starts_at: new Date(startMs).toISOString(),
          ends_at: new Date(endMs).toISOString(),
        },
        controller.current.signal,
      );

      if (startImmediately && canManageRentals) {
        try {
          const createdRental = await createRental(
            {
              reservation_id: created.id,
              ...(driverId.trim()
                ? { driver_user_id: Number(driverId.trim()) }
                : {}),
            },
            controller.current.signal,
          );
          onCreated(created, createdRental);
          return;
        } catch (rentalFailure) {
          if (
            rentalFailure instanceof ApiError &&
            rentalFailure.status === 401
          ) {
            session.expire();
          }
          onCreated(
            created,
            undefined,
            `Reservation #${created.id} was created, but starting the rental contract failed: ${errorText(rentalFailure)} Open the reservation to start the contract.`,
          );
          return;
        }
      }

      onCreated(created);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        session.expire();
      }
      setError(failure);
    } finally {
      lock.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }

  return (
    <form
      noValidate
      aria-busy={busy || creatingCustomer || creatingDriver}
      className="space-y-4"
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
    >
      <fieldset
        disabled={busy || creatingCustomer || creatingDriver}
        className="space-y-4"
      >
        <div className="space-y-1.5">
          <label htmlFor={`${formId}-branch`} className="text-sm font-medium">
            Branch
          </label>
          <DriveCoreSelect
            id={`${formId}-branch`}
            value={branchId}
            onValueChange={(next) => {
              setBranchId(next);
              setCustomerId("");
              setVehicleId("");
              setDriverId("");
              setCustomerNotice("");
              setNewCustError(null);
            }}
            placeholder="Select a branch"
            options={[
              { value: "", label: "Select a branch" },
              ...companyBranches.map((b) => ({
                value: String(b.id),
                label: b.name,
              })),
            ]}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor={`${formId}-customer`}
                className="text-sm font-medium"
              >
                Customer
              </label>
              {canManageCustomers ? (
                <button
                  type="button"
                  disabled={busy || creatingCustomer}
                  onClick={() => {
                    setShowNewCustomer((prev) => !prev);
                    setNewCustError(null);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-link hover:underline disabled:opacity-50"
                >
                  {showNewCustomer ? (
                    <>
                      <X className="size-3" aria-hidden="true" />
                      Close
                    </>
                  ) : (
                    <>
                      <UserPlus className="size-3" aria-hidden="true" />
                      + New customer
                    </>
                  )}
                </button>
              ) : null}
            </div>
            <DriveCoreSelect
              id={`${formId}-customer`}
              value={customerId}
              onValueChange={(next) => {
                setCustomerId(next);
                setCustomerNotice("");
              }}
              placeholder={
                customers.isPending ? "Loading customers…" : "Select customer"
              }
              options={[
                { value: "", label: "Select customer" },
                ...customerItems.map((c) => ({
                  value: String(c.id),
                  label: c.name,
                })),
              ]}
            />
            {customerNotice ? (
              <p
                role="status"
                className="truncate text-xs text-success-foreground"
                title={customerNotice}
              >
                {customerNotice}
              </p>
            ) : null}
          </div>

          <div className="min-w-0 space-y-1.5">
            <label
              htmlFor={`${formId}-vehicle`}
              className="text-sm font-medium"
            >
              Available vehicle
            </label>
            <DriveCoreSelect
              id={`${formId}-vehicle`}
              value={vehicleId}
              onValueChange={setVehicleId}
              placeholder={
                vehicles.isPending ? "Loading vehicles…" : "Select vehicle"
              }
              options={[
                { value: "", label: "Select vehicle" },
                ...vehicleItems.map((v) => ({
                  value: String(v.id),
                  label: `${v.registration} · ${v.make} ${v.model}`,
                })),
              ]}
            />
          </div>
        </div>

        {showNewCustomer && canManageCustomers ? (
          <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Quick add customer
              </p>
              <span className="text-[11px] text-muted-foreground">
                Saved to the selected branch
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label
                  htmlFor={`${formId}-new-cust-name`}
                  className="text-xs font-medium"
                >
                  Full name
                </label>
                <Input
                  id={`${formId}-new-cust-name`}
                  placeholder="Customer full name"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor={`${formId}-new-cust-type`}
                  className="text-xs font-medium"
                >
                  Customer type
                </label>
                <DriveCoreSelect
                  id={`${formId}-new-cust-type`}
                  value={newCustType}
                  onValueChange={(v) =>
                    setNewCustType(v as "individual" | "corporate")
                  }
                  options={[
                    { value: "individual", label: "Individual" },
                    { value: "corporate", label: "Corporate" },
                  ]}
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor={`${formId}-new-cust-email`}
                  className="text-xs font-medium"
                >
                  Email (optional)
                </label>
                <Input
                  id={`${formId}-new-cust-email`}
                  type="email"
                  placeholder="customer@example.com"
                  value={newCustEmail}
                  onChange={(e) => setNewCustEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor={`${formId}-new-cust-phone`}
                  className="text-xs font-medium"
                >
                  Phone (optional)
                </label>
                <Input
                  id={`${formId}-new-cust-phone`}
                  placeholder="+1 555 0100"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                />
              </div>
            </div>
            <FormErrorBanner
              error={newCustError}
              onClearError={setNewCustError}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={creatingCustomer}
                onClick={() => {
                  setShowNewCustomer(false);
                  setNewCustError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={creatingCustomer}
                onClick={() => {
                  void handleCreateInlineCustomer();
                }}
              >
                {creatingCustomer ? "Saving customer…" : "Save customer"}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-start`} className="text-sm font-medium">
              Departure
            </label>
            <DriveCoreDateTimeField
              id={`${formId}-start`}
              label="Departure"
              value={startsAt}
              onChange={setStartsAt}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor={`${formId}-end`} className="text-sm font-medium">
              Expected return
            </label>
            <DriveCoreDateTimeField
              id={`${formId}-end`}
              label="Expected return"
              value={endsAt}
              onChange={setEndsAt}
            />
          </div>
        </div>

        {canManageRentals ? (
          <div className="space-y-3 rounded-xl border border-border/80 bg-muted/20 p-3.5">
            <label
              htmlFor={`${formId}-start-now`}
              className="flex cursor-pointer items-center gap-2.5 text-sm font-medium"
            >
              <input
                id={`${formId}-start-now`}
                type="checkbox"
                checked={startImmediately}
                onChange={(e) => setStartImmediately(e.target.checked)}
                className="size-4 rounded border-input accent-link"
              />
              <span>Also start rental contract immediately</span>
            </label>
            {startImmediately ? (
              <div className="space-y-1.5">
                {branchId ? (
                  <DriverPickerField
                    id={`${formId}-driver`}
                    label="Assign driver (optional)"
                    labelClassName="text-xs font-medium text-muted-foreground"
                    branchId={Number(branchId)}
                    value={driverId}
                    disabled={busy || creatingCustomer}
                    onBusyChange={(next) => {
                      setCreatingDriver(next);
                      onBusyChange(next || busy || creatingCustomer);
                    }}
                    onChange={setDriverId}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Select a branch first to pick or add a driver.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </fieldset>

      <FormErrorBanner
        error={error}
        conflictMessage="This vehicle is already reserved or unavailable for the chosen window."
        onClearError={setError}
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          disabled={busy || creatingCustomer || creatingDriver}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={busy || creatingCustomer || creatingDriver}
        >
          {busy
            ? startImmediately
              ? "Creating rental…"
              : "Booking…"
            : startImmediately
              ? "Create reservation & start contract"
              : "Create reservation"}
        </Button>
      </div>
    </form>
  );
}

export function CreateReservationDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (
    reservation: Reservation,
    rental?: Rental,
    warning?: string,
  ) => void;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton={!busy}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-card sm:max-w-xl"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="size-4 text-link" aria-hidden="true" />
            Create reservation
          </DialogTitle>
          <DialogDescription>
            Allocate an available vehicle for a customer, or add a new customer
            and start the rental contract in one workflow.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <CreateReservationForm
            onBusyChange={setBusy}
            onCancel={() => onOpenChange(false)}
            onCreated={(res, rental, warning) => {
              onOpenChange(false);
              onCreated(res, rental, warning);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function StartRentalDialog({
  reservation,
  onClose,
  onCreated,
}: {
  reservation: Reservation | null;
  onClose: () => void;
  onCreated: (rental: Rental) => void;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <Dialog
      open={!!reservation}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        showCloseButton={!busy}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-card sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CarFront className="size-4 text-link" aria-hidden="true" />
            Create rental contract
          </DialogTitle>
          <DialogDescription>
            Start a draft rental from Reservation #{reservation?.id}. You may
            optionally assign a driver now or later.
          </DialogDescription>
        </DialogHeader>
        {reservation ? (
          <StartRentalForm
            key={reservation.id}
            reservation={reservation}
            onBusyChange={setBusy}
            onCancel={onClose}
            onCreated={(rental) => {
              onClose();
              onCreated(rental);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function StartRentalForm({
  reservation,
  onBusyChange,
  onCancel,
  onCreated,
}: {
  reservation: Reservation;
  onBusyChange: (busy: boolean) => void;
  onCancel: () => void;
  onCreated: (rental: Rental) => void;
}) {
  const session = useSession();
  const scope = useLiveContext();
  const formId = useId();
  const [driverId, setDriverId] = useState("");
  const [deposit, setDeposit] = useState("");
  const [busy, setBusy] = useState(false);
  const [creatingDriver, setCreatingDriver] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      controller.current?.abort();
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current || creatingDriver) return;
    if (driverId.trim() && !/^[1-9]\d*$/.test(driverId.trim())) {
      setError(new Error("Enter a valid positive driver ID."));
      return;
    }
    let depositMinor: number | undefined;
    if (deposit.trim()) {
      const parsed = parseMajorToMinor(deposit);
      if (parsed === null || parsed < 0) {
        setError(new Error("Enter a valid security deposit amount (e.g. 1500.00)."));
        return;
      }
      depositMinor = parsed;
    }
    lock.current = true;
    setBusy(true);
    onBusyChange(true);
    setError(null);
    controller.current = new AbortController();
    try {
      const created = await createRental(
        {
          reservation_id: reservation.id,
          ...(driverId.trim()
            ? { driver_user_id: Number(driverId.trim()) }
            : {}),
          ...(depositMinor && depositMinor > 0
            ? { security_deposit_minor: depositMinor }
            : {}),
        },
        controller.current.signal,
      );
      onCreated(created);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        session.expire();
      }
      setError(failure);
    } finally {
      lock.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }

  return (
    <form
      noValidate
      aria-busy={busy || creatingDriver}
      className="space-y-4"
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
    >
      <fieldset disabled={busy || creatingDriver} className="space-y-4">
        <DriverPickerField
          id={`${formId}-driver`}
          label="Assign driver (optional)"
          branchId={reservation.branch_id}
          value={driverId}
          disabled={busy}
          onBusyChange={(next) => {
            setCreatingDriver(next);
            onBusyChange(next || busy);
          }}
          onChange={setDriverId}
        />
        <div className="space-y-1.5">
          <label htmlFor={`${formId}-deposit`} className="text-sm font-medium">
            Security deposit ({scope.company?.currency || "ZMW"}, optional)
          </label>
          <Input
            id={`${formId}-deposit`}
            inputMode="decimal"
            placeholder="0.00"
            value={deposit}
            onChange={(e) => setDeposit(e.target.value)}
          />
        </div>
      </fieldset>
      <FormErrorBanner
        error={error}
        conflictMessage="This reservation is no longer eligible or already has a rental contract."
        onClearError={setError}
      />
      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          disabled={busy || creatingDriver}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={busy || creatingDriver}>
          {busy ? "Creating…" : "Create contract"}
        </Button>
      </div>
    </form>
  );
}

export function HandoverReturnDialog({
  rental,
  mode,
  scheduledAt,
  onClose,
  onCompleted,
}: {
  rental: Rental | null;
  mode: "handover" | "return";
  scheduledAt?: string | null;
  onClose: () => void;
  onCompleted: (updated: Rental) => void;
}) {
  const [busy, setBusy] = useState(false);

  const effectiveScheduledAt =
    scheduledAt !== undefined
      ? scheduledAt
      : rental
        ? mode === "handover"
          ? rental.starts_at
          : rental.ends_at
        : null;

  return (
    <Dialog
      open={!!rental}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        showCloseButton={!busy}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-card sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>
            {mode === "handover" ? "Complete handover" : "Record vehicle return"}
          </DialogTitle>
          <DialogDescription>
            {mode === "handover"
              ? "Record outbound kilometre odometer and condition notes. The vehicle status will switch to rented."
              : "Record inbound kilometre odometer, vehicle return condition, and inspection notes."}
          </DialogDescription>
        </DialogHeader>
        {rental ? (
          <HandoverReturnForm
            key={`${rental.id}:${mode}`}
            rental={rental}
            mode={mode}
            scheduledAt={effectiveScheduledAt}
            onBusyChange={setBusy}
            onCancel={onClose}
            onCompleted={(updated) => {
              onClose();
              onCompleted(updated);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function HandoverReturnForm({
  rental,
  mode,
  scheduledAt,
  onBusyChange,
  onCancel,
  onCompleted,
}: {
  rental: Rental;
  mode: "handover" | "return";
  scheduledAt?: string | null;
  onBusyChange: (busy: boolean) => void;
  onCancel: () => void;
  onCompleted: (updated: Rental) => void;
}) {
  const session = useSession();
  const scope = useLiveContext();
  const formId = useId();
  const [odometer, setOdometer] = useState(
    String(rental.handover_odometer ?? 0),
  );
  const [vehicleStatus, setVehicleStatus] = useState<
    "available" | "maintenance" | "damaged"
  >("available");
  const [fuelPct, setFuelPct] = useState("100");
  const [checks, setChecks] = useState({
    exterior_ok: true,
    interior_ok: true,
    tyres_ok: true,
    spare_tyre_ok: true,
    tools_ok: true,
    accessories_ok: true,
    documents_ok: true,
  });
  const [signatoryName, setSignatoryName] = useState("");
  const [customerAck, setCustomerAck] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [extraCharge, setExtraCharge] = useState("");
  const [extraChargeDesc, setExtraChargeDesc] = useState("");

  const handoverInspectionQuery = useQuery({
    queryKey: [...scope.key, "inspections", "rental", rental.id],
    queryFn: ({ signal }) =>
      listInspections(
        { companyId: scope.companyId, rentalId: rental.id },
        signal,
      ),
    enabled: mode === "return" && !!scope.companyId,
    retry: false,
  });
  const handoverInsp = handoverInspectionQuery.data?.find(
    (i) => i.type === "handover",
  );
  const fuelShortagePct =
    mode === "return" && handoverInsp
      ? Math.max(0, handoverInsp.fuel_level_pct - Number(fuelPct))
      : 0;
  const newlyFailedItems =
    mode === "return" && handoverInsp
      ? (
          [
            ["exterior_ok", "Exterior"],
            ["interior_ok", "Interior"],
            ["tyres_ok", "Tyres"],
            ["spare_tyre_ok", "Spare tyre"],
            ["tools_ok", "Tools"],
            ["accessories_ok", "Accessories"],
            ["documents_ok", "Documents"],
          ] as const
        )
          .filter(([k]) => handoverInsp[k] && !checks[k])
          .map(([, label]) => label)
      : [];
  const [timing, setTiming] = useState(() =>
    evaluateTransitionTiming(mode, scheduledAt),
  );
  const [confirmedOutsideWindow, setConfirmedOutsideWindow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      controller.current?.abort();
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    if (!/^\d+$/.test(odometer.trim())) {
      setError(new Error("Enter a nonnegative whole kilometre reading."));
      return;
    }
    if (!notes.trim()) {
      setError(new Error("Enter condition notes before continuing."));
      return;
    }
    const latestTiming = evaluateTransitionTiming(mode, scheduledAt);
    if (latestTiming.outsideWindow && !confirmedOutsideWindow) {
      setTiming(latestTiming);
      setError(
        new Error(
          `Confirm proceeding outside the ±30 minute scheduled window before completing this ${mode}.`,
        ),
      );
      return;
    }
    let extraMinor: number | undefined;
    if (mode === "return" && extraCharge.trim()) {
      const parsed = parseMajorToMinor(extraCharge);
      if (parsed === null || parsed < 0) {
        setError(
          new Error("Enter a valid additional return charge (e.g. 150.00)."),
        );
        return;
      }
      if (parsed > 0) {
        if (!extraChargeDesc.trim()) {
          setError(
            new Error(
              "Describe the additional return charge before continuing.",
            ),
          );
          return;
        }
        extraMinor = parsed;
      }
    }
    lock.current = true;
    setBusy(true);
    onBusyChange(true);
    setError(null);
    controller.current = new AbortController();
    try {
      const updated = await transitionRental(
        rental.id,
        mode,
        {
          odometer: Number(odometer.trim()),
          notes: notes.trim(),
          ...(mode === "return" ? { vehicle_status: vehicleStatus } : {}),
          ...(extraMinor && extraMinor > 0
            ? {
                extra_charge_minor: extraMinor,
                extra_charge_description: extraChargeDesc.trim(),
              }
            : {}),
          inspection: {
            fuel_level_pct: Number(fuelPct),
            ...checks,
            damage_notes: notes.trim(),
            customer_acknowledged_by: signatoryName.trim() || null,
            customer_acknowledged: customerAck || !!signatureDataUrl,
            signature_data_url: signatureDataUrl || null,
          },
        },
        controller.current.signal,
      );
      onCompleted(updated);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        session.expire();
      }
      setError(failure);
    } finally {
      lock.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }

  return (
    <form
      noValidate
      aria-busy={busy}
      className="space-y-4"
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
    >
      <fieldset disabled={busy} className="space-y-4">
        {timing.outsideWindow ? (
          <div
            role="status"
            className="space-y-2.5 rounded-xl border border-warning bg-warning/10 p-3.5 text-sm text-warning-foreground"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <div className="space-y-0.5">
                <p className="font-semibold">
                  Outside ±30 minute scheduled window
                </p>
                <p className="text-xs">{timing.summary}</p>
              </div>
            </div>
            <label
              htmlFor={`${formId}-confirm-timing`}
              className="flex cursor-pointer items-start gap-2 text-xs font-medium"
            >
              <input
                id={`${formId}-confirm-timing`}
                type="checkbox"
                checked={confirmedOutsideWindow}
                onChange={(e) => setConfirmedOutsideWindow(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 rounded border-input accent-warning"
              />
              <span>
                I confirm completing this {mode} outside the ±30 minute
                scheduled window.
              </span>
            </label>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label htmlFor={`${formId}-odo`} className="text-sm font-medium">
            {mode === "handover"
              ? "Handover odometer (km)"
              : "Return odometer (km)"}
          </label>
          <Input
            id={`${formId}-odo`}
            inputMode="numeric"
            value={odometer}
            onChange={(e) => setOdometer(e.target.value)}
          />
        </div>

        {mode === "return" ? (
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-cond`} className="text-sm font-medium">
              Returned vehicle condition
            </label>
            <DriveCoreSelect
              id={`${formId}-cond`}
              value={vehicleStatus}
              onValueChange={(v) =>
                setVehicleStatus(v as "available" | "maintenance" | "damaged")
              }
              options={[
                { value: "available", label: "Available" },
                { value: "maintenance", label: "Maintenance" },
                { value: "damaged", label: "Damaged" },
              ]}
            />
          </div>
        ) : null}

        <div className="space-y-3 rounded-xl border border-border/80 bg-muted/20 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Digital inspection checklist
            </p>
            <div className="w-36">
              <DriveCoreSelect
                ariaLabel="Fuel level"
                value={fuelPct}
                onValueChange={setFuelPct}
                options={[
                  { value: "100", label: "Fuel: 100% (Full)" },
                  { value: "75", label: "Fuel: 75% (3/4)" },
                  { value: "50", label: "Fuel: 50% (1/2)" },
                  { value: "25", label: "Fuel: 25% (1/4)" },
                  { value: "0", label: "Fuel: 0% (Empty)" },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ["exterior_ok", "Exterior"],
                ["interior_ok", "Interior"],
                ["tyres_ok", "Tyres"],
                ["spare_tyre_ok", "Spare tyre"],
                ["tools_ok", "Tools"],
                ["accessories_ok", "Accessories"],
                ["documents_ok", "Documents"],
              ] as const
            ).map(([k, label]) => (
              <label
                key={k}
                className="flex cursor-pointer items-center gap-1.5 text-xs"
              >
                <input
                  type="checkbox"
                  checked={checks[k]}
                  onChange={(e) =>
                    setChecks((prev) => ({ ...prev, [k]: e.target.checked }))
                  }
                  className="size-3.5 rounded border"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          {mode === "return" && (fuelShortagePct > 0 || newlyFailedItems.length > 0) ? (
            <div
              role="status"
              className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-900 dark:text-amber-200"
            >
              <p className="font-semibold">Return vs. handover diff detected:</p>
              <ul className="mt-1 list-disc pl-4">
                {fuelShortagePct > 0 ? (
                  <li>Fuel shortage: -{fuelShortagePct}% below handover level</li>
                ) : null}
                {newlyFailedItems.length > 0 ? (
                  <li>
                    New condition issues: {newlyFailedItems.join(", ")}
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}

          <div className="grid gap-2 border-t pt-2.5 sm:grid-cols-2">
            <div className="space-y-1">
              <label
                htmlFor={`${formId}-signatory`}
                className="text-xs font-medium"
              >
                Customer signatory name (optional)
              </label>
              <Input
                id={`${formId}-signatory`}
                maxLength={120}
                placeholder="Full name"
                value={signatoryName}
                onChange={(e) => setSignatoryName(e.target.value)}
              />
            </div>
            <div className="flex flex-col justify-end gap-1">
              <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={customerAck}
                  onChange={(e) => setCustomerAck(e.target.checked)}
                  className="size-3.5 rounded border"
                />
                <span>Customer acknowledges condition &amp; fuel reading</span>
              </label>
            </div>
            <div className="sm:col-span-2">
              <DigitalSignaturePad
                label="Customer / driver digital signature (optional)"
                value={signatureDataUrl}
                onChange={setSignatureDataUrl}
                disabled={busy}
              />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor={`${formId}-notes`} className="text-sm font-medium">
            Condition notes
          </label>
          <Textarea
            id={`${formId}-notes`}
            rows={3}
            maxLength={10000}
            placeholder={
              mode === "handover"
                ? "Fuel level, tires, body inspection, keys handed over…"
                : "Return fuel level, damage inspection, accessories checked…"
            }
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {mode === "return" ? (
          <div className="space-y-3 rounded-xl border border-border/80 bg-muted/25 p-3.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Additional return charge (optional)
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label
                  htmlFor={`${formId}-extra-charge`}
                  className="text-xs font-medium"
                >
                  Extra charge amount
                </label>
                <Input
                  id={`${formId}-extra-charge`}
                  inputMode="decimal"
                  placeholder="0.00"
                  value={extraCharge}
                  onChange={(e) => setExtraCharge(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor={`${formId}-extra-desc`}
                  className="text-xs font-medium"
                >
                  Charge description
                </label>
                <Input
                  id={`${formId}-extra-desc`}
                  maxLength={255}
                  placeholder="e.g. Fuel refill, cleaning"
                  value={extraChargeDesc}
                  onChange={(e) => setExtraChargeDesc(e.target.value)}
                />
              </div>
            </div>
          </div>
        ) : null}
      </fieldset>

      <FormErrorBanner
        error={error}
        conflictMessage={
          mode === "handover"
            ? timing.outsideWindow
              ? "The server rejected this off-schedule handover. Verify the vehicle is available — or if your backend has not deployed PR #9 yet, early/late handovers still require the backend timing update."
              : "Rental cannot be handed over right now. Verify the vehicle is available and the reservation is confirmed."
            : "Only active rentals can be returned."
        }
        onClearError={setError}
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy
            ? "Saving…"
            : mode === "handover"
              ? "Confirm handover"
              : "Confirm return"}
        </Button>
      </div>
    </form>
  );
}

export function ExtendRentalDialog({
  rental,
  onClose,
  onExtended,
}: {
  rental: Rental | null;
  onClose: () => void;
  onExtended: (updated: Rental) => void;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <Dialog
      open={!!rental}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        showCloseButton={!busy}
        className="rounded-2xl p-card sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="size-4 text-link" aria-hidden="true" />
            Extend active rental
          </DialogTitle>
          <DialogDescription>
            Choose a later return date. Laravel verifies no conflicting
            confirmed reservation overlaps the extended period.
          </DialogDescription>
        </DialogHeader>
        {rental ? (
          <ExtendRentalForm
            key={rental.id}
            rental={rental}
            onBusyChange={setBusy}
            onCancel={onClose}
            onExtended={(updated) => {
              onClose();
              onExtended(updated);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ExtendRentalForm({
  rental,
  onBusyChange,
  onCancel,
  onExtended,
}: {
  rental: Rental;
  onBusyChange: (busy: boolean) => void;
  onCancel: () => void;
  onExtended: (updated: Rental) => void;
}) {
  const session = useSession();
  const formId = useId();
  const [endsAt, setEndsAt] = useState(() => localDateTimeOffset(48));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      controller.current?.abort();
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    const ms = Date.parse(endsAt);
    if (Number.isNaN(ms)) {
      setError(new Error("Select a valid new return date & time."));
      return;
    }
    lock.current = true;
    setBusy(true);
    onBusyChange(true);
    setError(null);
    controller.current = new AbortController();
    try {
      const updated = await extendRental(
        rental.id,
        {
          ends_at: new Date(ms).toISOString(),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        },
        controller.current.signal,
      );
      onExtended(updated);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        session.expire();
      }
      setError(failure);
    } finally {
      lock.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }

  return (
    <form
      noValidate
      aria-busy={busy}
      className="space-y-4"
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
    >
      <fieldset disabled={busy} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor={`${formId}-ends`} className="text-sm font-medium">
            New expected return
          </label>
          <DriveCoreDateTimeField
            id={`${formId}-ends`}
            label="New expected return"
            value={endsAt}
            onChange={setEndsAt}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${formId}-notes`} className="text-sm font-medium">
            Extension notes (optional)
          </label>
          <Textarea
            id={`${formId}-notes`}
            rows={2}
            maxLength={1000}
            placeholder="Customer requested extension reason…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </fieldset>
      <FormErrorBanner
        error={error}
        conflictMessage="Cannot extend: another confirmed reservation overlaps this vehicle during the extended period."
        onClearError={setError}
      />
      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Extending…" : "Confirm extension"}
        </Button>
      </div>
    </form>
  );
}

export function AssignDriverDialog({
  rental,
  onClose,
  onAssigned,
}: {
  rental: Rental | null;
  onClose: () => void;
  onAssigned: (updated: Rental) => void;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <Dialog
      open={!!rental}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        showCloseButton={!busy}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-card sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="size-4 text-link" aria-hidden="true" />
            Assign driver — Rental #{rental?.id}
          </DialogTitle>
          <DialogDescription>
            Assigned drivers can view this job in Operations and submit handover
            or return updates with photos.
          </DialogDescription>
        </DialogHeader>
        {rental ? (
          <AssignDriverForm
            key={rental.id}
            rental={rental}
            onBusyChange={setBusy}
            onCancel={onClose}
            onAssigned={(updated) => {
              onClose();
              onAssigned(updated);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AssignDriverForm({
  rental,
  onBusyChange,
  onCancel,
  onAssigned,
}: {
  rental: Rental;
  onBusyChange: (busy: boolean) => void;
  onCancel: () => void;
  onAssigned: (updated: Rental) => void;
}) {
  const session = useSession();
  const formId = useId();
  const [driverId, setDriverId] = useState(
    rental.driver_user_id ? String(rental.driver_user_id) : "",
  );
  const [busy, setBusy] = useState(false);
  const [creatingDriver, setCreatingDriver] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      controller.current?.abort();
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current || creatingDriver) return;
    if (driverId.trim() && !/^[1-9]\d*$/.test(driverId.trim())) {
      setError(new Error("Enter a valid positive driver ID."));
      return;
    }
    lock.current = true;
    setBusy(true);
    onBusyChange(true);
    setError(null);
    controller.current = new AbortController();
    try {
      const updated = await assignRentalDriver(
        rental.id,
        driverId.trim() ? Number(driverId.trim()) : null,
        controller.current.signal,
      );
      onAssigned(updated);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        session.expire();
      }
      setError(failure);
    } finally {
      lock.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }

  return (
    <form
      noValidate
      aria-busy={busy || creatingDriver}
      className="space-y-4"
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
    >
      <fieldset disabled={busy || creatingDriver} className="space-y-4">
        <DriverPickerField
          id={`${formId}-driver`}
          label="Driver"
          branchId={rental.branch_id}
          value={driverId}
          disabled={busy}
          onBusyChange={(next) => {
            setCreatingDriver(next);
            onBusyChange(next || busy);
          }}
          onChange={setDriverId}
        />
      </fieldset>
      <FormErrorBanner error={error} onClearError={setError} />
      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          disabled={busy || creatingDriver}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={busy || creatingDriver}>
          {busy ? "Saving…" : "Save driver"}
        </Button>
      </div>
    </form>
  );
}
