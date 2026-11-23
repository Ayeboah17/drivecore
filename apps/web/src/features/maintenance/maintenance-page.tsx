"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Ban,
  CalendarClock,
  CheckCircle2,
  Clock,
  Fuel,
  PackageMinus,
  Play,
  Plus,
  Wrench,
  X,
} from "lucide-react";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "@/features/live/context";
import { EntityDocumentsPanel } from "@/features/documents/documents-panel";
import { PreventiveSchedulesPanel } from "@/features/operations-srs/preventive-schedules-panel";
import { FuelLogPanel } from "@/features/operations-srs/fuel-log-panel";
import { IncidentsPanel } from "@/features/srs-parity/incidents-panel";
import { listRecords } from "@/features/records/service";
import { listParts } from "@/features/inventory/service";
import {
  cancelWorkOrder,
  completeWorkOrder,
  consumeWorkOrderParts,
  createWorkOrder,
  getVehicleSummary,
  getWorkOrder,
  listWorkOrders,
  startWorkOrder,
} from "@/features/maintenance/service";
import { ApiError, errorText } from "@/lib/api/client";
import {
  can,
  canAccessMaintenance,
  formatMoneyMinor,
  parseMajorToMinor,
  type Vehicle,
  type WorkOrder,
} from "@/lib/api/contracts";
import {
  humanizeFieldLabel,
  humanizeFieldMessage,
} from "@/lib/api/error-format";
import { nextSortState, parseSortParams, sortRows } from "@/lib/table-sort";
import {
  DataSearchForm,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableFrame,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  DataTableSkeleton,
  PlateTag,
  StatusDotBadge,
  type ActiveFilterChip,
  type StatusDotTone,
} from "@/components/data/data-table";
import { StatePanel } from "@/components/layout/state-panel";
import { ViewFadeIn } from "@/components/motion/primitives";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DriveCoreDateField } from "@/components/ui/drivecore-calendar";
import { DriveCoreSelect } from "@/components/ui/drivecore-select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

const WO_STATUS_TONES: Record<WorkOrder["status"], StatusDotTone> = {
  open: "info",
  in_progress: "warning",
  completed: "success",
  cancelled: "danger",
};

