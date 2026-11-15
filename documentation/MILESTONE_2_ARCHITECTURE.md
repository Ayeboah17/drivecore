# Frontend Milestone 2 architecture

This is a mock-only frontend implementation. See MILESTONE_2_SPECIFICATION.md for the approved baseline and MILESTONE_2_BACKEND_DEPENDENCIES.md for integration work.

## Entry and routing

Run `apps/web`, then open `/companies`. `/` intentionally remains the original starter page. Company and branch scope are URL-owned. `branch=all` means all accessible branches in exactly one company. Context selectors reset pagination; company selection resets branch and returns to the dashboard. Direct inaccessible URLs show safe states rather than selecting a different company.

An `(erp)` server layout composes Suspense and application providers. The shell lives above dynamic company layouts to prevent hidden shell retention during company switches; feature pages are thin server wrappers around focused client features. Cache Components and partial prefetching remain enabled. Dynamic URL readers are below Suspense. There are no new API routes, middleware auth simulation, server actions, or shared server organization caches.

## Ownership and data flow

- `components/ui`: existing Base UI primitives, preserved public APIs.
- `components/layout`: page headers, breadcrumbs, page spacing and state panels.
- `components/shell`: sidebar, topbar, organization selectors, profile and development controls.
- `features/dashboard`: independently queried summaries and reusable queues; explicit controls rather than a generic table engine.
- `features/operations`: read-only departure and blocker pages.
- `features/search` / `features/notifications`: scoped read-only interfaces.
- `lib/context`: URL parsing, preferences, context resolution and navigation coordination.
- `lib/navigation`: one ordered navigation registry, route builders and Planned availability separate from capability filtering.
- `lib/data`: frontend adapter interface, errors, pagination and query infrastructure.
- `mocks`: the only operational fixture imports; deterministic records, access profiles and failure scenarios.

Components obtain a typed data source through providers. The provider explicitly constructs the mock adapter. There is no real-data mode and no automatic fallback. A future Laravel adapter must map approved payloads into frontend view models; components must not consume HTTP responses directly.

## State and cancellation

URL: company, branch, departure filter/sort/search/page, return sort/page, validated dashboard origin.

TanStack Query: directory, context resolution, summaries, queues, details, search and notifications. Each scoped key includes profile, scenario, company, branch, resource and inputs. Explicit switches cancel/remove scoped queries before pushing a transition. A render-time context boundary shows no organization content while URL scope resolves, including browser history. The shell itself persists outside company routes; its scoped subtree remounts for different scope/profile/scenario, discarding any retained prior-company route content; transient panels/search state cannot cross the boundary. The adapter consumes AbortSignal. Ordinary useQuery is used; Suspense only handles Next URL rendering.

Instead of a separate manual activation-counter state machine, native query cancellation plus removal and keyed scoped content prevent old activations from writing into a newly visible scope. Tests exercise A→B→A and delayed requests. No previous-scope placeholderData is used.

Mock profile and scenario are memory-only. Changing them cancels and clears the old QueryClient and constructs a new one, avoiding an identity-sensitive persistent cache. Desktop collapse and last company ID are versioned optional browser preferences; no identity, records or credentials are stored. Explicit URLs always win.

## Mock operational policy

The demo clock is fixed at 2026-11-13T09:00:00Z. Retrieval timestamps are actual and distinct. Companies have explicit IANA zones. Date and time formatting uses Intl, with local-day and daylight-saving tests.

Fixture annotations determine display status, severity, priority and whether an earlier departure is outstanding. They are not lifecycle enums or safety calculations. Dashboard selectors are mock-only: today in company zone; earlier outstanding / next 120 minutes / later today; priority, instant and stable ID. Returned counts are scoped before pagination and unique departures differ from issue totals.

Filters and pages are parsed from the URL. The mock adapter clamps invalid/out-of-range pagination. Detail origin URLs are limited to the same company's same-branch dashboard, with only supported queue parameters retained. No arbitrary redirect target is accepted.

