import { permittedNavigation } from "../lib/navigation/definitions";
import { modulePath, recordPath } from "../lib/navigation/routes";
import { formatTime } from "../lib/time/company-time";
import type { SearchResult } from "../features/search/models";
import { today, selectDepartures, selectReturns } from "./dashboard-selectors";
import { isDueSoon } from "../lib/time/company-time";
import type { ResolvedContext } from "../lib/context/types";
import type { DriveCoreDataSource } from "../lib/data/data-source";
import { DataAccessError } from "../lib/data/models";
import { companies, departures, returns, mockNow } from "./fixtures";
import { profiles } from "./profiles";
import { waitForMock, type Scenario } from "./scenarios";
export function createMockDataSource(
  profileId: string,
  scenario: Scenario,
): DriveCoreDataSource {
  const profile = profiles[profileId];
  if (!profile)
    throw new DataAccessError("denied", "Unknown development profile");
  const directory = async (signal?: AbortSignal) => {
    await waitForMock(signal);
    return companies
      .filter((c) => profile.access[c.id] && scenario !== "access-lost")
      .map((c) => ({
        ...c,
        branches: c.branches.filter((b) => profile.access[c.id].includes(b.id)),
      }));
  };
  const scoped = async (context: ResolvedContext, signal?: AbortSignal) => {
    const branch =
      context.branch.kind === "all" ? "all" : context.branch.branchId;
    const validated = await source.resolveContext(
      context.company.id,
      branch,
      signal,
    );
    if (!profile.modules.includes("dashboard"))
      throw new DataAccessError(
        "denied",
        "Dashboard access is not simulated for this profile.",
      );
    await waitForMock(signal, scenario === "slow" ? 1200 : 0);
    const visible = <
      T extends { companyId: string; branchId: string; id: string },
    >(
      items: T[],
    ) =>
      scenario === "empty"
        ? []
        : items.filter(
            (i) =>
              i.companyId === validated.company.id &&
              validated.company.branches.some((b) => b.id === i.branchId) &&
              (branch === "all" || i.branchId === branch) &&
              !profile.hiddenRecords.includes(i.id),
          );
    const ds = today(visible(departures), mockNow, validated.company.timezone);
    const rs = today(visible(returns), mockNow, validated.company.timezone).map(
      (r) =>
        profile.hiddenRecords.includes(r.relatedDepartureId ?? "")
          ? {
              ...r,
              relatedDepartureId: undefined,
              relatedDepartureReference: undefined,
            }
          : r,
    );
    return { ds, rs };
  };
  const calls = new Map<string, number>();
  const failRefresh = (resource: string, context: ResolvedContext) => {
    const key = `${resource}:${context.company.id}:${context.branch.kind === "all" ? "all" : context.branch.branchId}`;
    const count = (calls.get(key) ?? 0) + 1;
    calls.set(key, count);
    if (scenario === "refresh-error" && count > 1)
      throw new DataAccessError("request", "Mock refresh failed");
  };
  const source: DriveCoreDataSource = {
    referenceTime: mockNow,
    directory,
    async search(context, term, signal) {
      const branch =
        context.branch.kind === "all" ? "all" : context.branch.branchId;
      await source.resolveContext(context.company.id, branch, signal);
      await waitForMock(signal, scenario === "slow" ? 1200 : 0);
      if (scenario === "search-error")
        throw new DataAccessError("request", "Mock search failed");
      const query = term.trim().toLowerCase();
      const navigationResults: SearchResult[] = permittedNavigation(
        profile.modules,
      )
        .filter((n) => n.label.toLowerCase().includes(query))
        .map((n) => ({
          id: n.key,
          kind: "navigation",
          title: n.label,
          description:
            n.availability === "planned"
              ? "Planned module · Not yet implemented"
              : "Today's operational queues",
          planned: n.availability === "planned",
          href: modulePath(context, n.key),
        }));
      const departureResults: SearchResult[] = [];
      const blockerResults: SearchResult[] = [];
      if (
        query &&
        profile.modules.includes("dashboard") &&
        scenario !== "unavailable"
      ) {
        const { ds } = await scoped(context, signal);
        for (const departure of ds) {
          const description = `${departure.vehicle ?? "Not allocated"} · ${formatTime(departure.scheduledAt, context.company.timezone)} · ${departure.branchName}`;
          if (
            `${departure.bookingReference} ${description}`
              .toLowerCase()
              .includes(query)
          )
            departureResults.push({
              id: departure.id,
              kind: "departure",
              title: departure.bookingReference,
              description,
              href: recordPath(context, "departures", departure.id),
            });
          for (const blocker of departure.blockers)
            if (
              `${blocker.description} ${departure.bookingReference} ${description}`
                .toLowerCase()
                .includes(query)
            )
              blockerResults.push({
                id: blocker.id,
                kind: "blocker",
                title: blocker.description,
                description: `${departure.bookingReference} · ${description}`,
                href: recordPath(context, "blockers", blocker.id),
              });
        }
      }
      return {
        navigation: navigationResults.slice(0, 5),
        departures: departureResults.slice(0, 5),
        blockers: blockerResults.slice(0, 5),
        totals: {
          navigation: navigationResults.length,
          departures: departureResults.length,
          blockers: blockerResults.length,
        },
      };
    },
    async notifications(context, signal) {
      const { ds } = await scoped(context, signal);
      if (scenario === "search-error")
        throw new DataAccessError("request", "Mock notifications failed");
      return {
        items:
          scenario === "unavailable"
            ? []
            : ds
                .flatMap((departure) =>
                  departure.blockers.map((blocker) => ({
                    id: blocker.id,
                    message: `${departure.bookingReference}: ${blocker.description}`,
                    branchName: departure.branchName,
                    href: recordPath(context, "blockers", blocker.id),
                  })),
                )
                .slice(0, 5),
        retrievedAt: new Date().toISOString(),
      };
    },
    async departure(context, id, signal) {
      const { ds } = await scoped(context, signal);
      const record =
        scenario !== "unavailable" ? ds.find((d) => d.id === id) : undefined;
      if (!record)
        throw new DataAccessError(
          "unavailable",
          "Departure unavailable in this context",
        );
      return record;
    },
    async blocker(context, id, signal) {
      const { ds } = await scoped(context, signal);
      for (const departure of ds) {
        const blocker =
          scenario !== "unavailable"
            ? departure.blockers.find((b) => b.id === id)
            : undefined;
        if (blocker)
          return {
            ...blocker,
            companyId: departure.companyId,
            branchId: departure.branchId,
            branchName: departure.branchName,
            departureId: departure.id,
            bookingReference: departure.bookingReference,
            scheduledAt: departure.scheduledAt,
            vehicle: departure.vehicle,
          };
      }
      throw new DataAccessError(
        "unavailable",
        "Blocker unavailable in this context",
      );
    },
    async dashboardSummary(context, signal) {
      const { ds, rs } = await scoped(context, signal);
      failRefresh("summary", context);
      if (scenario === "departures-error")
        throw new DataAccessError("request", "Summary unavailable");
      return {
        departures: ds.length,
        affectedDepartures: ds.filter((d) => d.blockers.length).length,
        issues: ds.reduce((sum, d) => sum + d.blockers.length, 0),
        dueSoon: ds.filter((d) => isDueSoon(d.scheduledAt, mockNow)).length,
        returns: rs.length,
        retrievedAt: new Date().toISOString(),
        referenceTime: mockNow,
      };
    },
    async departures(context, input, signal) {
      const { ds } = await scoped(context, signal);
      failRefresh("departures", context);
      if (scenario === "departures-error")
        throw new DataAccessError("request", "Departure queue request failed");
      return selectDepartures(ds, input, mockNow);
    },
    async returns(context, input, signal) {
      const { rs } = await scoped(context, signal);
      failRefresh("returns", context);
      if (scenario === "returns-error")
        throw new DataAccessError("request", "Return queue request failed");
      return selectReturns(rs, input);
    },
    async resolveContext(companyId, branchId, signal) {
      const accessible = await directory(signal);
      const company = accessible.find((c) => c.id === companyId);
      if (!company)
        throw new DataAccessError(
          "denied",
          "This company is not available to the simulated profile.",
        );
      if (
        branchId !== "all" &&
        !company.branches.some((b) => b.id === branchId)
      )
        throw new DataAccessError(
          "denied",
          "This branch is not available in the selected company.",
        );
      if (!company.branches.length)
        throw new DataAccessError("unavailable", "No accessible branches.");
      return {
        company,
        branch:
          branchId === "all" ? { kind: "all" } : { kind: "branch", branchId },
      };
    },
  };
  return source;
}
