"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeftRight,
  Package,
  Plus,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "@/features/live/context";
import {
  adjustPartStock,
  createPart,
  listParts,
  listStockMovements,
  updatePart,
} from "@/features/inventory/service";
import { ApiError, errorText } from "@/lib/api/client";
import {
  can,
  canAccessInventory,
  formatMoneyMinor,
  parseMajorToMinor,
  type PartRecord,
} from "@/lib/api/contracts";
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
  StatusDotBadge,
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
import { DriveCoreSelect } from "@/components/ui/drivecore-select";
import { Input } from "@/components/ui/input";

type InventoryTab = "parts" | "movements";

const PART_SORT_KEYS = [
  "sku",
  "name",
  "unit_cost_minor",
  "on_hand",
  "min_stock",
] as const;
const MOVE_SORT_KEYS = [
  "created_at",
  "part_name",
  "quantity",
  "unit_cost_minor",
] as const;

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

export function LiveInventoryPage() {
  const { user } = useSession();
  const scope = useLiveContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const client = useQueryClient();

  const canAccess = !!user && canAccessInventory(user);
  const canManage = !!user && can(user, "parts.manage");
  const currency = scope.company?.currency || "ZMW";

  const activeTab: InventoryTab =
    searchParams.get("tab") === "movements" ? "movements" : "parts";
  const rawQ = searchParams.get("q") ?? "";
  const lowOnly = searchParams.get("low") === "1";
  const rawPage = Number(searchParams.get("page") ?? "1");
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const { sort, dir } = parseSortParams(
    searchParams.get("sort"),
    searchParams.get("dir"),
    activeTab === "parts" ? PART_SORT_KEYS : MOVE_SORT_KEYS,
  );

  const [partDialogMode, setPartDialogMode] = useState<
    null | { mode: "create" } | { mode: "edit"; part: PartRecord }
  >(null);
  const [adjustPart, setAdjustPart] = useState<PartRecord | null>(null);
  const [notice, setNotice] = useState("");
  const branchId = scope.branch !== "all" ? scope.branch : undefined;

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

  const partsQuery = useQuery({
    queryKey: [
      ...scope.key,
      "parts",
      "list",
      branchId ?? "all",
      lowOnly,
      rawQ,
      page,
      sort,
      dir,
    ],
    queryFn: ({ signal }) =>
      listParts(
        {
          companyId: scope.companyId,
          branchId,
          lowStockOnly: lowOnly,
          q: rawQ,
          page,
          sort: sort || undefined,
          dir,
        },
        signal,
      ),
    enabled: canAccess && activeTab === "parts",
  });

  const movementsQuery = useQuery({
    queryKey: [
      ...scope.key,
      "stock-movements",
      "list",
      branchId ?? "all",
      rawQ,
      page,
      sort,
      dir,
    ],
    queryFn: ({ signal }) =>
      listStockMovements(
        {
          companyId: scope.companyId,
          branchId,
          q: rawQ,
          page,
          sort: sort || undefined,
          dir,
        },
        signal,
      ),
    enabled: canAccess && activeTab === "movements",
  });

  if (!canAccess) {
    return (
      <StatePanel title="Access denied">
        Your account does not have permission to view Inventory.
      </StatePanel>
    );
  }

  const lowStockCount = (partsQuery.data?.items ?? []).filter(
    (p) => p.is_low_stock || p.on_hand <= p.min_stock,
  ).length;

  async function refreshInventory() {
    await Promise.all([
      client.invalidateQueries({ queryKey: [...scope.key, "parts"] }),
      client.invalidateQueries({ queryKey: [...scope.key, "stock-movements"] }),
      client.invalidateQueries({ queryKey: [...scope.key, "gl"] }),
    ]);
  }

  return (
    <ViewFadeIn className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-page-title font-extrabold tracking-tight">
            Inventory
          </h1>
          <p className="text-sm text-muted-foreground">
            Spare parts catalogue, live stock on hand, low-stock alerts, and
            immutable movement ledger.
          </p>
        </div>
        {canManage && activeTab === "parts" ? (
          <Button
            type="button"
            onClick={() => setPartDialogMode({ mode: "create" })}
            className="gap-1.5"
          >
            <Plus className="size-4" aria-hidden="true" />
            New part
          </Button>
        ) : null}
      </div>

      <div
        role="tablist"
        aria-label="Inventory sections"
        className="flex flex-wrap gap-1.5 rounded-2xl border bg-surface p-1.5"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "parts"}
          onClick={() =>
            updateQuery({ tab: "parts", q: "", sort: "", dir: "", page: 1 })
          }
          className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
            activeTab === "parts"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          }`}
        >
          <Package className="size-3.5" aria-hidden="true" />
          Parts catalogue
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "movements"}
          onClick={() =>
            updateQuery({
              tab: "movements",
              low: "",
              q: "",
              sort: "",
              dir: "",
              page: 1,
            })
          }
          className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
            activeTab === "movements"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          }`}
        >
          <ArrowLeftRight className="size-3.5" aria-hidden="true" />
          Stock movements
        </button>
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

      {activeTab === "parts" && lowStockCount > 0 ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-warning bg-warning/10 px-4 py-3 text-sm text-warning-foreground"
        >
          <span className="inline-flex items-center gap-2 font-medium">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            {lowStockCount} {lowStockCount === 1 ? "part is" : "parts are"} at
            or below minimum stock threshold.
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => updateQuery({ low: lowOnly ? "" : "1", page: 1 })}
          >
            {lowOnly ? "Show all parts" : "Filter low stock"}
          </Button>
        </div>
      ) : null}

      {activeTab === "parts" ? (
        <DataTableFrame
          ariaLabel="Spare parts table"
          toolbar={
            <DataSearchForm
              label="Search parts"
              placeholder="Search SKU or part name…"
              defaultValue={rawQ}
              formKey={`parts:${rawQ}`}
              onSubmitQuery={(nextQ) => updateQuery({ q: nextQ, page: 1 })}
            />
          }
        >
          {partsQuery.isPending ? (
            <DataTableSkeleton columns={6} label="Loading parts" />
          ) : partsQuery.error ? (
            <div className="p-card">
              <StatePanel title="Inventory unavailable">
                {errorText(partsQuery.error)}
              </StatePanel>
            </div>
          ) : partsQuery.data.items.length === 0 ? (
            <div className="p-card">
              <StatePanel title="No spare parts yet">
                Add spare parts to track stock on hand, consume them on work
                orders, and order replenishments.
              </StatePanel>
            </div>
          ) : (
            <DataTable>
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell
                    sortKey="sku"
                    activeSort={sort}
                    activeDir={dir}
                    onSort={handleSort}
                  >
                    SKU
                  </DataTableHeaderCell>
                  <DataTableHeaderCell
                    sortKey="name"
                    activeSort={sort}
                    activeDir={dir}
                    onSort={handleSort}
                  >
                    Part name
                  </DataTableHeaderCell>
                  <DataTableHeaderCell
                    align="right"
                    sortKey="unit_cost_minor"
                    activeSort={sort}
                    activeDir={dir}
                    onSort={handleSort}
                  >
                    Unit cost
                  </DataTableHeaderCell>
                  <DataTableHeaderCell
                    align="right"
                    sortKey="on_hand"
                    activeSort={sort}
                    activeDir={dir}
                    onSort={handleSort}
                  >
                    On hand
                  </DataTableHeaderCell>
                  <DataTableHeaderCell
                    align="right"
                    sortKey="min_stock"
                    activeSort={sort}
                    activeDir={dir}
                    onSort={handleSort}
                  >
                    Min stock
                  </DataTableHeaderCell>
                  <DataTableHeaderCell align="right">Actions</DataTableHeaderCell>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {sortRows(partsQuery.data.items, sort, dir, {
                  sku: (p) => p.sku,
                  name: (p) => p.name,
                  unit_cost_minor: (p) => p.unit_cost_minor,
                  on_hand: (p) => p.on_hand,
                  min_stock: (p) => p.min_stock,
                }).map((part) => {
                  const low = part.is_low_stock || part.on_hand <= part.min_stock;
                  return (
                    <DataTableRow key={part.id}>
                      <DataTableCell numeric className="font-semibold">
                        {part.sku}
                      </DataTableCell>
                      <DataTableCell className="font-medium">
                        {part.name}
                      </DataTableCell>
                      <DataTableCell align="right" numeric>
                        {formatMoneyMinor(part.unit_cost_minor, currency)}
                      </DataTableCell>
                      <DataTableCell align="right" numeric>
                        <StatusDotBadge tone={low ? "warning" : "success"}>
                          {part.on_hand}
                        </StatusDotBadge>
                      </DataTableCell>
                      <DataTableCell align="right" numeric>
                        {part.min_stock}
                      </DataTableCell>
                      <DataTableCell align="right">
                        {canManage ? (
                          <div className="inline-flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setAdjustPart(part)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-link hover:underline"
                            >
                              <SlidersHorizontal
                                className="size-3.5"
                                aria-hidden="true"
                              />
                              Adjust stock
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setPartDialogMode({ mode: "edit", part })
                              }
                              className="text-xs font-medium text-muted-foreground hover:text-foreground"
                            >
                              Edit
                            </button>
                          </div>
                        ) : (
                          "—"
                        )}
                      </DataTableCell>
                    </DataTableRow>
                  );
                })}
              </DataTableBody>
            </DataTable>
          )}
        </DataTableFrame>
      ) : (
        <DataTableFrame
          ariaLabel="Stock movements table"
          toolbar={
            <DataSearchForm
              label="Search stock movements"
              placeholder="Search part name, SKU, or reason…"
              defaultValue={rawQ}
              formKey={`moves:${rawQ}`}
              onSubmitQuery={(nextQ) => updateQuery({ q: nextQ, page: 1 })}
            />
          }
        >
          {movementsQuery.isPending ? (
            <DataTableSkeleton columns={5} label="Loading stock movements" />
          ) : movementsQuery.error ? (
            <div className="p-card">
              <StatePanel title="Stock movements unavailable">
                {errorText(movementsQuery.error)}
              </StatePanel>
            </div>
          ) : movementsQuery.data.items.length === 0 ? (
            <div className="p-card">
              <StatePanel title="No stock movements yet">
                PO receipts, work order consumptions, and stock adjustments will
                appear here.
              </StatePanel>
            </div>
          ) : (
            <DataTable>
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell
                    sortKey="created_at"
                    activeSort={sort}
                    activeDir={dir}
                    onSort={handleSort}
                  >
                    Date
                  </DataTableHeaderCell>
                  <DataTableHeaderCell
                    sortKey="part_name"
                    activeSort={sort}
                    activeDir={dir}
                    onSort={handleSort}
                  >
                    Part
                  </DataTableHeaderCell>
                  <DataTableHeaderCell>Reason</DataTableHeaderCell>
                  <DataTableHeaderCell
                    align="right"
                    sortKey="quantity"
                    activeSort={sort}
                    activeDir={dir}
                    onSort={handleSort}
                  >
                    Delta
                  </DataTableHeaderCell>
                  <DataTableHeaderCell
                    align="right"
                    sortKey="unit_cost_minor"
                    activeSort={sort}
                    activeDir={dir}
                    onSort={handleSort}
                  >
                    Unit cost
                  </DataTableHeaderCell>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {sortRows(movementsQuery.data.items, sort, dir, {
                  created_at: (m) => Date.parse(m.created_at),
                  part_name: (m) => m.part_name ?? "",
                  quantity: (m) => m.quantity,
                  unit_cost_minor: (m) => m.unit_cost_minor,
                }).map((m) => (
                  <DataTableRow key={m.id}>
                    <DataTableCell numeric>{fmtDate(m.created_at)}</DataTableCell>
                    <DataTableCell className="font-medium">
                      {m.part_sku ? `${m.part_sku} · ` : ""}
                      {m.part_name ?? `Part #${m.part_id}`}
                    </DataTableCell>
                    <DataTableCell>{m.reason}</DataTableCell>
                    <DataTableCell
                      align="right"
                      numeric
                      className={`font-bold ${
                        m.quantity > 0
                          ? "text-success-foreground"
                          : "text-danger-foreground"
                      }`}
                    >
                      {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                    </DataTableCell>
                    <DataTableCell align="right" numeric>
                      {formatMoneyMinor(m.unit_cost_minor, currency)}
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          )}
        </DataTableFrame>
      )}

      <PartFormDialog
        state={partDialogMode}
        currency={currency}
        onClose={() => setPartDialogMode(null)}
        onSaved={(part) => {
          setNotice(`Part ${part.sku} (${part.name}) saved.`);
          void refreshInventory();
        }}
      />

      <AdjustStockDialog
        part={adjustPart}
        onClose={() => setAdjustPart(null)}
        onAdjusted={(part) => {
          setNotice(`Stock adjusted for ${part.sku} — now ${part.on_hand} on hand.`);
          void refreshInventory();
        }}
      />
    </ViewFadeIn>
  );
}

function PartFormDialog({
  state,
  currency,
  onClose,
  onSaved,
}: {
  state: null | { mode: "create" } | { mode: "edit"; part: PartRecord };
  currency: string;
  onClose: () => void;
  onSaved: (part: PartRecord) => void;
}) {
  const session = useSession();
  const scope = useLiveContext();
  const formId = useId();
  const editing = state?.mode === "edit" ? state.part : null;

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

  const [branchId, setBranchId] = useState(
    scope.branch !== "all"
      ? scope.branch
      : companyBranches[0]
        ? String(companyBranches[0].id)
        : "",
  );
  const [sku, setSku] = useState(editing?.sku ?? "");
  const [name, setName] = useState(editing?.name ?? "");
  const [unitCost, setUnitCost] = useState(
    editing ? (editing.unit_cost_minor / 100).toFixed(2) : "",
  );
  const [minStock, setMinStock] = useState(
    editing ? String(editing.min_stock) : "5",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!state || busy) return;
    if (!editing && !branchId) {
      setError(new Error("Select a branch."));
      return;
    }
    if (!sku.trim() || !name.trim()) {
      setError(new Error("Enter both SKU and part name."));
      return;
    }
    const costMinor = parseMajorToMinor(unitCost || "0");
    if (costMinor === null || costMinor < 0) {
      setError(new Error("Enter a valid unit cost."));
      return;
    }
    if (!/^\d+$/.test(minStock.trim())) {
      setError(new Error("Minimum stock must be a nonnegative whole number."));
      return;
    }
    setBusy(true);
    setError(null);
    const ac = new AbortController();
    try {
      const saved = editing
        ? await updatePart(
            editing.id,
            {
              sku: sku.trim().toUpperCase(),
              name: name.trim(),
              unit_cost_minor: costMinor,
              min_stock: Number(minStock.trim()),
            },
            ac.signal,
          )
        : await createPart(
            {
              company_id: Number(scope.companyId),
              branch_id: Number(branchId),
              sku: sku.trim().toUpperCase(),
              name: name.trim(),
              unit_cost_minor: costMinor,
              min_stock: Number(minStock.trim()),
            },
            ac.signal,
          );
      setSku("");
      setName("");
      setUnitCost("");
      setMinStock("5");
      onClose();
      onSaved(saved);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={!!state}
      onOpenChange={(next) => {
        if (!next && !busy) {
          setError(null);
          onClose();
        }
      }}
    >
      <DialogContent className="rounded-2xl p-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing ? `Edit part ${editing.sku}` : "New spare part"}
          </DialogTitle>
          <DialogDescription>
            Stock on hand is tracked via Purchase Order receipts, work orders,
            and audited adjustments.
          </DialogDescription>
        </DialogHeader>
        <form
          key={editing?.id ?? "new"}
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="space-y-4"
        >
          {!editing ? (
            <div className="space-y-1.5">
              <label htmlFor={`${formId}-branch`} className="text-sm font-medium">
                Branch
              </label>
              <DriveCoreSelect
                id={`${formId}-branch`}
                value={branchId}
                onValueChange={setBranchId}
                options={[
                  { value: "", label: "Select branch" },
                  ...companyBranches.map((b) => ({
                    value: String(b.id),
                    label: b.name,
                  })),
                ]}
              />
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor={`${formId}-sku`} className="text-sm font-medium">
                SKU
              </label>
              <Input
                id={`${formId}-sku`}
                placeholder="BRK-PAD-01"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${formId}-min`} className="text-sm font-medium">
                Minimum stock
              </label>
              <Input
                id={`${formId}-min`}
                inputMode="numeric"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-name`} className="text-sm font-medium">
              Part name
            </label>
            <Input
              id={`${formId}-name`}
              placeholder="Front brake pad set"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-cost`} className="text-sm font-medium">
              Unit cost ({currency})
            </label>
            <Input
              id={`${formId}-cost`}
              inputMode="decimal"
              placeholder="0.00"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
            />
          </div>
          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-danger bg-danger/10 px-3.5 py-2.5 text-sm text-danger-foreground"
            >
              {errorText(error)}
            </p>
          ) : null}
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
              {busy ? "Saving…" : "Save part"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AdjustStockDialog({
  part,
  onClose,
  onAdjusted,
}: {
  part: PartRecord | null;
  onClose: () => void;
  onAdjusted: (part: PartRecord) => void;
}) {
  const formId = useId();
  const [qtyText, setQtyText] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!part || busy) return;
    if (!/^-?[1-9]\d*$/.test(qtyText.trim())) {
      setError(new Error("Enter a nonzero whole quantity (e.g. 5 or -2)."));
      return;
    }
    if (!reason.trim()) {
      setError(new Error("Enter a reason for this stock adjustment."));
      return;
    }
    setBusy(true);
    setError(null);
    const ac = new AbortController();
    try {
      const updated = await adjustPartStock(
        part.id,
        { quantity: Number(qtyText.trim()), reason: reason.trim() },
        ac.signal,
      );
      setQtyText("");
      setReason("");
      onClose();
      onAdjusted(updated);
    } catch (failure) {
      setError(
        failure instanceof ApiError && failure.status === 422
          ? new Error(
              Object.values(failure.fields ?? {})
                .flat()
                .join(" ") || errorText(failure),
            )
          : failure,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={!!part}
      onOpenChange={(next) => {
        if (!next && !busy) {
          setError(null);
          onClose();
        }
      }}
    >
      <DialogContent className="rounded-2xl p-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            {part
              ? `${part.sku} · ${part.name} (currently ${part.on_hand} on hand).`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-qty`} className="text-sm font-medium">
              Quantity change (+ or -)
            </label>
            <Input
              id={`${formId}-qty`}
              placeholder="e.g. 10 or -2"
              value={qtyText}
              onChange={(e) => setQtyText(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-reason`} className="text-sm font-medium">
              Adjustment reason
            </label>
            <Input
              id={`${formId}-reason`}
              maxLength={255}
              placeholder="e.g. Opening count or damaged in storage"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-danger bg-danger/10 px-3.5 py-2.5 text-sm text-danger-foreground"
            >
              {errorText(error)}
            </p>
          ) : null}
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
              {busy ? "Applying…" : "Apply adjustment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
