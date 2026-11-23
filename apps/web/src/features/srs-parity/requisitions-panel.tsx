"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Plus,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "@/features/live/context";
import { listSuppliers } from "@/features/procurement/service";
import {
  convertRequisitionToPo,
  createPurchaseRequisition,
  decidePurchaseRequisition,
  listPurchaseRequisitions,
} from "./service";
import { errorText } from "@/lib/api/client";
import {
  can,
  formatMoneyMinor,
  parseMajorToMinor,
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

export function RequisitionsPanel() {
  const { user } = useSession();
  const scope = useLiveContext();
  const client = useQueryClient();
  const currency = scope.company?.currency || "ZMW";
  const branchId = scope.branch !== "all" ? scope.branch : undefined;
  const canManage = !!user && can(user, "purchase_orders.manage");
  const canApprove = !!user && can(user, "purchase_orders.approve");

  const [createOpen, setCreateOpen] = useState(false);
  const [department, setDepartment] = useState("Workshop / Maintenance");
  const [supplierId, setSupplierId] = useState("");
  const [neededBy, setNeededBy] = useState(() =>
    new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
  );
  const [itemDesc, setItemDesc] = useState("");
  const [itemQty, setItemQty] = useState("2");
  const [itemCost, setItemCost] = useState("");
  const [justification, setJustification] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const reqQuery = useQuery({
    queryKey: [...scope.key, "purchase-requisitions", branchId ?? "all"],
    queryFn: ({ signal }) =>
      listPurchaseRequisitions({ companyId: scope.companyId, branchId }, signal),
  });

  const suppliersQuery = useQuery({
    queryKey: [...scope.key, "suppliers", "for-req"],
    queryFn: ({ signal }) =>
      listSuppliers({ companyId: scope.companyId, page: 1 }, signal),
    enabled: createOpen,
  });

  async function refresh() {
    await Promise.all([
      client.invalidateQueries({ queryKey: [...scope.key, "purchase-requisitions"] }),
      client.invalidateQueries({ queryKey: [...scope.key, "purchase-orders"] }),
    ]);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setErrMsg(null);
    const unitMinor = parseMajorToMinor(itemCost);
    const qty = Number(itemQty);
    if (!itemDesc.trim() || !Number.isInteger(qty) || qty < 1 || unitMinor === null || unitMinor <= 0) {
      setErrMsg("Enter a valid item description, quantity, and unit cost.");
      return;
    }
    if (!justification.trim()) {
      setErrMsg("Provide a purchase justification.");
      return;
    }
    const defaultBranchId =
      scope.branch !== "all"
        ? Number(scope.branch)
        : scope.directory?.branches[0]?.id ?? 1;
    setBusy(true);
    try {
      const created = await createPurchaseRequisition({
        company_id: Number(scope.companyId),
        branch_id: defaultBranchId,
        supplier_id: supplierId ? Number(supplierId) : null,
        department: department.trim() || "Operations",
        needed_by: neededBy,
        justification: justification.trim(),
        items: [
          {
            description: itemDesc.trim(),
            quantity: qty,
            estimated_unit_minor: unitMinor,
          },
        ],
      });
      setCreateOpen(false);
      setItemDesc("");
      setItemCost("");
      setJustification("");
      setNotice(`Purchase requisition ${created.requisition_number} submitted for approval.`);
      await refresh();
    } catch (err) {
      setErrMsg(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDecide(id: number, decision: "approve" | "reject") {
    setErrMsg(null);
    setBusy(true);
    try {
      const updated = await decidePurchaseRequisition(id, decision);
      setNotice(`Requisition ${updated.requisition_number} ${decision}d.`);
      await refresh();
    } catch (err) {
      setErrMsg(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleConvert(id: number) {
    setErrMsg(null);
    setBusy(true);
    try {
      const res = await convertRequisitionToPo(id);
      setNotice(
        `Converted ${res.requisition.requisition_number} into draft ${res.purchase_order.po_number}.`,
      );
      await refresh();
    } catch (err) {
      setErrMsg(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const items = reqQuery.data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight">
            Purchase Requisitions (SRS §16)
          </h2>
          <p className="text-xs text-muted-foreground">
            Request → Segregation-of-duties Approval → Convert to Purchase Order
            → Goods Receipt → Supplier Invoice.
          </p>
        </div>
        {canManage ? (
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" aria-hidden="true" />
            New requisition
          </Button>
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

      {reqQuery.isLoading ? (
        <DataTableSkeleton columns={7} rows={3} />
      ) : items.length === 0 ? (
        <StatePanel title="No purchase requisitions">
          Raise a requisition for spare parts, tyres, workshop tools, or office
          supplies before issuing a Purchase Order.
        </StatePanel>
      ) : (
        <DataTableFrame ariaLabel="Purchase requisitions table">
          <DataTable>
            <DataTableHead>
              <tr>
                <DataTableHeaderCell>Requisition #</DataTableHeaderCell>
                <DataTableHeaderCell>Department</DataTableHeaderCell>
                <DataTableHeaderCell>Requester</DataTableHeaderCell>
                <DataTableHeaderCell>Needed by</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Est. total</DataTableHeaderCell>
                <DataTableHeaderCell>Status</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Actions</DataTableHeaderCell>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {items.map((r) => {
                const isOwn = user?.id === r.requester_id;
                return (
                  <DataTableRow key={r.id}>
                    <DataTableCell className="font-mono text-xs font-semibold">
                      {r.requisition_number}
                    </DataTableCell>
                    <DataTableCell className="text-xs">
                      <div className="font-medium">{r.department}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {r.items[0]?.description}
                        {r.items.length > 1 ? ` +${r.items.length - 1} more` : ""}
                      </div>
                    </DataTableCell>
                    <DataTableCell className="text-xs text-muted-foreground">
                      {r.requester_name ?? `User #${r.requester_id}`}
                    </DataTableCell>
                    <DataTableCell className="font-mono text-xs">
                      {r.needed_by}
                    </DataTableCell>
                    <DataTableCell align="right" numeric>
                      {formatMoneyMinor(r.estimated_total_minor, currency)}
                    </DataTableCell>
                    <DataTableCell>
                      <StatusDotBadge
                        tone={
                          r.status === "converted" || r.status === "approved"
                            ? "success"
                            : r.status === "rejected"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {r.status}
                      </StatusDotBadge>
                    </DataTableCell>
                    <DataTableCell align="right">
                      <div className="inline-flex items-center gap-1.5">
                        {r.status === "pending" ? (
                          isOwn ? (
                            <span className="rounded-md border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
                              Own request
                            </span>
                          ) : canApprove ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                disabled={busy}
                                onClick={() => void handleDecide(r.id, "approve")}
                              >
                                <ShieldCheck className="size-3.5" aria-hidden="true" />
                                Approve
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => void handleDecide(r.id, "reject")}
                              >
                                <XCircle className="size-3.5" aria-hidden="true" />
                                Reject
                              </Button>
                            </>
                          ) : null
                        ) : r.status === "approved" && canManage ? (
                          <Button
                            type="button"
                            size="sm"
                            disabled={busy}
                            onClick={() => void handleConvert(r.id)}
                          >
                            <ArrowRightLeft className="size-3.5" aria-hidden="true" />
                            Convert to PO
                          </Button>
                        ) : r.purchase_order_id ? (
                          <span className="font-mono text-xs text-muted-foreground">
                            PO #{r.purchase_order_id}
                          </span>
                        ) : null}
                      </div>
                    </DataTableCell>
                  </DataTableRow>
                );
              })}
            </DataTableBody>
          </DataTable>
        </DataTableFrame>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New purchase requisition</DialogTitle>
            <DialogDescription>
              Submit a purchase request for approval before converting to a PO.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleCreate(e)} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="pr-dept" className="text-xs font-semibold">
                  Department
                </label>
                <Input
                  id="pr-dept"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  required
                />
              </div>
              <DriveCoreDateField
                label="Needed by"
                value={neededBy}
                onChange={setNeededBy}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold">
                Preferred supplier (optional)
              </label>
              <DriveCoreSelect
                ariaLabel="Preferred supplier"
                value={supplierId}
                onValueChange={setSupplierId}
                options={[
                  { value: "", label: "Any approved supplier" },
                  ...(suppliersQuery.data?.items ?? []).map((s) => ({
                    value: String(s.id),
                    label: s.name,
                  })),
                ]}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_5rem_8rem]">
              <div className="space-y-1">
                <label htmlFor="pr-item" className="text-xs font-semibold">
                  Item description
                </label>
                <Input
                  id="pr-item"
                  placeholder="e.g. Heavy-duty 4x4 tyres (set)"
                  value={itemDesc}
                  onChange={(e) => setItemDesc(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="pr-qty" className="text-xs font-semibold">
                  Qty
                </label>
                <Input
                  id="pr-qty"
                  inputMode="numeric"
                  value={itemQty}
                  onChange={(e) => setItemQty(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="pr-unit" className="text-xs font-semibold">
                  Unit ({currency})
                </label>
                <Input
                  id="pr-unit"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={itemCost}
                  onChange={(e) => setItemCost(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="pr-just" className="text-xs font-semibold">
                Justification
              </label>
              <Textarea
                id="pr-just"
                rows={2}
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Why this purchase is needed"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Submitting…" : "Submit requisition"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
