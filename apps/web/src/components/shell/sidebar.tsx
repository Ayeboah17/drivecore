"use client";
import { useSyncExternalStore } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDevelopment } from "@/mocks/development-provider";
import { readPreference, writePreference } from "@/lib/context/preferences";
import { NavigationItems } from "./navigation-items";
import { cn } from "@/lib/utils";
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("drivecore-preference", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("drivecore-preference", callback);
  };
}
export function Sidebar() {
  const { profile } = useDevelopment();
  const key = `sidebar.${profile.id}`;
  const preference = useSyncExternalStore(
    subscribe,
    () => readPreference(key) ?? "auto",
    () => "auto",
  );
  const labelClass =
    preference === "auto"
      ? "hidden xl:flex"
      : preference === "collapsed"
        ? "hidden"
        : "flex";
  return (
    <aside
      data-testid="sidebar"
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r bg-sidebar lg:flex",
        preference === "auto"
          ? "w-sidebar-collapsed xl:w-sidebar"
          : preference === "collapsed"
            ? "w-sidebar-collapsed"
            : "w-sidebar",
      )}
    >
      <div className="flex h-topbar shrink-0 items-center gap-3 border-b px-6">
        <span
          className="text-xl font-semibold tracking-tight text-primary"
          aria-hidden="true"
        >
          D
          <span
            className={cn(
              "text-foreground",
              preference === "auto"
                ? "hidden xl:inline"
                : preference === "collapsed"
                  ? "hidden"
                  : "inline",
            )}
          >
            riveCore
          </span>
        </span>
        <span className="sr-only">DriveCore</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <NavigationItems labelClass={labelClass} />
      </div>
      <div className="border-t p-3">
        <Button
          variant="ghost"
          className="w-full justify-start px-3"
          aria-label="Toggle sidebar"
          onClick={() => {
            const collapsed =
              preference === "auto"
                ? !window.matchMedia("(min-width:1280px)").matches
                : preference === "collapsed";
            writePreference(key, collapsed ? "expanded" : "collapsed");
            window.dispatchEvent(new Event("drivecore-preference"));
          }}
        >
          {preference === "collapsed" ? <PanelLeftOpen /> : <PanelLeftClose />}
          <span className={labelClass}>Collapse navigation</span>
        </Button>
      </div>
    </aside>
  );
}
