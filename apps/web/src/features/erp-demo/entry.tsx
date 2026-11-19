"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, RotateCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DriveCoreSelect } from "@/components/ui/drivecore-select";
import { ViewFadeIn } from "@/components/motion/primitives";
import { entities, type Database } from "@/lib/demo/types";
import { Brand } from "./shell";

export function DemoEntry({
  db,
  onEnter,
  onReset,
}: {
  db: Database;
  onEnter: (userId: string) => void;
  onReset: () => void;
}) {
  const [selected, setSelected] = useState("user-platform");
  return (
    <div data-erp-demo className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 px-3 pt-2.5">
        <div className="dc-glass-panel dc-shadow-float mx-auto flex h-16 max-w-6xl items-center justify-between rounded-2xl border px-4">
          <Brand subtitle="Fleet Rental · Maintenance · Accounting" />
          <Link
            href="/login"
            prefetch={false}
            className="text-sm font-semibold text-link hover:text-link-hover hover:underline"
          >
            Live sign-in
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl items-start gap-10 px-page py-12 lg:grid-cols-12">
        <ViewFadeIn className="space-y-6 lg:col-span-7">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-xs font-semibold text-link">
            <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
            DEMO MODE · Browser IndexedDB Engine
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Explore the DriveCore workspace
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            Interactive fleet rental, telematics inspection, maintenance workshop,
            inventory, and double-entry accounting ERP prototype. Trigger real
            state transitions locally and inspect how every module updates.
          </p>
          <ol className="grid gap-3 sm:grid-cols-2">
            {[
              "Quotation → reservation → contract → handover → return",
              "Work order → parts consumption → expense → available vehicle",
              "Purchase request → approval → receipt → stock movement",
              "Invoice → payment → AR ageing → double-entry GL ledger",
            ].map((step, i) => (
              <li
                key={step}
                className="dc-shadow-card flex items-start gap-3 rounded-2xl border bg-surface p-4 text-sm"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-structural font-mono text-xs font-bold text-structural-foreground">
                  0{i + 1}
                </span>
                <span className="font-medium text-foreground">{step}</span>
              </li>
            ))}
          </ol>
          <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
            All names and records are synthetic. Changes persist in IndexedDB
            until you reset. Rules, rates, demo kilometres and ledger entries
            are simulations, not production enforcement or certified accounting.
          </p>
        </ViewFadeIn>

        <ViewFadeIn delay={0.05} className="lg:col-span-5">
          <section className="dc-shadow-float space-y-5 rounded-3xl border bg-surface p-6">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-structural text-structural-foreground">
                <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-section-heading font-extrabold">
                  Choose a demo account
                </h2>
                <p className="text-xs text-muted-foreground">
                  Switch roles anytime from the header bar
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <span className="block text-sm font-medium">Demo role</span>
              <DriveCoreSelect
                ariaLabel="Demo role"
                value={selected}
                onValueChange={setSelected}
                options={entities(db, "user")
                  .filter((u) => u.active)
                  .map((u) => ({ value: u.id, label: u.name }))}
              />
            </div>

            <p className="text-sm text-muted-foreground">
              Start with the platform administrator to explore every workflow,
              or choose Operations, Fleet, Finance, or Viewer to test capability
              and branch isolation.
            </p>

            <Button
              className="h-11 w-full rounded-xl font-semibold"
              onClick={() => onEnter(selected)}
            >
              <span>Enter ERP demo</span>
              <ArrowRight className="ml-2 size-4" aria-hidden="true" />
            </Button>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-4">
              <Button variant="ghost" size="sm" onClick={onReset} className="gap-1.5">
                <RotateCcw className="size-3.5" aria-hidden="true" />
                Reset demo data
              </Button>
            </div>
          </section>
        </ViewFadeIn>
      </main>
    </div>
  );
}
