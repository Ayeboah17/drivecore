"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, MailPlus, ShieldCheck, SlidersHorizontal, UserPlus, Users, X } from "lucide-react";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "@/features/live/context";
import { canCreateBranch } from "@/features/setup/contracts";
import {
  canAccessUserAdmin,
  canManageCompanySettings,
  canManageUsers,
  managedRoleLabels,
  managedRoleNames,
  type ManagedRoleName,
  type ManagedUser,
} from "@/lib/api/contracts";
import { errorText } from "@/lib/api/client";
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
  type ActiveFilterChip,
} from "@/components/data/data-table";
import { StatePanel } from "@/components/layout/state-panel";
import { ViewFadeIn } from "@/components/motion/primitives";
import { Button, buttonVariants } from "@/components/ui/button";
import { DriveCoreSelect } from "@/components/ui/drivecore-select";
import {
  CreateUserDialog,
  EditUserDialog,
  RolesReferenceDialog,
} from "./dialogs";
import {
  nextSortState,
  parseSortParams,
  sortRows,
  type SortDirection,
} from "@/lib/table-sort";
import { listRoles, listUsers } from "./service";

const USER_SORT_KEYS = ["name", "email", "role", "is_active"] as const;
import { FinancialSettingsPanel } from "./settings-panel";
import { InvitationsPanel, InviteUserDialog } from "./invitations-panel";

const ROLE_FILTERS = [
  { value: "", label: "All roles" },
  ...managedRoleNames.map((name) => ({
    value: name,
    label: managedRoleLabels[name],
  })),
] as const;

const STATUS_FILTERS = [
  { value: "", label: "All statuses" },
  { value: "1", label: "Active" },
  { value: "0", label: "Inactive" },
] as const;

