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

