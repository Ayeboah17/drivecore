"use client";
import { useQuery } from "@tanstack/react-query";
import { useDevelopment } from "@/mocks/development-provider";
import { useResolvedContext } from "@/lib/context/context-provider";
import { scopeKey } from "@/lib/data/query-keys";
export function useNotifications(open: boolean) {
  const context = useResolvedContext();
  const { source, profile, scenario } = useDevelopment();
  return useQuery({
    queryKey: [...scopeKey(profile.id, scenario, context), "notifications"],
    queryFn: ({ signal }) => source.notifications(context, signal),
    enabled: open,
  });
}
