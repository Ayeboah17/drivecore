import type { SearchResultGroups } from "../../features/search/models";
import type { NotificationResult } from "../../features/notifications/models";
import type {
  DepartureDetail,
  BlockerDetail,
} from "../../features/operations/models";
import type {
  DashboardSummary,
  DepartureQueueItem,
  ReturnQueueItem,
  DepartureQueueInput,
  ReturnQueueInput,
} from "../../features/dashboard/models";
import type { PageResult } from "./models";
import type { CompanyMembership, ResolvedContext } from "../context/types";
// Frontend view-model interface. This is not an HTTP API or a Laravel contract.
export interface DriveCoreDataSource {
  readonly referenceTime: string;
  search(
    context: ResolvedContext,
    term: string,
    signal?: AbortSignal,
  ): Promise<SearchResultGroups>;
  notifications(
    context: ResolvedContext,
    signal?: AbortSignal,
  ): Promise<NotificationResult>;
  departure(
    context: ResolvedContext,
    id: string,
    signal?: AbortSignal,
  ): Promise<DepartureDetail>;
  blocker(
    context: ResolvedContext,
    id: string,
    signal?: AbortSignal,
  ): Promise<BlockerDetail>;
  dashboardSummary(
    context: ResolvedContext,
    signal?: AbortSignal,
  ): Promise<DashboardSummary>;
  departures(
    context: ResolvedContext,
    input: DepartureQueueInput,
    signal?: AbortSignal,
  ): Promise<PageResult<DepartureQueueItem>>;
  returns(
    context: ResolvedContext,
    input: ReturnQueueInput,
    signal?: AbortSignal,
  ): Promise<PageResult<ReturnQueueItem>>;
  directory(signal?: AbortSignal): Promise<CompanyMembership[]>;
  resolveContext(
    companyId: string,
    branchId: string,
    signal?: AbortSignal,
  ): Promise<ResolvedContext>;
}
