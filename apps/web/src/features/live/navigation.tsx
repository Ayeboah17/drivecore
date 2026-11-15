"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
import { can } from "@/lib/api/contracts";
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
  collapsed = false,
  close,
}: {
  collapsed?: boolean;
  close?: () => void;
}) {
  const { user } = useSession();
  const scope = useLiveContext();
  const path = usePathname();
  return (
    <nav aria-label="Main navigation" className="space-y-1 p-3">
      {navigation.map((item) => {
        const Icon = icons[item.icon];
        const permission =
          item.key === "fleet"
            ? "vehicles.view"
            : item.key === "customers"
              ? "customers.view"
              : null;
        const restricted = permission !== null && !can(user!, permission);
        const planned =
          item.key !== "dashboard" &&
          item.key !== "fleet" &&
          item.key !== "customers";
        const target =
          item.key === "dashboard"
            ? "dashboard"
            : item.key === "fleet"
              ? "vehicles"
              : item.key === "customers"
                ? "customers"
                : `modules/${item.key}`;
        const title = `${item.label}${restricted ? " · Restricted" : planned ? " · Planned" : ""}`;
        const content = (
          <>
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            <span className={collapsed ? "sr-only" : "min-w-0 flex-1"}>
              {item.label}
            </span>
            {!collapsed && (restricted || planned) ? (
              <span className="rounded-sm border px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground">
                {restricted ? "Restricted" : "Planned"}
              </span>
            ) : null}
          </>
        );
        const classes =
          "flex min-h-control items-center gap-3 rounded-control px-3 text-sm";
        return restricted ? (
          <div
            key={item.key}
            aria-disabled="true"
            aria-label={title}
            title={title}
            className={`${classes} text-muted-foreground`}
          >
            {content}
          </div>
        ) : (
          <Link
            key={item.key}
            href={`/companies/${scope.companyId}/${target}?branch=${scope.branch}`}
            onClick={close}
            aria-label={title}
            title={collapsed ? title : undefined}
            aria-current={path.endsWith(`/${target}`) ? "page" : undefined}
            className={`${classes} text-sidebar-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground`}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
