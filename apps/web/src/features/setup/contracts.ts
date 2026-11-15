import { z } from "zod";
import { can, type User } from "@/lib/api/contracts";
export const currencyOptions = ["USD", "EUR", "GHC", "ZMW"] as const;
export const defaultCurrency = "GHC";
const name = z.string().trim().min(1, "Enter a name.").max(255);
export const companyInput = z.object({
  name,
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/, "Enter three uppercase currency letters."),
});
export const branchInput = z.object({ name });
export const canCreateCompany = (user: User) => user.is_platform_admin;
export const canCreateBranch = (user: User, companyId: string) =>
  user.is_platform_admin ||
  (can(user, "branches.manage") &&
    user.companies.some(
      (c) => String(c.id) === companyId && c.branch_id === null,
    ));

// A branch-scoped directory cannot establish that the entire company is empty.
export const hasWholeCompanyDirectory = (user: User, companyId: string) =>
  can(user, "branches.view") &&
  (user.is_platform_admin ||
    user.companies.some(
      (company) =>
        String(company.id) === companyId && company.branch_id === null,
    ));
