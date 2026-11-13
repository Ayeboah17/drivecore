"use client";
import { useQuery } from "@tanstack/react-query";
import { useDevelopment } from "@/mocks/development-provider";
import { useResolvedContext } from "@/lib/context/context-provider";
import { scopeKey } from "@/lib/data/query-keys";
import type { DepartureQueueInput, ReturnQueueInput } from "./models";
export function useDashboardSummary() {
  const context = useResolvedContext();
  const { source, profile, scenario } = useDevelopment();
  return useQuery({
    queryKey: [...scopeKey(profile.id, scenario, context), "summary"],
    queryFn: ({ signal }) => source.dashboardSummary(context, signal),
  });
}
export function useDepartures(input: DepartureQueueInput) {
  const context = useResolvedContext();
  const { source, profile, scenario } = useDevelopment();
  return useQuery({
    queryKey: [...scopeKey(profile.id, scenario, context), "departures", input],
    queryFn: ({ signal }) => source.departures(context, input, signal),
  });
}
export function useReturns(input: ReturnQueueInput) {
  const context = useResolvedContext();
  const { source, profile, scenario } = useDevelopment();
  return useQuery({
    queryKey: [...scopeKey(profile.id, scenario, context), "returns", input],
    queryFn: ({ signal }) => source.returns(context, input, signal),
  });
}
