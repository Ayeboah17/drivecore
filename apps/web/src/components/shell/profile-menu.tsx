"use client";
import { UserRound } from "lucide-react";
import { useDevelopment } from "@/mocks/development-provider";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
export function ProfileMenu() {
  const { profile } = useDevelopment();
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Development user profile"
          />
        }
      >
        <UserRound />
      </PopoverTrigger>
      <PopoverContent align="end">
        <p className="font-semibold">{profile.name}</p>
        <p className="text-label text-muted-foreground">
          {profile.profileLabel}
        </p>
        <p className="border-t pt-2 text-label text-muted-foreground">
          Development identity · mock authentication only
        </p>
      </PopoverContent>
    </Popover>
  );
}
