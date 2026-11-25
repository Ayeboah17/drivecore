"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck, UserPlus } from "lucide-react";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "@/features/live/context";
import { ApiError, errorText, initializeCsrf } from "@/lib/api/client";
import {
  assignableRoleNames,
  canAssignRole,
  managedRoleLabels,
  managedRoleNames,
  type ManagedRoleName,
  type ManagedUser,
  type RoleDefinition,
} from "@/lib/api/contracts";
import { applyFieldErrors } from "@/features/records/forms";
import { Badge } from "@/components/ui/badge";
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
import {
  createUserSchema,
  updateUserSchema,
  type CreateUserValues,
  type UpdateUserValues,
} from "./schemas";
import {
  createUser,
  deleteUser,
  resetRolePermissions,
  updateRolePermissions,
  updateUser,
} from "./service";
import { Checkbox } from "@/components/ui/checkbox";

const ROLE_OPTIONS = assignableRoleNames.map((name) => ({
  value: name,
  label: managedRoleLabels[name],
}));

function CreateUserForm({
  onBusyChange,
  onCancel,
  onCreated,
}: {
  onBusyChange: (busy: boolean) => void;
  onCancel: () => void;
  onCreated: (name: string) => void;
}) {
  const scope = useLiveContext();
  const session = useSession();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const formId = useId();

  useEffect(() => {
    return () => {
      controller.current?.abort();
    };
  }, []);

  const companyBranches =
    scope.directory?.branches.filter(
      (b) => String(b.company_id) === scope.companyId,
    ) ?? [];
  const defaultBranch = scope.branch === "all" ? "" : scope.branch;

  const {
    register,
    handleSubmit,
    setError: setFieldError,
    setValue,
    reset,
    control,
    formState: { errors },
  } = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      password_confirmation: "",
      role: "operations-manager",
      branch_id: defaultBranch,
    },
  });

  const roleValue = useWatch({ control, name: "role" });
  const branchValue = useWatch({ control, name: "branch_id" });

  async function onSubmitValues(values: CreateUserValues) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    onBusyChange(true);
    setError(null);
    controller.current = new AbortController();
    try {
      const created = await createUser(
        {
          company_id: Number(scope.companyId),
          branch_id: values.branch_id ? Number(values.branch_id) : null,
          name: values.name,
          email: values.email.toLowerCase(),
          password: values.password,
          password_confirmation: values.password_confirmation,
          role: values.role,
        },
        controller.current.signal,
      );
      reset({
        name: "",
        email: "",
        password: "",
        password_confirmation: "",
        role: "operations",
        branch_id: defaultBranch,
      });
      onCreated(created.name);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        session.expire();
      }
      applyFieldErrors(
        failure,
        [
          "name",
          "email",
          "password",
          "password_confirmation",
          "role",
          "branch_id",
        ],
        setFieldError,
      );
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
      onSubmit={(event) => {
        void handleSubmit(onSubmitValues)(event);
      }}
    >
      <fieldset disabled={busy} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor={`${formId}-name`} className="text-sm font-medium">
            Name
          </label>
          <Input
            id={`${formId}-name`}
            autoComplete="off"
            maxLength={255}
            {...register("name")}
            aria-invalid={!!errors.name}
            aria-describedby={`${formId}-name-error`}
          />
          <p
            id={`${formId}-name-error`}
            className="text-sm text-danger-foreground"
          >
            {errors.name?.message}
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor={`${formId}-email`} className="text-sm font-medium">
            Email
          </label>
          <Input
            id={`${formId}-email`}
            type="email"
            autoComplete="off"
            maxLength={255}
            {...register("email")}
            aria-invalid={!!errors.email}
            aria-describedby={`${formId}-email-error`}
          />
          <p
            id={`${formId}-email-error`}
            className="text-sm text-danger-foreground"
          >
            {errors.email?.message}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-role`} className="text-sm font-medium">
              Role
            </label>
            <DriveCoreSelect
              id={`${formId}-role`}
              value={roleValue}
              onValueChange={(val) =>
                setValue("role", val as ManagedRoleName, {
                  shouldValidate: true,
                })
              }
              ariaInvalid={!!errors.role}
              aria-describedby={`${formId}-role-error`}
              options={ROLE_OPTIONS.filter(
                (o) => !session.user || canAssignRole(session.user, o.value),
              )}
            />
            <p
              id={`${formId}-role-error`}
              className="text-sm text-danger-foreground"
            >
              {errors.role?.message}
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor={`${formId}-branch`} className="text-sm font-medium">
              Branch access
            </label>
            <DriveCoreSelect
              id={`${formId}-branch`}
              value={branchValue}
              onValueChange={(val) =>
                setValue("branch_id", val, { shouldValidate: true })
              }
              ariaInvalid={!!errors.branch_id}
              aria-describedby={`${formId}-branch-error`}
              options={[
                { value: "", label: "All branches (whole company)" },
                ...companyBranches.map((b) => ({
                  value: String(b.id),
                  label: b.name,
                })),
              ]}
            />
            <p
              id={`${formId}-branch-error`}
              className="text-sm text-danger-foreground"
            >
              {errors.branch_id?.message}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label
              htmlFor={`${formId}-password`}
              className="text-sm font-medium"
            >
              Password
            </label>
            <Input
              id={`${formId}-password`}
              type="password"
              autoComplete="new-password"
              {...register("password")}
              aria-invalid={!!errors.password}
              aria-describedby={`${formId}-password-error`}
            />
            <p
              id={`${formId}-password-error`}
              className="text-sm text-danger-foreground"
            >
              {errors.password?.message}
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor={`${formId}-password-confirm`}
              className="text-sm font-medium"
            >
              Confirm password
            </label>
            <Input
              id={`${formId}-password-confirm`}
              type="password"
              autoComplete="new-password"
              {...register("password_confirmation")}
              aria-invalid={!!errors.password_confirmation}
              aria-describedby={`${formId}-password-confirm-error`}
            />
            <p
              id={`${formId}-password-confirm-error`}
              className="text-sm text-danger-foreground"
            >
              {errors.password_confirmation?.message}
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Minimum 12 characters containing both letters and numbers.
        </p>
      </fieldset>

      {error ? (
        <div
          role="alert"
          className="space-y-2 rounded-xl border border-danger bg-danger/10 p-3 text-sm text-danger-foreground"
        >
          <p>{errorText(error)}</p>
          {error instanceof ApiError && error.status === 419 ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  await initializeCsrf();
                  setError(
                    new Error(
                      "CSRF protection renewed. Submit again when ready.",
                    ),
                  );
                } catch (csrfFailure) {
                  setError(csrfFailure);
                }
              }}
            >
              Renew CSRF protection
            </Button>
          ) : null}
        </div>
      ) : null}

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
          {busy ? "Creating…" : "Create user"}
        </Button>
      </div>
    </form>
  );
}

export function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (name: string) => void;
}) {
  const scope = useLiveContext();
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
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-card sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-4 text-link" aria-hidden="true" />
            Create user
          </DialogTitle>
          <DialogDescription>
            Add a staff member or driver to {scope.company?.name}. Passwords are
            sent directly to the API and are never stored in browser state.
          </DialogDescription>
        </DialogHeader>

        {open ? (
          <CreateUserForm
            onBusyChange={setBusy}
            onCancel={() => onOpenChange(false)}
            onCreated={(name) => {
              onOpenChange(false);
              onCreated(name);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EditUserForm({
  target,
  onBusyChange,
  onCancel,
  onUpdated,
}: {
  target: ManagedUser;
  onBusyChange: (busy: boolean) => void;
  onCancel: () => void;
  onUpdated: (user: ManagedUser) => void;
}) {
  const scope = useLiveContext();
  const session = useSession();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const formId = useId();

  useEffect(() => {
    return () => {
      controller.current?.abort();
    };
  }, []);

  const companyBranches =
    scope.directory?.branches.filter(
      (b) => String(b.company_id) === scope.companyId,
    ) ?? [];

  const initialRole: ManagedRoleName = managedRoleNames.includes(
    (target.roles[0] ?? "") as ManagedRoleName,
  )
    ? (target.roles[0] as ManagedRoleName)
    : "viewer";

  const {
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<UpdateUserValues>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      role: initialRole,
      branch_id: target.branch_id ? String(target.branch_id) : "",
      is_active: target.is_active,
    },
  });

  const roleValue = useWatch({ control, name: "role" });
  const branchValue = useWatch({ control, name: "branch_id" });
  const activeValue = useWatch({ control, name: "is_active" });

  async function onSubmitValues(values: UpdateUserValues) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    onBusyChange(true);
    setError(null);
    controller.current = new AbortController();
    try {
      const payload: {
        company_id: number;
        branch_id?: number | null;
        role?: string;
        is_active?: boolean;
      } = {
        company_id: Number(scope.companyId),
      };
      const nextBranch = values.branch_id ? Number(values.branch_id) : null;
      if (nextBranch !== target.branch_id) {
        payload.branch_id = nextBranch;
      }
      if (values.role !== initialRole) {
        payload.role = values.role;
      }
      if (values.is_active !== target.is_active) {
        payload.is_active = values.is_active;
      }
      const updated = await updateUser(
        target.id,
        payload,
        controller.current.signal,
      );
      onUpdated(updated);
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
      onSubmit={(event) => {
        void handleSubmit(onSubmitValues)(event);
      }}
    >
      <fieldset disabled={busy} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor={`${formId}-role`} className="text-sm font-medium">
            Role
          </label>
          <DriveCoreSelect
            id={`${formId}-role`}
            value={roleValue}
            onValueChange={(val) =>
              setValue("role", val as ManagedRoleName, {
                shouldValidate: true,
              })
            }
            ariaInvalid={!!errors.role}
            options={ROLE_OPTIONS.filter(
              (o) => !session.user || canAssignRole(session.user, o.value),
            )}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor={`${formId}-branch`} className="text-sm font-medium">
            Branch access
          </label>
          <DriveCoreSelect
            id={`${formId}-branch`}
            value={branchValue}
            onValueChange={(val) =>
              setValue("branch_id", val, { shouldValidate: true })
            }
            ariaInvalid={!!errors.branch_id}
            options={[
              { value: "", label: "All branches (whole company)" },
              ...companyBranches.map((b) => ({
                value: String(b.id),
                label: b.name,
              })),
            ]}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor={`${formId}-status`} className="text-sm font-medium">
            Account status
          </label>
          <DriveCoreSelect
            id={`${formId}-status`}
            value={activeValue ? "active" : "inactive"}
            onValueChange={(val) =>
              setValue("is_active", val === "active", {
                shouldValidate: true,
              })
            }
            options={[
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive (revokes tokens)" },
            ]}
          />
          {!activeValue ? (
            <p className="text-xs text-warning-foreground">
              Deactivating immediately blocks sign-in and revokes active API
              tokens.
            </p>
          ) : null}
        </div>
      </fieldset>

      {error ? (
        <div
          role="alert"
          className="space-y-2 rounded-xl border border-danger bg-danger/10 p-3 text-sm text-danger-foreground"
        >
          <p>
            {error instanceof ApiError && error.status === 409
              ? "Access change rejected. You cannot change your own access, and only a platform administrator can change global role or activation for a multi-company user."
              : errorText(error)}
          </p>
        </div>
      ) : null}

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
          {busy ? "Saving…" : "Save access"}
        </Button>
      </div>
    </form>
  );
}

export function EditUserDialog({
  target,
  onClose,
  onUpdated,
}: {
  target: ManagedUser | null;
  onClose: () => void;
  onUpdated: (user: ManagedUser) => void;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <Dialog
      open={!!target}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        showCloseButton={!busy}
        className="rounded-2xl p-card sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Edit access — {target?.name}</DialogTitle>
          <DialogDescription>
            Update role, branch assignment, or account status for{" "}
            <span className="font-mono">{target?.email}</span>.
          </DialogDescription>
        </DialogHeader>

        {target ? (
          <EditUserForm
            key={target.id}
            target={target}
            onBusyChange={setBusy}
            onCancel={onClose}
            onUpdated={(updated) => {
              onUpdated(updated);
              onClose();
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function DeleteUserDialog({
  target,
  onClose,
  onDeleted,
}: {
  target: ManagedUser | null;
  onClose: () => void;
  onDeleted: (deletedId: number) => void;
}) {
  const scope = useLiveContext();
  const [confirmEmail, setConfirmEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const matches =
    !!target &&
    confirmEmail.trim().toLowerCase() === target.email.trim().toLowerCase();

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!target || !matches || busy) return;
    setBusy(true);
    setError(null);
    const ac = new AbortController();
    try {
      await deleteUser(target.id, scope.companyId, ac.signal);
      setConfirmEmail("");
      onDeleted(target.id);
      onClose();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={!!target}
      onOpenChange={(open) => {
        if (!open && !busy) {
          setConfirmEmail("");
          setError(null);
          onClose();
        }
      }}
    >
      <DialogContent
        showCloseButton={!busy}
        className="rounded-2xl p-card sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Remove user — {target?.name}</DialogTitle>
          <DialogDescription>
            This immediately revokes active sessions and removes{" "}
            <span className="font-semibold text-foreground">
              {target?.email}
            </span>{" "}
            from this company. Historical audit logs, rentals, invoices, and
            meetings remain intact.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            void handleConfirm(e);
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <label
              htmlFor="delete-user-confirm-email"
              className="text-xs font-medium text-foreground"
            >
              Type <span className="font-semibold">{target?.email}</span> to
              confirm
            </label>
            <Input
              id="delete-user-confirm-email"
              autoComplete="off"
              disabled={busy}
              placeholder={target?.email ?? ""}
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
            />
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-danger bg-danger/10 p-3 text-xs text-danger-foreground"
            >
              {errorText(error)}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setConfirmEmail("");
                setError(null);
                onClose();
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={busy || !matches}
            >
              {busy ? "Removing…" : "Delete user"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const PERMISSION_GROUPS: { label: string; permissions: string[] }[] = [
  {
    label: "Company & Branches",
    permissions: [
      "companies.view",
      "companies.manage",
      "branches.view",
      "branches.manage",
    ],
  },
  {
    label: "Fleet & Vehicles",
    permissions: ["vehicles.view", "vehicles.manage"],
  },
  {
    label: "Customers & CRM",
    permissions: [
      "customers.view",
      "customers.manage",
      "leads.view",
      "leads.manage",
    ],
  },
  {
    label: "Quotations & Rentals",
    permissions: [
      "quotations.view",
      "quotations.manage",
      "quotations.approve_discount",
      "reservations.view",
      "reservations.manage",
      "rentals.view",
      "rentals.manage",
      "documents.view",
      "documents.manage",
    ],
  },
  {
    label: "Finance & Accounting",
    permissions: [
      "invoices.view",
      "invoices.manage",
      "payments.manage",
      "expenses.view",
      "expenses.manage",
      "gl.view",
    ],
  },
  {
    label: "Maintenance, Inventory & Procurement",
    permissions: [
      "work_orders.view",
      "work_orders.manage",
      "parts.view",
      "parts.manage",
      "suppliers.view",
      "suppliers.manage",
      "purchase_orders.view",
      "purchase_orders.manage",
      "purchase_orders.approve",
    ],
  },
  {
    label: "Communications & Meetings",
    permissions: [
      "messages.view",
      "messages.send",
      "meetings.view",
      "meetings.manage",
    ],
  },
  {
    label: "Reports, Audit & Administration",
    permissions: [
      "reports.view",
      "audit.view",
      "users.view",
      "users.manage",
      "roles.view",
      "settings.manage",
    ],
  },
];

const LOCKOUT_PROTECTED_PERMISSIONS = new Set([
  "users.manage",
  "roles.view",
  "settings.manage",
]);

export function RolesReferenceDialog({
  open,
  onOpenChange,
  roles,
  loading,
  error,
  canEdit = false,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: RoleDefinition[] | undefined;
  loading: boolean;
  error: unknown;
  canEdit?: boolean;
  onUpdated?: () => void;
}) {
  const scope = useLiveContext();
  const [selectedRoleName, setSelectedRoleName] = useState<string>("");
  const [draftPerms, setDraftPerms] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [feedback, setFeedback] = useState<string>("");
  const [saveError, setSaveError] = useState<string>("");

  const activeRole =
    roles?.find((r) => r.name === selectedRoleName) ?? roles?.[0] ?? null;

  function selectRole(role: RoleDefinition) {
    setSelectedRoleName(role.name);
    setDraftPerms([...role.permissions]);
    setDirty(false);
    setFeedback("");
    setSaveError("");
  }

  const effectivePerms = dirty
    ? draftPerms
    : (activeRole?.permissions ?? []);

  const isLockedAdminRole =
    activeRole?.name === "system-administrator" ||
    activeRole?.name === "company-admin";

  function togglePerm(perm: string) {
    if (!canEdit || !activeRole) return;
    if (isLockedAdminRole && LOCKOUT_PROTECTED_PERMISSIONS.has(perm)) return;
    const base = dirty ? draftPerms : [...activeRole.permissions];
    const next = base.includes(perm)
      ? base.filter((p) => p !== perm)
      : [...base, perm];
    setDraftPerms(next);
    setDirty(true);
    setFeedback("");
    setSaveError("");
  }

  async function handleSave() {
    if (!canEdit || !activeRole || saving) return;
    setSaving(true);
    setSaveError("");
    setFeedback("");
    const ac = new AbortController();
    try {
      const updated = await updateRolePermissions(
        activeRole.name,
        {
          company_id: Number(scope.companyId),
          permissions: effectivePerms,
        },
        ac.signal,
      );
      setDraftPerms([...updated.permissions]);
      setDirty(false);
      setFeedback(
        `Saved ${updated.permissions.length} permissions for ${managedRoleLabels[activeRole.name]}.`,
      );
      onUpdated?.();
    } catch (err) {
      setSaveError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!canEdit || !activeRole || resetting) return;
    setResetting(true);
    setSaveError("");
    setFeedback("");
    const ac = new AbortController();
    try {
      const updated = await resetRolePermissions(
        activeRole.name,
        Number(scope.companyId),
        ac.signal,
      );
      setDraftPerms([...updated.permissions]);
      setDirty(false);
      setFeedback(
        `Restored default SRS permissions for ${managedRoleLabels[activeRole.name]}.`,
      );
      onUpdated?.();
    } catch (err) {
      setSaveError(errorText(err));
    } finally {
      setResetting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88dvh] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-2xl p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-5 py-4 pr-12">
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-link" aria-hidden="true" />
            {canEdit ? "Manage Role Permissions" : "Role Permissions"}
          </DialogTitle>
          <DialogDescription>
            {canEdit
              ? "Customize company-scoped permissions per role. Lockout-critical admin permissions remain protected."
              : "Authoritative permission matrix granted for each assignable role."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="p-5 text-sm text-muted-foreground">Loading roles…</p>
        ) : error ? (
          <p role="alert" className="p-5 text-sm text-danger-foreground">
            {errorText(error)}
          </p>
        ) : !roles?.length ? (
          <p className="p-5 text-sm text-muted-foreground">
            No assignable roles returned.
          </p>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            <aside className="flex shrink-0 gap-1 overflow-x-auto border-b bg-muted/20 p-3 md:w-56 md:flex-col md:overflow-y-auto md:border-r md:border-b-0">
              {roles.map((role) => {
                const selected = activeRole?.name === role.name;
                return (
                  <button
                    key={role.name}
                    type="button"
                    onClick={() => selectRole(role)}
                    className={`flex shrink-0 items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors ${
                      selected
                        ? "bg-surface font-semibold text-foreground shadow-xs ring-1 ring-border"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }`}
                  >
                    <span className="truncate">
                      {managedRoleLabels[role.name] ?? role.name}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {role.permissions.length}
                    </Badge>
                  </button>
                );
              })}
            </aside>

            {activeRole ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex-1 space-y-4 overflow-y-auto p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-foreground">
                        {managedRoleLabels[activeRole.name] ?? activeRole.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Slug: {activeRole.name} · {effectivePerms.length}{" "}
                        enabled
                      </p>
                    </div>
                  </div>

                  {PERMISSION_GROUPS.map((group) => (
                    <div
                      key={group.label}
                      className="space-y-2 rounded-xl border bg-surface p-3"
                    >
                      <h4 className="text-xs font-semibold text-foreground">
                        {group.label}
                      </h4>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {group.permissions.map((perm) => {
                          const checked = effectivePerms.includes(perm);
                          const locked =
                            isLockedAdminRole &&
                            LOCKOUT_PROTECTED_PERMISSIONS.has(perm);
                          return (
                            <label
                              key={perm}
                              className={`flex items-center gap-2 text-xs ${
                                canEdit && !locked
                                  ? "cursor-pointer text-foreground"
                                  : "text-muted-foreground"
                              }`}
                            >
                              <Checkbox
                                checked={checked}
                                disabled={!canEdit || locked}
                                onCheckedChange={() => togglePerm(perm)}
                              />
                              <span className="truncate">{perm}</span>
                              {locked ? (
                                <span className="text-[10px] text-muted-foreground">
                                  (locked)
                                </span>
                              ) : null}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {canEdit ? (
                  <div className="space-y-2 border-t bg-muted/20 px-4 py-3">
                    {saveError ? (
                      <p role="alert" className="text-xs text-danger-foreground">
                        {saveError}
                      </p>
                    ) : null}
                    {feedback ? (
                      <p
                        role="status"
                        className="text-xs font-medium text-emerald-700 dark:text-emerald-300"
                      >
                        {feedback}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={saving || resetting}
                        onClick={() => {
                          void handleReset();
                        }}
                      >
                        {resetting ? "Resetting…" : "Reset to defaults"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={saving || resetting || !dirty}
                        onClick={() => {
                          void handleSave();
                        }}
                      >
                        {saving ? "Saving…" : "Save permissions"}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
