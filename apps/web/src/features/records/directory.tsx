"use client";
import Link from "next/link";
import { useId, useState } from "react";
import type { Domain } from "@/lib/api/contracts";
import { useLiveContext } from "@/features/live/context";
import { StatePanel } from "@/components/layout/state-panel";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Deliberately has no collection query: the checked Laravel contract cannot scope
// these lists to the selected company/branch before pagination.
export function RecordDirectory({
  domain,
  canManage,
}: {
  domain: Domain;
  canManage: boolean;
}) {
  const scope = useLiveContext();
  const [lookup, setLookup] = useState("");
  const [invalid, setInvalid] = useState(false);
  const field = useId();
  const title = domain === "customers" ? "Customer" : "Vehicle";
  const base = `/companies/${scope.companyId}/${domain}`;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-page-title">
            {domain === "customers" ? "Customers" : "Fleet"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {domain === "customers"
              ? "Customer contact details and records"
              : "Vehicle identity, condition and records"}{" "}
            for {scope.company?.name}.
          </p>
        </div>
        {canManage ? (
          <Link
            className={buttonVariants()}
            href={`${base}/new?branch=${scope.branch}`}
          >
            Create {title.toLowerCase()}
          </Link>
        ) : null}
      </div>
      <StatePanel title="Scoped list unavailable">
        The API does not yet support selected company and branch filtering
        before pagination. No collection has been requested. Directory search,
        filters, pagination and totals are unavailable until that server
        contract is provided.
      </StatePanel>
      <section className="dc-shadow-card max-w-xl space-y-4 rounded-2xl border bg-surface p-card">
        <div className="space-y-2">
          <h2 className="text-section-heading">Open a known record</h2>
          <p className="text-sm text-muted-foreground">
            Use an existing {title.toLowerCase()} ID to view its details. Access
            and the selected company/branch context are checked before a record
            is displayed.
          </p>
        </div>
        <form
          noValidate
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const valid =
              /^[1-9]\d*$/.test(lookup) && Number.isSafeInteger(Number(lookup));
            setInvalid(!valid);
            if (valid)
              scope.navigate(`${base}/${lookup}?branch=${scope.branch}`);
          }}
        >
          <label htmlFor={field} className="text-sm font-medium">
            Open a known {title.toLowerCase()} ID
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              id={field}
              inputMode="numeric"
              value={lookup}
              onChange={(event) => {
                setLookup(event.target.value);
                setInvalid(false);
              }}
              aria-invalid={invalid}
              aria-describedby={`${field}-error`}
            />
            <Button type="submit" variant="outline" className="shrink-0">
              Open record
            </Button>
          </div>
          <p id={`${field}-error`} className="text-sm text-danger-foreground">
            {invalid ? "Enter a positive whole record ID." : ""}
          </p>
        </form>
      </section>
    </div>
  );
}
