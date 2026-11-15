# DriveCore frontend Milestone 2 — approved baseline

Status: approved requirements baseline. This frontend milestone is distinct from the master roadmap's M2 fleet/maintenance delivery phase.

Labels: CONFIRMED = agreed requirement; RECOMMENDED = approved frontend implementation choice; UNRESOLVED = deferred business decision; BACKEND CONFIRMATION REQUIRED = backend-owner dependency.

## 1. Feature objective

CONFIRMED: Establish the reusable ERP shell, URL organizational context, permission-aware navigation, operational dashboard, read-only detail navigation, global search and shared page/state patterns.

CONFIRMED: Acceptance demonstrates frontend behavior using explicitly labelled deterministic mocks. It does not establish production authentication, authorization, tenancy or security.

## 2. Problem being solved

CONFIRMED: Operational staff must identify and investigate departures that may not leave on time. Departures and handovers are primary; returns are secondary because they affect later work.

CONFIRMED: Surface missing allocations, unavailable allocated vehicles, outstanding cleaning/inspection/maintenance/documentation, imminent handovers, and preparation awaiting final confirmation. Prioritize urgency and impact rather than task counts.

RECOMMENDED: Categories do not form an absolute sort order independent of departure time. One departure row groups individually clickable blockers; counts distinguish affected departures and individual issues. Never infer vehicle safety or release eligibility.

## 3. Confirmed requirements and scope

CONFIRMED: Inter, Tailwind 4 CSS-first tokens, Base UI, light-default theme and manual dark infrastructure are retained. Sidebar is 248px expanded / 72px collapsed; topbar is 64px; standard controls are 40px with 7px corners.

CONFIRMED: Include all permitted navigation groups, functional dashboard and departure/blocker details, Planned explanations, mock organizational context and access profiles, replaceable typed data access, global search and explicit UI states.

CONFIRMED out of scope: real authentication/authorization/tenant isolation; actual Laravel integration; cross-company reporting; company or branch management; separate departure/return list pages; return details; saving, assignment, approval, release, confirmation, status changes; financial calculations; full future modules; configurable dashboards; fake account settings/sign-out; additional styling libraries.

## 4. User roles and permissions

CONFIRMED: Operational staff are the initial audience. Job titles do not define permissions. Simulated capabilities control presentation only.

RECOMMENDED: Development controls, separate from the product profile menu, demonstrate multi-company access, restricted branch/record/module access, no access, and access loss. Mock identity is in memory; it is not a login system.

BACKEND CONFIRMATION REQUIRED: Identity/session representation, memberships, branch access, capabilities, record permissions, access-loss handling and re-authentication on context switches.

## 5. User journeys

CONFIRMED: Open scoped dashboard; review departures/blockers; open a read-only detail; inspect the intended resolution destination; return to the original queue with company, branch and queue state preserved.

CONFIRMED: URLs are authoritative. Company is in the path; branch is explicit, including `branch=all` for all authorized branches within the selected company. Preferences only supply an initial landing context.

CONFIRMED: Company switching resets branch to all, immediately clears prior-company content, cancels pending requests and prevents stale responses. Compatible module navigation preserves context. Never mix company records, counts, searches or financial information.

RECOMMENDED: Company switching lands on the destination dashboard. Branch changes preserve compatible planned-module pages, otherwise land on the dashboard and reset pagination. Inaccessible explicit URLs show safe denied/unavailable states rather than silently choosing a different company.

CONFIRMED: Record ownership is explicit and separate from aggregate branch filtering.

## 6. Screens and UI interactions

### Shell and navigation

CONFIRMED navigation order: Dashboard, Operations, Fleet, Customers, Rentals, Maintenance, Inventory, Finance, Procurement, Reports, Administration. No child hierarchy is defined in AGENTS.md; invent no submenus.

CONFIRMED: Dashboard is implemented; Operations and all other modules are Planned. Availability is independent of permission. Restricted destinations are hidden; permitted planned destinations remain visible with a Planned label and open a concise explanation, not imitation module screens. Definitions are centralized.

RECOMMENDED: Desktop sidebar is expanded at >=1280px, collapsed at 1024–1279px and replaced by a modal sheet below 1024px. Persist a desktop collapse preference; close mobile navigation after selection. Show icon/label/Planned status and active non-color indication, with accessible tooltips when collapsed. Details retain Dashboard as their active navigation context.