export function UsersAdminPage() {
  const { user } = useSession();
  const scope = useLiveContext();
  const searchParams = useSearchParams();
  const client = useQueryClient();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [notice, setNotice] = useState("");

  const allowed = !!user && canAccessUserAdmin(user, scope.companyId);
  const canManage = !!user && canManageUsers(user, scope.companyId);
  const canManageBranches = !!user && canCreateBranch(user, scope.companyId);
  const canViewSettings =
    !!user && canManageCompanySettings(user, scope.companyId);
  const rawTab = searchParams.get("tab");
  const activeTab: "users" | "invitations" | "settings" =
    rawTab === "settings" && canViewSettings
      ? "settings"
      : rawTab === "invitations"
        ? "invitations"
        : "users";

  const rawQ = (searchParams.get("q") ?? "").slice(0, 100);
  const rawRole = searchParams.get("role") ?? "";
  const role = managedRoleNames.includes(rawRole as ManagedRoleName)
    ? rawRole
    : "";
  const rawActive = searchParams.get("is_active") ?? "";
  const isActive = rawActive === "1" || rawActive === "0" ? rawActive : "";
  const parsedPage = Number(searchParams.get("page") ?? "1");
  const page =
    Number.isInteger(parsedPage) && parsedPage >= 1 && parsedPage <= 1000000
      ? parsedPage
      : 1;
  const { sort, dir } = parseSortParams(
    searchParams.get("sort"),
    searchParams.get("dir"),
    USER_SORT_KEYS,
  );

  const base = `/companies/${scope.companyId}/users`;

  function updateQuery(next: {
    q?: string;
    role?: string;
    isActive?: string;
    page?: number;
    sort?: string;
    dir?: SortDirection | "";
  }) {
    const params = new URLSearchParams();
    params.set("branch", scope.branch);
    const nextQ = (next.q !== undefined ? next.q : rawQ).trim().slice(0, 100);
    const nextRole = next.role !== undefined ? next.role : role;
    const nextActive = next.isActive !== undefined ? next.isActive : isActive;
    const nextPage = next.page !== undefined ? next.page : 1;
    const nextSort = next.sort !== undefined ? next.sort : sort;
    const nextDir = next.dir !== undefined ? next.dir : dir;
    if (nextQ) params.set("q", nextQ);
    if (nextRole) params.set("role", nextRole);
    if (nextActive) params.set("is_active", nextActive);
    if (nextSort && nextDir) {
      params.set("sort", nextSort);
      params.set("dir", nextDir);
    }
    if (nextPage > 1) params.set("page", String(nextPage));
    scope.navigate(`${base}?${params.toString()}`);
  }

  function handleSort(columnKey: string) {
    const next = nextSortState(sort, dir, columnKey);
    updateQuery({ sort: next.sort, dir: next.dir, page: 1 });
  }

  const users = useQuery({
    queryKey: [
      ...scope.key,
      "users",
      "list",
      { q: rawQ.trim(), role, isActive, page, sort, dir },
    ],
    queryFn: ({ signal }) =>
      listUsers(
        {
          companyId: scope.companyId,
          branch: scope.branch,
          q: rawQ,
          role,
          isActive,
          page,
          sort: sort || undefined,
          dir: dir || undefined,
        },
        signal,
      ),
    enabled: allowed,
    staleTime: 0,
  });

  const rolesQuery = useQuery({
    queryKey: [...scope.key, "roles"],
    queryFn: ({ signal }) => listRoles(scope.companyId, signal),
    enabled: allowed && rolesOpen,
    staleTime: 60_000,
  });

  if (!allowed) {
    return (
      <StatePanel title="Access denied">
        Whole-company user administration requires company administrator or
        platform administrator access.
      </StatePanel>
    );
  }

  const branchLabel = (branchId: number | null) => {
    if (branchId === null) return "All branches";
    return (
      scope.directory?.branches.find((b) => b.id === branchId)?.name ??
      `Branch #${branchId}`
    );
  };

  const chips: ActiveFilterChip[] = [];
  if (rawQ.trim()) {
    chips.push({
      key: "q",
      label: `Search: ${rawQ.trim()}`,
      onRemove: () => updateQuery({ q: "", page: 1 }),
    });
  }
  if (role) {
    chips.push({
      key: "role",
      label: `Role: ${managedRoleLabels[role as ManagedRoleName]}`,
      onRemove: () => updateQuery({ role: "", page: 1 }),
    });
  }
  if (isActive) {
    chips.push({
      key: "is_active",
      label: `Status: ${isActive === "1" ? "Active" : "Inactive"}`,
      onRemove: () => updateQuery({ isActive: "", page: 1 }),
    });
  }

  async function refreshUsers() {
    await client.invalidateQueries({
      queryKey: [...scope.key, "users"],
    });
  }

  return (
    <ViewFadeIn className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-page-title font-extrabold tracking-tight">
            Administration
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage company users, driver accounts, roles, and branch scope for{" "}
            {scope.company?.name}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {canManage ? (
            <>
              <Button type="button" onClick={() => setInviteOpen(true)}>
                <MailPlus className="size-4" aria-hidden="true" />
                Invite user
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(true)}
              >
                <UserPlus className="size-4" aria-hidden="true" />
                Create user
              </Button>
            </>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => setRolesOpen(true)}
          >
            <ShieldCheck className="size-4" aria-hidden="true" />
            Role permissions
          </Button>
          {canManageBranches ? (
            <Link
              className={buttonVariants({ variant: "outline" })}
              href={`/companies/${scope.companyId}/setup?branch=${scope.branch}`}
            >
              Set up branches
            </Link>
          ) : null}
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Administration sections"
        className="flex flex-wrap gap-1.5 rounded-2xl border bg-surface p-1.5"
      >
        {(
          [
            ["users", "Users & Roles", true],
            ["invitations", "Pending invitations", true],
            ["settings", "Financial settings", canViewSettings],
          ] as const
        )
          .filter(([, , visible]) => visible)
          .map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={activeTab === key}
              onClick={() => {
                const params = new URLSearchParams({ branch: scope.branch });
                if (key !== "users") params.set("tab", key);
                scope.navigate(`${base}?${params.toString()}`);
              }}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
                activeTab === key
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              {key === "users" ? (
                <Users className="size-3.5" aria-hidden="true" />
              ) : key === "invitations" ? (
                <Mail className="size-3.5" aria-hidden="true" />
              ) : (
                <SlidersHorizontal className="size-3.5" aria-hidden="true" />
              )}
              {label}
            </button>
          ))}
      </div>

      {notice ? (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-2xl border border-success bg-success/10 px-4 py-3 text-sm text-success-foreground"
        >
          <span>{notice}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Dismiss notice"
            onClick={() => setNotice("")}
            className="size-7 rounded-lg"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
      ) : null}

      {activeTab === "settings" ? (
        <FinancialSettingsPanel />
      ) : activeTab === "invitations" ? (
        <InvitationsPanel canManage={canManage} onNotice={setNotice} />
      ) : (
        <DataTableFrame
          ariaLabel="Users directory"
          chips={chips}
          onClearAll={
            chips.length > 0
              ? () => updateQuery({ q: "", role: "", isActive: "", page: 1 })
              : undefined
          }
          toolbar={
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <DataSearchForm
                label="Search users"
                placeholder="Search name or email…"
                defaultValue={rawQ}
                formKey={`${scope.companyId}:${scope.branch}:users:${rawQ}`}
                onSubmitQuery={(nextQ) => updateQuery({ q: nextQ, page: 1 })}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:w-96">
                <div className="space-y-1.5">
                  <span className="block text-xs font-medium text-muted-foreground">
                    Role
                  </span>
                  <DriveCoreSelect
                    ariaLabel="Filter by role"
                    value={role}
                    onValueChange={(nextRole) =>
                      updateQuery({ role: nextRole, page: 1 })
                    }
                    options={ROLE_FILTERS}
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="block text-xs font-medium text-muted-foreground">
                    Status
                  </span>
                  <DriveCoreSelect
                    ariaLabel="Filter by account status"
                    value={isActive}
                    onValueChange={(nextActive) =>
                      updateQuery({ isActive: nextActive, page: 1 })
                    }
                    options={STATUS_FILTERS}
                  />
                </div>
              </div>
            </div>
          }
          footer={
            users.data ? (
              <>
                <span className="font-mono text-xs tabular-nums">
                  {users.data.total}{" "}
                  {users.data.total === 1 ? "user" : "users"} · Page{" "}
                  {users.data.page} of {users.data.lastPage}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={page <= 1 || users.isFetching}
                    onClick={() => updateQuery({ page: Math.max(1, page - 1) })}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={page >= users.data.lastPage || users.isFetching}
                    onClick={() => updateQuery({ page: page + 1 })}
                  >
                    Next
                  </Button>
                </div>
              </>
            ) : undefined
          }
        >
          {users.isPending ? (
            <DataTableSkeleton columns={6} label="Loading users" />
          ) : users.error ? (
            <div className="p-card">
              <StatePanel
                title="Users unavailable"
                onRetry={() => {
                  void users.refetch();
                }}
              >
                {errorText(users.error)}
              </StatePanel>
            </div>
          ) : users.data.items.length === 0 ? (
            <div className="p-card">
              {page > 1 && users.data.total > 0 ? (
                <StatePanel title="Page out of range">
                  <div className="space-y-3">
                    <p>No users exist on page {page}.</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => updateQuery({ page: 1 })}
                    >
                      Back to page 1
                    </Button>
                  </div>
                </StatePanel>
              ) : chips.length > 0 ? (
                <StatePanel title="No matching users">
                  <div className="space-y-3">
                    <p>
                      No users matched the active search or filter criteria in
                      this workspace scope.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateQuery({ q: "", role: "", isActive: "", page: 1 })
                      }
                    >
                      Clear search and filters
                    </Button>
                  </div>
                </StatePanel>
              ) : (
                <StatePanel title="No users found">
                  <p>No company users are assigned in this workspace scope.</p>
                </StatePanel>
              )}
            </div>
          ) : (
            <DataTable>
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell
                    sortKey="name"
                    activeSort={sort}
                    activeDir={dir}
                    onSort={handleSort}
                  >
                    Name
                  </DataTableHeaderCell>
                  <DataTableHeaderCell
                    sortKey="email"
                    activeSort={sort}
                    activeDir={dir}
                    onSort={handleSort}
                  >
                    Email
                  </DataTableHeaderCell>
                  <DataTableHeaderCell
                    sortKey="role"
                    activeSort={sort}
                    activeDir={dir}
                    onSort={handleSort}
                  >
                    Role
                  </DataTableHeaderCell>
                  <DataTableHeaderCell>Branch scope</DataTableHeaderCell>
                  <DataTableHeaderCell
                    sortKey="is_active"
                    activeSort={sort}
                    activeDir={dir}
                    onSort={handleSort}
                  >
                    Status
                  </DataTableHeaderCell>
                  <DataTableHeaderCell align="right">Action</DataTableHeaderCell>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {sortRows(users.data.items, sort, dir, {
                  name: (u) => u.name,
                  email: (u) => u.email,
                  role: (u) => u.roles[0] ?? "",
                  is_active: (u) => u.is_active,
                }).map((row) => {
                  const isSelf = row.id === user!.id;
                  const roleName = row.roles[0] ?? "unassigned";
                  const roleDisplay = managedRoleNames.includes(
                    roleName as ManagedRoleName,
                  )
                    ? managedRoleLabels[roleName as ManagedRoleName]
                    : roleName;
                  return (
                    <DataTableRow key={row.id}>
                      <DataTableCell className="font-medium">
                        <span className="inline-flex items-center gap-2">
                          <span>{row.name}</span>
                          {isSelf ? (
                            <span className="rounded-md border border-border/80 bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              You
                            </span>
                          ) : null}
                        </span>
                      </DataTableCell>
                      <DataTableCell className="font-mono text-xs text-muted-foreground">
                        {row.email}
                      </DataTableCell>
                      <DataTableCell>
                        <StatusDotBadge tone="neutral">
                          {roleDisplay}
                        </StatusDotBadge>
                      </DataTableCell>
                      <DataTableCell className="text-muted-foreground">
                        {branchLabel(row.branch_id)}
                      </DataTableCell>
                      <DataTableCell>
                        <StatusDotBadge
                          tone={row.is_active ? "success" : "danger"}
                        >
                          {row.is_active ? "Active" : "Inactive"}
                        </StatusDotBadge>
                      </DataTableCell>
                      <DataTableCell align="right">
                        {canManage ? (
                          isSelf ? (
                            <span className="text-xs text-muted-foreground">
                              Protected
                            </span>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setEditing(row)}
                              className="transition-transform duration-150 ease-out active:scale-[0.98]"
                            >
                              Edit access
                            </Button>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Read-only
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
      )}

      <InviteUserDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvited={(email) => {
          setNotice(`Invitation sent to ${email}.`);
          void client.invalidateQueries({
            queryKey: [...scope.key, "invitations"],
          });
        }}
      />

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(name) => {
          setNotice(`User created: ${name}.`);
          void refreshUsers();
        }}
      />

      <EditUserDialog
        target={editing}
        onClose={() => setEditing(null)}
        onUpdated={(updated) => {
          setNotice(`Updated access for ${updated.name}.`);
          void refreshUsers();
        }}
      />

      <RolesReferenceDialog
        open={rolesOpen}
        onOpenChange={setRolesOpen}
        roles={rolesQuery.data}
        loading={rolesQuery.isPending}
        error={rolesQuery.error}
      />
    </ViewFadeIn>
  );
}
