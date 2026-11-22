# DriveCore ERP — Live Integration Comparison & Milestone Roadmap

> **Purpose:** Grounded engineering comparison between the current **`drivecore-backend`** Laravel API (`routes/api.php` & database schema), the **`drivecore-frontend`** Live workspace (`/companies/*`), and the client-side **ERP Prototype Demo** (`/demo/erp`), followed by sequenced **Live Integration Milestones (M5–M10)** and exact backend contract extensions required—including recent feature additions (`vehicles.daily_rate`, `vehicles.functions[]`, `driver` user management, multi-vehicle quotations with discount threshold approval & VAT, PDF generation, Messaging & Chat Center, and Dashboard KPIs/infographics).
>
> **Backend Source Constraint:** `drivecore-backend` was inspected **read-only**. Zero backend files were modified; all required backend migrations, endpoints, FormRequests, and permissions are specified below for the backend developer.

---

## 1. Current State Comparison Matrix (Backend vs. Live UI vs. Demo ERP)

| Domain / Capability | `drivecore-backend` (Verified State) | `drivecore-frontend` Live Mode (`/companies/*`) | `drivecore-frontend` ERP Demo (`/demo/erp`) | Primary Integration Gap |
| :--- | :--- | :--- | :--- | :--- |
| **Auth & Session** | Sanctum SPA cookie (`web` guard) + PAT (`POST /auth/tokens`), `GET /auth/me`, `POST /auth/logout` | Implemented (`login`, BFF proxy cookie stripping, `useSession`) | Simulated account switcher (`user-platform`, `user-operations`, `user-finance`, `user-driver`, `user-viewer`, branch user) | Ready for Live |
| **Users & Roles** | `POST /api/v1/users` (`users.manage`), Spatie roles seeded: `company-admin`, `operations`, `viewer`, `driver` (`[]` permissions) | Not wired in Live UI (`Administration` shows `Planned`); `create-user` absent from BFF allowlist | Full Users & Roles CRUD; includes `Driver` (`role-driver` / `user-driver`) with dispatch permissions | Missing `GET/PATCH /api/v1/users` & role listing; `driver` role needs explicit permissions in `RolePermissionSeeder` |
| **Companies & Branches** | `GET/POST /api/v1/companies` (platform admin create), `GET/POST /api/v1/branches` (unique `(company_id, name)`), `CompanyAccess::scope` | Implemented (`CompaniesPage`, `BranchSetup`, `CreateCompanyDialog`) with animated setup & `DriveCoreSelect` | Full Company, Branch & Settings (`VAT rate (%)`, `Discount approval threshold (%)`) | No `PATCH` company/branch, no Company Settings API (VAT / discount threshold), partial branch-directory gaps |
| **Customers** | `GET/POST /api/v1/customers`, `GET/PATCH /customers/{id}` (`name`, `type`, `email`, `phone`) | Detail + Create + Edit (`DriveCoreSelect` for `type`, ZOD validated) | Full table + Search + Filter + KYC + linked rentals/invoices/statements | `GET /customers` lacks `company_id`/`branch_id` isolation filters, search `q`, `type` filter, `DELETE` |
| **Vehicles (Fleet)** | `GET/POST /vehicles`, `GET/PATCH /vehicles/{id}` (`registration`, `make`, `model`, `year`, `odometer`, `status` [`available`/`maintenance`/`damaged`; `rented` system-controlled]) | Detail + Create + Edit (omits `odometer` until unit confirmed); uses shared `DriveCoreSelect` | Full table + `dailyRate` + `functions[]` tags (`GPS Tracker`, `Automatic`, `4x4 / AWD`, `A/C`, `Chauffeur Eligible`, etc.) + `Vehicle 360` + ROI | `GET /vehicles` lacks scoped filter/search; `odometer` unit undecided; **`daily_rate` & `functions[]` absent from schema & `SaveVehicleRequest`** |
| **Reservations & Dispatch** | **Implemented in API**: `GET/POST /reservations`, `GET /reservations/{id}`, `POST /reservations/{id}/cancel` (`AllocateReservation` overlap lock) | **Not wired in Live UI** (`/modules/operations` & `/modules/rentals` show `Planned`; blocked in BFF `allowedPath`) | Full Quotation -> Multi-vehicle Reservation conversion, `Confirm`, `Cancel`, overlap lock | Backend endpoints exist today! Need Live UI + BFF allowlist + scoped `index()` query params |
| **Rentals (Handover / Return)** | **Implemented in API**: `GET/POST /rentals`, `GET /rentals/{id}`, `POST /rentals/{id}/handover`, `POST /rentals/{id}/return` (`TransitionRental`) | **Not wired in Live UI** (`Planned`, blocked in BFF `allowedPath`) | Handover (`DriveCoreDateTimeField`), Extensions (conflict checked), Return -> Inspection + Auto-Invoice | Core lifecycle exists in Laravel! Missing **extension**, **driver assignment**, and **checklist line-items** endpoints |
| **Documents** | **Implemented in API**: `GET/POST /documents` (multipart 10MB `pdf/jpg/png`), `GET /documents/{id}` (streamed download) | **Not wired in Live UI** (blocked in BFF `allowedPath`) | Document metadata CRUD attached to Vehicle/Customer/Contract + expiry warnings | Laravel `documents` table lacks `entity_type`/`entity_id` relation & `expires_at`; BFF needs multipart POST + binary stream support |
| **Quotations, Discount Approval & VAT** | **Not implemented** (no table or endpoints) | `Planned` | **Multi-vehicle `vehicleIds[]`**, pro-rated daily rates, `discountPct` + threshold (`10%`) approval (`pending_approval` -> `Approve discount`), mandatory VAT (`15%`) | Requires new `quotations` + `quotation_items` tables, company settings (`vat_rate_bps`, `discount_approval_threshold_bps`), and approval workflow endpoints |
| **PDF Generation** | **Not implemented** (only raw uploaded file download on `/documents/{id}`) | Not implemented | Client-side `.pdf` builder + branded Preview & Print modal (`DocumentPdfModal`) for Quotes, Reservations, Rentals, Invoices | Server-side PDF endpoint (`GET /api/v1/{domain}/{id}/pdf`) recommended for legal/audit permanence alongside instant preview |
| **Maintenance, Inventory & Procurement** | **Not implemented** | `Planned` | Work Orders, Parts Catalog, Atomic Stock Consumption -> Maintenance Cost, Suppliers, PR -> Approval -> PO Goods Receipt | Requires new backend modules (Milestones M8–M9) |
| **Finance & Accounting (GL)** | **Not implemented** | `Planned` | Draft/Issued Invoices with `VAT payable`, Payments, Refunds, Expenses, AR Ageing (`Current`..`60d+`), Balanced Double-Entry GL batches | Requires authoritative server-side integer minor-unit ledger (Milestone M8) |
| **Messaging & Chat Center** | **Not implemented** (only write-only internal `audit_events`) | Not implemented | Header **Messaging & Chat Center** drawer (`dispatch`, `drivers`, `customers`, `support`), unread badge, record linking | Requires `messages` + `message_reads` tables & notification center APIs |
| **Dashboard KPIs & Infographics** | **Not implemented** | Honest Workspace Context card + Demo link only | Interactive Date Range filter (`DriveCoreDateRangePicker`), 6 KPI cards + `KpiInfographicsBand` (Fleet donut, Revenue/VAT/Expenses bars, Quote-to-Cash funnel) | Requires scoped read-only `GET /api/v1/companies/{id}/dashboard/summary` endpoint |