const WO_STATUS_LABELS: Record<WorkOrder["status"], string> = {
  open: "Open",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const WO_SORT_KEYS = [
  "id",
  "vehicle_registration",
  "title",
  "due_at",
  "total_cost_minor",
  "status",
] as const;

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

function ErrorBox({
  error,
  conflictMessage,
}: {
  error: unknown;
  conflictMessage?: string;
}) {
  if (!error) return null;
  if (error instanceof ApiError && error.status === 409 && conflictMessage) {
    return (
      <p
        role="alert"
        className="rounded-xl border border-danger bg-danger/10 px-3.5 py-2.5 text-sm text-danger-foreground"
      >
        {conflictMessage}
      </p>
    );
  }
  const fields =
    error instanceof ApiError && error.fields
      ? Object.entries(error.fields)
      : [];
  return (
    <div
      role="alert"
      className="space-y-1 rounded-xl border border-danger bg-danger/10 px-3.5 py-2.5 text-sm text-danger-foreground"
    >
      <p className="font-medium">{errorText(error)}</p>
      {fields.length > 0 ? (
        <ul className="list-disc space-y-0.5 pl-4 text-xs">
          {fields.map(([key, msgs]) => (
            <li key={key}>
              <span className="font-semibold">{humanizeFieldLabel(key)}:</span>{" "}
              {msgs.map(humanizeFieldMessage).join(" ")}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function LiveMaintenancePage() {
  const { user } = useSession();
  const scope = useLiveContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const client = useQueryClient();

  const canAccess = !!user && canAccessMaintenance(user);
  const canManage = !!user && can(user, "work_orders.manage");
  const currency = scope.company?.currency || "ZMW";

  const rawTab = searchParams.get("tab");
  const activeTab: "work_orders" | "incidents" | "schedules" | "fuel" =
    rawTab === "incidents"
      ? "incidents"
      : rawTab === "schedules"
        ? "schedules"
        : rawTab === "fuel"
          ? "fuel"
          : "work_orders";

  const rawQ = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "";
  const rawPage = Number(searchParams.get("page") ?? "1");
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const { sort, dir } = parseSortParams(
    searchParams.get("sort"),
    searchParams.get("dir"),
    WO_SORT_KEYS,
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const branchId = scope.branch !== "all" ? scope.branch : undefined;
  const branchSuffix = `?branch=${encodeURIComponent(scope.branch)}`;

  function updateQuery(updates: Record<string, string | number | undefined>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined || v === "" || (k === "page" && v === 1)) {
        next.delete(k);
      } else {
        next.set(k, String(v));
      }
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function handleSort(clickedKey: string) {
    const next = nextSortState(sort, dir, clickedKey);
    updateQuery({ sort: next.sort, dir: next.dir, page: 1 });
  }

  const query = useQuery({
    queryKey: [
      ...scope.key,
      "work-orders",
      "list",
      branchId ?? "all",
      status,
      rawQ,
      page,
      sort,
      dir,
    ],
    queryFn: ({ signal }) =>
      listWorkOrders(
        {
          companyId: scope.companyId,
          branchId,
          status: status || undefined,
          q: rawQ,
          page,
          sort: sort || undefined,
          dir,
        },
        signal,
      ),
    enabled: canAccess,
  });

  if (!canAccess) {
    return (
      <StatePanel title="Access denied">
        Your account does not have permission to view Maintenance work orders.
      </StatePanel>
    );
  }

  const chips: ActiveFilterChip[] = [];
  if (rawQ) {
    chips.push({
      key: "q",
      label: `Search: ${rawQ}`,
      onRemove: () => updateQuery({ q: "", page: 1 }),
    });
  }
  if (status) {
    chips.push({
      key: "status",
      label: `Status: ${WO_STATUS_LABELS[status as WorkOrder["status"]] ?? status}`,
      onRemove: () => updateQuery({ status: "", page: 1 }),
    });
  }

  return (
    <ViewFadeIn className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-page-title font-extrabold tracking-tight">
            Maintenance
          </h1>
          <p className="text-sm text-muted-foreground">
            Workshop work orders, spare part consumption, and vehicle service
            availability.
          </p>
        </div>
        {canManage && activeTab === "work_orders" ? (
          <Button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="gap-1.5"
          >
            <Plus className="size-4" aria-hidden="true" />
            New work order
          </Button>
        ) : null}
      </div>

      <div
        role="tablist"
        aria-label="Maintenance sections"
        className="flex flex-wrap gap-1.5 rounded-2xl border bg-surface p-1.5"
      >
        {(
          [
            ["work_orders", "Work orders"],
            ["incidents", "Incidents"],
            ["schedules", "Preventive schedules"],
            ["fuel", "Fuel log"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={activeTab === key}
            onClick={() =>
              updateQuery({ tab: key === "work_orders" ? "" : key, page: 1 })
            }
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
              activeTab === key
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            }`}
          >
            {key === "work_orders" ? (
              <Wrench className="size-3.5" aria-hidden="true" />
            ) : key === "incidents" ? (
              <AlertTriangle className="size-3.5" aria-hidden="true" />
            ) : key === "schedules" ? (
              <CalendarClock className="size-3.5" aria-hidden="true" />
            ) : (
              <Fuel className="size-3.5" aria-hidden="true" />
            )}
            {label}
          </button>
        ))}
      </div>

      {notice ? (
        <div
          role="status"
          className="flex items-center justify-between gap-2 rounded-2xl border border-success bg-success/10 px-4 py-3 text-sm text-success-foreground"
        >
          <span>{notice}</span>
          <button
            type="button"
            aria-label="Dismiss notice"
            onClick={() => setNotice("")}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {activeTab === "incidents" ? (
        <IncidentsPanel
          canManage={canManage || (!!user && can(user, "vehicles.manage"))}
          onWorkOrderCreated={(msg) => setNotice(msg)}
        />
      ) : activeTab === "schedules" ? (
        <PreventiveSchedulesPanel
          canManage={canManage}
          onWorkOrderOpened={(msg) => {
            setNotice(msg);
          }}
        />
      ) : activeTab === "fuel" ? (
        <FuelLogPanel canManage={canManage || !!user && can(user, "vehicles.manage")} />
      ) : (
      <DataTableFrame
        ariaLabel="Maintenance work orders table"
        chips={chips}
        toolbar={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <DataSearchForm
              label="Search work orders"
              placeholder="Search title, vehicle plate, or notes…"
              defaultValue={rawQ}
              formKey={`wo:${scope.companyId}:${scope.branch}:${rawQ}`}
              onSubmitQuery={(nextQ) => updateQuery({ q: nextQ, page: 1 })}
            />
            <div className="w-full space-y-1.5 sm:w-52">
              <span className="block text-label font-semibold">Status</span>
              <DriveCoreSelect
                ariaLabel="Filter work orders by status"
                value={status}
                onValueChange={(nextStatus) =>
                  updateQuery({ status: nextStatus, page: 1 })
                }
                options={[
                  { value: "", label: "All statuses" },
                  { value: "open", label: "Open" },
                  { value: "in_progress", label: "In progress" },
                  { value: "completed", label: "Completed" },
                  { value: "cancelled", label: "Cancelled" },
                ]}
              />
            </div>
          </div>
        }
        footer={
          query.data ? (
            <>
              <span className="font-mono text-xs tabular-nums">
                {query.data.total}{" "}
                {query.data.total === 1 ? "work order" : "work orders"} · Page{" "}
                {query.data.page} of {query.data.lastPage}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={page <= 1 || query.isFetching}
                  onClick={() => updateQuery({ page: Math.max(1, page - 1) })}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={page >= query.data.lastPage || query.isFetching}
                  onClick={() => updateQuery({ page: page + 1 })}
                >
                  Next
                </Button>
              </div>
            </>
          ) : undefined
        }
      >
        {query.isPending ? (
          <DataTableSkeleton columns={7} label="Loading work orders" />
        ) : query.error ? (
          <div className="p-card">
            <StatePanel
              title="Work orders unavailable"
              onRetry={() => {
                void query.refetch();
              }}
            >
              {errorText(query.error)}
            </StatePanel>
          </div>
        ) : query.data.items.length === 0 ? (
          <div className="p-card">
            <StatePanel
              title={
                chips.length > 0 ? "No matching work orders" : "No work orders yet"
              }
            >
              {chips.length > 0
                ? "Try clearing your search or status filter."
                : "Create a work order to schedule vehicle servicing and track parts/labour costs."}
            </StatePanel>
          </div>
        ) : (
          <DataTable>
            <DataTableHead>
              <tr>
                <DataTableHeaderCell
                  sortKey="id"
                  activeSort={sort}
                  activeDir={dir}
                  onSort={handleSort}
                >
                  WO #
                </DataTableHeaderCell>
                <DataTableHeaderCell
                  sortKey="vehicle_registration"
                  activeSort={sort}
                  activeDir={dir}
                  onSort={handleSort}
                >
                  Vehicle
                </DataTableHeaderCell>
                <DataTableHeaderCell
                  sortKey="title"
                  activeSort={sort}
                  activeDir={dir}
                  onSort={handleSort}
                >
                  Service title
                </DataTableHeaderCell>
                <DataTableHeaderCell
                  sortKey="due_at"
                  activeSort={sort}
                  activeDir={dir}
                  onSort={handleSort}
                >
                  Due date
                </DataTableHeaderCell>
                <DataTableHeaderCell
                  align="right"
                  sortKey="total_cost_minor"
                  activeSort={sort}
                  activeDir={dir}
                  onSort={handleSort}
                >
                  Total cost
                </DataTableHeaderCell>
                <DataTableHeaderCell
                  sortKey="status"
                  activeSort={sort}
                  activeDir={dir}
                  onSort={handleSort}
                >
                  Status
                </DataTableHeaderCell>
                <DataTableHeaderCell align="right">Actions</DataTableHeaderCell>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {sortRows(query.data.items, sort, dir, {
                id: (w) => w.id,
                vehicle_registration: (w) => w.vehicle_registration ?? "",
                title: (w) => w.title,
                due_at: (w) => Date.parse(w.due_at),
                total_cost_minor: (w) =>
                  w.total_cost_minor || w.labour_cost_minor + w.parts_cost_minor,
                status: (w) => w.status,
              }).map((wo) => {
                const total =
                  wo.total_cost_minor || wo.labour_cost_minor + wo.parts_cost_minor;
                return (
                  <DataTableRow key={wo.id}>
                    <DataTableCell numeric>
                      <Link
                        href={`/companies/${scope.companyId}/maintenance/${wo.id}${branchSuffix}`}
                        className="font-semibold text-foreground hover:text-link hover:underline"
                      >
                        #{wo.id}
                      </Link>
                    </DataTableCell>
                    <DataTableCell>
                      <PlateTag>
                        {wo.vehicle_registration ?? `Vehicle #${wo.vehicle_id}`}
                      </PlateTag>
                    </DataTableCell>
                    <DataTableCell className="max-w-[16rem] truncate font-medium">
                      {wo.title}
                    </DataTableCell>
                    <DataTableCell numeric>{fmtDate(wo.due_at)}</DataTableCell>
                    <DataTableCell align="right" numeric className="font-semibold">
                      {formatMoneyMinor(total, currency)}
                    </DataTableCell>
                    <DataTableCell>
                      <StatusDotBadge tone={WO_STATUS_TONES[wo.status]}>
                        {WO_STATUS_LABELS[wo.status]}
                      </StatusDotBadge>
                    </DataTableCell>
                    <DataTableCell align="right">
                      <Link
                        href={`/companies/${scope.companyId}/maintenance/${wo.id}${branchSuffix}`}
                        className="text-xs font-semibold text-link hover:underline"
                      >
                        Open
                      </Link>
                    </DataTableCell>
                  </DataTableRow>
                );
              })}
            </DataTableBody>
          </DataTable>
        )}
      </DataTableFrame>
      )}

      <CreateWorkOrderDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(created) => {
          setNotice(`Work order #${created.id} created.`);
          void client.invalidateQueries({
            queryKey: [...scope.key, "work-orders"],
          });
          router.push(
            `/companies/${scope.companyId}/maintenance/${created.id}${branchSuffix}`,
          );
        }}
      />
    </ViewFadeIn>
  );
}

export function CreateWorkOrderDialog({
  open,
  defaultVehicleId,
  defaultBranchId,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  defaultVehicleId?: number;
  defaultBranchId?: number;
  onOpenChange: (open: boolean) => void;
  onCreated: (wo: WorkOrder) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && busy) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton={!busy}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-card sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="size-4 text-link" aria-hidden="true" />
            New work order
          </DialogTitle>
          <DialogDescription>
            Schedule workshop maintenance for a vehicle. Starting the work order
            locks the vehicle into maintenance status.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <CreateWorkOrderForm
            defaultVehicleId={defaultVehicleId}
            defaultBranchId={defaultBranchId}
            onBusyChange={setBusy}
            onCancel={() => onOpenChange(false)}
            onCreated={(wo) => {
              onOpenChange(false);
              onCreated(wo);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CreateWorkOrderForm({
  defaultVehicleId,
  defaultBranchId,
  onBusyChange,
  onCancel,
  onCreated,
}: {
  defaultVehicleId?: number;
  defaultBranchId?: number;
  onBusyChange: (busy: boolean) => void;
  onCancel: () => void;
  onCreated: (wo: WorkOrder) => void;
}) {
  const session = useSession();
  const scope = useLiveContext();
  const formId = useId();
  const currency = scope.company?.currency || "ZMW";

  const companyBranches = useMemo(() => {
    const fromDir = (scope.directory?.branches ?? []).filter(
      (b) => String(b.company_id) === scope.companyId,
    );
    if (fromDir.length > 0) return fromDir;
    const membership = session.user?.companies.find(
      (c) => String(c.id) === scope.companyId,
    );
    if (membership?.branch_id) {
      return [
        {
          id: membership.branch_id,
          company_id: Number(scope.companyId),
          name: `Branch #${membership.branch_id}`,
        },
      ];
    }
    return [];
  }, [scope.directory?.branches, scope.companyId, session.user?.companies]);

  const initialBranch = defaultBranchId
    ? String(defaultBranchId)
    : scope.branch !== "all"
      ? scope.branch
      : companyBranches[0]
        ? String(companyBranches[0].id)
        : "";

  const [branchId, setBranchId] = useState(initialBranch);
  const [vehicleId, setVehicleId] = useState(
    defaultVehicleId ? String(defaultVehicleId) : "",
  );
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(() =>
    new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10),
  );
  const [labourText, setLabourText] = useState("0.00");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const vehiclesQuery = useQuery({
    queryKey: [...scope.key, "wo-vehicles", branchId],
    queryFn: ({ signal }) =>
      listRecords(
        "vehicles",
        {
          companyId: scope.companyId,
          branch: branchId || "all",
          q: "",
          filter: "",
          page: 1,
        },
        signal,
      ),
    enabled: !!branchId,
  });
  const vehicleItems = (vehiclesQuery.data?.items ?? []) as Vehicle[];

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    if (!branchId) {
      setError(new Error("Select a branch."));
      return;
    }
    if (!vehicleId) {
      setError(new Error("Select a vehicle."));
      return;
    }
    if (!title.trim()) {
      setError(new Error("Enter a service title."));
      return;
    }
    const labourMinor = parseMajorToMinor(labourText);
    if (labourMinor === null || labourMinor < 0) {
      setError(new Error("Enter a valid labour cost (e.g. 250.00)."));
      return;
    }
    lock.current = true;
    setBusy(true);
    onBusyChange(true);
    setError(null);
    controller.current = new AbortController();
    try {
      const created = await createWorkOrder(
        {
          company_id: Number(scope.companyId),
          branch_id: Number(branchId),
          vehicle_id: Number(vehicleId),
          title: title.trim(),
          due_at: new Date(`${dueDate}T17:00:00Z`).toISOString(),
          labour_cost_minor: labourMinor,
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
      aria-busy={busy}
      className="space-y-4"
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
    >
      <fieldset disabled={busy} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-branch`} className="text-sm font-medium">
              Branch
            </label>
            <DriveCoreSelect
              id={`${formId}-branch`}
              value={branchId}
              onValueChange={(next) => {
                setBranchId(next);
                if (!defaultVehicleId) setVehicleId("");
              }}
              options={[
                { value: "", label: "Select branch" },
                ...companyBranches.map((b) => ({
                  value: String(b.id),
                  label: b.name,
                })),
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-vehicle`} className="text-sm font-medium">
              Vehicle
            </label>
            <DriveCoreSelect
              id={`${formId}-vehicle`}
              value={vehicleId}
              onValueChange={setVehicleId}
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

        <div className="space-y-1.5">
          <label htmlFor={`${formId}-title`} className="text-sm font-medium">
            Service title
          </label>
          <Input
            id={`${formId}-title`}
            maxLength={255}
            placeholder="e.g. 60,000 km major service & brake pads"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-due`} className="text-sm font-medium">
              Due date
            </label>
            <DriveCoreDateField
              id={`${formId}-due`}
              label="Due date"
              value={dueDate}
              onChange={setDueDate}
              optional
              disabled={busy}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-labour`} className="text-sm font-medium">
              Estimated labour ({currency})
            </label>
            <Input
              id={`${formId}-labour`}
              inputMode="decimal"
              value={labourText}
              onChange={(e) => setLabourText(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor={`${formId}-notes`} className="text-sm font-medium">
            Workshop notes (optional)
          </label>
          <Textarea
            id={`${formId}-notes`}
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </fieldset>

      <ErrorBox error={error} />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create work order"}
        </Button>
      </div>
    </form>
  );
}

export function LiveWorkOrderDetailPage({
  workOrderId,
}: {
  workOrderId: string;
}) {
  const { user } = useSession();
  const scope = useLiveContext();
  const client = useQueryClient();

  const valid =
    /^[1-9]\d*$/.test(workOrderId ?? "") &&
    Number.isSafeInteger(Number(workOrderId));
  const canView = !!user && can(user, "work_orders.view");
  const canManage = !!user && can(user, "work_orders.manage");
  const canViewDocs = !!user && can(user, "documents.view");
  const canUploadDocs = !!user && can(user, "documents.manage");
  const currency = scope.company?.currency || "ZMW";

  const [notice, setNotice] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busyAction, setBusyAction] = useState<"" | "start" | "cancel">("");
  const [consumeOpen, setConsumeOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);

  const query = useQuery({
    queryKey: [...scope.key, "work-orders", "detail", workOrderId],
    queryFn: ({ signal }) => getWorkOrder(workOrderId, signal),
    enabled: valid && canView,
    staleTime: 0,
  });

  const backHref = `/companies/${scope.companyId}/maintenance?branch=${encodeURIComponent(scope.branch)}`;

  async function refreshAll() {
    await Promise.all([
      client.invalidateQueries({ queryKey: [...scope.key, "work-orders"] }),
      client.invalidateQueries({ queryKey: [...scope.key, "vehicles"] }),
      client.invalidateQueries({ queryKey: [...scope.key, "parts"] }),
      client.invalidateQueries({ queryKey: [...scope.key, "stock-movements"] }),
      client.invalidateQueries({ queryKey: [...scope.key, "expenses"] }),
      client.invalidateQueries({ queryKey: [...scope.key, "gl"] }),
    ]);
  }

  if (!valid) {
    return (
      <StatePanel
        title="Page unavailable"
        href={backHref}
        linkLabel="Back to maintenance"
      >
        The work order URL is invalid.
      </StatePanel>
    );
  }
  if (!canView) {
    return (
      <StatePanel title="Access denied">
        Your account does not have permission to view work orders.
      </StatePanel>
    );
  }
  if (query.isPending) {
    return (
      <div role="status" className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-44 w-full rounded-2xl" />
      </div>
    );
  }
  if (query.error || !query.data) {
    return (
      <StatePanel
        title="Work order unavailable"
        onRetry={() => {
          void query.refetch();
        }}
      >
        {errorText(query.error)}
      </StatePanel>
    );
  }

  const wo = query.data;
  const totalCost = wo.total_cost_minor || wo.labour_cost_minor + wo.parts_cost_minor;

  async function handleStart() {
    if (busyAction) return;
    setBusyAction("start");
    setError(null);
    const ac = new AbortController();
    try {
      await startWorkOrder(wo.id, ac.signal);
      setNotice(`Work order #${wo.id} started — vehicle moved to maintenance.`);
      await refreshAll();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusyAction("");
    }
  }

  async function handleCancel() {
    if (busyAction) return;
    setBusyAction("cancel");
    setError(null);
    const ac = new AbortController();
    try {
      await cancelWorkOrder(wo.id, ac.signal);
      setNotice(`Work order #${wo.id} cancelled.`);
      await refreshAll();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusyAction("");
    }
  }

  return (
    <ViewFadeIn className="space-y-6">
      <Link
        className="inline-block text-sm text-link hover:underline"
        href={backHref}
      >
        Back to maintenance
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-page-title font-extrabold tracking-tight">
              Work order #{wo.id}
            </h1>
            <StatusDotBadge tone={WO_STATUS_TONES[wo.status]}>
              {WO_STATUS_LABELS[wo.status]}
            </StatusDotBadge>
            <Link
              href={`/companies/${scope.companyId}/vehicles/${wo.vehicle_id}?branch=${encodeURIComponent(scope.branch)}`}
            >
              <PlateTag>
                {wo.vehicle_registration ?? `Vehicle #${wo.vehicle_id}`}
              </PlateTag>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            {wo.title} · Due {fmtDate(wo.due_at)}
          </p>
        </div>

        {canManage ? (
          <div className="flex flex-wrap gap-2">
            {wo.status === "open" ? (
              <>
                <Button
                  type="button"
                  disabled={busyAction !== ""}
                  onClick={() => {
                    void handleStart();
                  }}
                  className="gap-1.5"
                >
                  <Play className="size-4" aria-hidden="true" />
                  {busyAction === "start" ? "Starting…" : "Start work"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busyAction !== ""}
                  onClick={() => {
                    void handleCancel();
                  }}
                  className="gap-1.5"
                >
                  <Ban className="size-4" aria-hidden="true" />
                  Cancel
                </Button>
              </>
            ) : null}
            {wo.status === "in_progress" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConsumeOpen(true)}
                  className="gap-1.5"
                >
                  <PackageMinus className="size-4" aria-hidden="true" />
                  Consume parts
                </Button>
                <Button
                  type="button"
                  onClick={() => setCompleteOpen(true)}
                  className="gap-1.5"
                >
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  Complete work order
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {notice ? (
        <div
          role="status"
          className="flex items-center justify-between gap-2 rounded-2xl border border-success bg-success/10 px-4 py-3 text-sm text-success-foreground"
        >
          <span>{notice}</span>
          <button
            type="button"
            aria-label="Dismiss notice"
            onClick={() => setNotice("")}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <ErrorBox
        error={error}
        conflictMessage="Cannot start maintenance while the vehicle is rented, has an active/future confirmed reservation, or has another work order in progress."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="dc-shadow-card rounded-2xl border bg-surface p-4">
          <p className="text-label text-muted-foreground">Labour cost</p>
          <p className="mt-1 font-mono text-lg font-extrabold tabular-nums">
            {formatMoneyMinor(wo.labour_cost_minor, currency)}
          </p>
        </div>
        <div className="dc-shadow-card rounded-2xl border bg-surface p-4">
          <p className="text-label text-muted-foreground">Parts consumed</p>
          <p className="mt-1 font-mono text-lg font-extrabold tabular-nums">
            {formatMoneyMinor(wo.parts_cost_minor, currency)}
          </p>
        </div>
        <div className="dc-shadow-card rounded-2xl border bg-surface p-4">
          <p className="text-label text-muted-foreground">Total cost</p>
          <p className="mt-1 font-mono text-lg font-extrabold tabular-nums">
            {formatMoneyMinor(totalCost, currency)}
          </p>
        </div>
      </div>

      <section className="dc-shadow-card space-y-3 rounded-2xl border bg-surface p-card">
        <h2 className="text-section-heading">Parts consumed on this job</h2>
        {wo.movements.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No spare parts have been consumed on this work order yet.
          </p>
        ) : (
          <DataTable>
            <DataTableHead>
              <tr>
                <DataTableHeaderCell>Part</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Qty used</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Unit cost</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Line cost</DataTableHeaderCell>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {wo.movements.map((m) => (
                <DataTableRow key={m.id}>
                  <DataTableCell className="font-medium">
                    {m.part_sku ? `${m.part_sku} · ` : ""}
                    {m.part_name ?? `Part #${m.part_id}`}
                  </DataTableCell>
                  <DataTableCell align="right" numeric>
                    {Math.abs(m.quantity)}
                  </DataTableCell>
                  <DataTableCell align="right" numeric>
                    {formatMoneyMinor(m.unit_cost_minor, currency)}
                  </DataTableCell>
                  <DataTableCell align="right" numeric className="font-semibold">
                    {formatMoneyMinor(
                      Math.abs(m.quantity) * m.unit_cost_minor,
                      currency,
                    )}
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </section>

      {canViewDocs ? (
        <EntityDocumentsPanel
          entityType="work_order"
          entityId={wo.id}
          branchId={wo.branch_id}
          canUpload={canUploadDocs}
        />
      ) : null}

      <ConsumePartsDialog
        workOrder={consumeOpen ? wo : null}
        onClose={() => setConsumeOpen(false)}
        onConsumed={() => {
          setNotice("Spare parts deducted from inventory and posted to WIP.");
          void refreshAll();
        }}
      />

      <CompleteWorkOrderDialog
        workOrder={completeOpen ? wo : null}
        currency={currency}
        onClose={() => setCompleteOpen(false)}
        onCompleted={() => {
          setNotice(
            `Work order #${wo.id} completed — vehicle restored to available and maintenance expense posted.`,
          );
          void refreshAll();
        }}
      />
    </ViewFadeIn>
  );
}

function ConsumePartsDialog({
  workOrder,
  onClose,
  onConsumed,
}: {
  workOrder: WorkOrder | null;
  onClose: () => void;
  onConsumed: () => void;
}) {
  const scope = useLiveContext();
  const formId = useId();
  const [partId, setPartId] = useState("");
  const [qty, setQty] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const partsQuery = useQuery({
    queryKey: [...scope.key, "parts", "picker", workOrder?.branch_id],
    queryFn: ({ signal }) =>
      listParts(
        {
          companyId: scope.companyId,
          branchId: workOrder ? String(workOrder.branch_id) : undefined,
        },
        signal,
      ),
    enabled: !!workOrder,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!workOrder || busy) return;
    if (!partId) {
      setError(new Error("Select a spare part."));
      return;
    }
    if (!/^[1-9]\d*$/.test(qty.trim())) {
      setError(new Error("Enter a whole quantity of at least 1."));
      return;
    }
    setBusy(true);
    setError(null);
    const ac = new AbortController();
    try {
      await consumeWorkOrderParts(
        workOrder.id,
        { part_id: Number(partId), quantity: Number(qty.trim()) },
        ac.signal,
      );
      setPartId("");
      setQty("1");
      onClose();
      onConsumed();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={!!workOrder}
      onOpenChange={(next) => {
        if (!next && !busy) {
          setError(null);
          onClose();
        }
      }}
    >
      <DialogContent className="rounded-2xl p-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Consume spare parts</DialogTitle>
          <DialogDescription>
            Deducts stock atomically from this branch&apos;s inventory.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-part`} className="text-sm font-medium">
              Spare part
            </label>
            <DriveCoreSelect
              id={`${formId}-part`}
              value={partId}
              onValueChange={setPartId}
              options={[
                { value: "", label: "Select part" },
                ...(partsQuery.data?.items ?? []).map((p) => ({
                  value: String(p.id),
                  label: `${p.sku} · ${p.name} (${p.on_hand} on hand)`,
                })),
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-qty`} className="text-sm font-medium">
              Quantity
            </label>
            <Input
              id={`${formId}-qty`}
              inputMode="numeric"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </div>
          <ErrorBox error={error} />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Consuming…" : "Consume parts"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CompleteWorkOrderDialog({
  workOrder,
  currency,
  onClose,
  onCompleted,
}: {
  workOrder: WorkOrder | null;
  currency: string;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const formId = useId();
  const [labourText, setLabourText] = useState(
    workOrder ? (workOrder.labour_cost_minor / 100).toFixed(2) : "0.00",
  );
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!workOrder || busy) return;
    const labourMinor = parseMajorToMinor(labourText);
    if (labourMinor === null || labourMinor < 0) {
      setError(new Error("Enter a valid final labour cost."));
      return;
    }
    setBusy(true);
    setError(null);
    const ac = new AbortController();
    try {
      await completeWorkOrder(
        workOrder.id,
        {
          labour_cost_minor: labourMinor,
          ...(notes.trim() ? { completion_notes: notes.trim() } : {}),
        },
        ac.signal,
      );
      onClose();
      onCompleted();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={!!workOrder}
      onOpenChange={(next) => {
        if (!next && !busy) {
          setError(null);
          onClose();
        }
      }}
    >
      <DialogContent className="rounded-2xl p-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete work order</DialogTitle>
          <DialogDescription>
            Restores the vehicle to available and posts a maintenance expense to
            Finance &amp; GL.
          </DialogDescription>
        </DialogHeader>
        <form
          key={workOrder?.id}
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-labour`} className="text-sm font-medium">
              Final labour cost ({currency})
            </label>
            <Input
              id={`${formId}-labour`}
              inputMode="decimal"
              value={labourText}
              onChange={(e) => setLabourText(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-notes`} className="text-sm font-medium">
              Completion notes (optional)
            </label>
            <Textarea
              id={`${formId}-notes`}
              rows={3}
              placeholder="Summary of repairs and road-test result…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <ErrorBox error={error} />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Completing…" : "Confirm completion"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Honest live Vehicle 360 rollup embedded on Vehicle Detail. */
export function Vehicle360Panel({ vehicle }: { vehicle: Vehicle }) {
  const { user } = useSession();
  const scope = useLiveContext();
  const router = useRouter();
  const client = useQueryClient();
  const [woOpen, setWoOpen] = useState(false);

  const canManageWo = !!user && can(user, "work_orders.manage");
  const canViewFinance = !!user && can(user, "invoices.view");
  const currency = scope.company?.currency || "ZMW";
  const branchSuffix = `?branch=${encodeURIComponent(scope.branch)}`;

  const summaryQuery = useQuery({
    queryKey: [...scope.key, "vehicles", "summary", vehicle.id],
    queryFn: ({ signal }) => getVehicleSummary(vehicle.id, signal),
    retry: false,
  });

  if (summaryQuery.error) {
    // Gracefully hide if backend hasn't deployed PR #12 yet
    return null;
  }

  const data = summaryQuery.data;

  return (
    <section
      aria-label="Vehicle 360 summary"
      className="dc-shadow-card space-y-4 rounded-2xl border bg-surface p-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wrench className="size-4 text-link" aria-hidden="true" />
          <h2 className="text-section-heading">Vehicle 360</h2>
        </div>
        {canManageWo ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setWoOpen(true)}
            className="gap-1.5"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            New work order
          </Button>
        ) : null}
      </div>

      {summaryQuery.isPending || !data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border bg-background/60 p-3.5">
              <p className="text-xs font-medium text-muted-foreground">
                Work orders
              </p>
              <p className="mt-1 font-mono text-base font-extrabold tabular-nums">
                {data.work_order_count}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  ({data.open_work_order_count} open)
                </span>
              </p>
            </div>
            <div className="rounded-xl border bg-background/60 p-3.5">
              <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <Clock className="size-3.5" aria-hidden="true" />
                Workshop downtime
              </p>
              <p className="mt-1 font-mono text-base font-extrabold tabular-nums">
                {data.total_downtime_hours.toFixed(1)} hrs
              </p>
            </div>
            {canViewFinance && data.cumulative_revenue_minor !== null ? (
              <>
                <div className="rounded-xl border bg-background/60 p-3.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Cumulative revenue
                  </p>
                  <p className="mt-1 font-mono text-base font-extrabold tabular-nums">
                    {formatMoneyMinor(data.cumulative_revenue_minor, currency)}
                  </p>
                </div>
                <div className="rounded-xl border bg-background/60 p-3.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Net vehicle ROI
                  </p>
                  <p
                    className={`mt-1 font-mono text-base font-extrabold tabular-nums ${
                      (data.net_roi_minor ?? 0) >= 0
                        ? "text-success-foreground"
                        : "text-danger-foreground"
                    }`}
                  >
                    {formatMoneyMinor(data.net_roi_minor ?? 0, currency)}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground tabular-nums">
                    Maint:{" "}
                    {formatMoneyMinor(data.maintenance_cost_minor ?? 0, currency)}
                    {data.other_expenses_minor
                      ? ` · Other: ${formatMoneyMinor(data.other_expenses_minor, currency)}`
                      : ""}
                  </p>
                </div>
              </>
            ) : null}
          </div>

          {data.recent_work_orders.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Recent work orders
              </p>
              <DataTable>
                <DataTableHead>
                  <tr>
                    <DataTableHeaderCell>WO #</DataTableHeaderCell>
                    <DataTableHeaderCell>Service</DataTableHeaderCell>
                    <DataTableHeaderCell>Status</DataTableHeaderCell>
                    <DataTableHeaderCell align="right">Cost</DataTableHeaderCell>
                  </tr>
                </DataTableHead>
                <DataTableBody>
                  {data.recent_work_orders.map((wo) => (
                    <DataTableRow key={wo.id}>
                      <DataTableCell numeric>
                        <Link
                          href={`/companies/${scope.companyId}/maintenance/${wo.id}${branchSuffix}`}
                          className="font-semibold text-link hover:underline"
                        >
                          #{wo.id}
                        </Link>
                      </DataTableCell>
                      <DataTableCell className="font-medium">
                        {wo.title}
                      </DataTableCell>
                      <DataTableCell>
                        <StatusDotBadge tone={WO_STATUS_TONES[wo.status]}>
                          {WO_STATUS_LABELS[wo.status]}
                        </StatusDotBadge>
                      </DataTableCell>
                      <DataTableCell align="right" numeric>
                        {formatMoneyMinor(
                          wo.total_cost_minor ||
                            wo.labour_cost_minor + wo.parts_cost_minor,
                          currency,
                        )}
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </div>
          ) : null}
        </>
      )}

      <CreateWorkOrderDialog
        open={woOpen}
        defaultVehicleId={vehicle.id}
        defaultBranchId={vehicle.branch_id}
        onOpenChange={setWoOpen}
        onCreated={(created) => {
          void client.invalidateQueries({
            queryKey: [...scope.key, "vehicles", "summary", vehicle.id],
          });
          router.push(
            `/companies/${scope.companyId}/maintenance/${created.id}${branchSuffix}`,
          );
        }}
      />
    </section>
  );
}
