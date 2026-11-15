"use client";
import { useDevelopment } from "@/mocks/development-provider";
import { profileOptions } from "@/mocks/profiles";
import { scenarioOptions, type Scenario } from "@/mocks/scenarios";
export function DevelopmentControls() {
  const { profile, scenario, setProfile, setScenario } = useDevelopment();
  return (
    <details className="border-t bg-muted/50 px-page py-3 text-xs">
      <summary className="w-fit cursor-pointer rounded-sm text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring">
        Development controls · simulated access
      </summary>
      <div className="mt-3 flex flex-wrap gap-4">
        <label className="flex flex-col gap-1">
          Mock access profile
          <select
            aria-label="Mock access profile"
            className="h-control max-w-full rounded-control border border-input bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
            value={profile.id}
            onChange={(e) => setProfile(e.target.value)}
          >
            {profileOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Mock scenario
          <select
            aria-label="Mock scenario"
            className="h-control max-w-full rounded-control border border-input bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
            value={scenario}
            onChange={(e) => setScenario(e.target.value as Scenario)}
          >
            {scenarioOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <p className="max-w-md self-end text-muted-foreground">
          Synthetic data and frontend-only access simulation. No real
          authentication, authorization or company isolation.
        </p>
      </div>
    </details>
  );
}
