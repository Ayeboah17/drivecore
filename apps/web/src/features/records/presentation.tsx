import type { Customer, Vehicle } from "@/lib/api/contracts";
import { Badge } from "@/components/ui/badge";

const statusStyles: Record<Vehicle["status"], string> = {
  available: "text-success-foreground border-success",
  maintenance: "text-warning-foreground border-warning",
  damaged: "text-danger-foreground border-danger",
  rented: "text-foreground border-border",
};
export function VehicleStatus({ status }: { status: Vehicle["status"] }) {
  return (
    <Badge variant="outline" className={statusStyles[status]}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}
function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-label text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm font-medium">{children}</dd>
    </div>
  );
}
function Timestamp({ value }: { value: string }) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? (
    <>Unavailable</>
  ) : (
    <time dateTime={value}>{date.toLocaleString()}</time>
  );
}
export function RecordDetails({
  record,
  company,
  branch,
}: {
  record: Customer | Vehicle;
  company: string;
  branch: string;
}) {
  return (
    <div className="grid items-start gap-6 xl:grid-cols-3">
      <section className="dc-shadow-card space-y-5 rounded-2xl border bg-surface p-card xl:col-span-2">
        <h2 className="text-section-heading">
          {"name" in record ? "Customer information" : "Vehicle information"}
        </h2>
        <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {"name" in record ? (
            <>
              <Detail label="Name">{record.name}</Detail>
              <Detail label="Customer type">
                {record.type === "individual" ? "Individual" : "Corporate"}
              </Detail>
              <Detail label="Email">{record.email || "Not provided"}</Detail>
              <Detail label="Phone">{record.phone || "Not provided"}</Detail>
            </>
          ) : (
            <>
              <Detail label="Registration">
                <span className="inline-block rounded-md bg-structural px-2 py-0.5 font-mono text-xs font-bold text-structural-foreground">
                  {record.registration}
                </span>
              </Detail>
              <Detail label="Status">
                <VehicleStatus status={record.status} />
              </Detail>
              <Detail label="Make">{record.make}</Detail>
              <Detail label="Model">{record.model}</Detail>
              <Detail label="Year">
                <span className="font-mono tabular-nums">
                  {record.year ?? "Not provided"}
                </span>
              </Detail>
              <Detail label="Odometer">
                Unavailable — distance unit awaiting confirmation
              </Detail>
            </>
          )}
        </dl>
        {"registration" in record && record.status === "rented" ? (
          <p className="border-t pt-4 text-sm text-muted-foreground">
            This vehicle is rented. Editing is unavailable until the backend
            permits it.
          </p>
        ) : null}
      </section>
      <section className="dc-shadow-card space-y-5 rounded-2xl border bg-surface p-card">
        <h2 className="text-section-heading">Record context</h2>
        <dl className="space-y-5">
          <Detail label="Record ID">
            <span className="font-mono tabular-nums">{record.id}</span>
          </Detail>
          <Detail label="Company">{company}</Detail>
          <Detail label="Branch">{branch}</Detail>
          <Detail label="Created">
            <Timestamp value={record.created_at} />
          </Detail>
          <Detail label="Last updated">
            <Timestamp value={record.updated_at} />
          </Detail>
        </dl>
        <p className="text-label text-muted-foreground">
          Times are shown in your browser’s timezone.
        </p>
      </section>
    </div>
  );
}
