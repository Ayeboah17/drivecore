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
  const {
    register,
    handleSubmit,
    resetField,
    setError: fieldError,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const target = safeLoginReturn(search.get("next"));
  useEffect(() => {
    if (!session.pending && !session.error && session.user)
      router.replace(target);
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
        ) : (
          <form
            className="space-y-4"
            onSubmit={handleSubmit(async (values) => {
              setError(null);
              try {
                await session.login(values.email, values.password);
                resetField("password");
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
              <label htmlFor="password">Password</label>
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