---

## 2. Immediate Delta Specs Requested for Upcoming Backend Work

These items bridge the newly implemented Demo features (`M4+`) into Laravel contracts when the backend developer schedules them:

### A. Vehicle Pricing & Capability Functions (`vehicles`)
- **Migration:** Add `daily_rate_minor BIGINT UNSIGNED NOT NULL DEFAULT 0` (or agree currency minor units per company) and `functions JSONB NOT NULL DEFAULT '[]'` (PostgreSQL) to `vehicles`.
- **`SaveVehicleRequest` & `RecordResource`:**
  - Validate `daily_rate_minor` (`integer|min:0`) and `functions` (`array`, elements in allowlisted strings or normalized slugs: `gps_tracker`, `automatic`, `awd_4x4`, `air_conditioning`, `chauffeur_eligible`, `bluetooth`, `child_seat`).
  - Expose `odometer_unit` (global company setting or fixed `km`) so Live Vehicle forms can safely re-enable numeric odometer input/display.

### B. User Administration UI & Driver Role (`users`)
- **`RolePermissionSeeder.php`:** Grant `driver` explicit scoped permissions (e.g., `vehicles.view`, `rentals.view`, `rentals.manage` for assigned dispatches, `messages.send`) instead of `[]` so `driver` accounts can sign in cleanly without an empty workspace.
- **`UserController` additions:**
  - `GET /api/v1/users` (scoped by `company_id`, `role`, `is_active`, search `q`; `users.view`).
  - `PATCH /api/v1/users/{id}` (`is_active`, `role`, `branch_id`; prevent self-demotion/self-lockout).

