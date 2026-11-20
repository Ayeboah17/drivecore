"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import {
  LayoutDashboard,
  ClipboardList,
  CarFront,
  UsersRound,
  CalendarRange,
  Wrench,
  Package,
  Landmark,
  ShoppingCart,
  ChartNoAxesCombined,
  Settings2,
} from "lucide-react";
import { navigation } from "@/lib/navigation/definitions";
import {
  can,
  canAccessFinance,
  canAccessOperations,
  canAccessRentals,
  canAccessUserAdmin,
} from "@/lib/api/contracts";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "./context";

const icons = {
  dashboard: LayoutDashboard,
  operations: ClipboardList,
  fleet: CarFront,
  customers: UsersRound,
  rentals: CalendarRange,
  maintenance: Wrench,
  inventory: Package,
  finance: Landmark,
  procurement: ShoppingCart,
  reports: ChartNoAxesCombined,
  administration: Settings2,
};

export function LiveNavigation({
  variant = "horizontal",
  close,
}: {
  variant?: "horizontal" | "vertical";
  close?: () => void;
}) {
  const { user } = useSession();
  const scope = useLiveContext();
  const path = usePathname();
  const horizontal = variant === "horizontal";

  return (
    <nav
      aria-label="Main navigation"
      className={
        horizontal ? "flex flex-wrap items-center gap-1" : "space-y-1 p-3"
      }
    >
      {navigation.map((item) => {
        const Icon = icons[item.icon];
        const permission =
          item.key === "fleet"
            ? "vehicles.view"
            : item.key === "customers"
              ? "customers.view"
              : null;
        const restricted =
          item.key === "administration"
            ? !canAccessUserAdmin(user!, scope.companyId)
            : item.key === "operations"
              ? !canAccessOperations(user!)
              : item.key === "rentals"
                ? !canAccessRentals(user!)
                : item.key === "finance"
                  ? !canAccessFinance(user!)
                  : permission !== null && !can(user!, permission);
        const planned =
          item.key !== "dashboard" &&
          item.key !== "operations" &&
          item.key !== "fleet" &&
          item.key !== "customers" &&
          item.key !== "rentals" &&
          item.key !== "finance" &&
          item.key !== "administration";
        const target =
          item.key === "dashboard"
            ? "dashboard"
            : item.key === "operations"
              ? "operations"
              : item.key === "fleet"
                ? "vehicles"
                : item.key === "customers"
                  ? "customers"
                  : item.key === "rentals"
                    ? "rentals"
                    : item.key === "finance"
                      ? "finance"
                      : item.key === "administration"
                        ? "users"
                        : `modules/${item.key}`;
        const basePath = `/companies/${scope.companyId}/${target}`;
        const active =
          !restricted &&
          (path === basePath ||
            path.startsWith(`${basePath}/`) ||
            (item.key === "rentals" &&
              (path.startsWith(`/companies/${scope.companyId}/reservations/`) ||
                path === `/companies/${scope.companyId}/quotations` ||
                path.startsWith(`/companies/${scope.companyId}/quotations/`))));
        const title = `${item.label}${restricted ? " · Restricted" : planned ? " · Planned" : ""}`;

        const badge =
          restricted || planned ? (
            <span className="relative z-10 rounded-md border bg-muted/60 px-1.5 py-0.5 font-mono text-[9px] leading-none font-semibold uppercase tracking-wide text-muted-foreground">
              {restricted ? "Restricted" : "Planned"}
            </span>
          ) : null;

        const inner = (
          <>
            {horizontal && active ? (
              <motion.span
                layoutId="live-erp-nav-pill"
                transition={{ type: "spring", stiffness: 380, damping: 34 }}
                className="dc-shadow-card absolute inset-0 rounded-xl border bg-surface"
              />
            ) : null}
            <Icon
              aria-hidden="true"
              className={`relative z-10 shrink-0 ${horizontal ? "size-3.5" : "size-4"}`}
            />
            <span
              className={`relative z-10 ${horizontal ? "whitespace-nowrap" : "min-w-0 flex-1"}`}
            >
              {item.label}
            </span>
            {badge}
          </>
        );

        const baseClasses = horizontal
          ? "relative flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-ring"
          : "flex min-h-control items-center gap-3 rounded-xl px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring";

        if (restricted) {
          return (
            <div
              key={item.key}
              aria-disabled="true"
              aria-label={title}
              title={title}
              className={`${baseClasses} cursor-not-allowed text-muted-foreground`}
            >
              {inner}
            </div>
          );
        }

        return (
          <Link
            key={item.key}
            href={`${basePath}?branch=${scope.branch}`}
            onClick={close}
            aria-label={title}
            aria-current={active ? "page" : undefined}
            className={`${baseClasses} ${
              active
                ? horizontal
                  ? "font-semibold text-foreground"
                  : "bg-accent font-semibold text-accent-foreground"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            }`}
          >
            {inner}
          </Link>
        );
      })}
    </nav>
  );
}
