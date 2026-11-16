"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Building2, ChevronDown, LogOut, ShieldCheck } from "lucide-react";
import { useSession } from "@/features/auth/session-provider";
import { ApiError, errorText, initializeCsrf } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** Shared charcoal account dropdown menu and explicit logout failure banner for Live Mode. */
export function useLiveLogout() {
  const session = useSession();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const lock = useRef(false);

  const logout = async () => {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError(null);
    try {
      await session.logout();
    } catch (failure) {
      setError(failure);
    } finally {
      lock.current = false;
      setPending(false);
    }
  };

  const renewCsrf = async () => {
    try {
      await initializeCsrf();
      setError(new Error("CSRF protection renewed. Try signing out again."));
    } catch (failure) {
      setError(failure);
    }
  };

  return { pending, error, logout, renewCsrf };
}

export function LiveLogoutAlert({
  error,
  pending,
  onRetry,
  onRenewCsrf,
  className,
}: {
  error: unknown;
  pending: boolean;
  onRetry: () => void;
  onRenewCsrf: () => Promise<void>;
  className?: string;
}) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className={cn("mx-auto mt-3 w-full max-w-[1600px] px-3 sm:px-page", className)}
    >
      <div className="dc-shadow-card space-y-3 rounded-2xl border bg-surface p-card text-sm">
        <p className="text-danger-foreground">{errorText(error)}</p>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" disabled={pending} onClick={onRetry}>
            Try signing out again
          </Button>
          {error instanceof ApiError && error.status === 419 ? (
            <Button
              variant="outline"
              onClick={() => {
                void onRenewCsrf();
              }}
            >
              Renew CSRF protection
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function LiveAccountMenu({
  pending,
  onLogout,
  showWorkspacesLink = false,
  className,
}: {
  pending: boolean;
  onLogout: () => void;
  showWorkspacesLink?: boolean;
  className?: string;
}) {
  const { user } = useSession();
  const name = user?.name ?? "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = (
    parts.length > 1
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`
      : (parts[0]?.slice(0, 2) ?? "")
  ).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            aria-label="Account menu"
            disabled={pending}
            className={cn(
              "h-9 min-w-0 max-w-full shrink gap-2 rounded-xl bg-structural px-2.5 text-structural-foreground shadow-sm hover:bg-structural/90 hover:text-structural-foreground",
              className,
            )}
          />
        }
      >
        <span
          aria-hidden="true"
          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface/15 font-mono text-[11px] font-bold text-structural-foreground"
        >
          {initials}
        </span>
        <span className="min-w-0 truncate text-xs font-semibold sm:text-sm">
          {pending ? "Signing out…" : name}
        </span>
        <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 opacity-80" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-2xl p-1.5">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Signed in as
          </DropdownMenuLabel>
          <div className="space-y-1 px-2 py-1.5">
            <p className="break-words text-sm font-semibold text-foreground">{name}</p>
            {user?.is_platform_admin ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-structural px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-structural-foreground">
                <ShieldCheck aria-hidden="true" className="size-3" />
                Platform Admin
              </span>
            ) : null}
          </div>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {showWorkspacesLink ? (
          <DropdownMenuItem
            className="min-h-control rounded-xl"
            render={<Link href="/companies" />}
          >
            <Building2 aria-hidden="true" />
            All workspaces
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          variant="destructive"
          disabled={pending}
          onClick={onLogout}
          className="min-h-control rounded-xl"
        >
          <LogOut aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
