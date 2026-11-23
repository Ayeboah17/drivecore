"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Archive,
  Calculator,
  CarFront,
  CheckCircle2,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "@/features/live/context";
import { listRecords } from "@/features/records/service";
import {
  completeAssetDisposal,
  createFixedAsset,
  listFixedAssets,
  requestAssetDisposal,
  runMonthlyDepreciation,
} from "./service";
import { errorText } from "@/lib/api/client";
import {
  canAccessAssets,
  canManageAssets,
  formatMoneyMinor,
  parseMajorToMinor,
  type DepreciationMethod,
  type FixedAsset,
  type FixedAssetCategory,
  type Vehicle,
} from "@/lib/api/contracts";
import {
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
} from "@/components/data/data-table";
import { StatePanel } from "@/components/layout/state-panel";
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
import { Textarea } from "@/components/ui/textarea";

export function VehicleAssetCard({ vehicle }: { vehicle: Vehicle }) {
  const { user } = useSession();
  const scope = useLiveContext();
  const currency = scope.company?.currency || "ZMW";
  const allowed = !!user && canAccessAssets(user);

  const query = useQuery({
    queryKey: [...scope.key, "fixed-assets", "vehicle", vehicle.id],
    queryFn: ({ signal }) =>
      listFixedAssets(
        { companyId: scope.companyId, vehicleId: String(vehicle.id) },
        signal,
      ),
    enabled: allowed,
  });

  if (!allowed || query.isLoading || !query.data?.items[0]) return null;
  const asset = query.data.items[0];

  return (
    <section className="dc-shadow-card space-y-3 rounded-2xl border bg-surface p-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-section-heading">
          <CarFront className="size-4 text-primary" aria-hidden="true" />
          Fixed Asset &amp; Net Book Value ({asset.asset_code})
        </h2>
        <StatusDotBadge
          tone={
            asset.status === "active"
              ? "success"
              : asset.status === "pending_disposal"
                ? "warning"
                : "neutral"
          }
        >
          {asset.status.replace("_", " ")}
        </StatusDotBadge>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border bg-background p-3">
          <p className="text-[11px] text-muted-foreground">Acquisition cost</p>
          <p className="mt-0.5 font-mono text-sm font-bold">
            {formatMoneyMinor(asset.acquisition_cost_minor, currency)}
          </p>
        </div>
        <div className="rounded-xl border bg-background p-3">
          <p className="text-[11px] text-muted-foreground">Accum. depreciation</p>
          <p className="mt-0.5 font-mono text-sm font-bold">
            {formatMoneyMinor(asset.accumulated_depreciation_minor, currency)}
          </p>
        </div>
        <div className="rounded-xl border bg-background p-3">
          <p className="text-[11px] text-muted-foreground">Net book value</p>
          <p className="mt-0.5 font-mono text-sm font-bold text-primary">
            {formatMoneyMinor(asset.net_book_value_minor, currency)}
          </p>
        </div>
        <div className="rounded-xl border bg-background p-3">
          <p className="text-[11px] text-muted-foreground">Method · Life</p>
          <p className="mt-0.5 text-xs font-semibold">
            {asset.depreciation_method === "straight_line"
              ? "Straight-line"
              : "Reducing balance"}{" "}
            · {asset.useful_life_months} mo
          </p>
        </div>
      </div>
    </section>
  );
}

