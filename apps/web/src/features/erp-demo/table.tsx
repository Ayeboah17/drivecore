"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  valueOf,
  entities,
  type Database,
  type DemoContext,
  type Entity,
  type Kind,
} from "@/lib/demo/types";
import {
  label,
  rows,
  displayStatus,
  money,
  inRange,
  type Range,
} from "@/lib/demo/selectors";
import { stock, invoiceBalance } from "@/lib/demo/rules";
import { fieldLabel, screens } from "./config";
import { selectClass } from "./form";
export function Status({ value }: { value: string }) {
  const style = [
    "available",
    "paid",
    "completed",
    "received",
    "confirmed",
    "active",
    "in stock",
  ].includes(value)
    ? "border-success text-success-foreground"
    : [
          "overdue",
          "damaged",
          "unpaid",
          "cancelled",
          "inactive",
          "void",
          "low stock",
        ].includes(value)
      ? "border-danger text-danger-foreground"
      : [
            "reserved",
            "maintenance",
            "in_progress",
            "partial",
            "submitted",
            "approved",
            "unread",
          ].includes(value)
        ? "border-warning text-warning-foreground"
        : "border-border text-muted-foreground";
  return value ? (
    <Badge variant="outline" className={style}>
      {value.replaceAll("_", " ")}
    </Badge>
  ) : null;
}
const financial = new Set([
  "dailyRate",
  "total",
  "amount",
  "unitCost",
  "labourCost",
  "partsCost",
]);
export function cell(db: Database, entity: Entity, key: string): string {
  if (key === "condition" && entity.kind === "vehicle")
    return displayStatus(db, entity);
  if (key === "status") return displayStatus(db, entity);
  const value = valueOf(entity, key);
  if (key.endsWith("Id")) {
    const related = db.entities.find((e) => e.id === value);
    return related ? label(related) : String(value || "—");
  }
  if (financial.has(key) && typeof value === "number")
    return money(db, entity.companyId, value);
  if (key === "odometer") return `${value} km (demo)`;
  if (key.endsWith("At") && typeof value === "string") {
    const d = new Date(value);
    return value && Number.isFinite(d.getTime()) ? d.toLocaleString() : "—";
  }
  if (Array.isArray(value)) return value.join(", ") || "None";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value || (value === 0 ? 0 : "—"));
}
export interface TableState {
  q: string;
  filter: string;
  sort: string;
  page: number;
}
export function RecordTable({
  db,
  ctx,
  kind,
  state,
  onState,
  onView,
  range,
}: {
  db: Database;
  ctx: DemoContext;
  kind: Kind;
  state: TableState;
  onState: (next: Partial<TableState>) => void;
  onView: (id: string) => void;
  range: Range;
}) {
  const spec = screens[kind];
  const dated = ![
    "company",
    "branch",
    "role",
    "user",
    "customer",
    "vehicle",
    "part",
    "supplier",
    "setting",
  ].includes(kind);
  let source = rows(db, ctx, kind).filter(
    (e) => !dated || inRange(e.createdAt, range),
  );
  const statuses = [
    ...new Set(source.map((e) => displayStatus(db, e)).filter(Boolean)),
  ].sort();
  const query = state.q.toLocaleLowerCase().trim();
  source = source.filter(
    (e) =>
      (!query ||
        [label(e), ...spec.columns.map((key) => cell(db, e, key))]
          .join(" ")
          .toLocaleLowerCase()
          .includes(query)) &&
      (!state.filter || displayStatus(db, e) === state.filter),
  );
  const [sort, dir] = state.sort.split(":");
  source.sort((a, b) => {
    const av = valueOf(a, sort),
      bv = valueOf(b, sort);
    const comparison =
      typeof av === "number" && typeof bv === "number"
        ? av - bv
        : cell(db, a, sort).localeCompare(cell(db, b, sort), undefined, {
            numeric: true,
          });
    return comparison * (dir === "desc" ? -1 : 1) || a.id.localeCompare(b.id);
  });
  const configured = Number(
    entities(db, "setting").find(
      (s) => s.companyId === ctx.companyId && s.name === "Rows per page",
    )?.value ?? "10",
  );
  const pageSize = [10, 25, 50].includes(configured) ? configured : 10;
  const last = Math.max(1, Math.ceil(source.length / pageSize)),
    page = Math.min(state.page, last),
    visible = source.slice((page - 1) * pageSize, page * pageSize);
  return (
    <section
      aria-label={spec.label}
      className="overflow-hidden rounded-card border bg-surface"
    >
      <div className="flex flex-col flex-wrap items-end gap-3 border-b p-card lg:flex-row">
        <form
          key={kind + state.q}
          className="flex min-w-0 flex-1 items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            onState({ q: String(data.get("query") ?? ""), page: 1 });
          }}
        >
          <label className="min-w-0 flex-1 space-y-2 text-label">
            Search {spec.label.toLowerCase()}
            <Input
              name="query"
              type="search"
              defaultValue={state.q}
              placeholder="Search all records in this scope"
            />
          </label>
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
        <label className="w-full space-y-2 text-label lg:w-40">
          Status
          <select
            aria-label="Filter status"
            className={selectClass}
            value={state.filter}
            onChange={(e) => onState({ filter: e.target.value, page: 1 })}
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="w-full space-y-2 text-label lg:w-48">
          Sort
          <select
            className={selectClass}
            aria-label="Sort records"
            value={state.sort}
            onChange={(e) => onState({ sort: e.target.value, page: 1 })}
          >
            {spec.columns.flatMap((key) => [
              <option key={`${key}-asc`} value={`${key}:asc`}>
                {fieldLabel(key, kind)} ↑
              </option>,
              <option key={`${key}-desc`} value={`${key}:desc`}>
                {fieldLabel(key, kind)} ↓
              </option>,
            ])}
          </select>
        </label>
      </div>
      {!source.length ? (
        <div className="space-y-2 p-8">
          <h2 className="text-section-heading">No matching records</h2>
          <p className="text-sm text-muted-foreground">
            Change the date range, search or filters, or create a record when
            your role allows it.
          </p>
          <Button
            variant="outline"
            onClick={() => onState({ q: "", filter: "", page: 1 })}
          >
            Clear search and status
          </Button>
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  {spec.columns.map((key) => (
                    <TableHead key={key}>{fieldLabel(key, kind)}</TableHead>
                  ))}
                  {kind === "part" ? (
                    <TableHead>Stock</TableHead>
                  ) : kind === "invoice" ? (
                    <TableHead>Outstanding</TableHead>
                  ) : null}
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((e) => (
                  <TableRow key={e.id}>
                    {spec.columns.map((key) => (
                      <TableCell
                        key={key}
                        className={
                          key === spec.columns[0]
                            ? "max-w-64 truncate font-medium"
                            : "max-w-56 truncate"
                        }
                      >
                        {["status", "condition"].includes(key) ? (
                          <Status value={cell(db, e, key)} />
                        ) : (
                          cell(db, e, key)
                        )}
                      </TableCell>
                    ))}
                    {e.kind === "part" ? (
                      <TableCell>{stock(db, e.id)}</TableCell>
                    ) : e.kind === "invoice" ? (
                      <TableCell>
                        {money(
                          db,
                          e.companyId,
                          invoiceBalance(db, e.id).outstanding,
                        )}
                      </TableCell>
                    ) : null}
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onView(e.id)}
                        aria-label={`View ${label(e)}`}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="divide-y md:hidden">
            {visible.map((e) => (
              <li key={e.id} className="space-y-3 p-card">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="min-w-0 break-words text-card-heading">
                    {label(e)}
                  </h2>
                  <Status value={displayStatus(db, e)} />
                </div>
                <dl className="grid grid-cols-2 gap-3 text-label">
                  {spec.columns.slice(1, 4).map((key) => (
                    <div key={key}>
                      <dt className="text-muted-foreground">
                        {fieldLabel(key, kind)}
                      </dt>
                      <dd className="break-words">{cell(db, e, key)}</dd>
                    </div>
                  ))}
                </dl>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onView(e.id)}
                >
                  View record
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm">
        <p>
          {source.length} records · Page {page} of {last}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onState({ page: page - 1 })}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= last}
            onClick={() => onState({ page: page + 1 })}
          >
            Next
          </Button>
        </div>
      </div>
    </section>
  );
}
export function exportCsv(
  name: string,
  headers: string[],
  data: (string | number)[][],
) {
  const escape = (v: string | number) => {
    let value = String(v);
    if (/^[=+\-@\t\r]/.test(value)) value = `'${value}`;
    return `"${value.replaceAll('"', '""')}"`;
  };
  const blob = new Blob(
    [[headers, ...data].map((row) => row.map(escape).join(",")).join("\r\n")],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
