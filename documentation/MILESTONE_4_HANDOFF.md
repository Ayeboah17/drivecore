# Milestone 4 — Customer and fleet management

## Delivery status

**Partially implemented; the milestone is not complete.** Customer and vehicle single-record workflows are supported, but safe live directories, their server pagination/search/filtering, and unit-aware odometer entry remain blocked by the inspected backend contract. No unsafe collection workaround was added.

| Requirement | Status |
| --- | --- |
| Customer create/detail/edit | Implemented and tested against the synthetic API; real Laravel staging acceptance outstanding |
| Vehicle create/detail/edit | Implemented for supported fields; rented editing blocked; odometer entry withheld |
| Compact operational directory tables | Blocked: no safe selected-company/branch collection contract |
| Server pagination, search and filters | Blocked: only unselected, membership-wide fixed pagination exists; search/filter parameters are not implemented |
| Loading/error/retry/access states | Implemented for single records and honest unavailable directory states |
| Identity/company/branch isolation and stale-save protection | Preserved and strengthened; synthetic regression coverage |
| Deletes, histories and financial/operational activity | Not implemented; no verified delete contract or history subresources |

## Repository and contract evidence

Frontend inspection started from clean branch `feat/milestone-3-integration`, commit `b106972` (the user's published work was preserved). Backend root is the independent `drivecore-backend` repository, clean on `main`, commit `8e477bb490c307a06bad4c80e8fddd13b5c58479`. It was inspected read-only. No backend commands that mutate configuration, databases, dependencies or generated files were run.

The following sources were checked against each other:

- `routes/api.php`, `CustomerController`, `VehicleController`, `SaveCustomerRequest`, `SaveVehicleRequest`.
- `CompanyAccess`, `RecordPolicy`, `AppServiceProvider`, `Customer`/`Vehicle` models, table migration and `RecordResource`.
- `public/openapi.json`, parent-folder `DriveCore_Frontend_Integration_Guide.md`, backend `tests/Feature/ApiFoundationTest.php`, frontend Milestone 3 handoff and design system.

None of the relevant Milestone 3 blockers is resolved in this checkout:

- Both controller `index()` methods still call `CompanyAccess::scope(...)->orderBy('id')->paginate(25)`, without reading selected-company, selected-branch or search parameters. Membership authorization is not selected-workspace filtering. A platform administrator's base scope includes all companies.
- OpenAPI lists only `page` on the customer/vehicle collection GETs. The integration guide explicitly says search, filters, custom sorting and arbitrary page size are not implemented.
- Directory access still depends on `companies.view`/`branches.view`; profile memberships are not an exhaustive platform-admin directory.
- Odometer is an integer with no distance unit in the model, resource or OpenAPI. The guide explicitly requires agreement on units.
- Existing Laravel tests cover negative customer PATCH authorization and creation, but do not establish successful customer/vehicle updates or the new selected-scope/search contract. No backend tests were executed against an unverified database.

Local source and OpenAPI do not prove what is deployed. No authenticated staging/production requests were made; the health service/version alone cannot establish a deployed Git SHA. Backend owner must provide release provenance and a disposable synthetic staging environment before real integration acceptance.

## Actual supported write and detail contracts

All endpoints are under `/api/v1`; the frontend accesses them only through the existing same-origin allowlisted proxy.

| Operation | Request/behavior |
| --- | --- |
| GET `customers/{id}` | `customers.view`, record policy and membership scope; `{ data: Customer }` |
| POST `customers` | `customers.manage`; required `company_id`, `branch_id`, `name`, `type`; optional nullable `email`, `phone` |
| PATCH `customers/{id}` | `customers.manage`; required `name`, `type` again; optional nullable contact fields; no ownership reassignment |
| GET `vehicles/{id}` | `vehicles.view`, record policy and membership scope; `{ data: Vehicle }` |
| POST `vehicles` | `vehicles.manage`; required `company_id`, `branch_id`, `registration`, `make`, `model`; optional nullable `year`, optional `status` and `odometer` |
| PATCH `vehicles/{id}` | `vehicles.manage`; required `registration`, `make`, `model`; optional `year`, `status`, `odometer`; ownership immutable |

Customer name max 255; types `individual`/`corporate`; email max 255, phone max 50. Registration max 40 and uppercased by Laravel, company-scoped uniqueness; make/model max 100; year 1900–2100. Writable vehicle statuses are `available`, `maintenance`, `damaged`; `rented` is backend-controlled. Laravel rejects rented edits with 409, decreasing odometer with 422, and condition restrictions conflicting with confirmed future reservations with 409. These workflow rules are not reimplemented in React.

Frontend writes include only the supported fields. PATCH payloads omit company/branch ownership. Live vehicle forms now omit odometer entirely: existing readings are preserved, and creation uses the backend migration's default `0`. The UI explains this limitation and does not solicit or display an unlabeled numeric distance. The isolated demo's existing validator remains independent; no live failure activates demo data.

Resources return scalar IDs and timestamps, not nested company/branch objects. Details use actual directory labels where available, otherwise explicit `Branch #ID`/`Company #ID` labels. Contact information is presented without fabricated history. OpenAPI's nullable/generic entity properties are broader than the table/request constraints; the backend owner should tighten response schemas and field-length documentation.

## Frontend changes

- Added modular `RecordDirectory`: a clear unavailable state, permission-aware create action, validated known-ID lookup. It contains no collection query, table with fake rows, fake totals, page-local filtering or disabled pretend search.
- Replaced raw key/value detail dumps with customer contact, vehicle identity/status and record-context panels. Added semantic status badges, timestamp formatting, proper back/cancel/edit actions and rented read-only guidance.
- Added skeleton loading and retryable error states. A failed refresh removes retained detail content from the visible page rather than presenting it as current.
- Strengthened get/save response validation to require the requested record ID as well as company/branch matching.
- Form controls are disabled during submission, client and backend field errors remain accessible, and successful saves remain locked through navigation to prevent repeat writes.
- Mutation invalidation marks only the matching company/domain queries stale, without refetching and replacing the mounted edit form mid-save. Navigation then obtains authoritative detail. A second active/aborted check after invalidation prevents an obsolete mutation from navigating to an old company.
- Detail/edit form keys include record ID and update timestamp. Identity/session-epoch/context query keys, cancellation, cache cleanup, CSRF/cookie handling, proxy allowlist, shell/navigation and Milestone 2 demo are preserved.

Files:

```text
apps/web/src/features/records/directory.tsx       (new)
apps/web/src/features/records/presentation.tsx    (new)
apps/web/src/features/records/page.tsx
apps/web/src/features/records/forms.tsx
apps/web/src/features/records/schemas.ts
apps/web/src/features/records/service.ts
apps/web/tests/live/milestone-4.spec.ts            (new)
apps/web/tests/unit/backend-proxy.spec.ts
apps/web/tests/unit/record-forms.spec.ts
README.md
documentation/MILESTONE_4_HANDOFF.md
documentation/screenshots/milestone-4/*
```

No dependencies, environment variables, API routes, permissions or backend files changed. The proxy continues rejecting customer/vehicle collection GETs, including requests containing proposed scope/search/page parameters.

## Backend-owner work required

### 1. Selected-scope collection contract — blocks both live directories

**Current behavior:** Collection results and totals span all permitted memberships, then paginate. Query-supplied company/branch values are not used.

**Required behavior:** Validate a selected company, intersect it with authenticated membership and branch restrictions, apply selected branch filtering, then search/filter, then paginate/count. “All branches” must mean all accessible branches within that single selected company. A platform admin must also explicitly select the company. Totals and links must not leak other contexts.

**Requested parameters for owner approval, NOT implemented or assumed by frontend:** required positive `company_id`; optional positive `branch_id` (omission could mean all accessible branches in that company); positive `page`. Confirm the exact names and all-branches encoding before implementation. Do not silently ignore invalid/unsupported scope parameters.

**Response requirement:** Keep Laravel's `{ data: [...], links: {...}, meta: {...} }`; define integer `current_page`, `last_page`, `per_page`, `total` and the empty-page/out-of-range behavior. Return records with existing ownership fields. Keep fixed size 25 unless a different contract is explicitly approved. The frontend should build its own same-origin page requests, not blindly follow arbitrary upstream links.

**Permissions/errors:** Require `customers.view`/`vehicles.view`, active Sanctum authentication, membership/branch access on every page. Return the established 401/403/404 authorization responses as appropriate; document consistent handling of inaccessible contexts. Invalid IDs/page/filter values should yield documented 422 field errors; do not downgrade an inaccessible selected branch to all branches. Preserve private/no-store responses and throttling.

**Relevant backend files:** `routes/api.php`, both controllers' `index()`, `CompanyAccess`, `RecordPolicy`, list validation (new Form Requests if the owner chooses), `RecordResource`, `public/openapi.json`, feature tests and integration guide.

**Acceptance tests:** Seed more than 25 records across two companies and multiple branches. Verify each page and total after selected-scope filtering for platform admin without membership rows, whole-company operations user, viewer, branch-restricted user and multiple memberships. Exercise forged company/branch pairs, missing scope, revoked access, disabled account, empty scope, boundary pages and invalid parameters. Cross-company/branch rows and totals must never be returned.

### 2. Search and useful filters — blocks directory search/filtering

**Current behavior:** No controller reads a search or entity-filter value; OpenAPI defines none.

**Required contract:** Owner must define search parameter name, supported customer/vehicle fields, maximum length, normalization/case behavior and literal wildcard semantics. Candidate fields for agreement are customer name/email/phone and vehicle registration/make/model; these are suggestions, not established search rules. Define supported exact filters (for example customer type or vehicle status) and allowed enums. Do not claim that all such filters exist today.

**Response/isolation:** Same paginated response; matching and totals must be computed within authorized selected context before pagination. Unknown filters must fail clearly. Document 422 errors, rate limits and stable ordering. Frontend will not simulate search using a downloaded page or fetch every record.

**Acceptance tests:** Matches beyond page 1, matching/unmatching terms, quotes/wildcards/Unicode, empty/overlong terms, invalid status/type, combinations with scope/page, no matches, and no information leakage from otherwise matching records outside scope. Verify parameter semantics in OpenAPI and staging.

### 3. Odometer distance unit — blocks numeric live odometer display/entry

**Current behavior:** Unitless integer, optional on create/update, database default 0, non-decreasing update check.

**Required decision:** Backend/product owner must confirm the distance unit and whether it is globally fixed or record-specific. Publish that decision in OpenAPI and integration documentation (and a typed unit field only if record-specific units are supported). Clarify whether default 0 represents an actual reading or an unrecorded reading, including the handling of existing data. Do not assume kilometres, miles or perform client conversions.

**Acceptance tests:** Confirm omission preserves an existing reading; exercise successful non-decreasing updates, negative/decreasing rejection, zero/default behavior and rented restrictions. Verify documented units against responses and user-entered values. Once approved, frontend can restore a correctly labelled field without changing Laravel's authority.

### 4. Directory, successful-write coverage and deployment provenance

The Milestone 3 authorized company/branch directory request remains open. Operational creation still requires a real known/assigned branch; platform admins' memberships must not be treated as exhaustive.

Backend owner should add successful customer/vehicle PATCH tests, immutable ownership checks, duplicate-registration checks, rented/reservation conflict tests, and session-security regressions with real CSRF middleware. Publish accurate response schemas, filter semantics, odometer decision and deployed release identifier. Run real integration tests only against a verified disposable database/environment. Frontend synthetic tests are not evidence that deployed Laravel authorization or SQL filtering works.

## Acceptance still outstanding

Milestone 4 cannot be marked complete until the owner delivers the selected-scope/search/unit contracts, corresponding Laravel tests pass in a disposable environment, and an authorized synthetic staging run verifies the real API. Then enable narrowly validated collection GETs in the BFF, implement typed paginated queries/tables and approved search/filter controls, and run cross-context/stale-request browser acceptance against that environment.

The current deliverable intentionally does not include fake tables, mock operational records, delete actions, customer/vehicle histories, charts or financial calculations. Screenshots use synthetic data only. No credentials, production records, commits or pushes were used.

## Observed verification and review

| Check | Observed result |
| --- | --- |
| `npm run lint` | Passed, no warnings/errors |
| `npx tsc --noEmit` | Passed |
| `npm run build` | Passed |
| `npm run test:unit` | 40 passed |
| `npx playwright test -c playwright.live.config.ts` | 36 passed, loopback synthetic API only |
| `npm run test:e2e` | 16 passed, including Firefox/WebKit smoke |
| Focused Milestone 4 suite | 7 passed; expanded vehicle responsive/keyboard capture test also rerun and passed |
| `git diff --check` | Passed; repository CRLF notices only |

The initial focused run passed 15/16 tests; one new test used a label selector that also matched hidden Next.js retained forms. It was corrected to target the visible form. The complete 36-test live suite then passed. Added tests cover exact writable payloads, omitted odometer and preserved existing readings, 422 errors, duplicate-submit guards, conflicts, rented restrictions, no collection requests even with scope/search/page URLs, invalid known IDs, read-only permissions, no fetch for denied edit URLs, stale saves, wrong response IDs, loading/error/retry and cache refresh after writes.

Collection search, server pagination, server-selected filtering and list empty states are **not claimed tested as successful functionality**: their contracts remain absent. Tests instead prove the frontend/proxy do not fetch such collections. Synthetic fixture authorization is not proof of Laravel policy enforcement or deployed server filtering. No backend database test was run.

Fifteen captures are saved in [the screenshot gallery](screenshots/milestone-4/README.md), including customer/fleet details, forms, blocked directories, loading/error/access/conflict/rented states and 390px dark/834px tablet views. Representative captures were visually inspected. Existing unrelated screenshot artifacts regenerated by regression tests were restored to their clean starting versions.

Frontend remains on `feat/milestone-3-integration` with the listed changes uncommitted. Backend remains clean on `main` at the inspected SHA. No commit or push was performed. An authorized user/backend owner must still perform real API acceptance in a disposable synthetic staging environment.
