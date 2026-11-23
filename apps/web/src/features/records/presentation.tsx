import {
  formatMinorCurrency,
  formatVehicleFunction,
  vehicleCategoryLabels,
  vehicleFinancingLabels,
  vehicleFuelTypeLabels,
  vehicleTransmissionLabels,
  type Customer,
  type Vehicle,
} from "@/lib/api/contracts";
import { Badge } from "@/components/ui/badge";

const statusStyles: Record<Vehicle["status"], string> = {
  available: "text-success-foreground border-success",
  reserved: "text-link border-link/60 bg-link/5",
  maintenance: "text-warning-foreground border-warning",
  damaged: "text-danger-foreground border-danger",
  accident: "text-danger-foreground border-danger bg-danger/10",
  awaiting_inspection: "text-warning-foreground border-warning/80 bg-warning/5",
  awaiting_repair: "text-warning-foreground border-warning bg-warning/10",
  rented: "text-foreground border-border",
  sold: "text-muted-foreground border-border bg-muted/40",
  decommissioned: "text-danger-foreground border-danger/60 bg-danger/5",
};

const statusLabels: Record<Vehicle["status"], string> = {
  available: "Available",
  reserved: "Reserved",
  rented: "Rented",
  maintenance: "Maintenance",
  damaged: "Damaged",
  accident: "Accident",
  awaiting_inspection: "Awaiting inspection",
  awaiting_repair: "Awaiting repair",
  sold: "Sold",
  decommissioned: "Decommissioned",
};