CONFIRMED: Persistent company/branch controls, global search, notifications, profile menu and breadcrumbs. Company selector appears for multiple accessible companies; one-company users see the company name. Branch selection is scoped to that company. Narrow layouts use a context strip below the 64px topbar.

RECOMMENDED: White semantic surfaces, subtle borders, restrained primary emphasis, shared headers, a main landmark, skip link and persistent mock identification. No unnecessary gradients, decorative charts, or large statistics. Shell dimensions and type come from existing tokens.

### Dashboard

CONFIRMED: Departures and Returns queues exist only on the dashboard, with reusable queue components for future dedicated list pages. One departure row contains all its individually clickable blockers.

RECOMMENDED: Header with company-local day/timezone, fixed mock clock and retrieval metadata; four compact summaries (departures today, departures with blockers plus issue count, due-soon departures, returns today); primary departures; secondary returns. Counts describe scope rather than visible pagination and categories need not be exclusive.

CONFIRMED: Company business timezone defines today; show it explicitly. Due soon is the next 120 minutes for this mock milestone, pending operational confirmation.

RECOMMENDED mock ordering: outstanding earlier departures, then departures in the next 120 minutes, then the rest of today; within a band, fixture priority, scheduled instant, stable ID. Do not infer completion/readiness from time. Due-soon window intersects the company-local dashboard day.

RECOMMENDED: Departure filters for all/blocked/due-soon/outstanding earlier, booking/registration search, priority/time sorting, accessible pagination of 10 items. Returns sort by scheduled time, with reverse-time option. Return-to-departure links are supplied fixture relationships, not availability predictions.

### Details and planned destinations

CONFIRMED: Full read-only departure details show booking reference, scheduled departure, company, assigned branch, optional allocated vehicle, provisional operational status, issues and intended resolution destinations.

CONFIRMED: Blocker details explain issue, mock severity, affected departure/vehicle, branch context and intended resolution destination. Use synthetic deterministic records. Real field/status/severity/relationship/action definitions require backend confirmation.

RECOMMENDED: Full pages support direct links, refresh and history. Validate same-company/same-branch dashboard return locations. Unknown or out-of-scope records disclose no detail metadata. For unimplemented Vehicle Inspection/Booking Management, explain the function and use the existing Operations/Rentals Planned destination rather than inventing routes.

### Search, notifications and profile

CONFIRMED: Search all permitted navigation, including labelled Planned entries, and only mock departures/blockers with functional details. Results respect company/branch scope and show useful booking, vehicle, time, branch and issue information. No future-module record search. Open functional destinations on selection. Clear stale input/results on context changes. Include loading, initial-empty, no-results and error states behind a replaceable interface.

RECOMMENDED: Group navigation/departures/blockers; limit to five results per group with an explanation; debounce record search 200ms. Support arrows, Enter, Escape, Ctrl/Cmd+K, composition-safe keyboard handling, focus trapping/restoration. Frequent search opening has no decorative animation.

RECOMMENDED: Read-only scoped mock notifications link only to functional departure/blocker details. No invented unread state, delivery, acknowledgements or preferences. Profile identifies the mock development user without fake account operations.

### Accessibility and responsive behavior

RECOMMENDED: Keyboard-operable controls, text alongside status colors, semantic headings/landmarks, accessible icon names, no hover-only information, explicit record/blocker links rather than nested row actions, restrained status announcements, readable mobile queue presentation, local table scrolling only where necessary, and reduced-motion support. Verify 200% zoom and narrow reflow. Keep focus visible and avoid animated layout dimensions.

## 7. Data requirements and ownership

CONFIRMED: Typed frontend models and a data-access layer isolate fixtures from components. Do not represent them as Laravel contracts.

RECOMMENDED: Frontend models for identity, company membership/timezone, branches/context resolution, summaries, departures, returns, blockers, paginated results, search and notifications. Use coherent synthetic organizations/vehicles/references, at least two companies and multiple branches, multiple blockers on a departure, missing allocation, preparation pending confirmation, and explicitly recorded return dependencies.

