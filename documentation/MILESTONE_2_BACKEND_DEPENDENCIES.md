# Milestone 2 backend coordination register

All items below are BACKEND CONFIRMATION REQUIRED. No endpoint, response payload, permission matrix, workflow or database policy is defined by the frontend mock implementation.

| Area              | Required decision / contract                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------------------------- |
| Company identity  | Are companies tenants, legal entities, or both? Canonical opaque IDs, memberships and branch ownership          |
| Sessions          | Sanctum setup, identity/session representation, expiry, company switching, re-authentication and logout         |
| Authorization     | Backend capabilities, company/branch/record/action access, revocation and direct URL behavior                   |
| Isolation         | Data scoping, aggregate permissions, prevention of cross-company and unauthorized cross-branch reads            |
| Company directory | Accessible companies and branches, business IANA timezone and stable ordering                                   |
| Dashboard         | Approved counts, source data, date windows, filters, ordering, pagination, freshness and consistency            |
| Operations        | Departure/handover/return fields, lifecycle statuses, readiness, blocker severity and priority                  |
| Relationships     | Vehicle allocation, branch/company ownership, return-to-departure dependency and inspection/document references |
| Safety            | Authoritative release eligibility and transitions; never infer safety from frontend checklist completion        |
| Time              | Operational day boundaries, company vs branch scheduling, DST, lateness and due-soon policy                     |
| Search            | Authorized record search, ranking, scopes, limits/pagination and metadata disclosure                            |
| Notifications     | Generation, sources, unread semantics, delivery, audit, retention and acknowledgement                           |
| Errors            | Authentication expiry, permission denied vs unavailable, safe disclosure, retry and cancellation semantics      |
| Reporting         | Whether cross-company reporting is permitted; no such aggregation is implemented here                           |
| Audits            | Material events and server audit requirements when future transactional workflows exist                         |

## Before any production use

1. Obtain reviewed contracts from the backend owner; do not derive them from fixtures.
2. Implement a real typed adapter and an explicit real-data configuration. Never fall back to fixtures after a request failure.
3. Validate identity/context before displaying scoped content. Enforce all authorization independently on every backend operation.
4. Map backend statuses, ownership, capabilities and errors into frontend view models without inventing missing rules.
5. Replace provisional urgency/priority/readiness annotations with approved authoritative data.
6. Remove or exclude mock fixtures/development controls from the production product.
7. Run actual session/IDOR/cross-company/cross-branch/aggregate/search authorization tests and permission-revocation checks.
8. Test delayed responses, concurrent changes, expiry and recovery against real APIs.

## Current acceptance boundary

Mock-only directory, profiles, access decisions, records, search and notifications validate frontend behavior. They do not implement or prove authentication, authorization, company isolation, security or real operational readiness. No transactional mutations or business audit events exist.
