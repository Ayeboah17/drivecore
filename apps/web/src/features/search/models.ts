export interface SearchResult {
  id: string;
  kind: "navigation" | "departure" | "blocker";
  title: string;
  description: string;
  href: string;
  planned?: boolean;
}
export interface SearchResultGroups {
  navigation: SearchResult[];
  departures: SearchResult[];
  blockers: SearchResult[];
  totals: { navigation: number; departures: number; blockers: number };
}