### C. Quotations, Multi-Vehicle Selection, Discount Approval & VAT
- **Company Financial Settings (`company_settings` or columns on `companies`):**
  - `vat_rate_pct` (numeric `0..100`, default `15.00`)
  - `discount_approval_threshold_pct` (numeric `0..100`, default `10.00`)
- **`quotations` & `quotation_vehicle` pivot:**
  - Fields: `company_id`, `branch_id`, `customer_id`, `starts_at`, `ends_at`, `status` (`draft`, `pending_approval`, `sent`, `converted`, `rejected`), `discount_pct`, `discount_status` (`not_required`, `pending`, `approved`, `rejected`), `approved_by`, `approved_at`, `subtotal_minor`, `discount_minor`, `vat_rate_pct`, `vat_minor`, `total_minor`.
  - **Rules:**
    1. All selected `vehicle_ids[]` must belong to the target `(company_id, branch_id)` and have `status = 'available'` with zero reservation overlaps for `[starts_at, ends_at]`.
    2. If `discount_pct > discount_approval_threshold_pct`, force `discount_status = 'pending'` and `status = 'pending_approval'`; block `convert` until a user with `quotations.approve_discount` (e.g., `finance` or `company-admin`) calls `POST /api/v1/quotations/{id}/approve-discount`.
    3. `POST /api/v1/quotations/{id}/convert` atomically creates **one `Reservation` per selected vehicle** inside a single `DB::transaction`.

