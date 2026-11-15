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
import { useDevelopment } from "@/mocks/development-provider";
import {
  useOrganization,
  useResolvedContext,
} from "@/lib/context/context-provider";
import { permittedNavigation } from "@/lib/navigation/definitions";
import { modulePath } from "@/lib/navigation/routes";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
export function NavigationItems({
  labelClass = "",
  onNavigate,
}: {
  labelClass?: string;
  onNavigate?: () => void;
}) {
  const context = useResolvedContext();
  const { profile } = useDevelopment();
  const { navigate } = useOrganization();
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation" className="space-y-1 px-3 py-4">
      {permittedNavigation(profile.modules).map((item) => {
        const Icon = icons[item.icon];
        const href = modulePath(context, item.key);
        const active =
          item.key === "dashboard"
            ? !pathname.includes("/modules/")
            : pathname.endsWith(`/modules/${item.key}`);
        return (
          <Tooltip key={item.key}>
            <TooltipTrigger
              render={
                <Link
                  href={href}
                  aria-label={`${item.label}${item.availability === "planned" ? " · Planned" : ""}`}
                  aria-current={active ? "page" : undefined}
                  onClick={(e) => {
                    if (
                      e.button === 0 &&
                      !e.metaKey &&
                      !e.ctrlKey &&
                      !e.shiftKey &&
                      !e.altKey
                    ) {
                      e.preventDefault();
                      onNavigate?.();
                      navigate(href);
                    }
                  }}
                  className={cn(
                    "relative flex h-11 items-center gap-3 rounded-control px-3 text-sm text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                    active &&
                      "[&_.text-muted-foreground]:text-sidebar-accent-foreground bg-sidebar-accent font-medium text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground before:absolute before:inset-y-3 before:left-0 before:w-0.5 before:rounded-full before:bg-primary",
                  )}
                />
              }
            >
              <Icon className="size-[18px] shrink-0" aria-hidden="true" />
              <span
                className={cn(
                  "flex min-w-0 flex-1 items-center justify-between gap-2",
                  labelClass,
                )}
              >
                <span>{item.label}</span>
                {item.availability === "planned" && (
                  <span className="text-[11px] font-normal text-muted-foreground">
                    Planned
                  </span>
                )}
              </span>
            </TooltipTrigger>
            <TooltipContent side="right">
              {item.label}
              {item.availability === "planned" ? " · Planned" : ""}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}
