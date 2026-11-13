"use client";
import { GlobalSearch } from "@/features/search/global-search";
import { NotificationPanel } from "@/features/notifications/notification-panel";
import { Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ContextSelectors } from "./context-selectors";
import { ProfileMenu } from "./profile-menu";
import { NavigationItems } from "./navigation-items";
export function Topbar() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <header
        data-testid="topbar"
        className="sticky top-0 z-20 flex h-topbar shrink-0 items-center gap-2 border-b bg-surface px-4 sm:px-page xl:gap-3"
      >
        <div className="lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Open navigation"
                />
              }
            >
              <Menu />
            </SheetTrigger>
            <SheetContent side="left" className="w-sidebar max-w-[90vw] gap-0">
              <div className="border-b p-page">
                <SheetTitle>DriveCore</SheetTitle>
                <SheetDescription>Mock operational workspace</SheetDescription>
              </div>
              <div className="overflow-y-auto">
                <NavigationItems onNavigate={() => setOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
        <div className="hidden min-w-0 flex-1 xl:flex">
          <ContextSelectors />
        </div>
        <span className="min-w-0 flex-1 truncate font-medium xl:hidden">
          DriveCore
          <span className="block text-[10px] leading-3 font-normal text-muted-foreground">
            Mock workspace
          </span>
        </span>
        <span className="hidden rounded-sm border border-border bg-muted xl:inline-block px-2 py-0.5 text-xs text-foreground">
          Mock workspace
        </span>
        <GlobalSearch />
        <NotificationPanel />
        <ProfileMenu />
      </header>
      <div className="border-b bg-surface px-page py-3 xl:hidden">
        <ContextSelectors />
      </div>
    </>
  );
}