export function FixedAssetsPanel() {
  const { user } = useSession();
  const scope = useLiveContext();
  const client = useQueryClient();
  const currency = scope.company?.currency || "ZMW";
  const branchId = scope.branch !== "all" ? scope.branch : undefined;
  const canManage = !!user && canManageAssets(user);

  const [registerOpen, setRegisterOpen] = useState(false);
  const [deprecOpen, setDeprecOpen] = useState(false);
  const [disposing, setDisposing] = useState<FixedAsset | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Register form state
  const [assetCode, setAssetCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<FixedAssetCategory>("vehicle");
  const [vehicleId, setVehicleId] = useState("");
  const [cost, setCost] = useState("");
  const [residual, setResidual] = useState("0.00");
  const [capDate, setCapDate] = useState(new Date().toISOString().slice(0, 10));
  const [lifeMonths, setLifeMonths] = useState("60");
  const [method, setMethod] = useState<DepreciationMethod>("straight_line");

  // Depreciation period
  const [periodMonth, setPeriodMonth] = useState(
    new Date().toISOString().slice(0, 7),
  );

  // Disposal form
  const [dispType, setDispType] = useState<"sold" | "decommissioned">("sold");
  const [dispDate, setDispDate] = useState(new Date().toISOString().slice(0, 10));
  const [dispProceeds, setDispProceeds] = useState("0.00");
  const [dispReason, setDispReason] = useState("");

  const assetsQuery = useQuery({
    queryKey: [...scope.key, "fixed-assets", branchId ?? "all"],
    queryFn: ({ signal }) =>
      listFixedAssets({ companyId: scope.companyId, branchId }, signal),
  });

  const vehiclesQuery = useQuery({
    queryKey: [...scope.key, "vehicles", "for-assets"],
    queryFn: ({ signal }) =>
      listRecords(
        "vehicles",
        { companyId: scope.companyId, branch: scope.branch, q: "", filter: "", page: 1 },
        signal,
      ),
    enabled: registerOpen,
  });

  async function refreshAssets() {
    await Promise.all([
      client.invalidateQueries({ queryKey: [...scope.key, "fixed-assets"] }),
      client.invalidateQueries({ queryKey: [...scope.key, "gl"] }),
      client.invalidateQueries({ queryKey: [...scope.key, "approvals"] }),
      client.invalidateQueries({ queryKey: [...scope.key, "vehicles"] }),
    ]);
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setErrMsg(null);
    const costMinor = parseMajorToMinor(cost);
    const resMinor = parseMajorToMinor(residual || "0");
    const months = Number(lifeMonths);
    if (!assetCode.trim() || !name.trim()) {
      setErrMsg("Asset code and name are required.");
      return;
    }
    if (costMinor === null || costMinor <= 0) {
      setErrMsg("Enter a positive acquisition cost.");
      return;
    }
    if (resMinor === null || resMinor < 0 || resMinor > costMinor) {
      setErrMsg("Residual value must be between 0 and acquisition cost.");
      return;
    }
    if (!Number.isInteger(months) || months < 1) {
      setErrMsg("Useful life must be at least 1 month.");
      return;
    }
    const defaultBranchId =
      scope.branch !== "all"
        ? Number(scope.branch)
        : scope.directory?.branches[0]?.id ?? 1;
    setBusy(true);
    try {
      const created = await createFixedAsset({
        company_id: Number(scope.companyId),
        branch_id: defaultBranchId,
        vehicle_id: vehicleId ? Number(vehicleId) : null,
        asset_code: assetCode.trim(),
        name: name.trim(),
        category,
        acquisition_cost_minor: costMinor,
        residual_value_minor: resMinor,
        capitalisation_date: capDate,
        useful_life_months: months,
        depreciation_method: method,
      });
      setRegisterOpen(false);
      setAssetCode("");
      setName("");
      setCost("");
      setNotice(`Fixed asset ${created.asset_code} registered.`);
      await refreshAssets();
    } catch (err) {
      setErrMsg(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRunDepreciation(e: React.FormEvent) {
    e.preventDefault();
    setErrMsg(null);
    if (!/^\d{4}-\d{2}$/.test(periodMonth.trim())) {
      setErrMsg("Use YYYY-MM format (e.g. 2026-11).");
      return;
    }
    setBusy(true);
    try {
      const res = await runMonthlyDepreciation({
        company_id: Number(scope.companyId),
        period_month: periodMonth.trim(),
      });
      setDeprecOpen(false);
      setNotice(
        `Depreciation for ${res.period_month}: ${res.posted_count} asset(s) posted (${formatMoneyMinor(res.total_depreciation_minor, currency)}), ${res.skipped_count} skipped.`,
      );
      await refreshAssets();
    } catch (err) {
      setErrMsg(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRequestDisposal(e: React.FormEvent) {
    e.preventDefault();
    if (!disposing) return;
    setErrMsg(null);
    const procMinor = parseMajorToMinor(dispProceeds || "0");
    if (procMinor === null || procMinor < 0) {
      setErrMsg("Enter valid disposal proceeds (0 or greater).");
      return;
    }
    if (!dispReason.trim()) {
      setErrMsg("Provide a disposal justification.");
      return;
    }
    setBusy(true);
    try {
      await requestAssetDisposal(disposing.id, {
        disposal_type: dispType,
        disposal_date: dispDate,
        disposal_proceeds_minor: procMinor,
        reason: dispReason.trim(),
      });
      setNotice(
        `Disposal approval requested for ${disposing.asset_code}. Approve in Operations → Approvals before completing disposal.`,
      );
      setDisposing(null);
      await refreshAssets();
    } catch (err) {
      setErrMsg(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleCompleteDisposal(asset: FixedAsset) {
    setErrMsg(null);
    setBusy(true);
    try {
      const done = await completeAssetDisposal(asset.id);
      const gl = done.disposal_gain_loss_minor ?? 0;
      setNotice(
        `Disposed ${done.asset_code} (${done.disposal_type}). Net ${gl >= 0 ? "gain" : "loss"}: ${formatMoneyMinor(Math.abs(gl), currency)}.`,
      );
      await refreshAssets();
    } catch (err) {
      setErrMsg(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const items = assetsQuery.data?.items ?? [];
  const totalCost = items.reduce((s, a) => s + a.acquisition_cost_minor, 0);
  const totalDep = items.reduce((s, a) => s + a.accumulated_depreciation_minor, 0);
  const totalNbv = items.reduce((s, a) => s + a.net_book_value_minor, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight">
            Fixed Assets, Depreciation &amp; Vehicle Disposal
          </h2>
          <p className="text-xs text-muted-foreground">
            Track acquisition costs, run idempotent monthly depreciation to GL,
            and manage approval-gated vehicle disposals.
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeprecOpen(true)}
            >
              <Calculator className="size-4" aria-hidden="true" />
              Run monthly depreciation
            </Button>
            <Button type="button" onClick={() => setRegisterOpen(true)}>
              <Plus className="size-4" aria-hidden="true" />
              Register asset
            </Button>
          </div>
        ) : null}
      </div>

      {notice ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-2xl border border-success bg-success/10 px-4 py-3 text-sm text-success-foreground"
        >
          <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
          <span>{notice}</span>
        </div>
      ) : null}

      {errMsg ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-2xl border border-danger bg-danger/10 px-4 py-3 text-sm text-danger-foreground"
        >
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          <span>{errMsg}</span>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-surface p-4">
          <p className="text-xs text-muted-foreground">Total acquisition cost</p>
          <p className="mt-1 font-mono text-lg font-extrabold tabular-nums">
            {formatMoneyMinor(totalCost, currency)}
          </p>
        </div>
        <div className="rounded-2xl border bg-surface p-4">
          <p className="text-xs text-muted-foreground">
            Accumulated depreciation
          </p>
          <p className="mt-1 font-mono text-lg font-extrabold tabular-nums">
            {formatMoneyMinor(totalDep, currency)}
          </p>
        </div>
        <div className="rounded-2xl border bg-surface p-4">
          <p className="text-xs text-muted-foreground">Total Net Book Value</p>
          <p className="mt-1 font-mono text-lg font-extrabold tabular-nums text-primary">
            {formatMoneyMinor(totalNbv, currency)}
          </p>
        </div>
      </div>

      {assetsQuery.isLoading ? (
        <DataTableSkeleton columns={7} rows={4} />
      ) : items.length === 0 ? (
        <StatePanel title="No fixed assets registered">
          Register fleet vehicles or workshop equipment to compute monthly
          depreciation and track Net Book Value.
        </StatePanel>
      ) : (
        <DataTableFrame ariaLabel="Fixed asset register">
          <DataTable>
            <DataTableHead>
              <tr>
                <DataTableHeaderCell>Asset</DataTableHeaderCell>
                <DataTableHeaderCell>Vehicle / Category</DataTableHeaderCell>
                <DataTableHeaderCell>Method</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Cost</DataTableHeaderCell>
                <DataTableHeaderCell align="right">
                  Accum. depr.
                </DataTableHeaderCell>
                <DataTableHeaderCell align="right">NBV</DataTableHeaderCell>
                <DataTableHeaderCell>Status</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Actions</DataTableHeaderCell>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {items.map((a) => {
                const approvalApproved =
                  a.status === "pending_disposal" &&
                  a.disposal_approval_status === "approved";
                return (
                  <DataTableRow key={a.id}>
                    <DataTableCell>
                      <div className="font-mono text-xs font-semibold">
                        {a.asset_code}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {a.name}
                      </div>
                    </DataTableCell>
                    <DataTableCell className="text-xs">
                      {a.vehicle_registration ? (
                        <PlateTag>{a.vehicle_registration}</PlateTag>
                      ) : (
                        <span className="capitalize">
                          {a.category.replace("_", " ")}
                        </span>
                      )}
                    </DataTableCell>
                    <DataTableCell className="text-xs text-muted-foreground">
                      {a.depreciation_method === "straight_line"
                        ? "Straight-line"
                        : "Reducing bal."}{" "}
                      ({a.useful_life_months}m)
                    </DataTableCell>
                    <DataTableCell align="right" numeric>
                      {formatMoneyMinor(a.acquisition_cost_minor, currency)}
                    </DataTableCell>
                    <DataTableCell align="right" numeric>
                      {formatMoneyMinor(
                        a.accumulated_depreciation_minor,
                        currency,
                      )}
                    </DataTableCell>
                    <DataTableCell align="right" numeric>
                      <strong>
                        {formatMoneyMinor(a.net_book_value_minor, currency)}
                      </strong>
                    </DataTableCell>
                    <DataTableCell>
                      <StatusDotBadge
                        tone={
                          a.status === "active"
                            ? "success"
                            : a.status === "pending_disposal"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {a.status === "disposed" && a.disposal_type
                          ? a.disposal_type
                          : a.status.replace("_", " ")}
                      </StatusDotBadge>
                    </DataTableCell>
                    <DataTableCell align="right">
                      {canManage ? (
                        a.status === "active" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setDisposing(a);
                              setDispProceeds(
                                (a.net_book_value_minor / 100).toFixed(2),
                              );
                              setDispReason("");
                            }}
                          >
                            <Archive className="size-3.5" aria-hidden="true" />
                            Request disposal
                          </Button>
                        ) : approvalApproved ? (
                          <Button
                            type="button"
                            size="sm"
                            disabled={busy}
                            onClick={() => void handleCompleteDisposal(a)}
                          >
                            <ShieldCheck className="size-3.5" aria-hidden="true" />
                            Complete disposal
                          </Button>
                        ) : a.status === "pending_disposal" ? (
                          <span className="text-[11px] text-warning-foreground">
                            Awaiting approval
                          </span>
                        ) : (
                          <span className="font-mono text-[11px] text-muted-foreground">
                            G/L:{" "}
                            {(a.disposal_gain_loss_minor ?? 0) >= 0 ? "+" : "-"}
                            {formatMoneyMinor(
                              Math.abs(a.disposal_gain_loss_minor ?? 0),
                              currency,
                            )}
                          </span>
                        )
                      ) : null}
                    </DataTableCell>
                  </DataTableRow>
                );
              })}
            </DataTableBody>
          </DataTable>
        </DataTableFrame>
      )}

      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Register fixed asset</DialogTitle>
            <DialogDescription>
              Link to a fleet vehicle or register workshop/office equipment.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleRegister(e)} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="fa-code" className="text-xs font-semibold">
                  Asset code
                </label>
                <Input
                  id="fa-code"
                  placeholder="FA-VEH-001"
                  value={assetCode}
                  onChange={(e) => setAssetCode(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold">Category</label>
                <DriveCoreSelect
                  ariaLabel="Asset category"
                  value={category}
                  onValueChange={(v) => setCategory(v as FixedAssetCategory)}
                  options={[
                    { value: "vehicle", label: "Fleet vehicle" },
                    { value: "workshop_equipment", label: "Workshop equipment" },
                    { value: "office_equipment", label: "Office equipment" },
                    { value: "other", label: "Other" },
                  ]}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="fa-name" className="text-xs font-semibold">
                Asset name
              </label>
              <Input
                id="fa-name"
                placeholder="e.g. 2024 Toyota Hilux 4x4"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            {category === "vehicle" ? (
              <div className="space-y-1">
                <label className="text-xs font-semibold">
                  Link vehicle (optional)
                </label>
                <DriveCoreSelect
                  ariaLabel="Link vehicle"
                  value={vehicleId}
                  onValueChange={setVehicleId}
                  options={[
                    { value: "", label: "Unlinked vehicle asset" },
                    ...(vehiclesQuery.data?.items ?? [])
                      .filter((v): v is Vehicle => "registration" in v)
                      .map((v) => ({
                        value: String(v.id),
                        label: `${v.registration} · ${v.make} ${v.model}`,
                      })),
                  ]}
                />
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="fa-cost" className="text-xs font-semibold">
                  Acquisition cost ({currency})
                </label>
                <Input
                  id="fa-cost"
                  inputMode="decimal"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="fa-res" className="text-xs font-semibold">
                  Residual value ({currency})
                </label>
                <Input
                  id="fa-res"
                  inputMode="decimal"
                  value={residual}
                  onChange={(e) => setResidual(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <DriveCoreDateField
                  value={capDate}
                  onChange={setCapDate}
                  label="Capitalised"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="fa-life" className="text-xs font-semibold">
                  Life (months)
                </label>
                <Input
                  id="fa-life"
                  inputMode="numeric"
                  value={lifeMonths}
                  onChange={(e) => setLifeMonths(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold">Method</label>
                <DriveCoreSelect
                  ariaLabel="Depreciation method"
                  value={method}
                  onValueChange={(v) => setMethod(v as DepreciationMethod)}
                  options={[
                    { value: "straight_line", label: "Straight-line" },
                    { value: "reducing_balance", label: "Reducing balance" },
                  ]}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRegisterOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Registering…" : "Save asset"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deprecOpen} onOpenChange={setDeprecOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Run monthly depreciation</DialogTitle>
            <DialogDescription>
              Idempotent per asset &amp; month. Posts DR 5500 Depreciation
              Expense / CR 1590 Accumulated Depreciation.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleRunDepreciation(e)} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="dep-month" className="text-xs font-semibold">
                Accounting period (YYYY-MM)
              </label>
              <Input
                id="dep-month"
                value={periodMonth}
                onChange={(e) => setPeriodMonth(e.target.value)}
                placeholder="2026-11"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeprecOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Posting…" : "Post depreciation"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!disposing} onOpenChange={(o) => !o && setDisposing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Request disposal · {disposing?.asset_code}
            </DialogTitle>
            <DialogDescription>
              Submits a governed <code>vehicle_disposal</code> approval request
              (segregation of duties enforced). Current NBV:{" "}
              {formatMoneyMinor(disposing?.net_book_value_minor ?? 0, currency)}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleRequestDisposal(e)} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Disposal type</label>
                <DriveCoreSelect
                  ariaLabel="Disposal type"
                  value={dispType}
                  onValueChange={(v) =>
                    setDispType(v as "sold" | "decommissioned")
                  }
                  options={[
                    { value: "sold", label: "Sold" },
                    { value: "decommissioned", label: "Decommissioned" },
                  ]}
                />
              </div>
              <div className="space-y-1">
                <DriveCoreDateField
                  value={dispDate}
                  onChange={setDispDate}
                  label="Disposal date"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="disp-proceeds" className="text-xs font-semibold">
                Expected sale proceeds ({currency})
              </label>
              <Input
                id="disp-proceeds"
                inputMode="decimal"
                value={dispProceeds}
                onChange={(e) => setDispProceeds(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="disp-reason" className="text-xs font-semibold">
                Justification
              </label>
              <Textarea
                id="disp-reason"
                rows={2}
                value={dispReason}
                onChange={(e) => setDispReason(e.target.value)}
                placeholder="e.g. End of 5-year fleet cycle — auction sale"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDisposing(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Submitting…" : "Submit disposal request"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
