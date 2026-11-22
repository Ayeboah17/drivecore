"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  KeyRound,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { useSession } from "@/features/auth/session-provider";
import { changePassword, updateProfile } from "@/features/auth/service";
import { PasswordStrengthHint } from "@/features/auth/password-strength";
import { Protected } from "@/features/live/shell";
import {
  LiveAccountMenu,
  LiveLogoutAlert,
  useLiveLogout,
} from "@/features/live/account-menu";
import { errorText } from "@/lib/api/client";
import {
  checkPasswordStrength,
  managedRoleLabels,
  type ManagedRoleName,
} from "@/lib/api/contracts";
import { DriveCoreLogo } from "@/components/brand/drivecore-mark";
import {
  DriveCoreMotionProvider,
  ViewFadeIn,
} from "@/components/motion/primitives";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function AccountWorkspace() {
  const session = useSession();
  const router = useRouter();
  const { pending: logoutPending, error: logoutError, logout, renewCsrf } =
    useLiveLogout();
  const user = session.user!;
  const forced = Boolean(user.must_change_password);

  const [displayName, setDisplayName] = useState(user.name);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [revokeOthers, setRevokeOthers] = useState(true);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaved, setPwSaved] = useState(false);

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfileSaved(false);
    const trimmed = displayName.trim();
    if (!trimmed) {
      setProfileError("Display name is required.");
      return;
    }
    setProfileBusy(true);
    try {
      const updated = await updateProfile(trimmed);
      await session.adoptUser(updated, false);
      setProfileSaved(true);
    } catch (err) {
      setProfileError(errorText(err));
    } finally {
      setProfileBusy(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwSaved(false);
    if (!currentPassword) {
      setPwError("Enter your current password.");
      return;
    }
    if (!checkPasswordStrength(newPassword).valid) {
      setPwError(
        "New password must be at least 10 characters and include a letter and a number.",
      );
      return;
    }
    if (newPassword === currentPassword) {
      setPwError("New password must be different from your current password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("Password confirmation does not match.");
      return;
    }
    setPwBusy(true);
    try {
      const updated = await changePassword({
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword,
        revoke_other_sessions: revokeOthers,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await session.adoptUser(updated, false);
      setPwSaved(true);
      if (forced) {
        router.replace("/companies");
      }
    } catch (err) {
      setPwError(errorText(err));
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <DriveCoreMotionProvider>
      <div className="min-h-dvh bg-background">
        <header className="sticky top-0 z-30 border-b bg-surface/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-page">
            <div className="flex items-center gap-3">
              <DriveCoreLogo badge="LIVE" />
              {!forced ? (
                <Link
                  href="/companies"
                  className="inline-flex items-center gap-1.5 rounded-xl border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:text-link"
                >
                  <ArrowLeft className="size-3.5" aria-hidden="true" />
                  Back to workspaces
                </Link>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <LiveAccountMenu
                pending={logoutPending}
                onLogout={() => void logout()}
                showWorkspacesLink={!forced}
              />
            </div>
          </div>
        </header>

        <LiveLogoutAlert
          error={logoutError}
          pending={logoutPending}
          onRetry={() => void logout()}
          onRenewCsrf={renewCsrf}
        />

        <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-page">
          <ViewFadeIn className="space-y-6">
            <div className="space-y-1">
              <h1 className="text-page-title font-extrabold tracking-tight">
                Account &amp; security
              </h1>
              <p className="text-sm text-muted-foreground">
                {forced
                  ? "Update your temporary password before opening your company workspace."
                  : "Manage your display name, workspace memberships, and password security."}
              </p>
            </div>

            {forced ? (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200"
              >
                <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-semibold">Password change required</p>
                  <p className="mt-0.5 text-xs opacity-90">
                    Your account was created with a temporary password. Choose a
                    new personal password below to unlock DriveCore workspaces.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-2">
              {!forced ? (
                <section className="dc-shadow-card space-y-5 rounded-2xl border bg-surface p-card">
                  <div className="space-y-1">
                    <h2 className="flex items-center gap-2 text-base font-bold tracking-tight">
                      <UserRound className="size-4 text-link" aria-hidden="true" />
                      Profile
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Email addresses are managed by your Company Admin.
                    </p>
                  </div>

                  <form
                    onSubmit={(e) => void handleProfileSubmit(e)}
                    className="space-y-4"
                  >
                    <div className="space-y-1.5">
                      <label
                        htmlFor="account-name"
                        className="text-sm font-medium"
                      >
                        Display name
                      </label>
                      <Input
                        id="account-name"
                        maxLength={120}
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        disabled={profileBusy}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label
                        htmlFor="account-email"
                        className="text-sm font-medium"
                      >
                        Email (read-only)
                      </label>
                      <Input
                        id="account-email"
                        value={user.email}
                        readOnly
                        disabled
                      />
                    </div>
                    {profileError ? (
                      <p role="alert" className="text-sm text-danger-foreground">
                        {profileError}
                      </p>
                    ) : null}
                    {profileSaved ? (
                      <p
                        role="status"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400"
                      >
                        <CheckCircle2 className="size-4" aria-hidden="true" />
                        Profile updated.
                      </p>
                    ) : null}
                    <Button type="submit" disabled={profileBusy}>
                      {profileBusy ? "Saving…" : "Save profile"}
                    </Button>
                  </form>

                  <div className="space-y-2 border-t pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Roles &amp; workspaces
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {user.roles.map((r) => (
                        <span
                          key={r}
                          className="rounded-md border bg-muted/40 px-2 py-0.5 text-xs font-medium"
                        >
                          {managedRoleLabels[r as ManagedRoleName] ?? r}
                        </span>
                      ))}
                    </div>
                    {user.companies.length > 0 ? (
                      <ul className="space-y-1 pt-1 text-xs text-muted-foreground">
                        {user.companies.map((c) => (
                          <li key={c.id} className="flex items-center gap-1.5">
                            <Building2 className="size-3.5" aria-hidden="true" />
                            <span className="font-medium text-foreground">
                              {c.name}
                            </span>
                            <span>
                              ·{" "}
                              {c.branch_id === null
                                ? "All branches"
                                : `Branch #${c.branch_id}`}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </section>
              ) : null}

              <section
                className={`dc-shadow-card space-y-5 rounded-2xl border bg-surface p-card ${
                  forced ? "lg:col-span-2 lg:max-w-lg" : ""
                }`}
              >
                <div className="space-y-1">
                  <h2 className="flex items-center gap-2 text-base font-bold tracking-tight">
                    <KeyRound className="size-4 text-link" aria-hidden="true" />
                    Change password
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Use at least 10 characters with letters and numbers.
                  </p>
                </div>

                <form
                  onSubmit={(e) => void handlePasswordSubmit(e)}
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <label
                      htmlFor="current-password"
                      className="text-sm font-medium"
                    >
                      Current password
                    </label>
                    <Input
                      id="current-password"
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      disabled={pwBusy}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="new-password"
                      className="text-sm font-medium"
                    >
                      New password
                    </label>
                    <Input
                      id="new-password"
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={pwBusy}
                    />
                    <PasswordStrengthHint password={newPassword} />
                  </div>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="confirm-new-password"
                      className="text-sm font-medium"
                    >
                      Confirm new password
                    </label>
                    <Input
                      id="confirm-new-password"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={pwBusy}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={revokeOthers}
                      onChange={(e) => setRevokeOthers(e.target.checked)}
                      disabled={pwBusy}
                      className="size-3.5 rounded border"
                    />
                    Sign out other devices
                  </label>
                  {pwError ? (
                    <p role="alert" className="text-sm text-danger-foreground">
                      {pwError}
                    </p>
                  ) : null}
                  {pwSaved ? (
                    <p
                      role="status"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400"
                    >
                      <CheckCircle2 className="size-4" aria-hidden="true" />
                      Password updated.
                    </p>
                  ) : null}
                  <Button type="submit" disabled={pwBusy}>
                    {pwBusy ? "Updating password…" : "Update password"}
                  </Button>
                </form>
              </section>
            </div>
          </ViewFadeIn>
        </main>
      </div>
    </DriveCoreMotionProvider>
  );
}

export function AccountPage() {
  return (
    <Protected>
      <AccountWorkspace />
    </Protected>
  );
}
