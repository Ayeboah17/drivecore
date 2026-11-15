"use client";
import { Building2, Users, CarFront } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepForm } from "./step-form";
import { steps } from "./steps";
import type { DemoRecord } from "./store";
export function DemoSetup({
  fresh,
  company,
  companyId,
  branches,
  revision,
  error,
  onCreate,
  onOpen,
}: {
  fresh: boolean;
  company?: DemoRecord;
  companyId?: string;
  branches: DemoRecord[];
  revision: number;
  error?: string;
  onCreate: (index: number, values: Record<string, string>) => void;
  onOpen: () => void;
}) {
  return (
    <>
      <div>
        <h1 className="text-page-title">Set up your workspace</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create a company, then add at least one branch before opening its
          dashboard.
        </p>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <section className="space-y-4 rounded-card border bg-surface p-card">
          <h2 className="text-section-heading">Company</h2>
          {fresh ? (
            <StepForm
              key={`company-${revision}`}
              definition={steps[0]}
              error={error}
              onComplete={(v) => onCreate(0, v)}
            />
          ) : (
            <>
              <p className="font-medium">{company?.values.name}</p>
              <p className="text-sm text-muted-foreground">
                Currency: {company?.values.currency}
              </p>
            </>
          )}
        </section>
        <section className="space-y-4 rounded-card border bg-surface p-card">
          <h2 className="text-section-heading">Branches</h2>
          {fresh ? (
            <p className="text-sm text-muted-foreground">
              Save the company to start adding branches.
            </p>
          ) : (
            <>
              <ul aria-label="Demo branches" className="divide-y">
                {branches.map((b) => (
                  <li className="py-3 text-sm" key={b.id}>
                    {b.values.name}
                  </li>
                ))}
              </ul>
              {!branches.length ? (
                <p className="text-sm text-muted-foreground">
                  No branches yet. Add your first branch to continue.
                </p>
              ) : (
                <p role="status" className="text-sm text-success-foreground">
                  Your company is ready. Add another branch or open the
                  workspace.
                </p>
              )}
              <StepForm
                key={`branch-${companyId}-${revision}`}
                definition={steps[1]}
                error={error}
                onComplete={(v) => onCreate(1, v)}
              />
            </>
          )}
        </section>
      </div>
      <Button disabled={fresh || !branches.length} onClick={onOpen}>
        Open workspace
      </Button>
    </>
  );
}
export function DemoDashboard({
  branchCount,
  customerCount,
  vehicleCount,
  onCreate,
}: {
  branchCount: number;
  customerCount: number;
  vehicleCount: number;
  onCreate: (index: 2 | 3) => void;
}) {
  return (
    <>
      <section className="space-y-4 rounded-card border bg-surface p-card">
        <h2 className="text-section-heading">Build your demo workspace</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Your company and branches are ready. Add fictional customers and
          vehicles to explore how records stay within the selected workspace.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => {
              onCreate(2);
            }}
          >
            Create customer
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              onCreate(3);
            }}
          >
            Create vehicle
          </Button>
        </div>
      </section>
      <div className="grid gap-5 md:grid-cols-3">
        {[
          {
            label: "Branches",
            count: branchCount,
            icon: Building2,
          },
          {
            label: "Customers",
            count: customerCount,
            icon: Users,
          },
          {
            label: "Vehicles",
            count: vehicleCount,
            icon: CarFront,
          },
        ].map(({ label, count, icon: Icon }) => (
          <section
            key={label}
            className="flex items-center gap-4 rounded-card border bg-surface p-card"
          >
            <Icon aria-hidden="true" className="size-5 text-muted-foreground" />
            <div>
              <h2 className="text-sm text-muted-foreground">
                Demo {label.toLowerCase()}
              </h2>
              <p className="text-section-heading">{count}</p>
            </div>
          </section>
        ))}
      </div>
      <section className="space-y-2 rounded-card border bg-surface p-card">
        <h2 className="text-card-heading">Operational workflows are planned</h2>
        <p className="text-sm text-muted-foreground">
          Reservations, rentals, departures, returns, finance, search and
          notifications are not simulated. No operational activity or financial
          totals are generated.
        </p>
      </section>
    </>
  );
}

export function RecordList({
  records,
  branches,
}: {
  records: DemoRecord[];
  branches: DemoRecord[];
}) {
  if (!records.length)
    return (
      <p className="text-sm text-muted-foreground">
        No demo records in this scope. Create the first record to get started.
      </p>
    );
  return (
    <ul className="divide-y">
      {records.map((r) => (
        <li key={r.id} className="space-y-2 py-4">
          <h3 className="break-words font-medium">
            {r.values.name ?? r.values.registration}
          </h3>
          <p className="text-sm text-muted-foreground">
            {branches.find((b) => b.id === r.branchId)?.values.name}
          </p>
          <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
            {Object.entries(r.values)
              .filter(([key]) => key !== "name" && key !== "registration")
              .map(([key, value]) => (
                <div key={key}>
                  <dt className="capitalize text-muted-foreground">{key}</dt>
                  <dd className="break-words">{value || "—"}</dd>
                </div>
              ))}
          </dl>
        </li>
      ))}
    </ul>
  );
}
