"use client";
import { createContext, useContext, useMemo, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/data/query-client";
import { createMockDataSource } from "./data-source";
import { profiles } from "./profiles";
import type { Scenario } from "./scenarios";
interface DevelopmentState {
  profile: (typeof profiles)[string];
  scenario: Scenario;
  setProfile: (id: string) => void;
  setScenario: (id: Scenario) => void;
  source: ReturnType<typeof createMockDataSource>;
}
const DevelopmentContext = createContext<DevelopmentState | null>(null);
export function DevelopmentProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [profileId, setProfileId] = useState("operator");
  const [scenario, setScenarioId] = useState<Scenario>("normal");
  const { source, queryClient } = useMemo(
    () => ({
      source: createMockDataSource(profileId, scenario),
      queryClient: createQueryClient(),
    }),
    [profileId, scenario],
  );
  const reset = () => {
    void queryClient.cancelQueries();
    queryClient.clear();
  };
  return (
    <DevelopmentContext
      value={{
        profile: profiles[profileId],
        scenario,
        source,
        setProfile: (id) => {
          if (!profiles[id]) return;
          reset();
          setProfileId(id);
        },
        setScenario: (id) => {
          reset();
          setScenarioId(id);
        },
      }}
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </DevelopmentContext>
  );
}
export function useDevelopment() {
  const value = useContext(DevelopmentContext);
  if (!value) throw new Error("Development provider missing");
  return value;
}
