export type Tone = "danger" | "warning" | "neutral";
export interface BlockerSummary {
  id: string;
  description: string;
  severity: string;
  tone: Tone;
  resolution: { moduleKey: string; label: string };
}
export interface DepartureQueueItem {
  id: string;
  bookingReference: string;
  companyId: string;
  branchId: string;
  branchName: string;
  scheduledAt: string;
  vehicle: string | null;
  displayStatus: string;
  blockers: BlockerSummary[];
  // Fixture-only presentation annotations. Never release or safety decisions.
  outstanding: boolean;
  priority: number;
}
export interface ReturnQueueItem {
  id: string;
  reference: string;
  companyId: string;
  branchId: string;
  branchName: string;
  scheduledAt: string;
  vehicle: string;
  relatedDepartureId?: string;
  relatedDepartureReference?: string;
}
export interface DashboardSummary {
  departures: number;
  affectedDepartures: number;
  issues: number;
  dueSoon: number;
  returns: number;
  retrievedAt: string;
  referenceTime: string;
}
export interface DepartureQueueInput {
  filter: "all" | "blocked" | "soon" | "earlier";
  sort: "priority" | "time";
  query: string;
  page: number;
  pageSize: number;
}
export interface ReturnQueueInput {
  sort: "time" | "time-desc";
  page: number;
  pageSize: number;
}
