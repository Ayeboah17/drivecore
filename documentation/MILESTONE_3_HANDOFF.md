# Milestone 3 implementation handoff

Date: 15 November 2026. Frontend branch: `feat/milestone-3-integration`. No commits or pushes authorized.

## Contract and deployment evidence

Frontend started clean on `feat/milestone-2-shell` at `e5be64b`. Backend started clean on `main` at `8e477bb490c307a06bad4c80e8fddd13b5c58479` and remains read-only. The parent-folder integration guide identifies that exact backend commit as the last confirmed deployment. Public health was independently rechecked and returned DriveCore API/v1/up. Health does not expose a revision; current deployed commit parity cannot be independently proved from it. No authenticated production requests were made.

Reviewed: both AGENTS.md files, parent `DriveCore_Frontend_Integration_Guide.md`, parent `MILESTONE_3_BACKEND_REQUESTS.md`, OpenAPI, routes, controllers, Form Requests, resources, membership access/policies, schema and feature tests, plus frontend milestone architecture/design/tests.

## Phase status

| Phase                          | Status                                             | Delivered / remaining                                                                                                                                                                                                                                  |
| ------------------------------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1: authentication/connectivity | Frontend implemented; staging verification pending | Allowlisted proxy, cookie/CSRF flow, login, restore, logout, errors, cross-tab logout and cache cleanup. Actual Laravel browser verification needs a safe environment and owner configuration.                                                         |
| 2: profile/context             | Partial                                            | Real profile, capability checks, membership companies, authorized directory pagination for administrators, branches when permitted, assigned branch IDs, direct URL validation and context isolation. Full operational-user directory remains blocked. |
| 3: shared infrastructure       | Implemented                                        | Typed validated client, error/pagination normalization, identity/session/context query keys, cancellation, invalidation and explicit demo isolation. No fixture fallback.                                                                              |
| 4: customers                   | Partial                                            | Create/detail/edit, form validation/422 mapping, error states, duplicate-submit guard and invalidation. Collection pagination/UI is blocked by missing server scope filters.                                                                           |
| 5: vehicles                    | Partial                                            | Create/detail/edit, writable statuses, duplicate feedback, conflicts, rented editing unavailable, neutral odometer label. Collection pagination/UI is blocked.                                                                                         |
| 6: security/regression         | Partial                                            | Automated frontend synthetic coverage and existing demo regression; real staging/Laravel verification remains outstanding.                                                                                                                             |

Lists do not fetch the first 25 records, fetch every record, filter downloaded records or fabricate totals. The proxy rejects customer/vehicle collection GETs. Forms require an authorized concrete branch. Known record IDs can be opened directly; responses are checked against selected company/branch before entering the query cache. Laravel independently authorizes access.

## Architecture and security review

- Laravel is the only authentication/business authority. No JWT, browser personal-access-token store or Next.js session database.
- Fixed server-side origin, exact method/path allowlist, only validated `page` on directory queries; no arbitrary upstream URL, search or filter parameters.
- Exact configured mutation Origin, required CSRF header, required JSON, 64 KiB bounded request body, 2 MiB bounded JSON response, configurable bounded timeout and abort propagation. Laravel validates CSRF; proxy does not synthesize a token from an unchecked cookie.
- Only configured session and XSRF cookies are forwarded. Multiple Set-Cookie headers are preserved separately; browser cookies are host-only, Path=/, SameSite=Lax; session is HttpOnly and HTTPS cookies are Secure.
- Authenticated responses use private/no-store. Upstream redirects are rejected. Browser Authorization and forwarded-IP headers are not relayed. Internal upstream error messages/HTML are not exposed; 422 field errors are retained as text.
- No automatic write retries or optimistic state changes. A timed-out or canceled write may have committed; refreshing before deliberate retry is required.
- Query identity includes session epoch/user/company/branch/profile access signature. Context/identity changes cancel/remove prior scope. Forms abort on deactivation and ignore obsolete responses. No previous-company placeholderData or persistent record cache.
- Live unresolved identity renders no protected content. A 401 clears identity/cache. A failed logout is reported, not presented as server logout. Disabled-account 403 on profile blocks the workspace.
- Cross-tab logout uses BroadcastChannel with a non-sensitive event only. Supported modern browsers are required for that synchronization; no session data is stored in localStorage.
- Mock modules are loaded only through server-selected explicit demo branches. Live providers/services do not import mock fixtures or identity. Demo cannot be selected when a real API origin is configured.
- Existing CSS tokens/UI primitives remain unchanged. Per-mounted-form IDs avoid duplicate accessible labels in Next.js retained routes.

