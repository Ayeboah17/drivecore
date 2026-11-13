import { CommandGroup, CommandItem } from "@/components/ui/command";
import type { SearchResultGroups } from "./models";
export function SearchResults({
  results,
  onSelect,
}: {
  results: SearchResultGroups;
  onSelect: (href: string) => void;
}) {
  return (
    <>
      {(["navigation", "departures", "blockers"] as const).map((key) => {
        const heading =
          key === "navigation"
            ? "Navigation"
            : key === "departures"
              ? "Departures"
              : "Blockers";
        return results[key].length ? (
          <CommandGroup key={key} heading={heading}>
            {results[key].map((item) => (
              <CommandItem
                key={item.id}
                value={`${item.kind}:${item.id}`}
                onSelect={() => onSelect(item.href)}
                className="items-start py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="break-words font-medium">
                      {item.title}
                    </span>
                    {item.planned && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        Planned
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 whitespace-normal text-xs text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </CommandItem>
            ))}
            {results.totals[key] > results[key].length && (
              <p className="px-2 py-2 text-xs text-muted-foreground">
                Showing {results[key].length} of {results.totals[key]} · Refine
                your search
              </p>
            )}
          </CommandGroup>
        ) : null;
      })}
    </>
  );
}
