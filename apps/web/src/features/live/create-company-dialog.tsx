"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SetupForm } from "@/features/setup/setup-form";
export function CreateCompanyDialog() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) setOpen(value);
      }}
    >
      <DialogTrigger render={<Button variant="outline" className="shrink-0" />}>
        <Plus aria-hidden="true" />
        Create company
      </DialogTrigger>
      <DialogContent
        showCloseButton={!pending}
        className="max-h-[calc(100dvh-3rem)] overflow-y-auto rounded-card p-card sm:max-w-lg"
      >
        <DialogHeader className="pr-6">
          <DialogTitle>Create company</DialogTitle>
          <DialogDescription>
            Add a company workspace. You can set up its branches after saving.
          </DialogDescription>
        </DialogHeader>
        <SetupForm
          kind="company"
          presentation="dialog"
          onPendingChange={setPending}
        />
      </DialogContent>
    </Dialog>
  );
}
