"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, FileSpreadsheet, UserPlus, X } from "lucide-react";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "@/features/live/context";
import { customerFormSchema } from "@/features/records/schemas";
import { listRecords, saveRecord } from "@/features/records/service";
import { ApiError, errorText, initializeCsrf } from "@/lib/api/client";
import {
  can,
  formatMoneyMinor,
  type Customer,
  type Quotation,
  type Vehicle,
} from "@/lib/api/contracts";
import {
  humanizeFieldLabel,
  humanizeFieldMessage,
} from "@/lib/api/error-format";
import { PlateTag } from "@/components/data/data-table";
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
import { Textarea } from "@/components/ui/textarea";
import { calculateQuotationPreview } from "./pricing";
import { createQuotation, getCompanySettings } from "./service";

export interface QuotationDraftSeed {
  branchId?: string;
  customerId?: string;
  vehicleIds?: number[];
  startsAt?: string;
  endsAt?: string;
  discountPct?: number;
  notes?: string;
}

function toLocalDateTimeInput(isoOrOffset: string | number) {
  const d =
    typeof isoOrOffset === "number"
      ? new Date(Date.now() + isoOrOffset * 3600000)
      : new Date(isoOrOffset);
  if (Number.isNaN(d.getTime())) return toLocalDateTimeInput(24);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ErrorAlert({
  error,
  onClear,
}: {
  error: unknown;
  onClear: (next: unknown) => void;
}) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className="space-y-2 rounded-xl border border-danger bg-danger/10 p-3 text-sm text-danger-foreground"
    >
      <p>{errorText(error)}</p>
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
              onClear(new Error("CSRF protection renewed. Submit again."));
            } catch (csrfErr) {
              onClear(csrfErr);
            }
          }}
        >
          Renew CSRF protection
        </Button>
      ) : null}
    </div>
  );
}

