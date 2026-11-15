# Milestone 4 — customer and fleet screens

These captures use fictional records from the loopback synthetic API, never production data. The blocked directory screenshots intentionally show no rows, fake totals, search or pagination controls. Safe live directory tables cannot be completed until the backend adds selected-company/branch filtering before pagination.

| Screen | Capture |
| --- | --- |
| Customer directory boundary | [Customers](customers-directory-blocked-light.png) |
| Fleet directory boundary | [Fleet](vehicles-directory-blocked-light.png) |
| Customer detail | [Light](customer-detail-light.png), [390px dark](customer-detail-390-dark.png) |
| Customer editing | [Form](customer-edit-light.png) |
| Customer loading | [Loading](customer-loading-light.png) |
| Customer API failure/retry | [Error](customer-error-light.png) |
| Customer action without permission | [Denied](customer-access-denied-light.png) |
| Vehicle creation | [Form](vehicle-create-light.png) |
| Vehicle detail | [Light](vehicle-detail-light.png), [834px tablet](vehicle-detail-834-light.png), [390px dark](vehicle-detail-390-dark.png) |
| Vehicle editing, mobile | [390px dark](vehicle-edit-390-dark.png) |
| Vehicle conflict | [Conflict](vehicle-conflict-light.png) |
| Rented vehicle, read-only | [Rented](vehicle-rented-light.png) |

The customer/vehicle pages preserve the established DriveCore shell, tokens and Inter. Odometer values are withheld until units are agreed; synthetic record/model names are merely test fixtures. Browser-local record timestamps may differ across runs. Screenshots disable animations and use fictional identities; no credentials, cookies or tokens appear.

Regenerate from `apps/web` after a production build:

```powershell
npx playwright test -c playwright.live.config.ts tests/live/milestone-4.spec.ts
```

The suite verifies customer/vehicle writes, validation/conflict handling, no collection requests, denied actions, stale saves, response identity validation, retry, mobile/tablet overflow and keyboard form focus. It does not verify deployed Laravel authorization, server-side list search/pagination, or full assistive-technology conformance.