Residual risks: no stale-write/version or idempotency-key API; globally scoped permissions; deployment host/HTTPS/client-IP throttling configuration unverified. Frontend visibility is not authorization. The backend must continue enforcing every operation.

`npm audit --omit=dev` exited 1 with six findings (two low, four moderate) in the pre-existing shadcn/@shadcn/registry/ts-morph dependency chains: deepmerge prototype poisoning and minimatch denial of service. Compared with the starting lockfile, deepmerge 4.3.1, nested minimatch 10.2.6 and shadcn 4.23.0 are unchanged. No force fix, breaking downgrade or unrelated dependency upgrade was applied. Review these tooling dependencies separately before deployment; this handoff does not claim a clean dependency audit.

## Backend handoff — backend owner only

The full parent-folder request register remains authoritative: `../MILESTONE_3_BACKEND_REQUESTS.md`. This copy provides a repository-contained review reference. No backend edits are part of the frontend task.

### B1 — Selected company/branch filtering before pagination (blocks collection screens)

Current: customer/vehicle controllers apply membership access, then paginate all accessible records at 25 in ID order. No selected-context query contract exists.

Required: owner-defined validated company/branch filters intersected with membership access before count/pagination, including explicit selected scope for administrators and all-accessible-branches within one company. Define omitted/invalid/inaccessible scope behavior and exact parameter names in OpenAPI.

No safe frontend workaround: page-local filtering misses records/totals; fetching every accessible record defeats isolation and scalability. Do not enable collection GETs until the delivered contract is inspected and tested.

Relevant backend files: `app/Http/Controllers/Api/V1/CustomerController.php`, `VehicleController.php`, `app/Support/CompanyAccess.php`, list Form Requests, `public/openapi.json`, feature tests.

Acceptance: synthetic interleaved records across two companies and branches, more than 25 records, all pages/totals, restricted users, administrators, invalid scope and mismatched company/branch. Filter must never broaden access.

### B2 — Authorized directory (blocks complete selectors and some creation)

Current: operations can manage customers/vehicles but lack companies/branches listing permissions. Profile has membership names/IDs and nullable branch restriction, not unrestricted branch catalogues. Admin memberships are not exhaustive.

Required: approved read-only directory via profile enhancement or owner-defined lookup. Supply complete accessible named companies/branches, admin discovery and pagination/revocation behavior without granting management permissions.

No safe workaround: cannot hardcode branches, invent a lookup endpoint or borrow administrator credentials. Current frontend uses actual membership companies, known assigned branch IDs and authorized directory lists only; unrestricted users without lookup cannot choose an unknown branch.

Relevant backend files: `app/Http/Resources/UserResource.php`, company/branch controllers, `CompanyAccess.php`, routes/permission seeder only if owner approves, OpenAPI and feature tests.

Acceptance: operations/viewer/driver/admin, null membership branch, assigned branch, zero memberships, cross-company isolation, directory pagination and revoked membership.

### B3 — Accurate documentation (blocks future contract expansion)

Current: guide confirms limitations; OpenAPI omits explicit CSRF path, strong pagination/query schemas and some implemented lengths/required/nullability details. Customer PATCH includes copied vehicle wording. Guide reports public OpenAPI 403.

Required: synchronize actual scope/directory contract and response constraints; correct copied text; document configurable cookie name; provide stable spec distribution. Public static hosting correction is optional while repository spec is usable.

Relevant files: `public/openapi.json`, `README.md`, guide; deployment static configuration only if owner diagnoses a cause. Acceptance: owner contract review and examples verified against synthetic feature responses. No frontend guess can replace this contract.