function CreateQuotationForm({
  initialValues,
  onBusyChange,
  onCancel,
  onCreated,
}: {
  initialValues?: QuotationDraftSeed;
  onBusyChange: (busy: boolean) => void;
  onCancel: () => void;
  onCreated: (created: Quotation) => void;
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
  const canManageVehicles =
    !!session.user && can(session.user, "vehicles.manage");

  const assignedBranchId =
    session.user?.companies.find((c) => String(c.id) === scope.companyId)
      ?.branch_id ?? null;
  const directoryBranches =
    scope.directory?.branches.filter(
      (b) => String(b.company_id) === scope.companyId,
    ) ?? [];
  const companyBranches =
    directoryBranches.length > 0
      ? directoryBranches
      : assignedBranchId
        ? [
            {
              id: assignedBranchId,
              company_id: Number(scope.companyId),
              name: `Branch #${assignedBranchId}`,
            },
          ]
        : [];
  const defaultBranch =
    initialValues?.branchId ||
    (scope.branch !== "all"
      ? scope.branch
      : companyBranches.length === 1
        ? String(companyBranches[0].id)
        : "");

  const [branchId, setBranchId] = useState(defaultBranch);
  const [customerId, setCustomerId] = useState(
    initialValues?.customerId ?? "",
  );
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<number[]>(
    initialValues?.vehicleIds ?? [],
  );
  const [startsAt, setStartsAt] = useState(() =>
    initialValues?.startsAt
      ? toLocalDateTimeInput(initialValues.startsAt)
      : toLocalDateTimeInput(24),
  );
  const [endsAt, setEndsAt] = useState(() =>
    initialValues?.endsAt
      ? toLocalDateTimeInput(initialValues.endsAt)
      : toLocalDateTimeInput(72),
  );
  const [discountInput, setDiscountInput] = useState(
    initialValues?.discountPct !== undefined
      ? String(initialValues.discountPct)
      : "0",
  );
  const [notes, setNotes] = useState(initialValues?.notes ?? "");
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
  const [newCustError, setNewCustError] = useState<unknown>(null);
  const [customerNotice, setCustomerNotice] = useState("");
  const [createdCustomers, setCreatedCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    return () => {
      controller.current?.abort();
      custController.current?.abort();
    };
  }, []);

  const settingsQuery = useQuery({
    queryKey: [...scope.key, "company-settings"],
    queryFn: ({ signal }) => getCompanySettings(scope.companyId, signal),
    staleTime: 60_000,
    retry: false,
  });

  const vatRatePct = settingsQuery.data?.vat_rate_pct ?? 15;
  const thresholdPct =
    settingsQuery.data?.discount_approval_threshold_pct ?? 10;
  const currency =
    settingsQuery.data?.currency || scope.company?.currency || "ZMW";

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

  const customerMap = new Map<number, Customer>();
  for (const c of (customers.data?.items ?? []) as Customer[]) {
    customerMap.set(c.id, c);
  }
  for (const c of createdCustomers) {
    if (!branchId || String(c.branch_id) === branchId) customerMap.set(c.id, c);
  }
  const customerItems = Array.from(customerMap.values());
  const vehicleItems = (vehicles.data?.items ?? []) as Vehicle[];

  const selectedVehicles = vehicleItems.filter(
    (v) => selectedVehicleIds.includes(v.id) && v.daily_rate_minor > 0,
  );
  const effectiveSelectedIds = selectedVehicles.map((v) => v.id);
  const parsedDiscount = Number(discountInput);
  const preview = calculateQuotationPreview({
    dailyRatesMinor: selectedVehicles.map((v) => v.daily_rate_minor),
    startsAt,
    endsAt,
    discountPct: Number.isFinite(parsedDiscount) ? parsedDiscount : 0,
    vatRatePct,
    thresholdPct,
  });

  function toggleVehicle(v: Vehicle) {
    if (v.daily_rate_minor <= 0) return;
    setSelectedVehicleIds((prev) =>
      prev.includes(v.id) ? prev.filter((id) => id !== v.id) : [...prev, v.id],
    );
  }

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
      setNewCustEmail("");
      setNewCustPhone("");
      setCustomerNotice(`Customer "${created.name}" added and selected.`);
      void client.invalidateQueries({ queryKey: [...scope.key, "customers"] });
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
    if (effectiveSelectedIds.length === 0) {
      setError(
        new Error("Select at least one priced available vehicle."),
      );
      return;
    }
    const startMs = Date.parse(startsAt);
    const endMs = Date.parse(endsAt);
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
      setError(new Error("Expected return must be after departure."));
      return;
    }
    if (
      discountInput.trim() === "" ||
      Number.isNaN(parsedDiscount) ||
      parsedDiscount < 0 ||
      parsedDiscount > 100
    ) {
      setError(new Error("Enter a discount percentage between 0 and 100."));
      return;
    }

    lock.current = true;
    setBusy(true);
    onBusyChange(true);
    setError(null);
    controller.current = new AbortController();
    try {
      const created = await createQuotation(
        {
          company_id: Number(scope.companyId),
          branch_id: Number(branchId),
          customer_id: Number(customerId),
          vehicle_ids: effectiveSelectedIds,
          starts_at: new Date(startMs).toISOString(),
          ends_at: new Date(endMs).toISOString(),
          discount_pct: parsedDiscount,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
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
      aria-busy={busy || creatingCustomer}
      className="space-y-4"
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
    >
      <fieldset disabled={busy || creatingCustomer} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0 space-y-1.5">
            <label htmlFor={`${formId}-branch`} className="text-sm font-medium">
              Branch
            </label>
            <DriveCoreSelect
              id={`${formId}-branch`}
              value={branchId}
              onValueChange={(next) => {
                setBranchId(next);
                setCustomerId("");
                setSelectedVehicleIds([]);
                setCustomerNotice("");
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
                  className="inline-flex items-center gap-1 text-xs font-medium text-link hover:underline disabled:opacity-50"
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
        </div>

        {showNewCustomer && canManageCustomers ? (
          <div className="space-y-3 rounded-xl border border-border/80 bg-muted/25 p-3.5">
            <p className="text-xs font-medium text-muted-foreground">
              Quick add customer
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label
                  htmlFor={`${formId}-nc-name`}
                  className="text-xs font-medium"
                >
                  Full name
                </label>
                <Input
                  id={`${formId}-nc-name`}
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="Customer full name"
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor={`${formId}-nc-type`}
                  className="text-xs font-medium"
                >
                  Customer type
                </label>
                <DriveCoreSelect
                  id={`${formId}-nc-type`}
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
                  htmlFor={`${formId}-nc-email`}
                  className="text-xs font-medium"
                >
                  Email (optional)
                </label>
                <Input
                  id={`${formId}-nc-email`}
                  type="email"
                  value={newCustEmail}
                  onChange={(e) => setNewCustEmail(e.target.value)}
                  placeholder="customer@example.com"
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor={`${formId}-nc-phone`}
                  className="text-xs font-medium"
                >
                  Phone (optional)
                </label>
                <Input
                  id={`${formId}-nc-phone`}
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  placeholder="+260 97 000 0000"
                />
              </div>
            </div>
            <ErrorAlert error={newCustError} onClear={setNewCustError} />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowNewCustomer(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
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

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">
              Available vehicles ({effectiveSelectedIds.length} selected)
            </span>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {preview.rentalDays} billing day
              {preview.rentalDays === 1 ? "" : "s"}
            </span>
          </div>
          <div className="max-h-52 overflow-y-auto rounded-xl border border-border/80 bg-background">
            {vehicles.isPending ? (
              <p className="p-3 text-xs text-muted-foreground">
                Loading available vehicles…
              </p>
            ) : vehicleItems.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">
                No available vehicles found in this branch.
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {vehicleItems.map((v) => {
                  const unpriced = v.daily_rate_minor <= 0;
                  const checked = !unpriced && selectedVehicleIds.includes(v.id);
                  return (
                    <li
                      key={v.id}
                      className={unpriced ? "bg-muted/20" : undefined}
                    >
                      <div className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs">
                        <label
                          className={`flex min-w-0 flex-1 items-center gap-2.5 ${
                            unpriced
                              ? "cursor-not-allowed opacity-65"
                              : "cursor-pointer"
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={unpriced}
                            checked={checked}
                            onChange={() => toggleVehicle(v)}
                            aria-label={`${v.registration} ${v.make} ${v.model}`}
                            className="size-4 shrink-0 rounded border-input accent-link"
                          />
                          <PlateTag>{v.registration}</PlateTag>
                          <span className="truncate font-medium">
                            {v.make} {v.model}
                          </span>
                        </label>
                        {unpriced ? (
                          <span className="flex shrink-0 items-center gap-2 text-warning-foreground">
                            <span>Set daily rate first</span>
                            {canManageVehicles ? (
                              <Link
                                href={`/companies/${scope.companyId}/vehicles/${v.id}/edit?branch=${scope.branch}`}
                                className="font-medium text-link hover:underline"
                              >
                                Edit
                              </Link>
                            ) : null}
                          </span>
                        ) : (
                          <span className="shrink-0 font-mono text-muted-foreground tabular-nums">
                            {formatMoneyMinor(v.daily_rate_minor, currency)}/day
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label
              htmlFor={`${formId}-discount`}
              className="text-sm font-medium"
            >
              Discount (%)
            </label>
            <Input
              id={`${formId}-discount`}
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={discountInput}
              onChange={(e) => setDiscountInput(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Approval required above {thresholdPct}%.
            </p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-notes`} className="text-sm font-medium">
              Notes (optional)
            </label>
            <Textarea
              id={`${formId}-notes`}
              rows={2}
              maxLength={2000}
              placeholder="Client terms, airport delivery, chauffeur request…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {preview.requiresApproval ? (
          <div
            role="status"
            className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs text-warning-foreground"
          >
            <AlertTriangle
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <p>
              Discount ({parsedDiscount}%) exceeds the company approval
              threshold ({thresholdPct}%). This quotation will enter{" "}
              <strong>Pending approval</strong> until Finance or an Admin
              approves it.
            </p>
          </div>
        ) : null}

        <div className="space-y-1.5 rounded-xl border border-border/80 bg-muted/25 p-3.5 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Subtotal ({effectiveSelectedIds.length} vehicle
              {effectiveSelectedIds.length === 1 ? "" : "s"} ×{" "}
              {preview.rentalDays} day{preview.rentalDays === 1 ? "" : "s"})
            </span>
            <span className="font-mono tabular-nums">
              {formatMoneyMinor(preview.subtotalMinor, currency)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Discount ({Number.isFinite(parsedDiscount) ? parsedDiscount : 0}%)
            </span>
            <span className="font-mono tabular-nums">
              -{formatMoneyMinor(preview.discountMinor, currency)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">VAT ({vatRatePct}%)</span>
            <span className="font-mono tabular-nums">
              {formatMoneyMinor(preview.vatMinor, currency)}
            </span>
          </div>
          <div className="flex justify-between border-t border-border/70 pt-2 text-sm font-semibold">
            <span>Estimated total</span>
            <span className="font-mono tabular-nums">
              {formatMoneyMinor(preview.totalMinor, currency)}
            </span>
          </div>
        </div>
      </fieldset>

      <ErrorAlert error={error} onClear={setError} />

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          disabled={busy || creatingCustomer}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={busy || creatingCustomer}>
          {busy
            ? "Creating…"
            : preview.requiresApproval
              ? "Submit for discount approval"
              : "Create quotation"}
        </Button>
      </div>
    </form>
  );
}

export function CreateQuotationDialog({
  open,
  initialValues,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  initialValues?: QuotationDraftSeed;
  onOpenChange: (open: boolean) => void;
  onCreated: (created: Quotation) => void;
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
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-card sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-4 text-link" aria-hidden="true" />
            {initialValues
              ? "Revise as new quotation"
              : "Create multi-vehicle quotation"}
          </DialogTitle>
          <DialogDescription>
            Select one or more priced available vehicles, apply optional
            discount, and preview VAT-inclusive pricing.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <CreateQuotationForm
            initialValues={initialValues}
            onBusyChange={setBusy}
            onCancel={() => onOpenChange(false)}
            onCreated={(created) => {
              onOpenChange(false);
              onCreated(created);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