### D. Authoritative PDF Export
- Add `GET /api/v1/quotations/{id}/pdf` and `GET /api/v1/invoices/{id}/pdf` (and `/rentals/{id}/pdf`) returning `Content-Type: application/pdf`, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff` (using DomPDF/Snappy/Browsershot on the server) alongside the instant client-side preview modal.

### E. Messaging & Chat Center + KPI Summary
- **`messages` (`company_id`, `branch_id` nullable, `channel` [`dispatch|drivers|customers|support`], `sender_id`, `related_type`, `related_id`, `body`):**
  - `GET /api/v1/messages?company_id=...&channel=...`
  - `POST /api/v1/messages` + `POST /api/v1/messages/{id}/read`
- **`GET /api/v1/dashboard/summary?company_id=...&branch_id=...&from=...&to=...`:**
  - Server-aggregated counts (`fleet.available`, `fleet.rented`, `fleet.maintenance`, `fleet.damaged`), active rentals, overdue returns, revenue/VAT/expenses totals (for `finance.view` only), and quote-to-cash funnel counts—never leaking unauthorized modules or cross-company data.

---

## 3. Phased Live Integration Milestones (M5–M10)

### Milestone 5 — Complete Live Directories, Filters & Fleet Attributes *(Unblocks M4 + Adds Functions/Rate/Users UI)*
- **Backend Prerequisites:**
  1. Scoped pagination + search + exact filters on `GET /api/v1/companies`, `branches`, `customers`, `vehicles` (`company_id` required for workspace resources, optional `branch_id`, `q`, `status`/`type`).
  2. Agreed odometer unit (`odometer_unit`), `daily_rate_minor`, and `functions[]` on `vehicles`.
  3. `GET/PATCH /api/v1/users` + `driver` role baseline permissions.
- **Frontend Deliverables:**
  1. Enable validated collection `GET` queries in `backend-proxy.ts` (`allowedPath`).
  2. Wire live searchable/filterable `DataTableFrame` tables for `/customers` and `/vehicles` (reusing unified UI components, pagination, removable filter chips, empty/error states).
  3. Re-enable unit-labeled `Odometer`, plus `Daily rate` and `Functions` multi-select badges in Live `VehicleForm` & `VehicleDetail`.
  4. Build Live `Administration -> Users` view (`Create user` including `Driver` role, search, activate/deactivate).
- **Acceptance Criteria:** Cross-company/branch SQL isolation tests >25 rows; Playwright live tests verifying server search, page navigation, and vehicle `functions[]` + `daily_rate` persistence.

---

### Milestone 6 — Live Operations: Reservations, Rentals, Handover & Return *(Uses Existing Laravel Endpoints + Extensions)*
- **Backend Prerequisites:**
  1. Scoped `GET /api/v1/reservations` & `GET /api/v1/rentals` filtering (`company_id`, `branch_id`, `status`, date window).
  2. `POST /api/v1/rentals/{id}/extend` (checking reservation overlap inside transaction) & nullable `driver_user_id` on rentals.
  3. Document polymorphic attachment (`entity_type`, `entity_id`, `expires_at`) on `/api/v1/documents`.
- **Frontend Deliverables:**
  1. Expand `backend-proxy.ts` allowlist for `reservations`, `rentals`, `handover`/`return`/`extend`, and `documents` (multipart POST + binary download stream).
  2. Build Live **Operations** & **Rentals** workspaces with `DriveCoreDateTimeField` (custom calendar+time modal), `AllocateReservation` conflict handling (`409`/`422`), Handover/Return odometer modals, and uploaded Document attachments/previews.
  3. Wire Operational Dashboard departure/blocker queues (`/departures/[id]`, `/blockers/[id]`) to real Laravel queries instead of planned placeholders.
- **Acceptance Criteria:** Real double-booking concurrency `409` test, handover/return odometer monotonic checks, real PDF/JPG document upload & signed stream download.

---

### Milestone 7 — Multi-Vehicle Quotations, Discount Approvals, VAT & PDF Engine
- **Backend Prerequisites:**
  1. Company financial settings (`vat_rate_pct`, `discount_approval_threshold_pct`).
  2. `quotations` CRUD + multi-vehicle line allocation + `approve-discount` / `reject-discount` + transactional `convert` to `reservations`.
  3. Authoritative PDF generation endpoints for Quotations, Reservations, and Rentals.
- **Frontend Deliverables:**
  1. Build Live Quotation builder (`vehicleIds[]` multi-select checkbox table, automatic subtotal, Discount `%` warning banner when exceeding company threshold, VAT line preview).
  2. Finance/Admin Discount Approval queue + immediate **Generate PDF** preview/download modal right after Quotation creation/conversion.
- **Acceptance Criteria:** Worker cannot `convert` a quote with `discountPct > threshold` until Finance/Admin approves (`403`/`409` verified server-side); single quote with 2+ vehicles atomically creates all linked Reservations.

---

### Milestone 8 — Live Finance, Invoicing, Payments, Refunds & Double-Entry GL
- **Backend Prerequisites:**
  1. `invoices` (auto-generated on rental return with VAT & discount carry-over, immutable once `issued`), `payments`, `refunds` (capped to net paid), `expenses`.
  2. `gl_accounts` + balanced `journal_entries` / `journal_lines` (`SUM(debit) == SUM(credit)`) including `VAT payable` liabilities.
  3. Server PDF endpoint for issued invoices + AR Ageing projection (`Current`, `1–30d`, `31–60d`, `60d+`).
- **Frontend Deliverables:**
  1. Build Live **Finance** module reusing the unified table/detail primitives, Invoice PDF modal, Payment/Refund recording flows, Expense entry, and permission-guarded GL journal viewer.
- **Acceptance Criteria:** Server rejects overpayments (`422`), refunds > receipts (`422`), and unauthenticated/non-finance GL reads (`403`); every financial state transition emits balanced GL entries.

---

### Milestone 9 — Maintenance, Inventory & Procurement Loop
- **Backend Prerequisites:**
  1. `work_orders` + atomic `consume-parts` (`409`/`422` insufficient stock), toggling vehicle status `maintenance <-> available` and writing `maintenance` expense entries.
  2. `parts`, `stock_movements`, `suppliers`, `purchase_orders` (`submit -> approve -> receive` incrementing inventory once).
- **Frontend Deliverables:**
  1. Build Live **Maintenance**, **Inventory**, and **Procurement** modules + `Vehicle 360` live cost/downtime rollup.
- **Acceptance Criteria:** Atomic stock deduction under concurrent checkout; receiving a PO twice returns `409`; maintenance costs reflect immediately in Vehicle ROI.

---

### Milestone 10 — Messaging Center, Live KPI Infographics, Driver App Integration & Hardening
- **Backend Prerequisites:**
  1. `GET /api/v1/dashboard/summary` (aggregated KPI counts + infographics dataset scoped by role/company/branch + date range).
  2. `messages` + `notifications` APIs (branch-scoped channels: `dispatch`, `drivers`, `customers`, `support`; optional WebSocket/Laravel Reverb broadcast or polling).
  3. Read-only `audit_events` endpoint (`audit.view`) + CSV/PDF financial & utilization reports.
- **Frontend Deliverables:**
  1. Connect Live Topbar **Messaging & Chat Center** drawer (`ChatCenterDrawer`) and **Notifications** bell to real backend threads.
  2. Connect Live Dashboard **KPI Cards** and **`KpiInfographicsBand`** (Fleet Composition donut, Revenue/VAT/Costs comparison, Quote-to-Cash funnel) using `DriveCoreDateRangePicker`.
  3. Enable Expo Driver App sync workflows against shared Sanctum tokens & handover/message endpoints.
- **Acceptance Criteria:** End-to-end staging rehearsal with real PostgreSQL, Redis/Horizon workers, S3 storage, dark/light contrast accessibility audit, and load/rate-limit verification.

---

### Milestone 11 — Detailed Stats, Customer/Vehicle Rollups & Advanced Filtering
- **Backend Prerequisites:**
  1. Server-computed entity rollups on `customers` (`total_spent_minor` = `payments - refunds`, `total_invoiced_minor`, `open_ar_minor`, `rental_count`, `avg_rental_value_minor`, `last_rental_at`) and `vehicles` (`revenue_minor`, `expense_minor`, `net_roi_minor`, `utilization_pct`, `rental_count`, `total_km_driven`, `idle_days`), with monetary fields gated behind `invoices.view`.
  2. Multi-facet filtering (`from`/`to` date range, `min_spend_minor`/`max_spend_minor`, `min_rate_minor`/`max_rate_minor`, `functions[]`, `has_open_ar`, `idle_days_min`) and multi-page sorting by computed metrics.
  3. `GET/POST/DELETE /api/v1/saved-filters` (personal & admin-shared saved filter views) plus `GET /api/v1/stats/{customers|vehicles|branches}` with CSV export.
- **Frontend Deliverables:**
  1. Inline KPI rollup strips and sortable metric columns on Customers & Fleet directories and detail pages (monetary metrics gated by `invoices.view`).
  2. Dedicated `Reports → Detailed Stats` workspace with cross-filtering, one-click preset chips (`Top spenders`, `Has open AR`, `Idle > 14d`, `Unpriced`), `SavedFiltersMenu`, and scoped CSV export.
- **Acceptance Criteria:** Multi-page sorting by server-computed customer spend >25 rows; `operations` sees operational stats only with zero monetary leakage; personal vs. company-shared `saved_filters` enforce strict ownership.

---

### Milestone 12 — Authentication, Admin Email Invitations & Account Lifecycle
- **Backend Prerequisites:**
  1. `invitations` table with SHA-256 hashed single-use tokens (72h expiry), `GET/POST /api/v1/invitations`, `resend`, `revoke` (`users.manage`, whole-company — no public self-serve signup), plus public `invitations/preview` and `invitations/accept`.
  2. Public rate-limited `forgot-password` (no account enumeration) & `reset-password` (revokes existing sessions/tokens).
  3. Authenticated `PATCH /api/v1/auth/profile` & `POST /api/v1/auth/change-password` (current password required + optional revoke other sessions), plus `must_change_password` flag for directly created fallback accounts (e.g., field drivers without email).
- **Frontend Deliverables:**
  1. Public `/accept-invite`, `/forgot-password`, and `/reset-password` routes + `"Forgot password?"` link on `/login`.
  2. Primary **Invite user by email** flow + Pending Invitations management in `Administration → Users` (retaining `"Create directly"` fallback with mandatory first-login password change).
  3. Authenticated `/account` Profile & Security page + mandatory password-change gate when `must_change_password = true`. *(2FA/TOTP and SSO/OAuth deferred to post-MVP.)*
- **Acceptance Criteria:** Expired/revoked/used tokens return `410`/`422` with recovery guidance; `must_change_password = true` blocks ERP routes until rotated; forgot-password never reveals email existence.

---

### Milestone 13 — Digital Inspections, Rate Cards, Preventive Maintenance, Tyres/Batteries & Fuel Management (PR #16)
- **Backend Prerequisites:**
  1. `vehicle_inspections` (handover/return checklist, fuel %, damage notes, digital customer acknowledgement, automatic return-vs-handover diff pre-filling extra invoice charges) + optional `company_settings.require_inspection_photos`.
  2. `rate_cards` (daily/weekly/monthly/chauffeur rates, daily km limit, excess km rate, security deposit, late-return charge, fuel policy) + optional attachment to quotations/rentals.
  3. `maintenance_schedules` (preventive km/date intervals, `ok|due_soon|overdue` status) + SRS §8 work-order fields (`work_order_type`, `complaint`, `diagnosis`, `technician_name`, `estimate_minor`, `schedule_id`, inline Quality Release Inspection `release_passed`).
  4. `vehicle_components` (tyre & battery serial/position/warranty logs) + `parts.location` & stock valuation.
  5. `fuel_transactions` (litres, amount, odometer, driver, station, server-computed `L/100km`, `cost/km`, abnormal-consumption alerts, auto-posted linked `fuel` Expense + balanced GL `DR 5000 / CR 1000`) + client-side unit preferences (`L/100km` default, `km/L`, `MPG US/UK`, `km`/`mi`, `L`/`gal`, `kg`/`lb`).
- **Frontend Deliverables:**
  1. Embedded handover/return inspection checklist + live return diff in Rental Handover/Return dialogs (typed signatory + acknowledgement checkbox + canvas-coming-soon prompt).
  2. `Rentals → Rate cards`, `Maintenance → Preventive schedules` & `Fuel log`, `Inventory → Tyres & batteries` + Stock Valuation, and `Administration → Financial settings` Measurement Units card.
- **Acceptance Criteria:** Return diff flags fuel shortage, damage, and excess km; failed work-order release inspection keeps vehicle in `maintenance`; fuel log auto-posts linked Expense & GL; unit conversion works client-side across `L/100km`, `km/L`, `MPG`, `km/mi`, `L/gal`, and `kg/lb`.

---

### Milestone 14 — Credit Control, Unified Approval Engine & Compliance Expiry Hub (PR #17)
- **Scope (SRS §5, §11, §18, §20):** Customer KYC/corporate credit profiles (`credit_limit_minor`, `payment_terms_days`, TIN, automatic credit holds blocking new rentals), collection follow-ups / promises to pay / disputes, Customer Account Statements, Unified Approval Queue & configurable thresholds across all 7 SRS approval types, and Compliance & Document Expiry hub (insurance, roadworthy, licences).

---

### Milestone 15 — Full Accounting: AP/Supplier Invoices, Bank Reconciliation, Fixed Assets & Financial Statements (PR #18)
- **Scope (SRS §4, §12, §15, §16, §24):** Procurement 3-way match (`PO → GRN → Supplier Invoice → Supplier Payment`) + AP Ageing, formal Credit Notes, Cash & Bank Accounts + Bank Reconciliation, Fixed Assets (vehicle acquisition, monthly depreciation, vehicle disposal gain/loss & extended vehicle statuses), and formal P&L, Balance Sheet & Cash Flow statements.

---

### Milestone 16 — SRS Role Expansion, Lead-to-Quote CRM Pipeline & Privileged TOTP 2FA (PR #19)
- **Scope (SRS §3, §6, §25):** Specialized SRS roles (`commercial`, `maintenance-manager`, `mechanic`, `credit-control`), Lead-to-Quote CRM pipeline, and optional TOTP 2FA for privileged users.

---

### Milestone 17 — Printing & Barcode Scanning *(TBD)*
- **Status:** Requirements to be defined via `/grill-me` after Milestone 16.

---

### Milestone 18 — Car Tracker / GPS Telematics API Integration *(Final — TBD)*
- **Status:** Moved to the final milestone until GPS tracker vendor and API documentation are finalized. Will integrate real-time vehicle location, telematics snapshots, geofencing, and alerts via a provider-agnostic backend adapter.