### B4 — Backend update/session regression coverage (blocks security signoff)

Current: tests cover creation, access restrictions, token logout and basic session authentication. They do not fully prove browser CSRF/session rotation/logout, successful update cases or selected list filtering.

Required: owner-run successful updates, immutable ownership, required PATCH fields, rented/odometer/status conflicts, permission revocation, actual cookie/CSRF login/logout and filtering/pagination tests.

Relevant files: `tests/Feature/ApiFoundationTest.php` and focused new feature tests; auth/customer/vehicle implementation only if failures identify a defect. Frontend synthetic tests are not a replacement. Run only on explicitly disposable databases.

### B5 — Staging Sanctum/session configuration (blocks staging acceptance)

Owner confirms exact frontend origin, Sanctum stateful host/port, CORS, SESSION_COOKIE, host-only domain/path, lifetime/driver, HttpOnly, Secure and SameSite=Lax. Confirm HTTPS recognition and trusted ingress/client-IP throttles. Do not blindly trust X-Forwarded-* headers.

Relevant files/config: `config/sanctum.php`, `session.php`, `cors.php`, `drivecore.php`, trusted middleware and deployment ingress only if necessary. Environment values remain private on the backend; frontend agent must not change them.

Acceptance: actual synthetic staging browser CSRF/login/restore/logout/expiry, HTTPS cookies, rejected untrusted origin and reasonable per-user/IP throttling. Configuration cannot be proved from source defaults or public liveness.

## Deferred decisions

- No destructive delete/archive API: no controls added.
- No server search/custom sort/page size: no invented parameters or partial search.
- Roles are global: no company-specific role mapping invented.
- Odometer unit unknown: no km/miles label or conversion.
- Company timezone absent: live context has no mock timezone and operational-day dashboard remains unavailable.
- Standalone documents have no customer/vehicle association: no attachment UI or transport added.
- Reservations/rentals/finance/maintenance/inventory and other ERP modules remain outside implementation scope.

## Dependencies

Added `react-hook-form`, `zod`, `@hookform/resolvers`: prescribed form handling, runtime contracts and resolver integration. Existing Query, Base UI and Playwright reused. No new state manager, HTTP library, table engine or permanent formatter dependency. Lockfile includes npm peer/dependency resolution associated with these additions.

## Verification and remaining manual checks

Automated results and the exact changed-file inventory are recorded in the final verification section below after the final run. Initial failures found duplicate form IDs and overly broad browser locators; those were corrected and are not represented as passing runs.

No real credentials, protected production records, Laravel database tests or migrations were used. The synthetic loopback fixture models contract responses; it is not a backend implementation.

Before staging release, the user/backend owner must provide a disposable synthetic environment and configure origins/cookies. The user can then log in interactively. Verify actual Laravel CSRF rejection, cookie rotation, reload restoration, logout/session invalidation, disabled/revoked access, cross-tab logout, update conflicts and HTTPS/throttle behavior. Verify the deployed commit separately with the owner. Do not share an administrator password or attach sensitive browser traces.

## Final verification — 15 November 2026

| Check actually executed | Observed result |
| --- | --- |
| `npm run lint` | Passed, exit 0. |
| `npx tsc --noEmit` | Passed, exit 0. |
| `npm run build` | Passed; Next.js production build with Cache Components and partial prefetching retained. |
| `npm run test:unit` | 33 passed, including existing mock tests and new proxy/contracts/forms. |
| `npm run test:e2e` | 15 existing regression tests passed: Chromium acceptance plus Firefox/WebKit smoke tests. |
| `npx playwright test tests/e2e/live-boundary.spec.ts --project=chromium` | 1 new demo/live resource-boundary test passed after the final route guards. |
| `npm run test:live` | 10 passed against the synthetic loopback API through the production Next proxy. Final run: 28.1 seconds. |
| `git diff --check` | Passed under the repository Git configuration. |
| `npm audit --omit=dev` | Exit 1; six existing low/moderate dependency findings, described above. Not a passing security audit. |
| Backend tests/migrations | Not run; backend remained read-only. |
| Authenticated live/staging tests | Not run; no disposable Laravel environment was available. |

