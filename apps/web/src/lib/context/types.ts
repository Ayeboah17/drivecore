export type BranchScope =
  | { kind: "all" }
  | { kind: "branch"; branchId: string };
export interface Branch {
  id: string;
  name: string;
}
export interface CompanyMembership {
  id: string;
  name: string;
  timezone: string;
  branches: Branch[];
}
export interface MockIdentity {
  id: string;
  name: string;
  profileLabel: string;
  modules: readonly string[];
}
export interface ResolvedContext {
  company: CompanyMembership;
  branch: BranchScope;
}
export function branchValue(branch: BranchScope) {
  return branch.kind === "all" ? "all" : branch.branchId;
}
