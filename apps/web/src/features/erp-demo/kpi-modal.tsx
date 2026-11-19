"use client";

import { CheckCircle2, AlertTriangle, BarChart3 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Database, DemoContext } from "@/lib/demo/types";
import type { Range } from "@/lib/demo/selectors";
import { projectKpis } from "./projections";

export function KpiScorecardModal({
  open,
  onOpenChange,
  db,
  ctx,
  range,
  now,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  db: Database;
  ctx: DemoContext;
  range: Range;
  now: number;
}) {
  const kpis = projectKpis(db, ctx, range, now);
  const metCount = kpis.criteria.filter((c) => c.status === "met").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-card sm:max-w-3xl">
        <DialogHeader className="pr-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BarChart3 className="size-4" aria-hidden="true" />
            </span>
            <DialogTitle className="text-lg font-extrabold tracking-tight">
              9 SRS Success Criteria Scorecard
            </DialogTitle>
            <span className="rounded-full border border-success/40 bg-success/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-success-foreground">
              {metCount}/9 Verified
            </span>
          </div>
          <DialogDescription>
            Live evaluation derived from your currently scoped company and
            branch records inside IndexedDB.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {kpis.criteria.map((item) => (
            <article
              key={item.id}
              className="flex flex-col justify-between gap-2 rounded-xl border bg-background/60 p-3.5"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  KPI 0{item.id}
                </span>
                {item.status === "met" ? (
                  <CheckCircle2
                    className="size-4 shrink-0 text-success"
                    aria-label="Target met"
                  />
                ) : (
                  <AlertTriangle
                    className="size-4 shrink-0 text-warning"
                    aria-label="Needs attention"
                  />
                )}
              </div>
              <div>
                <h3 className="text-xs font-bold text-foreground">
                  {item.title}
                </h3>
                <p className="mt-1 font-mono text-base font-extrabold text-foreground tabular-nums">
                  {item.metric}
                </p>
              </div>
              <div className="space-y-1.5 border-t pt-2">
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${
                      item.status === "met" ? "bg-success" : "bg-warning"
                    }`}
                    style={{ width: item.status === "met" ? "100%" : "45%" }}
                  />
                </div>
                <p className="text-[11px] font-medium text-muted-foreground">
                  {item.target} · {item.detail}
                </p>
              </div>
            </article>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
