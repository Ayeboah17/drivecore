"use client";
import {
  useOrganization,
  useResolvedContext,
} from "@/lib/context/context-provider";
import { branchValue } from "@/lib/context/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
export function ContextSelectors() {
  const { directory, changeCompany, changeBranch } = useOrganization();
  const context = useResolvedContext();
  const companies = directory.map((c) => ({ value: c.id, label: c.name }));
  const branches = [
    { value: "all", label: "All authorized branches" },
    ...context.company.branches.map((b) => ({ value: b.id, label: b.name })),
  ];
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      {companies.length > 1 ? (
        <Select
          items={companies}
          value={context.company.id}
          onValueChange={(id) => {
            if (id) changeCompany(id);
          }}
        >
          <SelectTrigger
            aria-label="Company"
            className="min-w-0 max-w-full flex-1 sm:w-[200px] sm:flex-none"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {companies.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <span className="text-sm font-medium">{context.company.name}</span>
      )}
      <Select
        items={branches}
        value={branchValue(context.branch)}
        onValueChange={(id) => {
          if (id)
            changeBranch(
              id === "all" ? { kind: "all" } : { kind: "branch", branchId: id },
            );
        }}
      >
        <SelectTrigger
          aria-label="Branch"
          className="min-w-0 max-w-full flex-1 sm:w-[220px] sm:flex-none"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {branches.map((b) => (
            <SelectItem key={b.value} value={b.value}>
              {b.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
