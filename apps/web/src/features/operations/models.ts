import type { BlockerSummary, DepartureQueueItem } from "../dashboard/models";
export type DepartureDetail = DepartureQueueItem;
export interface BlockerDetail extends BlockerSummary {
  companyId: string;
  branchId: string;
  branchName: string;
  departureId: string;
  bookingReference: string;
  scheduledAt: string;
  vehicle: string | null;
}