The final code was built before browser verification. Later test locator adjustments target visible controls in Next's retained route content; they do not change application behavior. The live suite disables automatic credential-bearing trace/video/screenshot artifacts. Reviewed the intentionally generated synthetic dark/mobile shell screenshot; the 64px topbar and separate responsive selector strip preserve the established shell proportions. Existing light/dark contrast, keyboard and reduced-motion regression tests passed; this is not a full assistive-technology certification.

Runtime: Node 24.8.0. Next package engine requirement is >=20.9.0.

## Exact frontend changed-file inventory

41 files added or modified, paths relative to the frontend Git root:

```text
README.md
apps/web/.env.example
apps/web/.gitignore
apps/web/README.md
apps/web/package-lock.json
apps/web/package.json
apps/web/playwright.config.ts
apps/web/playwright.live.config.ts
apps/web/src/app/(erp)/companies/[companyId]/blockers/[blockerId]/page.tsx
apps/web/src/app/(erp)/companies/[companyId]/customers/[[...record]]/page.tsx
apps/web/src/app/(erp)/companies/[companyId]/dashboard/page.tsx
apps/web/src/app/(erp)/companies/[companyId]/departures/[departureId]/page.tsx
apps/web/src/app/(erp)/companies/[companyId]/modules/[moduleKey]/page.tsx
apps/web/src/app/(erp)/companies/[companyId]/vehicles/[[...record]]/page.tsx
apps/web/src/app/(erp)/companies/page.tsx
apps/web/src/app/(erp)/layout.tsx
apps/web/src/app/api/backend/[...path]/route.ts
apps/web/src/app/layout.tsx
apps/web/src/app/login/page.tsx
apps/web/src/app/page.tsx
apps/web/src/features/auth/login-form.tsx
apps/web/src/features/auth/session-provider.tsx
apps/web/src/features/live/context.tsx
apps/web/src/features/live/pages.tsx
apps/web/src/features/live/shell.tsx
apps/web/src/features/records/forms.tsx
apps/web/src/features/records/page.tsx
apps/web/src/features/records/service.ts
apps/web/src/lib/api/client.ts
apps/web/src/lib/api/contracts.ts
apps/web/src/lib/server/backend-config.ts
apps/web/src/lib/server/backend-proxy.ts
apps/web/src/lib/server/mode.ts
apps/web/src/mocks/companies-entry.tsx
apps/web/tests/e2e/live-boundary.spec.ts
apps/web/tests/fixtures/api-server.mjs
apps/web/tests/live/integration.spec.ts
apps/web/tests/unit/backend-proxy.spec.ts
apps/web/tests/unit/live-contract.spec.ts
apps/web/tests/unit/record-forms.spec.ts
documentation/MILESTONE_3_HANDOFF.md
```

Outside the Git repositories, the parent `MILESTONE_3_BACKEND_REQUESTS.md` was updated to record frontend authorization/delivery and keep backend requests open. The supplied integration guide was not changed.

## Final Git state

- Frontend branch: `feat/milestone-3-integration`.
- Frontend HEAD remains `e5be64b`; implementation changes are uncommitted and ready for review.
- Backend branch: `main`; HEAD remains `8e477bb`; working tree clean.
- No commit, push, backend edit, migration, database refresh or production-data test was performed.

## Follow-up: company and branch setup

Implemented after explicit user approval, starting from the user's clean frontend HEAD `ebdcd6d` on `feat/milestone-3-integration`. The historical verification and inventory above describe the original milestone delivery; this section records the additional setup work.

