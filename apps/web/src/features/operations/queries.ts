"use client";
import { useQuery } from "@tanstack/react-query";
import { useDevelopment } from "@/mocks/development-provider";
import { useResolvedContext } from "@/lib/context/context-provider";
import { scopeKey } from "@/lib/data/query-keys";
export function useDeparture(id: string) {
  const context = useResolvedContext();
  const { source, profile, scenario } = useDevelopment();
  return useQuery({
    queryKey: [...scopeKey(profile.id, scenario, context), "departure", id],
    queryFn: ({ signal }) => source.departure(context, id, signal),
  });
}
export function useBlocker(id: string) {
  const context = useResolvedContext();
  const { source, profile, scenario } = useDevelopment();
  return useQuery({
    queryKey: [...scopeKey(profile.id, scenario, context), "blocker", id],
    queryFn: ({ signal }) => source.blocker(context, id, signal),
  });
}
