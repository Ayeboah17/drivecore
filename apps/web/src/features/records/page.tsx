"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "@/features/live/context";
import { can, type Domain } from "@/lib/api/contracts";
import { errorText } from "@/lib/api/client";
import { StatePanel } from "@/components/layout/state-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CustomerForm, VehicleForm } from "./forms";
import { getRecord } from "./service";

export function RecordPage({ domain }: { domain: Domain }) {
  const { record: route = [] } = useParams<{ record?: string[] }>();
  const scope = useLiveContext();
  const { user } = useSession();
  const [lookup, setLookup] = useState("");
  const lookupId = useId();
  const id = route[0];
  const creating = id === "new";
  const editing = route[1] === "edit";
  const valid =
    route.length <= 2 &&
    (!id ||
      (creating && route.length === 1) ||
      (/^[1-9]\d*$/.test(id) && (!route[1] || editing)));
  const canView = can(user!, `${domain}.view`);
  const canManage = can(user!, `${domain}.manage`);
  const record = useQuery({
    queryKey: [...scope.key, domain, id],
    queryFn: ({ signal }) =>
      getRecord(domain, id!, scope.companyId, scope.branch, signal),
    enabled: valid && canView && !!id && !creating,
  });
  const title = domain === "customers" ? "Customer" : "Vehicle";
  const base = `/companies/${scope.companyId}/${domain}`;
  const suffix = `?branch=${scope.branch}`;
  if (!valid)
    return (
      <StatePanel title="Page unavailable">
        The record URL is invalid.
      </StatePanel>
    );
  if (!canView || ((creating || editing) && !canManage))
    return (
      <StatePanel title="Access denied">
        Your account does not have permission for this action.
      </StatePanel>
    );
  if (!id)
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-page-title">
            {domain === "customers" ? "Customers" : "Vehicles"}
          </h1>
          {canManage ? (
            <Link className="text-link" href={`${base}/new${suffix}`}>
              Create {title.toLowerCase()}
            </Link>
          ) : null}
        </div>
        <StatePanel title="Scoped list unavailable">
          The API does not yet support company and branch filtering before
          pagination. No records have been fetched. Complete lists, totals and
          pagination will be enabled when the backend provides that contract.
        </StatePanel>
        <form
          className="max-w-sm space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (/^[1-9]\d*$/.test(lookup))
              scope.navigate(`${base}/${lookup}${suffix}`);
          }}
        >
          <label htmlFor={lookupId} className="text-sm">
            Open a known {title.toLowerCase()} ID
          </label>
          <Input
            id={lookupId}
            inputMode="numeric"
            pattern="[1-9][0-9]*"
            required
            value={lookup}
            onChange={(event) => setLookup(event.target.value)}
          />
          <Button type="submit" variant="outline">
            Open record
          </Button>
        </form>
      </div>
    );
  if (creating)
    return (
      <div className="space-y-6">
        <h1 className="text-page-title">Create {title.toLowerCase()}</h1>
        <Link className="text-link" href={`${base}${suffix}`}>
          Back to {domain}
        </Link>
        {domain === "customers" ? <CustomerForm /> : <VehicleForm />}
      </div>
    );
  if (record.isPending)
    return <p role="status">Loading {title.toLowerCase()}…</p>;
  if (record.error || !record.data)
    return (
      <StatePanel
        title="Record unavailable"
        onRetry={() => {
          void record.refetch();
        }}
      >
        {errorText(record.error)}
      </StatePanel>
    );
  const value = record.data;
  if (editing && "registration" in value && value.status === "rented")
    return (
      <StatePanel
        title="Vehicle cannot be edited"
        href={`${base}/${id}${suffix}`}
      >
        This vehicle is rented. The backend controls when editing becomes
        available.
      </StatePanel>
    );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-page-title">
          {editing
            ? `Edit ${title.toLowerCase()}`
            : "name" in value
              ? value.name
              : value.registration}
        </h1>
        <Link href={`${base}${suffix}`} className="text-link">
          Back to {domain}
        </Link>
      </div>
      {editing ? (
        "name" in value ? (
          <CustomerForm key={value.updated_at} record={value} />
        ) : (
          <VehicleForm key={value.updated_at} record={value} />
        )
      ) : (
        <>
          <dl className="grid max-w-2xl grid-cols-1 gap-4 rounded-card border bg-surface p-card sm:grid-cols-2">
            {Object.entries(value).map(([name, content]) => (
              <div key={name}>
                <dt className="text-sm text-muted-foreground">
                  {name.replaceAll("_", " ")}
                </dt>
                <dd className="break-words text-sm font-medium">
                  {content === null ? "—" : String(content)}
                </dd>
              </div>
            ))}
          </dl>
          {canManage &&
          !("registration" in value && value.status === "rented") ? (
            <Link href={`${base}/${id}/edit${suffix}`} className="text-link">
              Edit {title.toLowerCase()}
            </Link>
          ) : null}
          <Button
            variant="outline"
            onClick={() => {
              void record.refetch();
            }}
          >
            Refresh record
          </Button>
        </>
      )}
    </div>
  );
}