- `/companies` now offers company creation only when the real profile has `is_platform_admin: true`. A platform administrator with an empty complete directory sees “No companies registered”; an ordinary account with no memberships sees assignment guidance. Roles or `companies.manage` alone do not unlock company creation.
- Company fields are name (required, maximum 255) and currency (exactly three uppercase letters). The UI does not invent a supported currency catalogue or conversion behavior.
- Successful creation refreshes the authorized directory and opens `/companies/{companyId}/setup?branch=all`.
- Branch setup uses the actual `branches.manage` capability plus whole-company membership (`branch_id: null`), or the platform-administrator bypass. Assigned-branch users cannot open the setup form. The branch's company ID comes from validated context and is not editable in the form.
- Branch creation accepts only name and company ID, maps backend validation errors (including duplicate names), refreshes the directory and offers workspace/customer/vehicle links according to capabilities. Users lacking branch-directory access receive an explicit limitation; no extra permissions or fabricated catalogue are added.
- The proxy now permits POST to the existing companies and branches endpoints. Existing Origin/CSRF/cookie/body/timeout/no-store protections still apply. No update/delete endpoints were added.
- A synchronous submission guard and disabled pending form prevent duplicate writes. Obsolete requests are canceled/ignored. After confirmed creation, a failed directory refresh retains the success and removes the submit form; recovery refreshes only the directory.
- Demo setup URLs show an unavailable state. No real data was created by this task, and the backend repository, configuration and dependencies were not changed.
- README setup instructions were updated. No new dependencies were added. Existing scoped customer/vehicle list blockers and directory-access limitations remain open.

Changed files for this follow-up:

```text
README.md
apps/web/src/features/live/pages.tsx
apps/web/src/features/setup/branch-setup.tsx
apps/web/src/features/setup/contracts.ts
apps/web/src/features/setup/setup-form.tsx
apps/web/src/app/(erp)/companies/[companyId]/setup/page.tsx
apps/web/src/lib/server/backend-proxy.ts
apps/web/tests/fixtures/api-server.mjs
apps/web/tests/live/integration.spec.ts
apps/web/tests/live/setup.spec.ts
apps/web/tests/unit/setup.spec.ts
documentation/MILESTONE_3_HANDOFF.md
```

Automated coverage uses only the loopback synthetic API. It covers an empty platform administrator creating a company, branch and customer; whole-company versus restricted branch permissions; non-admin empty guidance; 422 feedback; duplicate-submit counts; and creation success followed by directory-refresh failure. Real Laravel staging acceptance and deployment parity remain unverified. Light desktop and dark 390px mobile setup screenshots were visually inspected; no horizontal overflow was observed.

Follow-up verification actually executed: `npm run lint` passed; `npx tsc --noEmit` passed; `npm run build` passed; `npm run test:unit` passed (36 tests); `npm run test:e2e` passed (16 tests, including Firefox/WebKit smoke); `npm run test:live` passed (14 synthetic tests). An initial lint finding was fixed without disabling checks; an existing broad link locator was made exact to distinguish the new setup link. Final `git diff --check` passed. Frontend HEAD remains `ebdcd6d`; all follow-up changes are uncommitted. Backend working tree remains clean. No commit or push was performed.

## Follow-up: browser-accessible workflow demo

Added `/demo/workflow`, reachable through explicit links on sign-in, company selection and the session-unavailable state. No login, company membership, backend configuration or environment-mode switch is required. This route is outside the protected ERP layout and is separate from the original Milestone 2 environment-selected operational demo.

The walkthrough demonstrates company → branch → customer → vehicle creation using editable fictional examples, field validation, focus-managed progression, a local record summary and reset. Data exists only in component memory; reload resets it. No cookie, credential, identity, live QueryClient or browser storage is created by the walkthrough. It does not import an API client/session provider or send API requests. Offline progression works after initial loading. Live permissions, validation, uniqueness and business rules remain authoritative outside the demo; no backend workflow or endpoint was added.

Extracted the existing customer/vehicle form schemas to `apps/web/src/features/records/schemas.ts` so both paths reuse the exact same field validators without importing live form handlers into the demo. Existing exports from `forms.tsx` remain compatible. Company/branch validators are likewise reused. No new dependency was added. Links from live screens do not import demo fixtures into live data paths; they navigate to the isolated route. Live errors never switch to demo automatically.

Additional files for the demo:

```text
apps/web/src/app/demo/workflow/page.tsx
apps/web/src/features/workflow-demo/steps.ts
apps/web/src/features/workflow-demo/workflow-demo.tsx
apps/web/src/features/records/schemas.ts
apps/web/tests/live/workflow-demo.spec.ts
```

