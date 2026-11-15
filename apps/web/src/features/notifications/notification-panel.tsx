"use client";
import { useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
  PopoverDescription,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useNotifications } from "./queries";
export function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const result = useNotifications(open);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Operational notifications"
          />
        }
      >
        <Bell />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(360px,calc(100vw-2rem))] p-4"
      >
        <PopoverTitle>Operational notifications</PopoverTitle>
        <PopoverDescription>
          Read-only mock items · Current branch scope
        </PopoverDescription>
        {result.isPending ? (
          <p role="status" className="py-3 text-sm text-muted-foreground">
            Loading notifications…
          </p>
        ) : result.isError ? (
          <div>
            <p>Notifications unavailable</p>
            <Button
              className="mt-2"
              variant="outline"
              onClick={() => void result.refetch()}
            >
              Retry notifications
            </Button>
          </div>
        ) : !result.data?.items.length ? (
          <p role="status" className="py-3 text-sm text-muted-foreground">
            No mock notifications in this scope
          </p>
        ) : (
          <ul className="max-h-[50dvh] divide-y overflow-y-auto">
            {result.data.items.map((item) => (
              <li key={item.id} className="py-3">
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-sm text-sm text-link hover:text-link-hover hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {item.message}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.branchName}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="border-t pt-2 text-[11px] text-muted-foreground">
          No delivery or read-status tracking is implemented
        </p>
      </PopoverContent>
    </Popover>
  );
}
