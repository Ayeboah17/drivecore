import { branchValue, type ResolvedContext } from "../context/types";
export function scopeKey(
  profile: string,
  scenario: string,
  context: ResolvedContext,
) {
  return [
    "scope",
    profile,
    scenario,
    context.company.id,
    branchValue(context.branch),
  ] as const;
}
