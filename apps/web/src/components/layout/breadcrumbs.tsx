"use client";
import { useDevelopment } from "@/mocks/development-provider";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useResolvedContext } from "@/lib/context/context-provider";
import { dashboardPath } from "@/lib/context/url";
import { findModule } from "@/lib/navigation/definitions";
export function Breadcrumbs() {
  const context = useResolvedContext();
  const { profile } = useDevelopment();
  const pathname = usePathname();
  const moduleKey = pathname.match(/\/modules\/([^/]+)/)?.[1];
  const current = moduleKey
    ? profile.modules.includes(moduleKey)
      ? (findModule(moduleKey)?.label ?? "Unavailable")
      : "Unavailable"
    : pathname.includes("/departures/")
      ? "Departure details"
      : pathname.includes("/blockers/")
        ? "Blocker details"
        : null;
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 flex-wrap items-center gap-2 px-page pt-5 text-label text-muted-foreground"
    >
      <span>{context.company.name}</span>
      <ChevronRight className="size-3" aria-hidden="true" />
      {current ? (
        <>
          <Link
            className="hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            href={dashboardPath(context.company.id, context.branch)}
          >
            Dashboard
          </Link>
          <ChevronRight className="size-3" aria-hidden="true" />
          <span aria-current="page" className="text-foreground">
            {current}
          </span>
        </>
      ) : (
        <span aria-current="page" className="text-foreground">
          Dashboard
        </span>
      )}
    </nav>
  );
}
