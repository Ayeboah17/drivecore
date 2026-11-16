# Interactive ERP demo

## Run

From `apps/web`, run `npm install` if dependencies are absent, then `npm run dev`.
Open `http://localhost:3000/demo/erp` and choose a synthetic account. No API origin,
credentials, Laravel process, or database is needed. The login and company-selection
pages also link to this explicit demo. No failed live request activates it.

The frontend must serve the initial page/assets. After loading, demo reads and
writes use browser storage even when the browser network is offline. This is not
an installable offline application or a promise of offline first-page loading.

## Scope and workflows

All eleven modules have working dataset-backed screens: dashboard, operations,
fleet, customers, rentals, maintenance, inventory, finance, procurement, reports,
and administration. Search, status filters, sorting and pagination operate on the
complete locally scoped demo dataset; they are not live server search.

- Create/edit customers and vehicles, inspect histories, and attach synthetic
  document metadata. Linked records cannot be deleted accidentally.
- Create a quotation, convert to reservation, confirm/assign a vehicle, create a
  contract, hand over, extend, return, issue an invoice and record payments/refunds.
  Overlapping allocations, decreasing odometer readings and unavailable vehicles
  are rejected centrally. Cancelling an eligible reservation releases allocation.
- Start maintenance, consume parts, complete work and see stock, vehicle condition,
  maintenance expense and availability change together.
- Create purchase requests, approve and receive orders; receiving increases stock
  once. Adjustments require a reason and cannot make stock negative.
- Inspect derived reports, balanced illustrative ledger postings, outstanding
  invoices and CSV exports. Mark notifications read and inspect generated audits.
- Manage synthetic users, capability roles, companies, branches and workspace
  settings. Company creation guides users to branch setup on the same workspace.

Dashboard and reports derive their figures from these records. Date filters use
the browser's local calendar. Company currencies are shown separately: there is
no exchange-rate conversion or cross-company monetary aggregation.

## Accounts and permissions

The entry screen and header offer Platform administrator, Company administrator,
Branch manager, Operations staff, Fleet manager, Finance staff and Viewer, plus a
second-company account. No password is used or stored. The platform account has
explicit `*` capability and is not constrained by ordinary membership rows.

Capabilities and membership scopes control navigation, direct URL access, reads
and commands. Role names do not grant permissions. Branch managers have restricted
branch membership. Account switching is intentionally public: this is a product
simulation, not a security boundary. Never enter real personal or financial data.

## Seed, persistence and reset

`src/lib/demo/seed.ts` creates relative-date synthetic records: two companies, four
branches, seven roles, eight users, 36 customers, 32 vehicles, 16 quotations,
28 reservations, 20 contracts, 12 work orders, 20 parts, eight suppliers and
16 purchase orders, plus linked inspections, movements, invoices, receipts,
refunds, expenses, document metadata, notifications and audit records.

Changes persist in IndexedDB database `drivecore-erp-demo-v1`, store `snapshots`,
key `main`. Storage is per browser profile and origin; it is not shared with other
devices. Commands update an entire validated snapshot atomically. Concurrent tabs
serialize writes and broadcast invalidation. The URL owns the selected account,
company, branch, screen and filters; reload/back/forward restore that selection.

Use **Reset demo data** and confirm to restore the seed. Reset is irreversible for
local demo edits. Invalid stored data shows a recovery screen with explicit reset;
it is never silently replaced. Browser storage eviction can also remove data.
There is no automatic migration of older incompatible demo snapshots.

## Architecture and extension

- `src/lib/demo/types.ts`: Zod schemas, typed entities, commands and context.
- `permissions.ts`: capabilities and organization/branch scope.
- `rules.ts`: central, atomic business simulations and validation.
- `repository.ts`: repository interface, IndexedDB implementation and test-only
  memory implementation; asynchronous operations support cancellation.
- `selectors.ts`: derived totals, availability, scoped relationships and ledger.
- `seed.ts`: synthetic, coherent initial graph.
- `src/features/erp-demo`: provider, existing-token shell, reusable forms/tables,
  record detail, dashboard and reports. `config.ts` declares fields and actions.
- `src/app/demo/erp/page.tsx`: public isolated entry, outside live session routing.

To add seed data, use typed entities with valid references, ownership and integer
minor-unit amounts; extend the seed-integrity tests. To add a module, add schemas,
capability mapping and scoped service commands first, then field/table/action
configuration and focused lifecycle tests. Keep invariants out of page components.

The repository interface isolates browser persistence from presentation. A future
Laravel adapter must map actual approved endpoints/resources and preserve server
pagination, scope enforcement and authorization. The demo's extra fields and
commands are not proposed API endpoints. Live code still uses the existing secure
proxy and remains blocked where the backend lacks a safe scoped contract. The
Milestone 2 demo and `/demo/workflow` setup walkthrough remain separate.

## Simulation limits

This is not production authentication, accounting, tax or approval enforcement.
Pricing uses started 24-hour blocks in integer minor units; late returns add
started-day charges and explicit extra charges. Demo distance is explicitly km;
this does not settle the live API's unresolved odometer unit. Taxes, insurance,
depreciation and exchange rates are not simulated.

Refunds include a matching credit; ledger views are illustrative balanced
postings, not certified accounting. Purchase orders are single-line/full-receipt
workflows. Documents are metadata only: no actual uploads, signatures or downloads
of customer documents. There are no real emails, payment processors or background
notifications. Browser time is the simulation clock. Records and account choices
are synthetic and editable locally.

UI uses the established red/charcoal palette and components. Motion is limited to
short composite-property feedback/press states, with reduced-motion support.
No dependencies were added.

## Verification

Build before running browser suites; do not rebuild while test servers use `.next`.

```powershell
npm run lint
npx tsc --noEmit
npm run build
npm run test:unit
npx playwright test -c playwright.demo.config.ts
npm run test:e2e
npm run test:live
```

Prototype tests use port 3102 and IndexedDB synthetic records. They cover seed and
reference integrity, permissions, conflicts, complete rental/finance workflows,
maintenance/stock, procurement, persistence/reset, offline writes, cross-tab
updates, corruption recovery, administration and zero API calls. Smoke tests run
in Chromium, Firefox and WebKit; detailed workflows run in Chromium. These tests
do not verify deployed Laravel authorization or Sanctum configuration.

Prototype screenshots are off by default. Only set
`DRIVECORE_CAPTURE_SCREENSHOTS=1` when explicitly requesting visual artifacts.

### Observed verification — 2026-11-15

- ESLint: passed.
- TypeScript `--noEmit`: passed.
- Next.js production build: passed; `/demo/erp` is included.
- Unit suite: 55 passed.
- Prototype browser suite: 12 passed (detailed Chromium workflows and three-browser smoke).
- Existing Milestone 2 browser regression suite: 16 passed.
- Synthetic live-path browser suite: 36 passed.

No deployed API, production data, backend database tests, migrations or credentials
were used. No dependencies were added. Backend checkout remains unchanged. Work
is on `feat/milestone-4-erp-prototype`, with frontend changes uncommitted and
untracked new files awaiting review; nothing was committed or pushed. Existing
Milestone 4 work was preserved. Further screenshot work was skipped on request.