Updated live sign-in/company/error entry links, record schema imports, README and browser tests alongside these files. Backend code/configuration and production records remain unchanged. The working tree includes the preceding setup work; it was preserved. No commit or push was performed.

Demo verification: production build, lint, TypeScript and 36 unit tests passed. The synthetic live-path browser suite passed all 17 tests, including three new demo tests: API-outage entry, all four validated steps with zero API requests/reload reset, and offline/mobile/reset behavior. All 16 existing browser regression tests passed, including Firefox/WebKit smoke tests. A synthetic dark/mobile screenshot was captured and visually inspected; the layout fits 390px without horizontal overflow. Final diff checks passed. No backend changes, production writes, new dependencies, commits or pushes were made.

## Follow-up: currency selection

Per the user's explicit choice, live company setup and the workflow demo now offer dropdowns containing only USD, EUR, GHC and ZMW, in that order, with GHC selected by default. Shared frontend option/default constants avoid drift. The backend's existing three-uppercase-letter validation remains unchanged; these UI choices do not introduce currency conversion or change existing records. README instructions were updated.

Verified lint, TypeScript, production build and seven focused synthetic setup/demo browser tests. Coverage checks the exact options, GHC default, alternative selection and demo reset on reload. No backend changes, dependencies, live-data writes, commits or pushes.

## Fix: first-sign-in redirect loop

Reviewed the supplied video using address-bar-only crops; it repeatedly alternates between `/companies` and `/login?next=%2Fcompanies`. The original recording was not modified. No credentials or protected production responses were used to diagnose the issue.

Cause: sign-in and the ERP layout each constructed their own `LiveProviders`/QueryClient. After the first anonymous visit to a protected page, Next's retained route tree could preserve that workspace's cached anonymous identity. A successful sign-in updated only the sign-in provider. Returning to the workspace could redirect immediately from cached `null` while its profile request was still running; the sign-in provider, already authenticated, redirected back. A full refresh discarded those competing caches, explaining the observed workaround. Existing helper-based tests masked the bug by performing a fresh `page.goto('/login')` before entering credentials.

Fix:

- Added `apps/web/src/app/(session)/layout.tsx` as the single persistent live session/query-cache owner for sign-in and ERP routes.
- Moved the existing `(erp)` and `login` directories beneath `(session)`; public URLs remain exactly the same. Feature pages and business behavior were preserved. All ten moved tracked ERP files other than the intentionally changed layout were compared with their original content and matched.
- Removed the nested live providers from the ERP and sign-in wrappers. The isolated Milestone 2 demo does not bootstrap live authentication, and `/demo/workflow` remains outside the session group, retaining its no-API-request behavior.
- Treat a cached anonymous identity with an in-flight profile request as unresolved. Protected routing waits for verification rather than redirecting from stale anonymous data.
- Sign-in redirects only when identity is resolved and error-free. Session errors take precedence over retained user data in the sign-in screen.
- Added `apps/web/tests/live/session-navigation.spec.ts`: first visit to a protected workspace, sign in through the automatic redirect without reloading, deliberately hold the subsequent profile request, verify no return to `/login`, then verify logout/re-login with a different permission profile.

The first regression was executed against the old implementation and failed as expected, then passed after the fix. Final observed verification: production build passed, lint passed, TypeScript passed, 36 unit tests passed, all 19 synthetic live-path browser tests passed, and all 16 existing demo/browser regression tests passed (including Firefox/WebKit smoke). Existing user changes and the uploaded video were preserved. The backend repository remains clean/read-only; no dependencies, production data, credentials, commits or pushes were involved. Real staging authentication remains a separate owner/user acceptance check.

The development server may need one restart to recognize the moved route layouts. A refresh after each sign-in is no longer part of the workflow.

## Company workspace selection UI refinement

