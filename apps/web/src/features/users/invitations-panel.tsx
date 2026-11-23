"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, MailPlus, RefreshCw } from "lucide-react";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "@/features/live/context";
import {
  createInvitation,
  listInvitations,
  resendInvitation,
  revokeInvitation,
} from "@/features/auth/service";
import { errorText } from "@/lib/api/client";
import {
  assignableRoleNames,
  canAssignRole,
  managedRoleLabels,
  type AssignableRoleName,
  type Invitation,
  type ManagedRoleName,
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
  type StatusDotTone,
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

const STATUS_TONE: Record<Invitation["status"], StatusDotTone> = {
  pending: "info",
  accepted: "success",
  revoked: "danger",
  expired: "warning",
};

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function InviteUserDialog({
  open,
  onOpenChange,
  onInvited,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvited: (email: string) => void;
}) {
  const { user } = useSession();
  const scope = useLiveContext();
  const allowedRoles = assignableRoleNames.filter(
    (r) => !user || canAssignRole(user, r),
  );
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignableRoleName>(
    allowedRoles.includes("operations-manager")
      ? "operations-manager"
      : allowedRoles[0] ?? "driver",
  );
  const [branchId, setBranchId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const branches =
    scope.directory?.branches.filter(
      (b) => String(b.company_id) === scope.companyId,
    ) ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      await createInvitation({
        company_id: Number(scope.companyId),
        branch_id: branchId ? Number(branchId) : null,
        email: trimmed,
        role,
      });
      setEmail("");
      setBranchId("");
      onInvited(trimmed);
      onOpenChange(false);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl p-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MailPlus className="size-4 text-link" aria-hidden="true" />
            Invite user by email
          </DialogTitle>
          <DialogDescription>
            Send a single-use 72-hour invitation link to join{" "}
            {scope.company?.name}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="invite-user-email" className="text-sm font-medium">
              Email address
            </label>
            <Input
              id="invite-user-email"
              type="email"
              placeholder="teammate@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
          </div>

          <div className="space-y-1.5">
            <span className="block text-sm font-medium">Role</span>
            <DriveCoreSelect
              ariaLabel="Invited user role"
              value={role}
              onValueChange={(v) => setRole(v as AssignableRoleName)}
              options={allowedRoles.map((r) => ({
                value: r,
                label: managedRoleLabels[r],
              }))}
            />
          </div>

          <div className="space-y-1.5">
            <span className="block text-sm font-medium">Branch scope</span>
            <DriveCoreSelect
              ariaLabel="Invited user branch"
              value={branchId}
              onValueChange={setBranchId}
              options={[
                { value: "", label: "All branches (whole company)" },
                ...branches.map((b) => ({
                  value: String(b.id),
                  label: b.name,
                })),
              ]}
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-danger-foreground">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Sending invite…" : "Send invitation"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function InvitationsPanel({
  canManage,
  onNotice,
}: {
  canManage: boolean;
  onNotice: (msg: string) => void;
}) {
  const scope = useLiveContext();
  const client = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: [...scope.key, "invitations", statusFilter],
    queryFn: ({ signal }) =>
      listInvitations(
        { companyId: scope.companyId, status: statusFilter || undefined },
        signal,
      ),
    enabled: !!scope.companyId,
    retry: false,
  });

  async function handleResend(inv: Invitation) {
    setBusyId(inv.id);
    setActionError(null);
    try {
      await resendInvitation(inv.id);
      await client.invalidateQueries({
        queryKey: [...scope.key, "invitations"],
      });
      onNotice(
        `Invitation resent to ${inv.email}. Any previous link is now invalid.`,
      );
    } catch (err) {
      setActionError(errorText(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleRevoke(inv: Invitation) {
    setBusyId(inv.id);
    setActionError(null);
    try {
      await revokeInvitation(inv.id);
      await client.invalidateQueries({
        queryKey: [...scope.key, "invitations"],
      });
      onNotice(`Invitation for ${inv.email} revoked.`);
    } catch (err) {
      setActionError(errorText(err));
    } finally {
      setBusyId(null);
    }
  }

  if (query.data && !query.data.supported) {
    return (
      <StatePanel title="Invitations endpoint not yet deployed">
        Email invitations require backend PR #15 (/api/v1/invitations). Use
        Create user in the meantime.
      </StatePanel>
    );
  }

  return (
    <div className="space-y-4">
      {actionError ? (
        <p role="alert" className="text-sm text-danger-foreground">
          {actionError}
        </p>
      ) : null}

      <DataTableFrame
        ariaLabel="Pending invitations"
        toolbar={
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-48 space-y-1">
              <span className="block text-xs font-medium text-muted-foreground">
                Status
              </span>
              <DriveCoreSelect
                ariaLabel="Filter invitations by status"
                value={statusFilter}
                onValueChange={setStatusFilter}
                options={[
                  { value: "", label: "All statuses" },
                  { value: "pending", label: "Pending" },
                  { value: "accepted", label: "Accepted" },
                  { value: "revoked", label: "Revoked" },
                  { value: "expired", label: "Expired" },
                ]}
              />
            </div>
          </div>
        }
      >
        {query.isPending ? (
          <DataTableSkeleton columns={6} label="Loading invitations" />
        ) : query.error || !query.data ? (
          <div className="p-card">
            <StatePanel title="Invitations unavailable">
              {errorText(query.error)}
            </StatePanel>
          </div>
        ) : query.data.items.length === 0 ? (
          <div className="p-card">
            <StatePanel title="No invitations">
              Use Invite user to send a 72-hour single-use email invitation.
            </StatePanel>
          </div>
        ) : (
          <DataTable>
            <DataTableHead>
              <tr>
                <DataTableHeaderCell>Email</DataTableHeaderCell>
                <DataTableHeaderCell>Role</DataTableHeaderCell>
                <DataTableHeaderCell>Branch</DataTableHeaderCell>
                <DataTableHeaderCell>Status</DataTableHeaderCell>
                <DataTableHeaderCell>Expires</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Actions</DataTableHeaderCell>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {query.data.items.map((inv) => (
                <DataTableRow key={inv.id}>
                  <DataTableCell className="font-mono text-xs font-semibold">
                    {inv.email}
                  </DataTableCell>
                  <DataTableCell>
                    {managedRoleLabels[inv.role as ManagedRoleName] ?? inv.role}
                  </DataTableCell>
                  <DataTableCell className="text-muted-foreground">
                    {inv.branch_name ?? "All branches"}
                  </DataTableCell>
                  <DataTableCell>
                    <StatusDotBadge tone={STATUS_TONE[inv.status]}>
                      {inv.status}
                    </StatusDotBadge>
                  </DataTableCell>
                  <DataTableCell className="text-xs text-muted-foreground">
                    {fmtDate(inv.expires_at)}
                  </DataTableCell>
                  <DataTableCell align="right">
                    {canManage &&
                    (inv.status === "pending" || inv.status === "expired") ? (
                      <div className="inline-flex items-center gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busyId === inv.id}
                          onClick={() => void handleResend(inv)}
                          className="h-7 gap-1 px-2 text-xs"
                        >
                          <RefreshCw className="size-3" aria-hidden="true" />
                          Resend
                        </Button>
                        {inv.status === "pending" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={busyId === inv.id}
                            onClick={() => void handleRevoke(inv)}
                            className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive"
                          >
                            <Ban className="size-3" aria-hidden="true" />
                            Revoke
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </DataTableFrame>
    </div>
  );
}