## Interaction and visual decisions

Reuse existing Inter and semantic tokens; branding follows the SRS PDF and DESIGN_SYSTEM.md. No spacing system is introduced. Sidebar 248/72px, topbar 64px, controls 40px/7px. White surfaces, restrained red active state, compact numeric summaries, no charts. Desktop table rows grow for grouped issue text; mobile queues use stacked records, with hidden desktop controls removed from keyboard reach.

Company/branch selectors reuse Base UI Select. Ordinary queue/test controls use labelled native selects. Navigation sheet and search reuse Base UI focus handling. Global search uses cmdk with adapter filtering (`shouldFilter=false`), 200ms debounce, grouped results, explicit state panels and a result cap. Search has no decorative open/close motion. Mobile sheet only transitions transform/translate/opacity, honoring reduced motion. No animated sidebar widths or dashboard entrances.

The search DialogTitle/Description live inside its portalled popup. Notification items are not unread messages; no acknowledgement or persistence exists. Read-only detail pages never show save/assign/approve/release controls. Planned functions map to existing permitted module explanations, not invented child routes.

## Testing

Only two direct packages are added: @tanstack/react-query 5.107.1 and development-only @playwright/test 1.65.0. Unit/adapter tests use Playwright Test without browser fixtures or a web server (`playwright.unit.config.ts`). Browser tests use `playwright.config.ts` against `next start` after a production build. Chromium runs full acceptance; Firefox/WebKit run milestone smoke tests. No extra React DOM test environment is needed.

From apps/web: `npm run test:unit`, `npm run lint`, `npm run build`, `npx tsc --noEmit`, `npm run test:e2e`. First-time browser setup: `npx playwright install chromium firefox webkit`. Reports/screenshots/traces are ignored build artifacts. Tests cover URL validation, mock access, counts, time, pagination, cancellation, planned navigation, details, search, context races, responsive keyboard flows and manual dark/reduced-motion behavior. Screenshots require human/agent visual inspection; these checks are not a full accessibility certification.

## Deliberate limitations

Frontend guards are inspectable simulation, not security. Mock fixtures remain bundled, even in a production Next build of this demonstration. Production deployment requires replacing the adapter, removing development controls/fixture loading, implementing actual authentication/authorization and independently testing isolation. No backend contracts are established by these models.

No live browser/device performance claim is made from automated desktop tests. npm audit findings in the pre-existing shadcn/TypeScript-ESLint dependency chains are tracked separately rather than triggering unrelated dependency upgrades.

## Acceptance coverage

| Approved criteria                                   | Evidence                                                                                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1–5, existing foundation and honest mock boundary   | Preserved-token/starter diff check; font/control assertions and inspected light/dark/mobile screenshots; explicit mock UI and documentation |
| 6–13, organization context and isolation simulation | context.spec.ts, mock-data-source.spec.ts, query-isolation.spec.ts, context-navigation.spec.ts, context-races.spec.ts                       |
| 14–20, navigation and shell                         | navigation.spec.ts, shell.spec.ts, milestone-2.spec.ts, accessibility-responsive.spec.ts                                                    |
| 21–26, queues/counts/time                           | dashboard.spec.ts unit and browser suites; company-time.spec.ts; allocation/priority fixture coherence test                                 |
| 27–31, read-only details                            | operational-details.spec.ts unit and browser suites; validated return-location tests; no mutation methods or controls                       |
| 32–39, search and notifications                     | search.spec.ts, notifications.spec.ts, search-notifications.spec.ts, context-races.spec.ts                                                  |
| 40–42, states and partial failures                  | dashboard.spec.ts, milestone-2.spec.ts, context-navigation.spec.ts, context-races.spec.ts; deterministic scenario controls                  |
| 43–46, interaction/accessibility                    | accessibility-responsive.spec.ts, shell.spec.ts, search-notifications.spec.ts; screenshot inspection; 200% reflow                           |
| 47–49, verification and handoff                     | Unit/browser suites, lint, production build, TypeScript, complete diff review and backend dependency register                               |