export function VehicleStatus({ status }: { status: Vehicle["status"] }) {
  return (
    <Badge variant="outline" className={statusStyles[status]}>
      {statusLabels[status] ?? status}
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
  currency,
  canFinance = false,
}: {
  record: Customer | Vehicle;
  company: string;
  branch: string;
  currency?: string;
  canFinance?: boolean;
}) {
  return (
    <div className="grid items-start gap-6 xl:grid-cols-3">
      <section className="dc-shadow-card space-y-5 rounded-2xl border bg-surface p-card xl:col-span-2">
        <h2 className="text-section-heading">
          {"name" in record ? "Customer information" : "Vehicle digital file"}
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
              {record.type === "individual" ? (
                <>
                  <Detail label="National ID / Passport">
                    {record.id_number || "Not provided"}
                  </Detail>
                  <Detail label="Driver licence #">
                    {record.driver_licence_number || "Not provided"}
                  </Detail>
                  <Detail label="Driver licence expiry">
                    <span className="font-mono tabular-nums">
                      {record.driver_licence_expires_at || "Not provided"}
                    </span>
                  </Detail>
                </>
              ) : (
                <>
                  <Detail label="Company registration">
                    {record.company_registration || "Not provided"}
                  </Detail>
                  <Detail label="Tax ID (TIN)">
                    {record.tin || "Not provided"}
                  </Detail>
                  <Detail label="Contact person">
                    {record.contact_person_name || "Not provided"}
                  </Detail>
                  <Detail label="Contact phone">
                    {record.contact_person_phone || "Not provided"}
                  </Detail>
                </>
              )}
              {record.billing_address ? (
                <div className="min-w-0 space-y-1 sm:col-span-2">
                  <dt className="text-label text-muted-foreground">
                    Billing address
                  </dt>
                  <dd className="break-words text-sm font-medium">
                    {record.billing_address}
                  </dd>
                </div>
              ) : null}
              {canFinance &&
              (record.credit_limit_minor != null ||
                record.payment_terms_days != null) ? (
                <>
                  <Detail label="Credit limit">
                    <span className="font-mono tabular-nums">
                      {record.credit_limit_minor != null
                        ? formatMinorCurrency(record.credit_limit_minor, currency)
                        : "Not set"}
                    </span>
                  </Detail>
                  <Detail label="Payment terms">
                    <span className="font-mono tabular-nums">
                      {record.payment_terms_days != null
                        ? `${record.payment_terms_days} days`
                        : "Default"}
                    </span>
                  </Detail>
                </>
              ) : null}
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
              <Detail label="VIN / Chassis #">
                <span className="font-mono text-xs">
                  {record.vin || "Not recorded"}
                </span>
              </Detail>
              <Detail label="Category">
                {record.category
                  ? vehicleCategoryLabels[record.category]
                  : "Not specified"}
              </Detail>
              <Detail label="Make">{record.make}</Detail>
              <Detail label="Model">{record.model}</Detail>
              <Detail label="Year">
                <span className="font-mono tabular-nums">
                  {record.year ?? "Not provided"}
                </span>
              </Detail>
              <Detail label="Fuel & transmission">
                {[
                  record.fuel_type
                    ? vehicleFuelTypeLabels[record.fuel_type]
                    : null,
                  record.transmission
                    ? vehicleTransmissionLabels[record.transmission]
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Not specified"}
              </Detail>
              <Detail label="Daily rate">
                <span className="font-mono tabular-nums">
                  {formatMinorCurrency(record.daily_rate_minor, currency)}
                </span>
              </Detail>
              <Detail label="Odometer">
                <span className="font-mono tabular-nums">
                  {record.odometer.toLocaleString()}{" "}
                  {record.odometer_unit ?? "km"}
                </span>
              </Detail>
              <Detail label="Current location">
                {record.current_location || branch}
              </Detail>
              <Detail label="Insurance">
                {record.insurance_provider || record.insurance_policy_number ? (
                  <span>
                    {[
                      record.insurance_provider,
                      record.insurance_policy_number,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    {record.insurance_expires_at
                      ? ` (exp. ${record.insurance_expires_at})`
                      : ""}
                  </span>
                ) : record.insurance_expires_at ? (
                  `Expires ${record.insurance_expires_at}`
                ) : (
                  "Not recorded"
                )}
              </Detail>
              <Detail label="Roadworthy expiry">
                <span className="font-mono tabular-nums">
                  {record.roadworthy_expires_at || "Not recorded"}
                </span>
              </Detail>
              <Detail label="Licence expiry">
                <span className="font-mono tabular-nums">
                  {record.licence_expires_at || "Not recorded"}
                </span>
              </Detail>

              {canFinance ? (
                <div className="grid gap-x-8 gap-y-4 border-t pt-4 sm:col-span-2 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Acquisition, financing &amp; valuation
                    </h3>
                  </div>
                  <Detail label="Acquisition date">
                    <span className="font-mono tabular-nums">
                      {record.acquisition_date || "Not recorded"}
                    </span>
                  </Detail>
                  <Detail label="Acquisition cost">
                    <span className="font-mono tabular-nums">
                      {record.acquisition_cost_minor != null
                        ? formatMinorCurrency(
                            record.acquisition_cost_minor,
                            currency,
                          )
                        : "Not recorded"}
                    </span>
                  </Detail>
                  <Detail label="Financing">
                    {record.financing_type
                      ? `${vehicleFinancingLabels[record.financing_type]}${record.financing_provider ? ` · ${record.financing_provider}` : ""}`
                      : "Not recorded"}
                  </Detail>
                  <Detail label="Monthly financing">
                    <span className="font-mono tabular-nums">
                      {record.financing_monthly_minor != null
                        ? `${formatMinorCurrency(record.financing_monthly_minor, currency)}${record.financing_end_date ? ` (until ${record.financing_end_date})` : ""}`
                        : "—"}
                    </span>
                  </Detail>
                  <Detail label="Current book value">
                    <span className="font-mono tabular-nums">
                      {record.current_book_value_minor != null
                        ? formatMinorCurrency(
                            record.current_book_value_minor,
                            currency,
                          )
                        : "See Fixed Assets card"}
                    </span>
                  </Detail>
                  <Detail label="Residual value">
                    <span className="font-mono tabular-nums">
                      {record.residual_value_minor != null
                        ? formatMinorCurrency(
                            record.residual_value_minor,
                            currency,
                          )
                        : "Not recorded"}
                    </span>
                  </Detail>
                </div>
              ) : null}

              <div className="min-w-0 space-y-1 sm:col-span-2">
                <dt className="text-label text-muted-foreground">
                  Vehicle functions
                </dt>
                <dd className="pt-1">
                  {record.functions.length === 0 ? (
                    <span className="text-sm text-muted-foreground">
                      None selected
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {record.functions.map((fn) => (
                        <Badge
                          key={fn}
                          variant="outline"
                          className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                        >
                          {formatVehicleFunction(fn)}
                        </Badge>
                      ))}
                    </div>
                  )}
                </dd>
              </div>
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