The `/companies` page now uses a centred responsive maximum-width container, a 64px branded header, “Your workspace” heading, compact secondary create action and real-data workspace cards. Cards show company name/ID and currency only when the directory actually supplies it; no branch counts, access claims or metrics were fabricated. Workspace/branch URLs and the profile/directory contract are unchanged.

Company creation now opens the existing Base UI dialog with the same `SetupForm` submission/validation logic. New optional presentation/pending callbacks remove duplicate card chrome inside the dialog and prevent dismissal during a pending write. Required fields, four currency choices/GHC default, permission checks, duplicate-submit guard, 422 mapping, directory refresh and confirmed-success recovery remain intact. Branch setup keeps its existing panel presentation.

The company-selection header shows the actual authenticated name and derived initials, with a Base UI account menu using the existing authoritative logout action and explicit error recovery. The ERP header outside company selection retains its existing account controls.

At the user's explicit request, the live sidebar/mobile navigation now shows all eleven existing module labels in the same order as the mock workspace. Working customer/fleet destinations remain disabled and labelled Restricted without their actual view permissions. Unsupported modules are labelled Planned and lead only to existing unavailable/planned screens. No new backend endpoint, permission, business logic or data access was enabled. The original mock navigation and demo data paths remain separate.

Main source files for this refinement:

```text
apps/web/src/features/live/pages.tsx
apps/web/src/features/live/shell.tsx
apps/web/src/features/live/workspace-header.tsx
apps/web/src/features/live/create-company-dialog.tsx
apps/web/src/features/live/navigation.tsx
apps/web/src/features/setup/setup-form.tsx
```

Tests: new `tests/live/workspace-selection.spec.ts` and `workspace-visual.spec.ts`; a shared logout helper and existing live test selectors were updated for the new heading, card action names, account menu and dialog entry. Auth/session/context implementations, API contracts, design tokens, UI primitive APIs and dependencies were not changed by this refinement. All pre-existing uncommitted work was preserved.

Before/after and state captures are saved under [screenshots/workspace-selection](screenshots/workspace-selection/README.md), using only synthetic data. Coverage includes 1440px and 1920px desktop, 834px tablet, 390px mobile, both themes, dialog keyboard focus/validation/pending state, menu, empty/loading/error/unauthorized states, and full/restricted live navigation. The capture checks wait for settled theme colours rather than exporting mid-transition images. No credentials or production records were used. No Laravel files were changed; no commit or push was performed.

Final refinement verification: lint, TypeScript and production build passed; 36 unit tests, 25 synthetic live-path browser tests and 16 existing demo/browser regression tests passed. Two test-timing issues found during the first full live run (header readiness and Base UI focus-guard settling) were corrected, their focused tests passed, and the complete live suite was rerun successfully. Staging authentication with a real account was not exercised.


## Approved follow-up: demo dashboard and required branch setup

This supersedes the earlier in-memory, four-step walkthrough description. The user approved the grill-me specification and implementation plan before work began.

### Delivered behavior

- `/demo/workflow` opens a credential-free **Enter demo** screen using a fictional administrator. No Laravel session, API request, personal-access token or live identity is used.
- Demo company and branch setup share a screen. A company needs at least one locally created branch before its dashboard can render, including after refresh and through direct query URLs. Multiple branches can be added before continuing.
- The demo dashboard starts with the created company/branches and zero customers/vehicles. Its counts derive solely from saved demo records. It supports company/branch switching, company/branch creation, customer/vehicle creation and scoped record lists. Other destinations remain Planned; no reservation, rental, finance or operational behavior is fabricated.
- Customer/vehicle forms reuse the existing validators. Branch names and normalized vehicle registrations receive explicitly local duplicate checks. Selecting a record's owning branch preserves entered fields without changing the dashboard context. These demo checks do not replace Laravel rules in live mode.
- Versioned browser storage (`drivecore.workflow-demo.v1`) persists across refresh. Records include explicit company/branch ownership and are validated on read. Corruption, unsupported state or storage failures are explicit; corrupted data is not silently overwritten. Reset requires confirmation, removes only the demo key, and synchronizes other open tabs through storage events. Existing unrelated browser storage and live session cookies/caches are untouched.
- The demo works offline after the page has loaded. It does not install a service worker or promise that an offline first load/reload will work. Browser storage is for fictional data only, not secrets or personal information. Storage events synchronize ordinary changes; local storage is not a transactional multi-user database.
- Live setup displays the saved company alongside branch setup, supports **Create another branch**, and offers **Continue to dashboard**. Company/branch creation actions remain on the live dashboard where existing authorization permits them.
- Live shell routing hides dashboard content and redirects verified branchless companies to setup. The check requires a successful directory load plus company-wide visibility (platform flag or whole-company membership and `branches.view`). Unknown or branch-restricted directories are never treated as proof of zero branches. Existing context errors, backend validation, authorization and partial-success recovery remain intact.