Tests use simulated data and access. They do not prove actual backend security. Automated keyboard/reflow/semantic checks and screenshot inspection are not a substitute for a full assistive-technology or real-device audit.

## Reviewed file inventory

Paths are repository-relative. The starter page, global token stylesheet, existing cn utility, Next configuration and TypeScript configuration are unchanged.

```text
apps/web/.gitignore
apps/web/README.md
apps/web/eslint.config.mjs
apps/web/package-lock.json
apps/web/package.json
apps/web/playwright.config.ts
apps/web/playwright.unit.config.ts
apps/web/src/app/(erp)/companies/[companyId]/blockers/[blockerId]/page.tsx
apps/web/src/app/(erp)/companies/[companyId]/dashboard/page.tsx
apps/web/src/app/(erp)/companies/[companyId]/departures/[departureId]/page.tsx
apps/web/src/app/(erp)/companies/[companyId]/error.tsx
apps/web/src/app/(erp)/companies/[companyId]/layout.tsx
apps/web/src/app/(erp)/companies/[companyId]/loading.tsx
apps/web/src/app/(erp)/companies/[companyId]/modules/[moduleKey]/page.tsx
apps/web/src/app/(erp)/companies/page.tsx
apps/web/src/app/(erp)/layout.tsx
apps/web/src/app/layout.tsx
apps/web/src/components/layout/breadcrumbs.tsx
apps/web/src/components/layout/page-header.tsx
apps/web/src/components/layout/page-layout.tsx
apps/web/src/components/layout/state-panel.tsx
apps/web/src/components/providers/application-providers.tsx
apps/web/src/components/shell/application-shell.tsx
apps/web/src/components/shell/context-selectors.tsx
apps/web/src/components/shell/development-controls.tsx
apps/web/src/components/shell/navigation-items.tsx
apps/web/src/components/shell/profile-menu.tsx
apps/web/src/components/shell/sidebar.tsx
apps/web/src/components/shell/topbar.tsx
apps/web/src/components/ui/command.tsx
apps/web/src/components/ui/dialog.tsx
apps/web/src/components/ui/sheet.tsx
apps/web/src/components/ui/skeleton.tsx
apps/web/src/features/dashboard/dashboard-page.tsx
apps/web/src/features/dashboard/departures-queue.tsx
apps/web/src/features/dashboard/models.ts
apps/web/src/features/dashboard/operational-summary.tsx
apps/web/src/features/dashboard/queries.ts
apps/web/src/features/dashboard/queue-controls.tsx
apps/web/src/features/dashboard/queue-url.ts
apps/web/src/features/dashboard/returns-queue.tsx
apps/web/src/features/notifications/models.ts
apps/web/src/features/notifications/notification-panel.tsx
apps/web/src/features/notifications/queries.ts
apps/web/src/features/operations/blocker-detail.tsx
apps/web/src/features/operations/departure-detail.tsx
apps/web/src/features/operations/models.ts
apps/web/src/features/operations/queries.ts
apps/web/src/features/operations/resolution-destination.tsx
apps/web/src/features/planned/planned-module-page.tsx
apps/web/src/features/search/global-search.tsx
apps/web/src/features/search/models.ts
apps/web/src/features/search/queries.ts
apps/web/src/features/search/search-results.tsx
apps/web/src/lib/context/context-provider.tsx
apps/web/src/lib/context/preferences.ts
apps/web/src/lib/context/types.ts
apps/web/src/lib/context/url.ts
apps/web/src/lib/data/data-source.ts
apps/web/src/lib/data/models.ts
apps/web/src/lib/data/query-client.ts
apps/web/src/lib/data/query-keys.ts
apps/web/src/lib/navigation/definitions.ts
apps/web/src/lib/navigation/routes.ts
apps/web/src/lib/time/company-time.ts
apps/web/src/mocks/dashboard-selectors.ts
apps/web/src/mocks/data-source.ts
apps/web/src/mocks/development-provider.tsx
apps/web/src/mocks/fixtures.ts
apps/web/src/mocks/profiles.ts
apps/web/src/mocks/scenarios.ts
apps/web/tests/e2e/accessibility-responsive.spec.ts
apps/web/tests/e2e/context-navigation.spec.ts
apps/web/tests/e2e/context-races.spec.ts
apps/web/tests/e2e/dashboard.spec.ts
apps/web/tests/e2e/milestone-2.spec.ts
apps/web/tests/e2e/operational-details.spec.ts
apps/web/tests/e2e/search-notifications.spec.ts
apps/web/tests/e2e/shell.spec.ts
apps/web/tests/unit/company-time.spec.ts
apps/web/tests/unit/context.spec.ts
apps/web/tests/unit/dashboard.spec.ts
apps/web/tests/unit/mock-data-source.spec.ts
apps/web/tests/unit/navigation.spec.ts
apps/web/tests/unit/notifications.spec.ts
apps/web/tests/unit/operational-details.spec.ts
apps/web/tests/unit/query-isolation.spec.ts
apps/web/tests/unit/search.spec.ts
documentation/MILESTONE_2_ARCHITECTURE.md
documentation/MILESTONE_2_BACKEND_DEPENDENCIES.md
documentation/MILESTONE_2_SPECIFICATION.md
```

