"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { entities, type Database } from "@/lib/demo/types";
import { Brand } from "./shell";
import { selectClass } from "./form";
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
      <header className="flex h-topbar items-center justify-between border-b bg-surface px-page">
        <Brand />
        <Link href="/login" prefetch={false} className="text-sm text-link">
          Live sign-in
        </Link>
      </header>
      <main className="mx-auto grid max-w-6xl gap-10 px-page py-12 lg:grid-cols-2">
        <div className="space-y-6">
          <span className="inline-block rounded-control border border-input px-3 py-1 text-label font-medium">
            DEMO MODE · browser only
          </span>
          <h1 className="text-page-title">Explore the DriveCore workspace</h1>
          <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
            A connected vehicle rental and fleet ERP prototype. Make a booking,
            hand over a vehicle, consume service parts or record a payment—and
            see the related records change.
          </p>
          <ol className="space-y-4 text-sm">
            {[
              "Quotation → reservation → contract → handover → return",
              "Work order → parts consumption → expense → available vehicle",
              "Purchase request → approval → receipt → stock movement",
              "Invoice → payment → balance → refund and credit",
            ].map((step, i) => (
              <li key={step} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-control border text-label">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <p className="max-w-lg text-label leading-relaxed text-muted-foreground">
            All names and records are synthetic. Changes persist in IndexedDB
            until you reset. Rules, rates, demo kilometres and ledger entries
            are simulations, not production enforcement or certified accounting.
          </p>
        </div>
        <section className="h-fit space-y-5 rounded-card border bg-surface p-card">
          <h2 className="text-section-heading">Choose a demo account</h2>
          <label className="block space-y-2 text-sm">
            Demo role
            <select
              className={selectClass}
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {entities(db, "user")
                .filter((u) => u.active)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
          </label>
          <p className="text-sm text-muted-foreground">
            Start with the platform administrator to explore every workflow.
            Switch accounts inside the demo to see capability and branch
            restrictions.
          </p>
          <Button onClick={() => onEnter(selected)}>Enter ERP demo</Button>
          <div className="flex flex-wrap gap-4 border-t pt-4">
            <Link
              href="/demo/workflow"
              prefetch={false}
              className="text-sm text-link"
            >
              Use the setup walkthrough
            </Link>
            <Button variant="ghost" size="sm" onClick={onReset}>
              Reset demo data
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