RECOMMENDED: Fixed mock reference instant 2026-11-13T09:00:00Z, always labelled demo time; ISO instants formatted using company timezone. Retrieval timestamps are separate and actual. Test local midnight and DST. Fixture priority/status/severity are provisional display annotations, never authoritative business states.

## 8. API requirements and backend dependencies

CONFIRMED: No Laravel endpoints, payloads, database policies, or authentication infrastructure are invented.

RECOMMENDED frontend routes:

- `/companies` application entry, preserving the starter `/` page.
- `/companies/{companyId}/dashboard?branch=all|{branchId}`.
- `/companies/{companyId}/departures/{departureId}?branch=…`.
- `/companies/{companyId}/blockers/{blockerId}?branch=…`.
- `/companies/{companyId}/modules/{moduleKey}?branch=…`.

RECOMMENDED: TanStack Query manages asynchronous data; URL owns company/branch/filter/sort/page state. Scope keys include profile, scenario, company, branch, resource and inputs. No previous-context placeholders. Abort signals propagate into adapters. A render-time context gate also handles browser Back/Forward; explicit switches cancel/remove scoped queries before navigation. No server-global organization cache or persistent record cache.

RECOMMENDED: Use server route/layout composition with focused client context/interaction/query boundaries under Suspense, preserving Cache Components and partial prefetching. No generic plugin framework, mock REST server or redundant state library.

BACKEND CONFIRMATION REQUIRED: tenant/legal-entity interpretation; canonical IDs/ownership; session/membership/capabilities; branch/record/aggregate authorization; re-authentication; dashboard field/count/state/priority contracts; time/day rules; search, notifications, freshness, concurrency and error/disclosure semantics; whether cross-company reporting is permitted.

## 9. Validation and error handling

RECOMMENDED: Validate URL identifiers, module keys, supported filters/sorts/pages and return URLs. Canonicalize omitted branch scope. Explicit inaccessible scope never silently changes organization.

CONFIRMED: Show loading, empty, no-results, request failure/retry, denied, unavailable and Planned states. No-access users get an organizational-access empty state.

RECOMMENDED: Summary and queues load independently. One failed queue leaves others usable. Failure is not zero. Same-scope refresh failure may retain explicitly stale data with timestamp/retry; cross-scope changes must clear it. Cancellation is not a user-facing failure. Read-only navigation needs no success toast.

## 10. Edge cases

RECOMMENDED: Test rapid A→B→A switching, late/out-of-order responses, profile/access changes, refreshed/bookmarked URLs, browser history, wrong-company/branch records, no accessible company, one-company users, missing allocation/registration, multiple blockers, long strings, partial failure, empty final page after filter changes, search errors and stale terms, timezone/day/DST boundaries. Reset pagination on context/filter changes and clamp out-of-range pages.

## 11. Security and authorization

CONFIRMED: All access behavior is simulation. Bundled fixtures are inspectable and contain no real information. No credentials/secrets are stored or logged. Frontend visibility is not security.

RECOMMENDED: Use the same simulated source for route/data/search/navigation scope; validate internal links; clear profile-sensitive caches; keep business records and identity out of persistent storage. Explicit mock adapter selection must never become silent fallback after a future real API error.

BACKEND CONFIRMATION REQUIRED: Every real operation must independently enforce company, branch, record and action authorization.

## 12. Audit and notifications

CONFIRMED: No transactional operations means no fabricated business audit trail. Mock notifications are read-only. Production generation, read/delivery/audit/retention behavior requires backend confirmation.

## 13. Dependencies

CONFIRMED: Keep Next.js App Router, React, strict TypeScript, Tailwind 4, Inter, Base UI, Lucide and existing token-aware cn.

RECOMMENDED approved additions: @tanstack/react-query 5.107.1 runtime; @playwright/test 1.65.0 development only. Browser and pure logic suites use one test runner. No charts, date library, auth library, Zustand, mock HTTP service or extra styling library.

RECOMMENDED: Installed design/composition/performance/motion skills are advisory; project constraints win. Avoid plugin frameworks, speculative widgets, boolean-heavy page APIs or business rules in components.

## 14. Deferred decisions and assumptions

RECOMMENDED: Desktop-first with full mobile access; full-page details; root starter page unchanged; manual dark support without new toggle; company switches land on dashboard; fixed demo clock; no return details; no fake settings/sign-out or unread notifications.

