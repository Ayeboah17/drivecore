"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, KeyRound, Mail, ShieldAlert } from "lucide-react";
import { useSession } from "@/features/auth/session-provider";
import {
  acceptInvitation,
  previewInvitation,
  requestPasswordReset,
  resetPassword,
} from "@/features/auth/service";
import { PasswordStrengthHint } from "@/features/auth/password-strength";
import { ApiError, errorText } from "@/lib/api/client";
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

function PublicAuthFrame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <DriveCoreMotionProvider>
      <main className="relative flex min-h-dvh items-center justify-center bg-background p-page">
        <div className="fixed top-4 right-4 z-20">
          <ThemeToggle />
        </div>
        <ViewFadeIn className="w-full max-w-md">
          <section className="dc-shadow-float w-full space-y-6 rounded-3xl border bg-surface p-7">
            <div>
              <div className="mb-6">
                <DriveCoreLogo
                  badge="LIVE"
                  subtitle="Fleet Rental · Maintenance · Finance"
                />
              </div>
              <h1 className="text-page-title font-extrabold tracking-tight">
                {title}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
            </div>
            {children}
          </section>
        </ViewFadeIn>
      </main>
    </DriveCoreMotionProvider>
  );
}

export function AcceptInviteForm() {
  const session = useSession();
  const router = useRouter();
  const search = useSearchParams();
  const token = (search.get("token") ?? "").trim();

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = useQuery({
    queryKey: ["invitation-preview", token],
    queryFn: ({ signal }) => previewInvitation(token, signal),
    enabled: token.length >= 16,
    retry: false,
  });

  if (!token || token.length < 16) {
    return (
      <PublicAuthFrame
        title="Invitation unavailable"
        subtitle="The invitation link is missing or incomplete."
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Ask your Company Admin to send a fresh invitation email.
          </p>
          <Link
            href="/login"
            className="inline-block text-sm font-medium text-link hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </PublicAuthFrame>
    );
  }

  if (preview.isPending) {
    return (
      <PublicAuthFrame
        title="Checking invitation…"
        subtitle="Verifying your invitation link."
      >
        <p role="status" className="text-sm text-muted-foreground">
          Loading invitation details…
        </p>
      </PublicAuthFrame>
    );
  }

  if (preview.error || !preview.data) {
    const isGone =
      preview.error instanceof ApiError &&
      (preview.error.status === 410 || preview.error.status === 422);
    return (
      <PublicAuthFrame
        title="Invitation expired or invalid"
        subtitle="This invitation can no longer be accepted."
      >
        <div role="alert" className="space-y-4 text-sm">
          <div className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger-surface p-3.5 text-danger-foreground">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>
              {isGone
                ? "This invitation has expired, was revoked, or has already been used. Ask your Company Admin to resend a new invitation."
                : errorText(preview.error)}
            </p>
          </div>
          <Link
            href="/login"
            className="inline-block font-medium text-link hover:underline"
          >
            Go to sign in
          </Link>
        </div>
      </PublicAuthFrame>
    );
  }

  const info = preview.data;
  const roleLabel =
    managedRoleLabels[info.role as ManagedRoleName] ?? info.role;
  const signedInDifferentUser =
    !!session.user &&
    session.user.email.toLowerCase() !== info.email.toLowerCase();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!info.account_exists) {
      if (!name.trim()) {
        setError("Enter your full name.");
        return;
      }
      if (!checkPasswordStrength(password).valid) {
        setError(
          "Password must be at least 10 characters and include a letter and a number.",
        );
        return;
      }
      if (password !== confirm) {
        setError("Password confirmation does not match.");
        return;
      }
    } else if (!password) {
      setError("Enter your existing DriveCore password to confirm joining.");
      return;
    }

    setBusy(true);
    try {
      const result = await acceptInvitation(
        info.account_exists
          ? { token, password }
          : {
              token,
              name: name.trim(),
              password,
              password_confirmation: confirm,
            },
      );
      await session.adoptUser(result.user, true);
      router.replace(`/companies/${result.companyId}/dashboard?branch=all`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 410) {
        setError(
          "This invitation has expired or was already used. Ask your Company Admin for a new one.",
        );
      } else {
        setError(errorText(err));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicAuthFrame
      title={
        info.account_exists
          ? `Join ${info.company_name}`
          : `Accept invitation to ${info.company_name}`
      }
      subtitle={
        info.account_exists
          ? "Confirm your existing DriveCore password to add this company to your account."
          : "Set your name and password to activate your DriveCore account."
      }
    >
      <div className="space-y-1 rounded-2xl border bg-muted/30 p-3.5 text-xs">
        <p>
          <span className="text-muted-foreground">Invited email:</span>{" "}
          <span className="font-mono font-semibold">{info.email}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Role:</span>{" "}
          <span className="font-semibold">{roleLabel}</span>
          {info.branch_name ? ` · ${info.branch_name}` : " · All branches"}
        </p>
      </div>

      {signedInDifferentUser ? (
        <div role="alert" className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-sm">
          <p>
            You are currently signed in as{" "}
            <strong className="font-mono">{session.user?.email}</strong>, but
            this invitation is for{" "}
            <strong className="font-mono">{info.email}</strong>. Sign out first
            to accept.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void session.logout()}
          >
            Sign out to continue
          </Button>
        </div>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {!info.account_exists ? (
            <div className="space-y-1.5">
              <label htmlFor="invite-name" className="text-sm font-medium">
                Full name
              </label>
              <Input
                id="invite-name"
                autoComplete="name"
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label htmlFor="invite-password" className="text-sm font-medium">
              {info.account_exists ? "Existing DriveCore password" : "Password"}
            </label>
            <Input
              id="invite-password"
              type="password"
              autoComplete={
                info.account_exists ? "current-password" : "new-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
            {!info.account_exists ? (
              <PasswordStrengthHint password={password} />
            ) : null}
          </div>

          {!info.account_exists ? (
            <div className="space-y-1.5">
              <label htmlFor="invite-confirm" className="text-sm font-medium">
                Confirm password
              </label>
              <Input
                id="invite-confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={busy}
              />
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="text-sm text-danger-foreground">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy
              ? "Activating account…"
              : info.account_exists
                ? `Join ${info.company_name}`
                : "Create account & sign in"}
          </Button>
        </form>
      )}
    </PublicAuthFrame>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      const msg = await requestPasswordReset(email.trim());
      setDoneMessage(msg);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicAuthFrame
      title="Reset your password"
      subtitle="Enter your work email and we will send a password reset link if an account exists."
    >
      {doneMessage ? (
        <div role="status" className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-sm text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>{doneMessage}</p>
          </div>
          <Link
            href="/login"
            className="inline-block text-sm font-medium text-link hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="forgot-email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="forgot-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-danger-foreground">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full gap-2" disabled={busy}>
            <Mail className="size-4" aria-hidden="true" />
            {busy ? "Sending reset link…" : "Send reset link"}
          </Button>
          <Link
            href="/login"
            className="block text-sm font-medium text-link hover:underline"
          >
            Back to sign in
          </Link>
        </form>
      )}
    </PublicAuthFrame>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const search = useSearchParams();
  const token = (search.get("token") ?? "").trim();
  const initialEmail = (search.get("email") ?? "").trim();

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <PublicAuthFrame
        title="Reset link invalid"
        subtitle="The password reset token is missing."
      >
        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            Request a new password reset link to continue.
          </p>
          <Link
            href="/forgot-password"
            className="inline-block font-medium text-link hover:underline"
          >
            Request new reset link
          </Link>
        </div>
      </PublicAuthFrame>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !email.includes("@")) {
      setError("Enter your account email address.");
      return;
    }
    if (!checkPasswordStrength(password).valid) {
      setError(
        "Password must be at least 10 characters and include a letter and a number.",
      );
      return;
    }
    if (password !== confirm) {
      setError("Password confirmation does not match.");
      return;
    }
    setBusy(true);
    try {
      await resetPassword({
        token,
        email: email.trim(),
        password,
        password_confirmation: confirm,
      });
      router.replace("/login?reset=1");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicAuthFrame
      title="Choose a new password"
      subtitle="Setting a new password signs out all existing sessions."
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="reset-email" className="text-sm font-medium">
            Email
          </label>
          <Input
            id="reset-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="reset-password" className="text-sm font-medium">
            New password
          </label>
          <Input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
          />
          <PasswordStrengthHint password={password} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="reset-confirm" className="text-sm font-medium">
            Confirm new password
          </label>
          <Input
            id="reset-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={busy}
          />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-danger-foreground">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full gap-2" disabled={busy}>
          <KeyRound className="size-4" aria-hidden="true" />
          {busy ? "Resetting password…" : "Reset password"}
        </Button>
      </form>
    </PublicAuthFrame>
  );
}
