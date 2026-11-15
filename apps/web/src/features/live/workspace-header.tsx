"use client";

import Link from "next/link";
import { DriveCoreLogo } from "@/components/brand/drivecore-mark";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import {
  LiveAccountMenu,
  LiveLogoutAlert,
  useLiveLogout,
} from "./account-menu";

export function WorkspaceHeader() {
  const { pending, error, logout, renewCsrf } = useLiveLogout();

  return (
    <>
      <a
        href="#workspace-content"
        className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:rounded-control focus:bg-surface focus:p-3 focus:outline-2 focus:outline-ring"
      >
        Skip to workspaces
      </a>
      <header className="sticky top-0 z-30 px-2.5 pt-2.5 pb-1.5 sm:px-3">
        <div className="dc-glass-panel dc-shadow-float mx-auto flex max-w-[1600px] items-center justify-between gap-2 rounded-2xl border px-3 py-2 sm:gap-4 sm:px-3.5">
          <Link
            href="/companies"
            className="shrink-0 rounded-xl focus-visible:outline-2 focus-visible:outline-ring"
            aria-label="DriveCore home"
          >
            <DriveCoreLogo
              badge="LIVE"
              subtitle="Fleet · Maintenance · Finance"
            />
          </Link>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
            <ThemeToggle />
            <LiveAccountMenu
              pending={pending}
              onLogout={() => {
                void logout();
              }}
            />
          </div>
        </div>
      </header>
      <LiveLogoutAlert
        error={error}
        pending={pending}
        onRetry={() => {
          void logout();
        }}
        onRenewCsrf={renewCsrf}
      />
    </>
  );
}