## Verification results — 13 November 2026

- `npm run lint`: passed.
- `npm run test:unit`: 17 passed (including Ghana clock/day boundaries).
- `npm run build`: passed with Cache Components and partial prefetching preserved.
- `npx tsc --noEmit`: passed.
- `npm run test:e2e`: 13 passed (11 Chromium acceptance tests, Firefox and WebKit milestone smoke tests).
- `git diff --check`: passed.
- Inspected desktop light, desktop dark and 390px mobile screenshots; verified 200% reflow, keyboard focus, portalled dark dialogs and reduced-motion sheet behavior.
- Confirmed starter `src/app/page.tsx`, `src/app/globals.css`, `src/lib/utils.ts`, Next configuration and TypeScript configuration have no changes.
- The only package additions are the approved React Query runtime and Playwright Test development dependency. No formatter dependency was added; formatting used a one-off external CLI.
- npm audit still reports 12 findings (2 low, 10 moderate) through existing shadcn/TypeScript-ESLint chains; no high or critical findings were reported. No unrelated dependency upgrades or downgrades were applied.

Work is on `feat/milestone-2-shell`; no commit was created. Laravel integration, actual authorization/company isolation and production operational definitions remain unimplemented by design. Real assistive-technology and physical-device performance certification remain outside this verification.

## Ghana demo localization

The demo companies are fictional Akwaaba Vehicle Rental (`akwaaba`: Accra Airport / `accra`, Kumasi Central / `kumasi`) and Sankofa Mobility (`sankofa`: Tema Harbour / `tema`, Takoradi Depot / `takoradi`). All use `Africa/Accra` and the interface formats dates/times using `en-GH`. Mock names are Kwame Mensah, Ama Owusu and Kofi Asante. Booking prefixes are AKW/SNK; vehicle identifiers explicitly start with DEMO-GH and are not real registration numbers. The fixed 09:00 UTC demo clock is 09:00 in the Ghana fixtures. Counts, access scenarios, cross-company boundaries and provisional operational states remain unchanged.

All route, profile, record and search test references use the Ghana fixtures. Generic foreign-timezone/DST unit inputs are retained to test the shared timezone utility, alongside Ghana midnight and year-round clock checks. These foreign-timezone test inputs are not displayed demo data. No finance widgets, currency rules, backend contracts or real Ghanaian customer information are added.
