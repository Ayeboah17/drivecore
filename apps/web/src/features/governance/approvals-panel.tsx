"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, ShieldCheck, X } from "lucide-react";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "@/features/live/context";
import {
  createApprovalRequest,
  decideApprovalRequest,
  listApprovalRequests,
} from "@/features/governance/service";
import { errorText } from "@/lib/api/client";
import {
  approvalTypeLabels,
  approvalTypes,
  canDecideApprovals,
  type ApprovalRequest,
  type ApprovalType,
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
import { DriveCoreSelect } from "@/components/ui/drivecore-select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function ApprovalsPanel() {
  const { user } = useSession();
  const scope = useLiveContext();
  const client = useQueryClient();
  const branchId = scope.branch !== "all" ? scope.branch : undefined;
  const canDecide = !!user && canDecideApprovals(user);

  const [statusFilter, setStatusFilter] = useState("pending");
  const [typeFilter, setTypeFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [reqType, setReqType] = useState<ApprovalType>("credit_limit");
  const [reqTitle, setReqTitle] = useState("");
  const [prevValue, setPrevValue] = useState("");
  const [reqValue, setReqValue] = useState("");
  const [reason, setReason] = useState("");
  const [decideTarget, setDecideTarget] = useState<{
    item: ApprovalRequest;
    decision: "approve" | "reject";
  } | null>(null);
  const [decisionNotes, setDecisionNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const query = useQuery({
    queryKey: [...scope.key, "approvals", branchId ?? "all", statusFilter, typeFilter],
    queryFn: ({ signal }) =>
      listApprovalRequests(
        {
          companyId: scope.companyId,
          branchId,
          status: statusFilter || undefined,
          type: typeFilter || undefined,
        },
        signal,
      ),
    enabled: !!scope.companyId,
    retry: false,
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!reqTitle.trim() || !reqValue.trim() || !reason.trim()) {
      setError("Enter a title, requested value, and business justification.");
      return;
    }
    setBusy(true);
    try {
      await createApprovalRequest({
        company_id: Number(scope.companyId),
        branch_id: branchId ? Number(branchId) : null,
        type: reqType,
        title: reqTitle.trim(),
        previous_value: prevValue.trim() || null,
        requested_value: reqValue.trim(),
        reason: reason.trim(),
      });
      setReqTitle("");
      setPrevValue("");
      setReqValue("");
      setReason("");
      setCreateOpen(false);
      setNotice("Approval request submitted.");
      await client.invalidateQueries({ queryKey: [...scope.key, "approvals"] });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDecide(e: React.FormEvent) {
    e.preventDefault();
    if (!decideTarget) return;
    setError(null);
    setBusy(true);
    try {
      await decideApprovalRequest(
        decideTarget.item.id,
        decideTarget.decision,
        {
          approved_value:
            decideTarget.decision === "approve"
              ? decideTarget.item.requested_value
              : undefined,
          decision_notes: decisionNotes.trim() || undefined,
        },
      );
      setNotice(
        `Approval #${decideTarget.item.id} ${decideTarget.decision === "approve" ? "approved" : "rejected"}.`,
      );
      setDecideTarget(null);
      setDecisionNotes("");
      await client.invalidateQueries({ queryKey: [...scope.key, "approvals"] });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  if (query.data && !query.data.supported) {
    return (
      <StatePanel title="Unified approvals endpoint not yet deployed">
        The unified approval queue requires backend PR #17 (/api/v1/approvals).
      </StatePanel>
    );
  }

  const items = query.data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-40">
            <DriveCoreSelect
              ariaLabel="Filter approvals by status"
              value={statusFilter}
              onValueChange={setStatusFilter}
              options={[
                { value: "pending", label: "Pending" },
                { value: "approved", label: "Approved" },
                { value: "rejected", label: "Rejected" },
                { value: "", label: "All statuses" },
              ]}
            />
          </div>
          <div className="w-48">
            <DriveCoreSelect
              ariaLabel="Filter approvals by type"
              value={typeFilter}
              onValueChange={setTypeFilter}
              options={[
                { value: "", label: "All approval types" },
                ...approvalTypes.map((t) => ({
                  value: t,
                  label: approvalTypeLabels[t],
                })),
              ]}
            />
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => setCreateOpen(true)}
          className="gap-1.5"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          New approval request
        </Button>
      </div>

      {notice ? (
        <p
          role="status"
          className="rounded-xl border border-success bg-success/10 px-4 py-2.5 text-sm text-success-foreground"
        >
          {notice}
        </p>
      ) : null}

      <DataTableFrame ariaLabel="Unified approvals queue">
        {query.isPending ? (
          <DataTableSkeleton columns={7} label="Loading approvals" />
        ) : query.error ? (
          <div className="p-card">
            <StatePanel title="Approvals unavailable">
              {errorText(query.error)}
            </StatePanel>
          </div>
        ) : items.length === 0 ? (
          <div className="p-card">
            <StatePanel title="No matching approvals">
              Submit an approval request for credit limits, repairs, discounts,
              purchases, refunds, amendments, or vehicle disposals.
            </StatePanel>
          </div>
        ) : (
          <DataTable>
            <DataTableHead>
              <tr>
                <DataTableHeaderCell>Type</DataTableHeaderCell>
                <DataTableHeaderCell>Request</DataTableHeaderCell>
                <DataTableHeaderCell>Requester</DataTableHeaderCell>
                <DataTableHeaderCell>Previous → Requested</DataTableHeaderCell>
                <DataTableHeaderCell>Status</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Action</DataTableHeaderCell>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {items.map((a) => {
                const isSelf = !!user && a.requester_id === user.id;
                return (
                  <DataTableRow key={a.id}>
                    <DataTableCell className="text-xs font-semibold">
                      {approvalTypeLabels[a.type]}
                    </DataTableCell>
                    <DataTableCell>
                      <p className="font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{a.reason}</p>
                    </DataTableCell>
                    <DataTableCell className="text-xs text-muted-foreground">
                      {a.requester_name ?? `User #${a.requester_id}`}
                    </DataTableCell>
                    <DataTableCell className="font-mono text-xs">
                      {a.previous_value ? `${a.previous_value} → ` : ""}
                      <strong>{a.requested_value}</strong>
                    </DataTableCell>
                    <DataTableCell>
                      <StatusDotBadge
                        tone={
                          a.status === "approved"
                            ? "success"
                            : a.status === "rejected"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {a.status}
                      </StatusDotBadge>
                    </DataTableCell>
                    <DataTableCell align="right">
                      {a.status === "pending" ? (
                        isSelf ? (
                          <span className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
                            <ShieldCheck className="size-3" aria-hidden="true" />
                            Own request
                          </span>
                        ) : canDecide ? (
                          <div className="inline-flex gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 px-2 text-xs text-emerald-700 dark:text-emerald-400"
                              onClick={() =>
                                setDecideTarget({ item: a, decision: "approve" })
                              }
                            >
                              <Check className="size-3" aria-hidden="true" />
                              Approve
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive"
                              onClick={() =>
                                setDecideTarget({ item: a, decision: "reject" })
                              }
                            >
                              <X className="size-3" aria-hidden="true" />
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Awaiting approver
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {a.approver_name ?? "Decided"}
                        </span>
                      )}
                    </DataTableCell>
                  </DataTableRow>
                );
              })}
            </DataTableBody>
          </DataTable>
        )}
      </DataTableFrame>

      {/* New Approval Request Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md rounded-2xl p-card">
          <DialogHeader>
            <DialogTitle>New approval request</DialogTitle>
            <DialogDescription>
              Submit a governed change request. Segregation of duties prevents
              approving your own request.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
            <div className="space-y-1">
              <span className="block text-xs font-medium">Approval type</span>
              <DriveCoreSelect
                ariaLabel="Approval request type"
                value={reqType}
                onValueChange={(v) => setReqType(v as ApprovalType)}
                options={approvalTypes.map((t) => ({
                  value: t,
                  label: approvalTypeLabels[t],
                }))}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="apr-title" className="text-xs font-medium">
                Title
              </label>
              <Input
                id="apr-title"
                placeholder="e.g. Increase Acme Corp credit limit"
                value={reqTitle}
                onChange={(e) => setReqTitle(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="apr-prev" className="text-xs font-medium">
                  Previous value (optional)
                </label>
                <Input
                  id="apr-prev"
                  placeholder="e.g. ZMW 50,000"
                  value={prevValue}
                  onChange={(e) => setPrevValue(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="apr-req" className="text-xs font-medium">
                  Requested value
                </label>
                <Input
                  id="apr-req"
                  placeholder="e.g. ZMW 100,000"
                  value={reqValue}
                  onChange={(e) => setReqValue(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="apr-reason" className="text-xs font-medium">
                Justification
              </label>
              <Textarea
                id="apr-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={busy}
              />
            </div>
            {error ? (
              <p role="alert" className="text-xs text-danger-foreground">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                Submit request
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Decide Dialog */}
      <Dialog
        open={!!decideTarget}
        onOpenChange={(o) => {
          if (!o) setDecideTarget(null);
        }}
      >
        <DialogContent className="max-w-md rounded-2xl p-card">
          <DialogHeader>
            <DialogTitle>
              {decideTarget?.decision === "approve"
                ? "Approve request"
                : "Reject request"}
            </DialogTitle>
            <DialogDescription>
              {decideTarget?.item.title} ({decideTarget?.item.requested_value})
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleDecide(e)} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="apr-notes" className="text-xs font-medium">
                Decision notes (optional)
              </label>
              <Textarea
                id="apr-notes"
                rows={3}
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                disabled={busy}
              />
            </div>
            {error ? (
              <p role="alert" className="text-xs text-danger-foreground">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setDecideTarget(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {decideTarget?.decision === "approve"
                  ? "Confirm approval"
                  : "Confirm rejection"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