UNRESOLVED beyond this milestone: production statuses/transitions, urgency/priority/readiness/turnaround policy, handover confirmation, final permission matrix, role-specific dashboards, future list pages, cross-company reporting and personalization. These do not block the frontend mock specification.

## 15. Acceptance criteria

1. CONFIRMED: Preserve Inter, Tailwind 4, Base UI and design tokens.
2. CONFIRMED: Standard controls 40px/7px; compact and square icon variants preserved.
3. CONFIRMED: No transactional operations or imitation module screens.
4. CONFIRMED: Mock identity/data clearly identified.
5. RECOMMENDED: Synthetic deterministic records only.
6. CONFIRMED: Scoped routes explicitly encode company and branch.
7. CONFIRMED: All means only accessible branches within that company.
8. CONFIRMED: Company switch resets branch to all.
9. CONFIRMED: Explicit URL overrides preferences.
10. CONFIRMED: Immediately remove prior-company content.
11. CONFIRMED: Late responses cannot repopulate prior scope.
12. CONFIRMED: Safe denied/unavailable explicit URLs.
13. RECOMMENDED: Regression test rapid A→B→A switching.
14. CONFIRMED: Required navigation order.
15. CONFIRMED: Restricted hidden; permitted Planned visible.
16. CONFIRMED: Operations remains Planned.
17. RECOMMENDED: Sidebar 248/72px at default root size.
18. RECOMMENDED: Accessible mobile sheet, selection close and focus restoration.
19. RECOMMENDED: Context visible at supported widths.
20. RECOMMENDED: Correct active states on details/Planned pages.
21. CONFIRMED: Departures primary; returns secondary.
22. CONFIRMED: One row per departure.
23. CONFIRMED: Grouped individually navigable blockers.
24. CONFIRMED: Distinct departure and issue counts.
25. CONFIRMED: Company timezone and provisional 120-minute window.
26. RECOMMENDED: Stable ordering against fixed mock clock.
27. CONFIRMED: Agreed detail fields when available.
28. CONFIRMED: Honest Planned resolution destinations.
29. CONFIRMED: Return to originating queue/context.
30. RECOMMENDED: Preserve filters/sort/pages/history.
31. CONFIRMED: No safety inference or status changes.
32. CONFIRMED: Search only permitted destinations and functional departure/blocker records.
33. CONFIRMED: Label Planned search results.
34. CONFIRMED: Scope search by company/branch.
35. CONFIRMED: Clear stale searches on context change.
36. CONFIRMED: Loading, initial-empty and no-results.
37. RECOMMENDED: Search errors support retry.
38. RECOMMENDED: Valid scoped search/notification links.
39. RECOMMENDED: Keyboard opening/selection/dismissal/focus restoration.
40. CONFIRMED: Demonstrable loading/empty/failure/unavailable/denied states.
41. RECOMMENDED: Independent partial dashboard failures.
42. RECOMMENDED: Failure counts are not zero.
43. RECOMMENDED: Keyboard access to essential actions.
44. RECOMMENDED: Meaning available without color.
45. RECOMMENDED: Narrow/zoom layouts keep shell controls accessible.
46. RECOMMENDED: Manual dark mode includes portals.
47. RECOMMENDED: Tests cover context, access filtering, ordering, search and late responses.
48. CONFIRMED: Lint, build and TypeScript pass.
49. CONFIRMED: Review final changes and document backend limitations.

## 16. Implementation phases

1. Context/routing/typed mock boundary and test infrastructure.
2. Shared shell, navigation, selectors, Planned pages and page/state composition.
3. Operational dashboard, time, sorting/filtering/pagination, independent states.
4. Read-only details and safe queue-return navigation.
5. Global search and scoped read-only notifications.
6. Context-race/browser/accessibility/visual review, documentation and final checks.

CONFIRMED: Inspect changes and run relevant checks after each phase; fix regressions before continuing. No commits are authorized.

## Approved brand alignment

The SRS PDF is authoritative for visual branding. The previous blue primary is superseded by red #D71920, charcoal #28323A, muted grey #65727A and white #FFFFFF. See [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) for light/dark adaptations and independent semantic statuses. Typography, dimensions and application behaviour are unchanged.
