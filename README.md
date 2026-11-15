# DriveCore frontend

Next.js web ERP foundation with Laravel Sanctum session integration. The frontend and Laravel backend are independent repositories. Laravel owns authentication, authorization, validation, organization access and business rules.

## Current delivery boundary

- Real login, CSRF initialization, profile restoration, logout and cross-tab logout.
- Permission-aware company workspace and branch selection where the authenticated contract supplies enough information.
- Customer and vehicle creation, authorized detail lookup and editing.
- Customer/vehicle collection pages deliberately unavailable: the current backend cannot filter by selected company/branch before pagination. No unscoped collection is downloaded, no fake totals are displayed, and there are no delete controls.
- Dashboard operations, search and notifications show honest unavailable states in live mode. Documents and other ERP workflows are deferred.
- The completed Milestone 2 mock workspace remains an explicitly selected, isolated demo. A failed live request never activates it.

See [Milestone 3 handoff](documentation/MILESTONE_3_HANDOFF.md) for phase status, backend owner requests, verification and limitations. [Design system](documentation/DESIGN_SYSTEM.md) defines the authoritative red/charcoal branding.

## Run locally

Use a supported Node.js runtime and npm. The installed Next.js package requires Node >=20.9.0; verification used Node 24.8.0. The lockfile is authoritative for package versions.

```powershell
cd apps/web
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Edit `.env.local` with your disposable local API origin and actual Laravel session-cookie name. Open `http://localhost:3000`. `/` opens `/companies`; anonymous visitors are sent to `/login`.

Do not point automated tests at production. No administrator credentials or API tokens are needed in frontend configuration. The user enters their credentials interactively into the login page; do not put them into files, logs, screenshots or environment variables.

## Environment

All variables below are server-only. Never prefix them with `NEXT_PUBLIC_`.

| Variable                        | Required  | Meaning                                                                                                   |
| ------------------------------- | --------- | --------------------------------------------------------------------------------------------------------- |
| `DRIVECORE_API_ORIGIN`          | Live mode | Fixed Laravel origin, no API prefix/path/query/userinfo. HTTPS except loopback-only development.          |
| `DRIVECORE_APP_ORIGIN`          | Live mode | Exact browser-facing origin, including local port. Mutation Origin must match. HTTPS for staging.         |
| `DRIVECORE_SESSION_COOKIE_NAME` | Live mode | Exact backend `SESSION_COOKIE` value; no guess based on the app name.                                     |
| `DRIVECORE_API_TIMEOUT_MS`      | Optional  | 100–30000 ms; default 15000.                                                                              |
| `DRIVECORE_MODE`                | Optional  | Defaults to live behavior. `demo` is honored only when API origin is unset. Never enable demo in staging. |

The proxy exposes only `/api/backend/...` and maps approved paths to Laravel. It forwards only the session and XSRF cookies, strips cookie Domain attributes, uses Path=/ and SameSite=Lax, and enforces HttpOnly on the session cookie. HTTPS frontend origins receive Secure cookies. HTTP is accepted only for localhost/loopback development.

Backend owner must configure the actual frontend host/port in Sanctum stateful domains, explicit CORS origins, host-only session cookies, secure staging cookies and correct HTTPS recognition. Do not change backend configuration from this repository. Requests fail closed with 503 when frontend configuration is absent or invalid.

This is a Node-hosted Next.js app, not a static export. Keep authenticated proxy traffic out of CDN caches. No cookie jar, service token or second session store exists in Next.js. Client IP forwarding is deliberately omitted; the backend owner must review trusted ingress and throttle behavior before staging release.

## Verify

From `apps/web`:

```powershell
npm run lint
npx tsc --noEmit
npm run build
npm run test:unit
npm run test:e2e
npm run test:live
```

Install browsers once if needed: `npx playwright install chromium firefox webkit`.

- Unit tests cover existing mock logic and new proxy/contracts.
- `test:e2e` runs existing Milestone 2 regression tests on a separate explicit demo server at port 3100.
- `test:live` starts the production Next server at port 3101 and a loopback-only synthetic contract server at port 3201. It does not start Laravel or access production. These tests prove frontend behavior, not deployed Sanctum configuration or Laravel correctness.
- Build first. Avoid running a build while browser tests use that build. Test server ports must be free. Browser traces, videos and automatic screenshots are disabled for the live suite. Its explicitly generated visual-QA screenshot contains synthetic data only.
- No backend migrations or database-refresh tests are part of these commands.

## Isolated development demo

In a separate PowerShell session, remove any configured API origin and explicitly select demo mode:

```powershell
$env:DRIVECORE_MODE = 'demo'
$env:DRIVECORE_API_ORIGIN = ''
npm run dev
```

If `.env.local` configures an API origin, remove that setting for this isolated session. Demo is conspicuously labelled and is not authenticated ERP functionality. Restore live mode before real integration work.

## Code map

- `apps/web/src/app`: App Router pages and allowlisted proxy Route Handler.
- `src/features/auth`: live session lifecycle and login.
- `src/features/live`: real organization context and shell.
- `src/features/records`: customer/vehicle services, schemas, forms and pages.
- `src/lib/api`: validated response contracts, transport and safe errors.
- `src/lib/server`: proxy policy and explicit demo-mode boundary.
- `src/components/ui`: established Base UI/shadcn primitives; preserve their public APIs.
- `src/mocks`, existing dashboard/search/operations features: isolated Milestone 2 demo.
- `tests/unit`, `tests/e2e`, `tests/live`: unit, demo regression and synthetic live-path tests.

Reuse the existing tokens, Inter, spacing, focus styles and red/charcoal themes. Do not infer permissions from job titles or add unsupported endpoints. Report backend dependencies to the backend owner; do not edit that repository.
