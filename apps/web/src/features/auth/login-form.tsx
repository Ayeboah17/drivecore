"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSession } from "./session-provider";
import { safeLoginReturn } from "@/lib/api/contracts";
import { ApiError, errorText, initializeCsrf } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DriveCoreLogo } from "@/components/brand/drivecore-mark";
import { DriveCoreMotionProvider, ViewFadeIn } from "@/components/motion/primitives";
import { ThemeToggle } from "@/components/theme/theme-toggle";
const schema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});
export function LoginForm() {
  const session = useSession();
  const router = useRouter();
  const search = useSearchParams();
  const [error, setError] = useState<unknown>(null);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [verifying2fa, setVerifying2fa] = useState(false);
  const {
    register,
    handleSubmit,
    resetField,
    setError: fieldError,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const target = safeLoginReturn(search.get("next"));
  const wasReset = search.get("reset") === "1";
  useEffect(() => {
    if (!session.pending && !session.error && session.user) {
      router.replace(
        session.user.must_change_password
          ? "/account?force_password_change=1"
          : session.user.two_factor_enrollment_required
            ? "/account?setup_2fa=1"
            : target,
      );
    }
  }, [session.pending, session.error, session.user, router, target]);
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
                Sign in
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Access your company workspace.
              </p>
            </div>
        {session.pending ? (
          <p role="status">Checking your session…</p>
        ) : session.error ? (
          <div role="alert">
            <p>{errorText(session.error)}</p>
            <Button variant="outline" onClick={session.refresh}>
              Check connection again
            </Button>
          </div>
        ) : session.user ? (
          <p role="status">Opening workspace…</p>
        ) : challengeToken ? (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              const trimmed = twoFactorCode.trim();
              if (!trimmed) {
                setError(
                  new Error(
                    useRecovery
                      ? "Enter a recovery code."
                      : "Enter your 6-digit authenticator code.",
                  ),
                );
                return;
              }
              setVerifying2fa(true);
              try {
                await session.verifyTwoFactor({
                  challengeToken,
                  ...(useRecovery
                    ? { recoveryCode: trimmed }
                    : { code: trimmed }),
                });
              } catch (failure) {
                setError(failure);
              } finally {
                setVerifying2fa(false);
              }
            }}
          >
            <div className="space-y-1">
              <h2 className="text-base font-bold tracking-tight">
                Two-factor verification
              </h2>
              <p className="text-xs text-muted-foreground">
                {useRecovery
                  ? "Enter one of your single-use recovery codes."
                  : "Enter the 6-digit code from your authenticator app."}
              </p>
            </div>
            <div className="space-y-2">
              <label htmlFor="two-factor-code">
                {useRecovery ? "Recovery code" : "Verification code"}
              </label>
              <Input
                id="two-factor-code"
                inputMode={useRecovery ? "text" : "numeric"}
                autoComplete="one-time-code"
                placeholder={useRecovery ? "XXXX-XXXX" : "123456"}
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                disabled={verifying2fa}
              />
            </div>
            {error ? (
              <div role="alert" className="text-sm text-danger-foreground">
                <p>{errorText(error)}</p>
              </div>
            ) : null}
            <Button type="submit" className="w-full" disabled={verifying2fa}>
              {verifying2fa ? "Verifying…" : "Verify & sign in"}
            </Button>
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                className="font-medium text-link hover:underline"
                onClick={() => {
                  setUseRecovery((v) => !v);
                  setTwoFactorCode("");
                  setError(null);
                }}
              >
                {useRecovery
                  ? "Use authenticator code instead"
                  : "Use a recovery code"}
              </button>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setChallengeToken(null);
                  setTwoFactorCode("");
                  setError(null);
                }}
              >
                Back to sign in
              </button>
            </div>
          </form>
        ) : (
          <form
            className="space-y-4"
            onSubmit={handleSubmit(async (values) => {
              setError(null);
              try {
                const res = await session.login(values.email, values.password);
                resetField("password");
                if (res.status === "two_factor_required") {
                  setChallengeToken(res.challengeToken);
                  setTwoFactorCode("");
                  setUseRecovery(false);
                }
              } catch (failure) {
                resetField("password");
                setError(failure);
                if (failure instanceof ApiError)
                  for (const key of ["email", "password"] as const)
                    if (failure.fields[key])
                      fieldError(key, { message: failure.fields[key][0] });
              }
            })}
          >
            <div className="space-y-2">
              <label htmlFor="email">Email</label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                {...register("email")}
                aria-invalid={!!errors.email}
                aria-describedby="email-error"
              />
              <p id="email-error" className="text-sm text-danger-foreground">
                {errors.email?.message}
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="password">Password</label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-link hover:text-link-hover hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register("password")}
                aria-invalid={!!errors.password}
                aria-describedby="password-error"
              />
              <p id="password-error" className="text-sm text-danger-foreground">
                {errors.password?.message}
              </p>
            </div>
            {wasReset && !error ? (
              <div
                role="status"
                className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-300"
              >
                Your password has been reset. Sign in with your new password.
              </div>
            ) : null}
            {session.notice && !error ? (
              <div
                role="alert"
                className="rounded-xl border border-danger/30 bg-danger-surface p-3 text-sm text-danger-foreground"
              >
                <p>{session.notice}</p>
              </div>
            ) : null}
            {error ? (
              <div role="alert" className="text-sm text-danger-foreground">
                <p>{errorText(error)}</p>
                {error instanceof ApiError && error.retryAfter ? (
                  <p>Retry after {error.retryAfter}.</p>
                ) : null}
                {error instanceof ApiError && error.status === 419 ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await initializeCsrf();
                        setError(
                          new Error(
                            "CSRF protection renewed. Submit again when ready.",
                          ),
                        );
                      } catch (failure) {
                        setError(failure);
                      }
                    }}
                  >
                    Renew CSRF protection
                  </Button>
                ) : null}
              </div>
            ) : null}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        )}
        <Link
          href="/demo/erp"
          prefetch={false}
          className="block text-sm font-medium text-link hover:text-link-hover hover:underline"
        >
          Explore the full ERP demo
        </Link>
          </section>
        </ViewFadeIn>
      </main>
    </DriveCoreMotionProvider>
  );
}
