"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { useSession } from "@/features/auth/session-provider";
import { ApiError, errorText, initializeCsrf } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export function WorkspaceHeader() {
  const session = useSession();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const lock = useRef(false);
  const name = session.user?.name ?? "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = (
    parts.length > 1
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`
      : (parts[0]?.slice(0, 2) ?? "")
  ).toUpperCase();
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
  return (
    <>
      <a
        href="#workspace-content"
        className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:rounded-control focus:bg-surface focus:p-3 focus:outline-2 focus:outline-ring"
      >
        Skip to workspaces
      </a>
      <header className="border-b bg-surface">
        <div className="mx-auto flex h-topbar max-w-6xl items-center justify-between gap-4 px-page">
          <Link
            href="/companies"
            className="rounded-sm text-xl font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-ring"
            aria-label="DriveCore home"
          >
            <span className="text-primary">D</span>riveCore
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  className="max-w-[65%] gap-2 px-2"
                  aria-label="Account menu"
                  disabled={pending}
                />
              }
            >
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-muted text-xs font-semibold text-foreground"
              >
                {initials}
              </span>
              <span className="truncate text-sm font-medium">
                {pending ? "Signing out…" : name}
              </span>
              <ChevronDown
                aria-hidden="true"
                className="size-3.5 shrink-0 text-muted-foreground"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Signed in as</DropdownMenuLabel>
                <p className="break-words px-1.5 py-2 text-sm font-medium">
                  {name}
                </p>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={pending}
                onClick={() => {
                  void logout();
                }}
                className="min-h-control"
              >
                <LogOut aria-hidden="true" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      {error ? (
        <div role="alert" className="mx-auto mt-6 w-full max-w-6xl px-page">
          <div className="space-y-3 rounded-card border bg-surface p-card text-sm">
            <p className="text-danger-foreground">{errorText(error)}</p>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => {
                  void logout();
                }}
              >
                Try signing out again
              </Button>
              {error instanceof ApiError && error.status === 419 ? (
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await initializeCsrf();
                      setError(
                        new Error(
                          "CSRF protection renewed. Try signing out again.",
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
          </div>
        </div>
      ) : null}
    </>
  );
}
