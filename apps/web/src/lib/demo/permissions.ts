import {
  entities,
  find,
  DemoError,
  type Database,
  type DemoContext,
  type Entity,
  type Kind,
} from "./types";
export const modules = [
  "dashboard",
  "operations",
  "fleet",
  "customers",
  "rentals",
  "maintenance",
  "inventory",
  "finance",
  "procurement",
  "reports",
  "administration",
] as const;
export type Module = (typeof modules)[number];
export const kindModule: Record<Kind, Module> = {
  company: "administration",
  branch: "administration",
  role: "administration",
  user: "administration",
  setting: "administration",
  audit: "administration",
  customer: "customers",
  vehicle: "fleet",
  inspection: "operations",
  quotation: "rentals",
  reservation: "rentals",
  rental: "rentals",
  workOrder: "maintenance",
  part: "inventory",
  movement: "inventory",
  supplier: "procurement",
  purchaseOrder: "procurement",
  invoice: "finance",
  payment: "finance",
  refund: "finance",
  expense: "finance",
  document: "fleet",
  notification: "dashboard",
  message: "dashboard",
};
export function actor(db: Database, ctx: DemoContext) {
  const user = find(db, "user", ctx.userId);
  if (!user.active)
    throw new DemoError("This demo account is inactive. Switch accounts.");
  return user;
}
export function capabilities(db: Database, ctx: DemoContext) {
  return find(db, "role", actor(db, ctx).roleId).permissions;
}
export function allowed(
  db: Database,
  ctx: DemoContext,
  module: Module,
  write = false,
) {
  try {
    const p = capabilities(db, ctx);
    return (
      p.includes("*") || p.includes(`${module}.${write ? "write" : "read"}`)
    );
  } catch {
    return false;
  }
}
export function authorizedContext(db: Database, ctx: DemoContext) {
  const user = actor(db, ctx),
    p = capabilities(db, ctx);
  find(db, "company", ctx.companyId);
  if (!p.includes("*") && !user.companyIds.includes(ctx.companyId))
    throw new DemoError("This demo account cannot access that company.");
  if (ctx.branchId !== "all") {
    const b = find(db, "branch", ctx.branchId);
    if (
      b.companyId !== ctx.companyId ||
      (!p.includes("*") &&
        user.branchIds.length &&
        !user.branchIds.includes(b.id))
    )
      throw new DemoError("This demo account cannot access that branch.");
  }
  return user;
}
export function inScope(db: Database, ctx: DemoContext, e: Entity) {
  const u = actor(db, ctx),
    platform = capabilities(db, ctx).includes("*");
  if (e.kind === "role") return true;
  if (e.kind === "company") return e.id === ctx.companyId;
  if (e.kind === "user")
    return (
      e.companyIds.includes(ctx.companyId) ||
      find(db, "role", e.roleId).permissions.includes("*")
    );
  return (
    e.companyId === ctx.companyId &&
    (ctx.branchId === "all" || !e.branchId || e.branchId === ctx.branchId) &&
    (platform ||
      !u.branchIds.length ||
      !e.branchId ||
      u.branchIds.includes(e.branchId))
  );
}
export function scoped<K extends Kind>(
  db: Database,
  ctx: DemoContext,
  kind: K,
) {
  authorizedContext(db, ctx);
  if (!allowed(db, ctx, kindModule[kind]))
    throw new DemoError("Your demo role cannot view this module.");
  return entities(db, kind).filter((e) => inScope(db, ctx, e));
}
export function assertWrite(
  db: Database,
  ctx: DemoContext,
  kind: Kind,
  e?: Entity,
) {
  authorizedContext(db, ctx);
  if (!allowed(db, ctx, kindModule[kind], true) || (e && !inScope(db, ctx, e)))
    throw new DemoError(
      "Your demo role cannot perform this action in this workspace.",
    );
}
export function companyOptions(db: Database, userId: string) {
  const u = find(db, "user", userId),
    p = find(db, "role", u.roleId).permissions;
  return entities(db, "company").filter(
    (c) => p.includes("*") || u.companyIds.includes(c.id),
  );
}
export function branchOptions(db: Database, ctx: DemoContext) {
  const u = actor(db, ctx),
    p = capabilities(db, ctx);
  return entities(db, "branch").filter(
    (b) =>
      b.companyId === ctx.companyId &&
      (p.includes("*") || !u.branchIds.length || u.branchIds.includes(b.id)),
  );
}
