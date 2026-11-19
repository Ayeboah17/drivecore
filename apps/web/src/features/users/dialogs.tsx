"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck, UserPlus } from "lucide-react";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "@/features/live/context";
import { ApiError, errorText, initializeCsrf } from "@/lib/api/client";
import {
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
import { createUser, updateUser } from "./service";

const ROLE_OPTIONS = managedRoleNames.map((name) => ({
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
      role: "operations",
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
              options={ROLE_OPTIONS}
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
            options={ROLE_OPTIONS}
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

export function RolesReferenceDialog({
  open,
  onOpenChange,
  roles,
  loading,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: RoleDefinition[] | undefined;
  loading: boolean;
  error: unknown;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-card sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-link" aria-hidden="true" />
            Role permissions
          </DialogTitle>
          <DialogDescription>
            Authoritative permission matrix granted by Laravel for each
            assignable role.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading roles…</p>
        ) : error ? (
          <p role="alert" className="text-sm text-danger-foreground">
            {errorText(error)}
          </p>
        ) : !roles?.length ? (
          <p className="text-sm text-muted-foreground">
            No assignable roles returned.
          </p>
        ) : (
          <div className="space-y-3">
            {roles.map((role) => (
              <article
                key={role.name}
                className="space-y-2 rounded-xl border bg-muted/20 p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">
                    {managedRoleLabels[role.name]}
                  </h3>
                  <span className="font-mono text-xs text-muted-foreground">
                    {role.name}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {role.permissions.length === 0 ? (
                    <span className="text-xs text-muted-foreground">
                      No explicit permissions
                    </span>
                  ) : (
                    role.permissions.map((perm) => (
                      <Badge
                        key={perm}
                        variant="outline"
                        className="font-mono text-[11px]"
                      >
                        {perm}
                      </Badge>
                    ))
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
