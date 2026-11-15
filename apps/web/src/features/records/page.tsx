"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "@/features/live/context";
import { can, type Domain } from "@/lib/api/contracts";
import { errorText } from "@/lib/api/client";
import { StatePanel } from "@/components/layout/state-panel";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomerForm, VehicleForm } from "./forms";
import { getRecord } from "./service";
import { RecordDirectory } from "./directory";
import { RecordDetails, VehicleStatus } from "./presentation";

export function RecordPage({ domain }: { domain: Domain }) {
  const { record: route = [] } = useParams<{ record?: string[] }>();
  const scope = useLiveContext();
  const { user } = useSession();
  const id = route[0];
  const creating = id === "new";
  const editing = route[1] === "edit";
  const valid =
    route.length <= 2 &&
    (!id ||
      (creating && route.length === 1) ||
      (/^[1-9]\d*$/.test(id) &&
        Number.isSafeInteger(Number(id)) &&
        (!route[1] || editing)));
  const canView = can(user!, `${domain}.view`);
  const canManage = can(user!, `${domain}.manage`);
  const record = useQuery({
    queryKey: [...scope.key, domain, id],
    queryFn: ({ signal }) =>
      getRecord(domain, id!, scope.companyId, scope.branch, signal),
    enabled: valid && canView && (!editing || canManage) && !!id && !creating,
    staleTime: 0,
  });
  const title = domain === "customers" ? "Customer" : "Vehicle";
  const directory = domain === "customers" ? "customers" : "fleet";
  const base = `/companies/${scope.companyId}/${domain}`;
  const suffix = `?branch=${scope.branch}`;
  const back = (
    <Link
      className="inline-block text-sm text-link hover:underline"
      href={`${base}${suffix}`}
    >
      Back to {directory}
    </Link>
  );
  if (!valid)
    return (
      <StatePanel
        title="Page unavailable"
        href={`${base}${suffix}`}
        linkLabel={`Back to ${directory}`}
      >
        The record URL is invalid.
      </StatePanel>
    );
  if (!canView || ((creating || editing) && !canManage))
    return (
      <StatePanel title="Access denied">
        Your account does not have permission for this action.
      </StatePanel>
    );
  if (!id) return <RecordDirectory domain={domain} canManage={canManage} />;
  if (creating)
    return (
      <div className="space-y-6">
        {back}
        <div className="space-y-2">
          <h1 className="text-page-title">Create {title.toLowerCase()}</h1>
          <p className="text-sm text-muted-foreground">
            Add a {title.toLowerCase()} record to {scope.company?.name}. Choose
            the branch that owns this record.
          </p>
        </div>
        {domain === "customers" ? <CustomerForm /> : <VehicleForm />}
      </div>
    );
  if (record.isPending)
    return (
      <div className="space-y-6">
        {back}
        <div
          role="status"
          aria-label={`Loading ${title.toLowerCase()}`}
          className="space-y-4"
        >
          <p className="text-sm text-muted-foreground">
            Loading {title.toLowerCase()}…
          </p>
          <div
            aria-hidden="true"
            className="dc-shadow-card space-y-5 rounded-2xl border bg-surface p-card"
          >
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      </div>
    );
  if (record.error || !record.data)
    return (
      <div className="space-y-6">
        {back}
        <StatePanel
          title="Record unavailable"
          onRetry={() => {
            void record.refetch();
          }}
        >
          {errorText(record.error)}
        </StatePanel>
      </div>
    );
  const value = record.data;
  if (editing && "registration" in value && value.status === "rented")
    return (
      <StatePanel
        title="Vehicle cannot be edited"
        href={`${base}/${id}${suffix}`}
        linkLabel="Back to vehicle"
      >
        This vehicle is rented. The backend controls when editing becomes
        available.
      </StatePanel>
    );
  return (
    <div className="space-y-6">
      {back}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <h1 className="break-words text-page-title font-extrabold tracking-tight">
            {editing
              ? `Edit ${title.toLowerCase()}`
              : "name" in value
                ? value.name
                : value.registration}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="font-mono text-xs font-semibold tabular-nums">
              {title} #{value.id}
            </span>
            {"registration" in value ? (
              <>
                <span className="rounded-md bg-structural px-2 py-0.5 font-mono text-xs font-bold text-structural-foreground">
                  {value.registration}
                </span>
                <span>
                  {value.make} {value.model}
                </span>
                <VehicleStatus status={value.status} />
              </>
            ) : (
              <span className="rounded-md bg-structural px-2 py-0.5 font-mono text-xs font-semibold text-structural-foreground">
                {value.type === "individual" ? "Individual" : "Corporate"}
              </span>
            )}
          </div>
        </div>
        {!editing ? (
          <div className="flex flex-wrap gap-3">
            {canManage &&
            !("registration" in value && value.status === "rented") ? (
              <Link
                className={buttonVariants()}
                href={`${base}/${id}/edit${suffix}`}
              >
                Edit {title.toLowerCase()}
              </Link>
            ) : null}
            <Button
              variant="outline"
              disabled={record.isFetching}
              onClick={() => {
                void record.refetch();
              }}
            >
              {record.isFetching ? "Refreshing…" : "Refresh record"}
            </Button>
          </div>
        ) : (
          <Link
            className="text-sm text-link hover:underline"
            href={`${base}/${id}${suffix}`}
          >
            Cancel editing
          </Link>
        )}
      </div>
      {editing ? (
        "name" in value ? (
          <CustomerForm
            key={`${value.id}:${value.updated_at}`}
            record={value}
          />
        ) : (
          <VehicleForm key={`${value.id}:${value.updated_at}`} record={value} />
        )
      ) : (
        <RecordDetails
          record={value}
          company={scope.company?.name ?? `Company #${value.company_id}`}
          branch={
            scope.directory?.branches.find(
              (branch) =>
                branch.id === value.branch_id &&
                branch.company_id === value.company_id,
            )?.name ?? `Branch #${value.branch_id}`
          }
        />
      )}
    </div>
  );
}