### Files changed for this follow-up

```text
README.md
apps/web/src/app/demo/workflow/page.tsx
apps/web/src/features/workflow-demo/workflow-demo.tsx
apps/web/src/features/workflow-demo/store.ts                 (new)
apps/web/src/features/workflow-demo/step-form.tsx             (extracted form)
apps/web/src/features/workflow-demo/workspace-panels.tsx      (new presentation components)
apps/web/src/features/setup/contracts.ts
apps/web/src/features/setup/branch-setup.tsx
apps/web/src/features/setup/setup-form.tsx
apps/web/src/features/live/shell.tsx
apps/web/src/features/live/pages.tsx
apps/web/tests/live/workflow-demo.spec.ts
apps/web/tests/live/setup.spec.ts
apps/web/tests/unit/setup.spec.ts
documentation/MILESTONE_3_HANDOFF.md
documentation/screenshots/workflow-dashboard/*
../MILESTONE_3_BACKEND_REQUESTS.md                            (directory clarification only)
```

No dependencies, environment variables, API contracts or backend files changed. Existing uncommitted work, session route moves and the Milestone 2 operational demo were preserved. Skills applied: grill-me for the approved specification, frontend-design for the restrained setup/dashboard layout, and vercel-react-best-practices for browser-state subscription, runtime Suspense and component boundaries.

### Remaining live boundary and manual acceptance

The complete organization-directory contract remains a backend-owner dependency, tracked in the parent-folder `MILESTONE_3_BACKEND_REQUESTS.md`. The frontend cannot impose a universal branch-existence requirement on accounts whose directory does not establish it. This is an explicit integration limitation, not a reason to fabricate a directory. Customer/vehicle collection scoping remains blocked in live mode; the complete demo lists are local demo records and do not enable unscoped live collection requests.

Real staging login and company/branch creation were not exercised. The user should perform those checks interactively in an authorized synthetic staging workspace once backend deployment/configuration and directory access are confirmed. No production data, credentials or backend database tests were used. Before/after and responsive captures are in [the screenshot gallery](screenshots/workflow-dashboard/README.md). Nothing was committed or pushed.

### Observed verification

- `npm run lint`: passed with no warnings after removing an unused type import.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed against the final source, including the isolated static demo route with its runtime Suspense boundary.
- `npm run test:unit`: 37 passed.
- `npx playwright test -c playwright.live.config.ts`: 29 passed, using only the loopback synthetic API. Coverage includes the existing auth/proxy/context/resource cases, required live setup and the new persistent demo.
- `npm run test:e2e`: 16 passed, including the existing Firefox/WebKit smoke checks.
- After the final demo icon/mobile-wordmark refinement, the production build, lint and TypeScript passed again, and all six focused workflow-demo browser tests passed with regenerated captures. The final refinement did not change live behavior or the Milestone 2 operational demo.
- `git diff --check`: passed; only repository line-ending notices were emitted. Twelve workflow before/after captures are saved and representative desktop/mobile, setup and form views were visually inspected.

The first production build identified a missing Suspense boundary around runtime search parameters; this was fixed before the successful build. Initial demo tests exposed ambiguous text/implicit-label selectors and a focus expectation that targeted the second control instead of the owning-branch selector; the tests were corrected and rerun. All reported pass totals above were observed, not inferred. Backend working tree remained clean on `main`; frontend remains uncommitted on `feat/milestone-3-integration`.
