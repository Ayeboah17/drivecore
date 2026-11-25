"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  ChevronDown,
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
  canAccessInventory,
  canAccessMaintenance,
  canAccessOperations,
  canAccessProcurement,
  canAccessRentals,
  canAccessReports,
  canAccessUserAdmin,
  canManageCompanySettings,
  type User,
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

interface NavSubItem {
  label: string;
  href: string;
  description?: string;
}

function getSubItems(
  key: (typeof navigation)[number]["key"],
  user: User,
  companyId: string,
  branch: string,
): NavSubItem[] {
  const b = `branch=${encodeURIComponent(branch)}`;
  const base = `/companies/${companyId}`;

  switch (key) {
    case "operations": {
      const items: NavSubItem[] = [
        { label: "Operations Hub", href: `${base}/operations?${b}` },
      ];
      if (can(user, "documents.view")) {
        items.push({
          label: "Compliance & Expiries",
          href: `${base}/operations?tab=compliance&${b}`,
        });
      }
      if (can(user, "vehicles.view")) {
        items.push({
          label: "Incidents & Claims",
          href: `${base}/operations?tab=incidents&${b}`,
        });
      }
      items.push({
        label: "Approvals Queue",
        href: `${base}/operations?tab=approvals&${b}`,
      });
      return items;
    }
    case "fleet": {
      const items: NavSubItem[] = [
        { label: "Vehicle Register", href: `${base}/vehicles?${b}` },
      ];
      if (can(user, "work_orders.view")) {
        items.push({
          label: "Preventive Schedules",
          href: `${base}/maintenance?${b}`,
        });
      }
      if (can(user, "parts.view")) {
        items.push({
          label: "Spare Parts & Components",
          href: `${base}/inventory?${b}`,
        });
      }
      return items;
    }
    case "customers": {
      const items: NavSubItem[] = [
        { label: "Customer Directory", href: `${base}/customers?${b}` },
      ];
      if (can(user, "leads.view")) {
        items.push({
          label: "CRM Leads & Pipeline",
          href: `${base}/operations?tab=leads&${b}`,
        });
      }
      return items;
    }
    case "rentals": {
      const items: NavSubItem[] = [
        { label: "Reservations & Rentals", href: `${base}/rentals?${b}` },
      ];
      if (can(user, "quotations.view")) {
        items.push({
          label: "Quotations",
          href: `${base}/quotations?${b}`,
        });
      }
      if (can(user, "rentals.view") || can(user, "quotations.view")) {
        items.push({
          label: "Rate Cards",
          href: `${base}/operations?tab=rate-cards&${b}`,
        });
      }
      return items;
    }
    case "finance": {
      const items: NavSubItem[] = [
        { label: "Invoices & AR", href: `${base}/finance?tab=invoices&${b}` },
        {
          label: "Payments & Refunds",
          href: `${base}/finance?tab=payments&${b}`,
        },
        {
          label: "Credit Control",
          href: `${base}/finance?tab=credit&${b}`,
        },
        {
          label: "Accounts Payable",
          href: `${base}/finance?tab=ap&${b}`,
        },
        {
          label: "Bank Reconciliation",
          href: `${base}/finance?tab=banking&${b}`,
        },
        {
          label: "Fixed Assets",
          href: `${base}/finance?tab=assets&${b}`,
        },
      ];
      if (can(user, "gl.view")) {
        items.push({
          label: "General Ledger & Statements",
          href: `${base}/finance?tab=gl&${b}`,
        });
      }
      return items;
    }
    case "procurement": {
      const items: NavSubItem[] = [
        { label: "Purchase Orders", href: `${base}/procurement?${b}` },
      ];
      if (can(user, "suppliers.view")) {
        items.push({
          label: "Suppliers & Requisitions",
          href: `${base}/procurement?tab=suppliers&${b}`,
        });
      }
      return items;
    }
    case "reports": {
      const items: NavSubItem[] = [];
      if (can(user, "invoices.view")) {
        items.push({
          label: "Financial Reports",
          href: `${base}/reports?tab=financial&${b}`,
        });
      }
      if (can(user, "vehicles.view")) {
        items.push({
          label: "Fleet Utilization",
          href: `${base}/reports?tab=fleet&${b}`,
        });
      }
      if (can(user, "audit.view")) {
        items.push({
          label: "Audit Trail",
          href: `${base}/reports?tab=audit&${b}`,
        });
      }
      return items;
    }
    case "administration": {
      const items: NavSubItem[] = [
        { label: "Users & Roles", href: `${base}/users?${b}` },
        { label: "Invitations", href: `${base}/users?tab=invitations&${b}` },
      ];
      if (canManageCompanySettings(user, companyId)) {
        items.push({
          label: "Company Settings & Email",
          href: `${base}/users?tab=settings&${b}`,
        });
      }
      if (can(user, "branches.manage")) {
        items.push({
          label: "Branch Setup",
          href: `${base}/setup?${b}`,
        });
      }
      return items;
    }
    default:
      return [];
  }
}

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
  const [openKey, setOpenKey] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  if (!user) return null;

  function scheduleClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenKey(null), 140);
  }

  function openDropdown(key: string) {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenKey(key);
  }

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
            ? !canAccessUserAdmin(user, scope.companyId)
            : item.key === "operations"
              ? !canAccessOperations(user)
              : item.key === "rentals"
                ? !canAccessRentals(user)
                : item.key === "finance"
                  ? !canAccessFinance(user)
                  : item.key === "maintenance"
                    ? !canAccessMaintenance(user)
                    : item.key === "inventory"
                      ? !canAccessInventory(user)
                      : item.key === "procurement"
                        ? !canAccessProcurement(user)
                        : item.key === "reports"
                          ? !canAccessReports(user)
                          : permission !== null && !can(user, permission);

        // Hide tabs/nav items the user does not have access to (no "Restricted" badge)
        if (restricted) {
          return null;
        }

        const target =
          item.key === "fleet"
            ? "vehicles"
            : item.key === "administration"
              ? "users"
              : item.key;
        const basePath = `/companies/${scope.companyId}/${target}`;
        const active =
          path === basePath ||
          path.startsWith(`${basePath}/`) ||
          (item.key === "rentals" &&
            (path.startsWith(`/companies/${scope.companyId}/reservations/`) ||
              path === `/companies/${scope.companyId}/quotations` ||
              path.startsWith(`/companies/${scope.companyId}/quotations/`)));

        const subItems = getSubItems(item.key, user, scope.companyId, scope.branch);
        const hasDropdown = horizontal && subItems.length > 1;
        const isDropdownOpen = hasDropdown && openKey === item.key;

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
            {hasDropdown ? (
              <ChevronDown
                aria-hidden="true"
                className={`relative z-10 size-3 text-muted-foreground transition-transform duration-150 ${
                  isDropdownOpen ? "rotate-180 text-foreground" : ""
                }`}
              />
            ) : null}
          </>
        );

        const baseClasses = horizontal
          ? "relative flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-ring"
          : "flex min-h-control items-center gap-3 rounded-xl px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring";

        if (hasDropdown) {
          return (
            <div
              key={item.key}
              className="relative"
              onMouseEnter={() => openDropdown(item.key)}
              onMouseLeave={scheduleClose}
              onFocus={() => openDropdown(item.key)}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  setOpenKey(null);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpenKey(null);
              }}
            >
              <Link
                href={`${basePath}?branch=${scope.branch}`}
                onClick={() => {
                  setOpenKey(null);
                  close?.();
                }}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                aria-haspopup="menu"
                aria-expanded={isDropdownOpen}
                className={`${baseClasses} ${
                  active
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                {inner}
              </Link>

              {isDropdownOpen ? (
                <div
                  role="menu"
                  aria-label={`${item.label} quick links`}
                  className="dc-shadow-card absolute top-full left-0 z-50 mt-1.5 min-w-52 rounded-2xl border bg-surface/98 p-1.5 backdrop-blur-md"
                >
                  {subItems.map((sub) => (
                    <Link
                      key={sub.href}
                      role="menuitem"
                      href={sub.href}
                      onClick={() => {
                        setOpenKey(null);
                        close?.();
                      }}
                      className="flex items-center rounded-xl px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted/80 focus-visible:bg-muted/80 focus-visible:outline-none"
                    >
                      {sub.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          );
        }

        return (
          <Link
            key={item.key}
            href={`${basePath}?branch=${scope.branch}`}
            onClick={close}
            aria-label={item.label}
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
