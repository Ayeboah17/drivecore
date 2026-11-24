# DriveCore ERP — Consolidated Backend Requirements (Milestone 6 Onwards)

> **Single Source of Truth (M6+):** This document consolidates **all** Laravel REST API (`drivecore-backend`) requirements from **Milestone 6** onwards in PR implementation order. It supersedes the standalone `BACKEND_MILESTONE_6_SPEC.md` file.
>
> **Milestone 5 Prerequisite:** Ensure PR #8 (`b2a450e`) plus the small custom vehicle functions validation update in `documentation/BACKEND_CUSTOM_VEHICLE_FUNCTIONS.md` are deployed before PR #9.
>
> **Backend Source Constraint:** `drivecore-backend` was not modified by the frontend repo. Every contract, query parameter, payload, validation rule, concurrency lock, permission, and status code below matches the live Next.js BFF proxy (`apps/web/src/lib/server/backend-proxy.ts`), Zod contracts (`apps/web/src/lib/api/contracts.ts`), and Playwright E2E suite.

---

## Master Quick-Reference Index (M6–M16.5.5)

### A. Endpoint Index

| Milestone | Method | Endpoint | Required Permission / Access | Notes |
| :--- | :--- | :--- | :--- | :--- |
| M6 | `GET` | `/api/v1/reservations` | `reservations.view` | `company_id` required; optional `branch_id`, `status`, `vehicle_id`, `customer_id`, `q`, `page` |
| M6 | `GET/POST` | `/api/v1/rentals` | `rentals.view` or `driver` self-scope / `rentals.manage` | Optional `driver_user_id` on `POST`; `driver` sees only assigned rentals |
| M6 | `POST` | `/api/v1/rentals/{id}/handover` | `rentals.manage` or assigned `driver` | **Anytime** while `draft` + vehicle `available` + reservation `confirmed` (no `starts_at`/`ends_at` hard block) |
| M6/M8 | `POST` | `/api/v1/rentals/{id}/return` | `rentals.manage` or assigned `driver` | Anytime while `active`; optional `extra_charge_minor` & `extra_charge_description`; atomically creates `draft` invoice & returns `invoice_id` |
| M6 | `POST` | `/api/v1/rentals/{id}/extend` | `rentals.manage` | Transactional overlap check against future confirmed reservations (`409`) |
| M6 | `POST` | `/api/v1/rentals/{id}/assign-driver` | `rentals.manage` | Assign/unassign active `driver` user in company/branch scope |
| M6 | `GET/POST` | `/api/v1/documents` | `documents.view`/`documents.manage` or assigned `driver` (`rental` docs) | Polymorphic `entity_type` (`vehicle\|customer\|reservation\|rental\|quotation\|invoice`), `entity_id`, `expires_at`; integer casts on response |
| M6 | `GET` | `/api/v1/documents/{id}` | `documents.view` or assigned `driver` | Binary stream with `nosniff` + `private, no-store` |
| M7 | `GET/PATCH` | `/api/v1/companies/{id}/settings` | `companies.view` (GET) / `settings.manage` (PATCH, whole-company) | `vat_rate_pct` (0–100, default `15.00`), `discount_approval_threshold_pct` (0–100, default `10.00`) |
| M7 | `GET/POST` | `/api/v1/quotations` | `quotations.view` / `quotations.manage` | Multi-vehicle `vehicle_ids[]` (requires `daily_rate_minor > 0`), `discount_pct`, server-computed minor-unit pricing |
| M7 | `GET` | `/api/v1/quotations/{id}` | `quotations.view` | Includes snapshotted `vehicles[]` & converted `reservation_ids[]` |
| M7 | `POST` | `/api/v1/quotations/{id}/approve-discount` | `quotations.approve_discount` | Approves pending discount (`409` if not `pending_approval`) |
| M7 | `POST` | `/api/v1/quotations/{id}/reject-discount` | `quotations.approve_discount` | Rejects pending discount with optional `notes`; quote stays immutable |
| M7 | `POST` | `/api/v1/quotations/{id}/cancel` | `quotations.manage` | Cancels unconverted (`pending_approval` or `approved`) quotation (`409` if converted/rejected/cancelled) |
| M7 | `POST` | `/api/v1/quotations/{id}/convert` | `quotations.manage` + `reservations.manage` | Atomically locks all selected vehicles & creates 1 `Reservation` per vehicle (`409` if unapproved discount or any overlap) |
| M7/M8 | `GET` | `/api/v1/{quotations\|reservations\|rentals\|invoices}/{id}/pdf` | Matching `.view` permission (or assigned `driver` for rentals) | Authoritative PDF export (`Content-Type: application/pdf`, `nosniff`, `private, no-store`, optional `?download=1`) |
| M8 | `GET/POST` | `/api/v1/invoices` | `invoices.view` / `invoices.manage` | Scoped list (`status`, `customer_id`, `rental_id`, `ageing_bucket`, `q`, `sort`, `dir`, `page`); `POST` creates manual `draft` invoice with structured `lines[]` |
| M8 | `GET` | `/api/v1/invoices/ageing` | `invoices.view` | 5-bucket AR Ageing (`Current`, `1–30d`, `31–60d`, `61–90d`, `90+d`) + top customer exposures |
| M8 | `GET/PATCH` | `/api/v1/invoices/{id}` | `invoices.view` / `invoices.manage` | `GET` includes `lines[]`, `payments[]`, `refunds[]`, balances; `PATCH` edits `draft` only (`409` if `issued`/`void`) |
| M8 | `POST` | `/api/v1/invoices/{id}/issue` | `invoices.manage` | Locks `draft` → `issued` (requires `total_minor > 0`), posts balanced GL entry (`DR 1100`, `CR 4000`, `CR 2100`) |
| M8 | `POST` | `/api/v1/invoices/{id}/void` | `invoices.manage` | Voids `draft` or unpaid `issued` invoice (`409` if `paid_minor > 0`); posts reversing GL entry if previously `issued` |
| M8 | `GET/POST` | `/api/v1/payments` & `/api/v1/invoices/{id}/payments` | `invoices.view` / `payments.manage` | Lists payments; `POST` locks invoice row, rejects `amount_minor > outstanding_minor` (`422`), posts GL (`DR 1000`, `CR 1100`) |
| M8 | `GET/POST` | `/api/v1/refunds` & `/api/v1/invoices/{id}/refunds` | `invoices.view` / `payments.manage` | Lists refunds; `POST` locks invoice row, rejects `amount_minor > net_paid_minor` (`422`), requires `reason`, posts GL (`DR 4100`, `CR 1000`) |
| M8 | `GET/POST` | `/api/v1/expenses` | `expenses.view` / `expenses.manage` | Immutable expenses with category (`maintenance\|fuel\|insurance\|tolls_parking\|general`) & optional `vehicle_id`; posts GL (`DR 5000`, `CR 1000`) |
| M8 | `GET` | `/api/v1/gl/accounts` | `gl.view` | Read-only system-seeded Chart of Accounts + scoped Trial Balance (`debit_minor`, `credit_minor`, `balance_minor`) |
| M8 | `GET` | `/api/v1/gl/journal-entries` | `gl.view` | Paginated immutable balanced `JournalEntry` rows with `lines[]` (`account_code`, `source_type`, `q`, `page`) |
| M9 | `GET/POST` | `/api/v1/work-orders` | `work_orders.view` / `work_orders.manage` | Scoped list (`status`, `vehicle_id`, `q`, `sort`, `dir`, `page`); `POST` opens work order (`open`) |
| M9 | `GET` | `/api/v1/work-orders/{id}` | `work_orders.view` | Work order detail including consumed `movements[]` & linked `expense_id` |
| M9 | `POST` | `/api/v1/work-orders/{id}/{start\|consume-parts\|complete\|cancel}` | `work_orders.manage` | Locks vehicle/part rows (`lockForUpdate()`); toggles `vehicle.status`, deducts stock atomically, posts Maintenance Expense & GL |
| M9 | `GET/POST` | `/api/v1/parts` | `parts.view` / `parts.manage` | Spare parts catalogue with server-computed `on_hand` & `is_low_stock` (`low_stock_only`, `q`, `sort`, `dir`, `page`) |
| M9 | `PATCH/POST` | `/api/v1/parts/{id}` & `/api/v1/parts/{id}/adjust` | `parts.manage` | Edit part metadata; `adjust` writes stock movement + GL and rejects negative resulting stock (`422`) |
| M9 | `GET` | `/api/v1/stock-movements` | `parts.view` | Immutable inventory movement ledger (`part_id`, `work_order_id`, `purchase_order_id`, `q`, `sort`, `dir`, `page`) |
| M9 | `GET/POST/PATCH` | `/api/v1/suppliers` & `/api/v1/suppliers/{id}` | `suppliers.view` / `suppliers.manage` | Company-scoped suppliers directory (`is_active`, `q`, `sort`, `dir`, `page`) |
| M9 | `GET/POST` | `/api/v1/purchase-orders` | `purchase_orders.view` / `purchase_orders.manage` | Multi-line POs (`lines[]` per supplier & branch); `status`, `supplier_id`, `q`, `sort`, `dir`, `page` |
| M9 | `GET/PATCH` | `/api/v1/purchase-orders/{id}` | `purchase_orders.view` / `purchase_orders.manage` | PO detail with `lines[]`; `PATCH` edits `draft` only (`409` otherwise) |
| M9 | `POST` | `/api/v1/purchase-orders/{id}/{submit\|approve\|receive\|cancel}` | `purchase_orders.manage` (`approve` requires `purchase_orders.approve`) | `receive` atomically increments stock once (`409` duplicate) & posts GL (`DR 1200 / CR 2000`) |
| M9 | `GET` | `/api/v1/vehicles/{id}/summary` | `vehicles.view` | Live Vehicle 360 rollup (downtime, work orders; financial revenue/cost/ROI populated only when caller holds `invoices.view`) |
| M10 | `GET` | `/api/v1/dashboard/summary` | Authenticated company member | `company_id` required; optional `branch_id`, `from`, `to`; returns role-scoped `fleet`, `pipeline`, `approvals`, and (`invoices.view` only) `finance` totals |
| M10 | `GET/POST` | `/api/v1/messages` & `/api/v1/messages/{id}/read` | `messages.view` / `messages.send` (or `driver` on `drivers` & `dispatch`) | Branch-scoped channels (`dispatch\|drivers\|customers\|support`), unread counts, optional `related_entity_type`/`related_entity_id` |
| M10 | `GET/POST` | `/api/v1/notifications`, `/{id}/read`, `/read-all` | Authenticated company member | Role- and scope-filtered operational/financial alerts with unread count and mark-read actions |
| M10 | `GET` | `/api/v1/reports/financial` | `invoices.view` | Period financial summary + line breakdown (`company_id`, optional `branch_id`, `from`, `to`) |
| M10 | `GET` | `/api/v1/reports/fleet` | `vehicles.view` | Fleet utilization, rentals, maintenance cost & downtime (`revenue_minor`/`net_roi_minor` populated only with `invoices.view`) |
| M10 | `GET` | `/api/v1/audit-events` | `audit.view` (`company-admin` & platform admin only) | Paginated immutable audit log (`company_id`, optional `action`, `entity_type`, `q`, `page`) |
| M11 | `GET` | `/api/v1/customers` & `/api/v1/stats/customers` | `customers.view` (monetary filters/sorts/fields require `invoices.view`) | Multi-facet filtering (`from`, `to`, `type`, `min_spend_minor`, `max_spend_minor`, `has_open_ar`, `include_stats=1`) + multi-page sort (`rental_count`, `total_spent_minor`, `open_ar_minor`, `last_rental_at`); returns `403` if non-`invoices.view` caller sends monetary filter/sort params |
| M11 | `GET` | `/api/v1/customers/{id}/summary` | `customers.view` (monetary fields & invoices require `invoices.view`) | Customer 360 rollup (lifetime spend `payments - refunds`, invoiced, live `open_ar_minor`, rental count, avg rental value, last rental, recent rentals & invoices) |
| M11 | `GET` | `/api/v1/vehicles` & `/api/v1/stats/vehicles` | `vehicles.view` (monetary sorts/fields require `invoices.view`) | Multi-facet filtering (`from`, `to`, `status`, `functions`, `min_rate_minor`, `max_rate_minor`, `idle_days_min`, `unpriced_only`, `include_stats=1`) + multi-page sort (`rental_count`, `utilization_pct`, `idle_days`, `revenue_minor`, `net_roi_minor`) |
| M11 | `GET` | `/api/v1/stats/branches` | `reports.view` (monetary columns require `invoices.view`) | Per-branch comparison rollup (`company_id`, optional `branch_id`, `from`, `to`); branch-restricted users see only their assigned branch |
| M11 | `GET/POST/DELETE` | `/api/v1/saved-filters` & `/api/v1/saved-filters/{id}` | Authenticated company member (`is_shared=true` requires `company-admin` / platform admin) | Personal & company-shared filter views per `module`; omits shared views with `requires_finance=true` when caller lacks `invoices.view`; max 50 per `(company_id, module)` |
| M12 | `GET/POST` | `/api/v1/invitations` & `/{id}/{resend\|revoke}` | `users.manage` (whole-company only) | Admin email invitations with SHA-256 hashed 72h single-use tokens; `resend` rotates & invalidates old token; rejects duplicate same-company member/invite (`422`) |
| M12 | `GET/POST` | `/api/v1/invitations/preview` & `/api/v1/invitations/accept` | Public (rate-limited) | `preview?token=...` returns invite metadata & `account_exists` (`410` expired/revoked/used); `accept` creates new user or verifies existing password for multi-company join, auto-signs in & returns `User` |
| M12 | `POST` | `/api/v1/auth/forgot-password` & `/api/v1/auth/reset-password` | Public (rate-limited) | `forgot-password` always returns identical generic `200` (zero enumeration); `reset-password` enforces `>=10` chars + letters + numbers, clears `must_change_password`, and revokes all active sessions |
| M12 | `PATCH/POST` | `/api/v1/auth/profile` & `/api/v1/auth/change-password` | Authenticated user | `profile` updates `name` only (email read-only); `change-password` requires `current_password`, optional `revoke_other_sessions`, clears `must_change_password`; non-auth routes return `403` while `must_change_password=true` |
| M13 | `GET/POST/PATCH` | `/api/v1/rate-cards` & `/api/v1/rate-cards/{id}` | `rentals.view`/`manage` or `quotations.view`/`manage` | Configurable daily/weekly/monthly/chauffeur rates, daily km limit, excess km rate, security deposit, fuel policy |
| M13 | `GET` | `/api/v1/inspections` & embedded `inspection` on handover/return | `rentals.view` or assigned `driver` | Structured handover/return condition checklist, fuel %, customer acknowledgement, automatic return-vs-handover diff |
| M13 | `GET/POST/PATCH` | `/api/v1/maintenance-schedules` & `/{id}` | `work_orders.view` / `work_orders.manage` | Preventive km/date service schedules (`ok\|due_soon\|overdue`); work order completion updates schedule & enforces `release_passed` quality release |
| M13 | `GET/POST/PATCH` | `/api/v1/vehicle-components` & `/{id}` | `parts.view`/`manage` or `work_orders.view`/`manage` | Tyre & battery serial, position (`FL\|FR\|RL\|RR\|SPARE\|BATTERY`), warranty, replacement history; plus `parts.location` & stock valuation |
| M13 | `GET/POST` | `/api/v1/fuel-transactions` | `vehicles.view`/`manage`, `work_orders.view`, or assigned `driver` (active vehicle) | Canonical metric (`km`, `litres`), server-computed `litres_per_100km`, `cost_per_km_minor`, `is_abnormal`; atomically posts `fuel` Expense + balanced GL (`DR 5000 / CR 1000`) |
| M14 | `GET/PATCH` | `/api/v1/credit/accounts` & `/{customerId}` | `invoices.view` / `invoices.manage` (or `credit.view`/`manage`) | Customer credit limits, payment terms, exposure %, manual/auto credit hold (`409` blocks new reservations, quote convert, and handovers while on hold) |
| M14 | `GET/POST/PATCH` | `/api/v1/credit/collections` & `/{id}` | `invoices.view` / `invoices.manage` | Collection reminders, promises to pay (`promised_amount_minor`, `promised_date`), disputes, escalations |
| M14 | `GET` | `/api/v1/customers/{id}/statement` | `invoices.view` | Running-balance chronological Customer Account Statement (`from`, `to`, opening/closing balance, rows) |
| M14 | `GET/POST` | `/api/v1/approvals` & `/{id}/{approve\|reject}` | Authenticated member (request) / `invoices.manage` or `quotations.approve_discount` or `company-admin` (decide) | Unified Approval Engine across all 7 SRS §20 types; enforces strict segregation of duties (`requester_id === caller.id` → `403`) |
| M14 | `GET` | `/api/v1/compliance/expiries` | `documents.view` | Document & compliance expiry hub (`expired`, `d7`, `d14`, `d30`, `valid` buckets across insurance, roadworthy, licences, contracts, KYC) |
| M15 | `GET/POST` | `/api/v1/ap/invoices`, `/ap/ageing`, `/ap/invoices/{id}/payments` | `invoices.view`/`manage` or `ap.view`/`manage` | Supplier Invoices (PO 3-way match + non-PO bills), AP Ageing (5 buckets), Supplier Payments (`409` if `variance` without approval) |
| M15 | `GET/POST` | `/api/v1/credit-notes` & `/api/v1/invoices/{id}/credit-notes` | `invoices.view` / `invoices.manage` | Formal Customer Credit Notes (`refund_writeoff` approval gating), GL reversal (`DR 4000 + 2100 / CR 1100`), updates AR & Customer Statement |
| M15 | `GET/POST` | `/api/v1/bank-accounts`, `/{id}/transactions`, `/{id}/reconciliations`, `/bank-transactions/{id}/{match\|unmatch}` | `gl.view` / `expenses.manage` (`banking.view`/`manage`) | Cash & Bank Accounts, CSV/manual statement lines, auto-suggested matching, bank-fee posting, reconciliation close |
| M15 | `GET/POST` | `/api/v1/fixed-assets`, `/depreciate`, `/{id}/{request-disposal\|dispose}` | `gl.view` / `expenses.manage` (`assets.view`/`manage`) | Fixed Assets (vehicle or equipment), idempotent monthly depreciation (`straight_line` / `reducing_balance`), approval-gated Vehicle Disposal (`sold` / `decommissioned`) |
| M15 | `GET` | `/api/v1/reports/statements/{pnl\|balance-sheet\|cash-flow}` | `gl.view` (or `invoices.view`) | Server-aggregated Management P&L, Balance Sheet (`is_balanced`), and Cash Flow from posted GL journal lines |
| M16 | `GET/POST/PATCH` | `/api/v1/roles`, `/users`, `/invitations` (Exact SRS §3 Roles) | `users.view`/`manage` (`HR/Admin Manager` non-privileged only; `System Administrator` all) | Adds all 10 exact SRS §3 roles (`ceo`, `general-manager`, `business-accounts-manager`, `operations-manager`, `maintenance-manager`, `finance-manager`, `credit-control-manager`, `hr-admin-manager`, `mechanic-technician`, `system-administrator`) + `driver`; keeps legacy slugs backward-compatible |
| M16 | `GET/POST/PATCH` | `/api/v1/leads` & `POST /api/v1/leads/{id}/convert` | `leads.view`/`manage` (or `quotations.view`/`manage`) | CRM Lead-to-Quote pipeline (`new\|contacted\|qualified\|proposal_sent\|won\|lost`); `convert` auto-creates or links Customer & transitions to Quotation |
| M16 | `POST` | `/api/v1/auth/two-factor/{setup\|confirm\|disable\|recovery-codes\|challenge}` | Authenticated (public rate-limited for `challenge`) | TOTP 2FA enrollment (encrypted secret + `otpauth_uri`), 6-digit confirmation + 8 single-use hashed recovery codes, 2-step login challenge |
| M16 | `POST` | `/api/v1/users/{id}/reset-two-factor` | `System Administrator` / platform admin only | Lockout recovery clearing target user's TOTP secret & recovery codes (`409` on self-reset; `403` for HR/Admin Manager) |
| M16.5 | `GET` | `/api/v1/vehicles/{id}/history` | `vehicles.view` (monetary fields require `invoices.view`) | Digital Vehicle File consolidated history (`rentals`, `fuel`, `work_orders`, `incidents`, `compliance`) + extended SRS §4 vehicle master & 9 statuses |
| M16.5 | `GET/POST/PATCH` | `/api/v1/incidents` & `/{id}/create-work-order` | `work_orders.view`/`manage` or `vehicles.manage` | Accident/breakdown/damage incident log with insurance claim #, optional vehicle unsafe transition, 1-click work order creation |
| M16.5 | `POST` | `/api/v1/quotations/{id}/accept` & `/rentals/{id}/amend` | `quotations.manage` / `rentals.manage` | Quotation customer acceptance + active rental amendment/early-return & security deposit settlement + canvas signature payload on handover/return |
| M16.5 | `GET/POST` | `/api/v1/purchase-requisitions` & `/{id}/{approve\|reject\|convert-to-po}` | `purchase_orders.view`/`manage` (`approve` with segregation of duties) | SRS §16 Purchase Requisitions → Approval → 1-click draft PO conversion |
| M16.5 | `GET` | `/api/v1/suppliers/{id}/statement` & `/reports/statements/vat-return` | `invoices.view` / `gl.view` | Chronological Supplier Account Statement & Output/Input VAT Return summary |
| M16.5 | `GET/PATCH` | `/api/v1/companies/{id}/approval-thresholds` | `companies.view` / `settings.manage` (`System Administrator`) | Configurable 7-type SRS §20 approval threshold & approver SRS role matrix |

### B. Spatie Role & Permission Matrix (M6–M10 Additions)

| Permission | `company-admin` | `operations` | `finance` | `driver` | `viewer` |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `companies.view`, `branches.view` | Yes | Yes | Yes | Yes (assigned) | Yes |
| `settings.manage` | Yes | — | — | — | — |
| `customers.view` / `customers.manage` | Yes / Yes | Yes / Yes | Yes / — | — / — | Yes / — |
| `vehicles.view` / `vehicles.manage` | Yes / Yes | Yes / Yes | Yes / — | — / — | Yes / — |
| `reservations.view` / `reservations.manage` | Yes / Yes | Yes / Yes | Yes / — | — / — | Yes / — |
| `rentals.view` / `rentals.manage` | Yes / Yes | Yes / Yes | Yes / — | Self-scoped | Yes / — |
| `documents.view` / `documents.manage` | Yes / Yes | Yes / Yes | Yes / — | Self-scoped (`rental`) | Yes / — |
| `quotations.view` / `quotations.manage` | Yes / Yes | Yes / Yes | Yes / — | — / — | Yes / — |
| `quotations.approve_discount` | Yes | — | Yes | — | — |
| `invoices.view` / `invoices.manage` | Yes / Yes | — / — | Yes / Yes | — / — | Yes / — |
| `payments.manage` | Yes | — | Yes | — | — |
| `expenses.view` / `expenses.manage` | Yes / Yes | — / — | Yes / Yes | — / — | Yes / — |
| `gl.view` | Yes | — | Yes | — | — |
| `work_orders.view` / `work_orders.manage` | Yes / Yes | Yes / Yes | Yes / — | — / — | Yes / — |
| `parts.view` / `parts.manage` | Yes / Yes | Yes / Yes | Yes / — | — / — | Yes / — |
| `suppliers.view` / `suppliers.manage` | Yes / Yes | Yes / Yes | Yes / — | — / — | Yes / — |
| `purchase_orders.view` / `purchase_orders.manage` | Yes / Yes | Yes / Yes | Yes / — | — / — | Yes / — |
| `purchase_orders.approve` | Yes | — | Yes | — | — |
| `messages.view` / `messages.send` | Yes / Yes | Yes / Yes | Yes / Yes | `drivers` & `dispatch` | Yes / — |
| `reports.view` | Yes | Yes (Fleet) | Yes | — | Yes |
| `audit.view` | Yes | — | — | — | — |

*(Platform admins with `is_platform_admin = true` bypass all permission gates.)*

---

## Milestone 6 — Live Operations, Rentals, Anytime Handover & Documents (PR #9)

### 6.1 Database Migrations

#### A. Add `driver_user_id` to `rentals`
```php
Schema::table('rentals', function (Blueprint $table): void {
    $table->foreignId('driver_user_id')
        ->nullable()
        ->after('vehicle_id')
        ->constrained('users')
        ->nullOnDelete();
    $table->index(['company_id', 'driver_user_id', 'status']);
});
```
Add `'driver_user_id'` to `Rental::$fillable` and cast `'driver_user_id' => 'integer'`.

#### B. Add polymorphic entity linking, expiry & integer casts to `documents`
```php
Schema::table('documents', function (Blueprint $table): void {
    $table->string('entity_type', 32)->nullable()->after('uploaded_by');
    $table->unsignedBigInteger('entity_id')->nullable()->after('entity_type');
    $table->timestampTz('expires_at')->nullable()->after('size');
    $table->index(['company_id', 'entity_type', 'entity_id']);
});
```
Add `'entity_type'`, `'entity_id'`, `'expires_at'` to `Document::$fillable` and cast `'company_id' => 'integer'`, `'branch_id' => 'integer'`, `'uploaded_by' => 'integer'`, `'size' => 'integer'`, `'entity_id' => 'integer'`, `'expires_at' => 'immutable_datetime'` (or call `->refresh()` on `Document::create(...)`) so `POST /api/v1/documents` returns integer IDs rather than multipart strings.

### 6.2 Scoped `DirectoryQuery` on `index()` Endpoints
Update `ReservationController::index`, `RentalController::index`, and `DocumentController::index` to use `DirectoryQuery::apply` (`paginate(25)->withQueryString()`):

| Endpoint | Required | Optional | Search (`q`) Columns | Filters |
| :--- | :--- | :--- | :--- | :--- |
| `GET /api/v1/reservations` | `company_id` | `branch_id`, `status`, `vehicle_id`, `customer_id`, `q`, `page` | Linked customer `name`, vehicle `registration`, or reservation ID | `status` in `['confirmed', 'cancelled', 'completed']`, `vehicle_id`, `customer_id` |
| `GET /api/v1/rentals` | `company_id` | `branch_id`, `status`, `driver_user_id`, `vehicle_id`, `q`, `page` | Linked vehicle `registration`, customer `name`, or notes | `status` in `['draft', 'active', 'returned']`, `driver_user_id`, `vehicle_id` |
| `GET /api/v1/documents` | `company_id` | `branch_id`, `entity_type`, `entity_id`, `q`, `page` | `original_name`, `mime_type` | `entity_type` in `['vehicle', 'customer', 'reservation', 'rental', 'quotation', 'invoice']`, `entity_id` (requires `entity_type`, else `422`) |

### 6.3 Rental Extension, Driver Assignment & Anytime Handover Timing

#### Routes
```php
Route::post('rentals/{rental}/extend', [RentalController::class, 'extend'])
    ->middleware('can:rentals.manage')
    ->name('rentals.extend');
Route::post('rentals/{rental}/assign-driver', [RentalController::class, 'assignDriver'])
    ->middleware('can:rentals.manage')
    ->name('rentals.assign-driver');
```

#### A. Driver Assignment (`POST /api/v1/rentals` & `POST /api/v1/rentals/{rental}/assign-driver`)
- `POST /api/v1/rentals`: `{ reservation_id: int, driver_user_id?: int|null }`.
- `POST /api/v1/rentals/{rental}/assign-driver`: `{ driver_user_id: int|null }`.
- When `driver_user_id !== null`: user must exist, `is_active = true`, hold role `'driver'`, belong to `rental.company_id`, and if branch-restricted match `rental.branch_id` (else `422` on `driver_user_id`).
- Allowed only when `rental.status` is `'draft'` or `'active'` (else `409`). Audit: `rental.driver_assigned`.

#### B. Rental Extension (`POST /api/v1/rentals/{rental}/extend`)
- Payload: `{ ends_at: ISO-8601 datetime, notes?: string (max 1000) }`.
- Inside `DB::transaction(..., 3)` locking `vehicle`, `rental`, and `reservation`:
  1. Require `rental.status === 'active'` (else `409`).
  2. Require `ends_at->gt($reservation->ends_at)` (else `422` on `ends_at`).
  3. Check overlapping `confirmed` reservations for same `vehicle_id` excluding `$reservation->id`: `where('starts_at', '<', $newEndsAt)->where('ends_at', '>', $reservation->ends_at)->exists()` → abort `409`.
  4. Update `$reservation->ends_at`, write `RecordAudit::write($user, 'rental.extended', $rental)`, return `new RecordResource($rental)`.

#### C. Anytime Handover Timing (`TransitionRental::handle`)
- Remove the scheduled-window hard `409` block (`$reservation->starts_at->lte(now()) && $reservation->ends_at->isFuture()`) from `handover` so early and late handovers succeed anytime while operational integrity still holds (frontend displays a ±30 minute warning banner + required confirmation checkbox):
```php
abort_unless(
    $rental->status === 'draft'
    && $vehicle->status === 'available'
    && $reservation->status === 'confirmed',
    409,
    'Rental cannot be handed over at this time.'
);
```
- Keep odometer monotonicity (`odometer >= $vehicle->odometer`) and `lockForUpdate()`.
- **Recommended audit enrichment:** Record `{ scheduled_at, delta_minutes }` in `RecordAudit::write` when handover or return occurs more than 30 minutes before or after `starts_at` / `ends_at`.

### 6.4 Driver Self-Scoped Access (`driver` role)
- `GET /api/v1/rentals`: allow `driver` role automatically scoped with `->where('driver_user_id', $user->id)` when lacking `rentals.view`.
- `GET /api/v1/rentals/{rental}` & `POST /api/v1/rentals/{rental}/{handover|return}`: allow `driver` **only** when `$rental->driver_user_id === $user->id` (else `403`/`404`). Keep `extend` and `assign-driver` restricted to `rentals.manage`.
- `GET/POST /api/v1/documents` & `GET /api/v1/documents/{document}`: allow `driver` **only** when `entity_type === 'rental'` and referenced rental belongs to `$user->id`.

### 6.5 Polymorphic Documents (`StoreDocumentRequest` & `DocumentController`)
```php
'entity_type' => ['sometimes', 'nullable', Rule::in(['vehicle', 'customer', 'reservation', 'rental', 'quotation', 'invoice'])],
'entity_id' => ['required_with:entity_type', 'nullable', 'integer', 'min:1'],
'expires_at' => ['sometimes', 'nullable', 'date'],
```
Verify target entity exists in same `(company_id, branch_id)` and is accessible (else `404`/`422`). Retain `mimes:pdf,jpg,jpeg,png`, `max:10240`, `nosniff`, and `private, no-store` streaming headers.

### 6.6 Recommended Read-Only Summary Fields on `RecordResource`
Eager-load linked relations to eliminate client N+1 lookups:
- **`Reservation`**: `customer_name`, `vehicle_registration`, `vehicle_label`, `has_rental`, `rental_id`.
- **`Rental`**: `odometer_unit: 'km'`, `customer_id`, `customer_name`, `vehicle_registration`, `vehicle_label`, `driver_name`, `starts_at`, `ends_at`.

### 6.7 Required Feature Tests (`tests/Feature/MilestoneSixTest.php`)
1. Scoped pagination (>25 rows), search, and filters on `/reservations`, `/rentals`, `/documents` with cross-company/branch isolation.
2. `POST /api/v1/rentals/{id}/extend`: succeeds when free, `409` on overlap, `409` on draft/returned, `422` on non-increasing `ends_at`.
3. Anytime handover (both before `starts_at` and after `ends_at` while vehicle available & reservation confirmed) + odometer monotonicity.
4. Driver assignment validation + `driver` self-scoping (assigned rentals & rental photos only; `403`/`404` for unassigned records, `extend`, `assign-driver`).
5. Polymorphic `documents` upload (`entity_type`, `entity_id`, `expires_at`, integer IDs in JSON response) and streamed download headers.

---

## Milestone 7 — Multi-Vehicle Quotations, Discount Approvals, VAT, Financial Settings & PDF Engine (PR #10)

### 7.1 Database Migrations

#### A. Add Financial Settings columns to `companies`
```php
Schema::table('companies', function (Blueprint $table): void {
    $table->decimal('vat_rate_pct', 5, 2)->default(15.00)->after('currency');
    $table->decimal('discount_approval_threshold_pct', 5, 2)->default(10.00)->after('vat_rate_pct');
});
```
Cast both as `'float'` in `Company` so JSON serialization returns clean numbers (`0..100`).

#### B. Create `quotations` and `quotation_vehicles` tables
```php
Schema::create('quotations', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
    $table->foreignId('customer_id')->constrained()->restrictOnDelete();
    $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
    $table->timestampTz('starts_at');
    $table->timestampTz('ends_at');
    $table->unsignedInteger('rental_days'); // max(1, ceil((ends_at - starts_at) / 24h))
    $table->string('status', 32)->default('approved'); // draft | pending_approval | approved | rejected | cancelled | converted
    $table->decimal('discount_pct', 5, 2)->default(0.00);
    $table->string('discount_status', 32)->default('not_required'); // not_required | pending | approved | rejected
    $table->foreignId('discount_decided_by')->nullable()->constrained('users')->nullOnDelete();
    $table->timestampTz('discount_decided_at')->nullable();
    $table->string('discount_decision_notes', 500)->nullable();
    $table->unsignedBigInteger('subtotal_minor');
    $table->unsignedBigInteger('discount_minor')->default(0);
    $table->decimal('vat_rate_pct', 5, 2);
    $table->unsignedBigInteger('vat_minor')->default(0);
    $table->unsignedBigInteger('total_minor');
    $table->text('notes')->nullable();
    $table->timestampTz('converted_at')->nullable();
    $table->timestamps();

    $table->index(['company_id', 'branch_id', 'status']);
    $table->index(['company_id', 'customer_id']);
});

Schema::create('quotation_vehicles', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('quotation_id')->constrained()->cascadeOnDelete();
    $table->foreignId('vehicle_id')->constrained()->restrictOnDelete();
    $table->unsignedBigInteger('daily_rate_minor'); // snapshot of vehicle.daily_rate_minor at quote creation (> 0)
    $table->unsignedBigInteger('line_subtotal_minor'); // daily_rate_minor * rental_days
    $table->foreignId('reservation_id')->nullable()->constrained('reservations')->nullOnDelete();
    $table->timestamps();

    $table->unique(['quotation_id', 'vehicle_id']);
});
```

### 7.2 Seeded Roles & Permissions (`RolePermissionSeeder.php`)
Add permissions:
- `settings.manage` → `company-admin`
- `quotations.view` → `company-admin`, `operations`, `finance`, `viewer`
- `quotations.manage` → `company-admin`, `operations`
- `quotations.approve_discount` → `company-admin`, `finance`
- Seed the `finance` role with `companies.view`, `branches.view`, `customers.view`, `vehicles.view`, `reservations.view`, `rentals.view`, `documents.view`, `quotations.view`, `quotations.approve_discount` (and M8 `finance.*` when implemented).

### 7.3 Company Financial Settings API
- **`GET /api/v1/companies/{company}/settings`** (`companies.view`, verified company membership):
  ```json
  {
    "data": {
      "company_id": 1,
      "currency": "ZMW",
      "vat_rate_pct": 15,
      "discount_approval_threshold_pct": 10
    }
  }
  ```
- **`PATCH /api/v1/companies/{company}/settings`** (`settings.manage`, whole-company membership):
  - Validates `vat_rate_pct`: `['required', 'numeric', 'min:0', 'max:100']`
  - Validates `discount_approval_threshold_pct`: `['required', 'numeric', 'min:0', 'max:100']`
  - Writes `RecordAudit::write($user, 'company.settings_updated', $company)`.
  - Never retroactively recalculates existing quotations or issued invoices.

### 7.4 Quotations API (`QuotationController`)

#### A. `GET /api/v1/quotations` (`quotations.view`)
- Scoped `DirectoryQuery::apply`, `paginate(25)->withQueryString()`.
- Required: `company_id`. Optional: `branch_id`, `status` (`draft|pending_approval|approved|rejected|cancelled|converted`), `customer_id`, `q` (customer name, vehicle registration, quotation ID), `page`.
- Each quotation resource includes:
  - Core fields (`id`, `company_id`, `branch_id`, `customer_id`, `customer_name`, `starts_at`, `ends_at`, `rental_days`, `status`, `discount_pct`, `discount_status`, `discount_decided_by`, `discount_decided_by_name`, `discount_decided_at`, `discount_decision_notes`, `subtotal_minor`, `discount_minor`, `vat_rate_pct`, `vat_minor`, `total_minor`, `notes`, `converted_at`, `created_at`, `updated_at`)
  - `vehicles`: array of `{ vehicle_id, registration, make, model, daily_rate_minor, line_subtotal_minor, reservation_id }`
  - `reservation_ids`: integer array of created reservation IDs once converted.

#### B. `POST /api/v1/quotations` (`quotations.manage`)
- Payload:
  ```json
  {
    "company_id": 1,
    "branch_id": 2,
    "customer_id": 10,
    "vehicle_ids": [10, 14],
    "starts_at": "2026-12-01T09:00:00Z",
    "ends_at": "2026-12-04T09:00:00Z",
    "discount_pct": 12.5,
    "notes": "Corporate multi-vehicle fleet hire"
  }
  ```
- Validation & authoritative server pricing:
  1. `vehicle_ids`: `required|array|min:1|max:25`, each unique positive int belonging to `(company_id, branch_id)` with `status = 'available'` **and `daily_rate_minor > 0`** (else `422` on `vehicle_ids`).
  2. `ends_at > starts_at` (else `422` on `ends_at`).
  3. `discount_pct`: `sometimes|numeric|min:0|max:100` (default `0`).
  4. Verify no selected vehicle has an overlapping `confirmed` reservation in `[starts_at, ends_at]` (else `409`).
  5. Compute integer minor units server-side (started 24h blocks, VAT after discount):
     - `rental_days = max(1, (int) ceil(($endMs - $startMs) / 86_400_000))`
     - `line_subtotal_minor = vehicle.daily_rate_minor * rental_days`
     - `subtotal_minor = sum(line_subtotal_minor)`
     - `discount_minor = (int) round($subtotal_minor * ($discount_pct / 100))`
     - `taxable_minor = max(0, $subtotal_minor - $discount_minor)`
     - `vat_minor = (int) round($taxable_minor * ($company->vat_rate_pct / 100))`
     - `total_minor = $taxable_minor + $vat_minor`
  6. Discount approval gate:
     - If `$discount_pct > $company->discount_approval_threshold_pct`: `status = 'pending_approval'`, `discount_status = 'pending'`.
     - Else: `status = 'approved'`, `discount_status = 'not_required'`.
  7. Write `RecordAudit::write($user, 'quotation.created', $quotation)` and return `201`.

#### C. `POST /api/v1/quotations/{id}/approve-discount` & `reject-discount` (`quotations.approve_discount`)
- Payload: `{ notes?: string (max 500) }`.
- Require `quotation.status === 'pending_approval'` and `quotation.discount_status === 'pending'` (else `409`).
- `approve-discount`: sets `status = 'approved'`, `discount_status = 'approved'`, stamps `discount_decided_by = $user->id`, `discount_decided_at = now()`, `discount_decision_notes`. Audit: `quotation.discount_approved`.
- `reject-discount`: sets `status = 'rejected'`, `discount_status = 'rejected'`, stamps decider & notes. Quotation remains immutable (frontend offers `"Revise as new quote"` to create a fresh quotation). Audit: `quotation.discount_rejected`.

#### D. `POST /api/v1/quotations/{id}/cancel` (`quotations.manage`)
- Allowed when `quotation.status` is `'pending_approval'` or `'approved'` (else `409`).
- Sets `status = 'cancelled'`, writes `RecordAudit::write($user, 'quotation.cancelled', $quotation)`, returns `200`.

#### E. `POST /api/v1/quotations/{id}/convert` (`quotations.manage` + `reservations.manage`)
- Inside `DB::transaction(..., 3)`:
  1. Lock `quotation` (`lockForUpdate()`); require `status === 'approved'` (abort `409` if `pending_approval`, `rejected`, `cancelled`, or already `converted`).
  2. Lock ALL `vehicles` in `quotation_vehicles` ordered by `vehicle_id ASC` (deadlock-safe) with `lockForUpdate()`.
  3. Verify every vehicle is still `status === 'available'` and has zero overlapping `confirmed` reservations for `[starts_at, ends_at]`; if ANY vehicle conflicts, abort `409` and roll back the entire transaction (zero partial reservations).
  4. Create one `confirmed` `Reservation` per `quotation_vehicle` row and store its `reservation_id` back on `quotation_vehicles`.
  5. Update `quotation.status = 'converted'`, `quotation.converted_at = now()`.
  6. Write `RecordAudit::write($user, 'quotation.converted', $quotation)` and return `200` with updated quotation (including `reservation_ids[]`).

### 7.5 Authoritative Server PDF Export (`GET /api/v1/{domain}/{id}/pdf`) `[BACKEND CONFIRMATION REQUIRED: DomPDF vs. Browsershot]`
- Endpoints:
  - `GET /api/v1/quotations/{id}/pdf` (`quotations.view`)
  - `GET /api/v1/reservations/{id}/pdf` (`reservations.view`)
  - `GET /api/v1/rentals/{id}/pdf` (`rentals.view` or assigned `driver`)
- Headers:
  - `Content-Type: application/pdf`
  - `Content-Disposition: inline; filename="{domain}-{id}.pdf"` (or `attachment` if `?download=1`)
  - `Cache-Control: private, no-store, max-age=0`
  - `X-Content-Type-Options: nosniff`

### 7.6 Required Feature Tests (`tests/Feature/MilestoneSevenTest.php`)
1. Company financial settings `GET`/`PATCH` validation (`0..100`), `403` for non-admin, existing quotes unchanged after settings update.
2. Multi-vehicle quotation creation with 2+ priced vehicles: server computes exact `rental_days`, `subtotal_minor`, `discount_minor`, `vat_minor`, `total_minor`; rejects any vehicle with `daily_rate_minor === 0` (`422`).
3. Discount > threshold forces `pending_approval`; worker without `quotations.approve_discount` receives `403` on approve and `409` on convert.
4. Finance/Admin approves discount → `convert` atomically creates all linked `Reservation` records; overlapping vehicle rolls back ALL reservations with `409`.
5. Rejecting a discount marks the quote immutable `rejected`; cancelling an unconverted quote marks it `cancelled` (`409` on converted quotes).
6. `GET /api/v1/{quotations|reservations|rentals}/{id}/pdf` enforces company/branch isolation & permissions and returns valid `%PDF-` bytes with `nosniff` + `private, no-store`.
7. Server-side `sort` & `dir` ordering across paginated collections (`> 25` rows) with strict allowlist validation (`422` on unknown sort keys).

### 7.7 Server-Side Collection Sorting (`DirectoryQuery::apply` — Cross-Cutting M6/M7)
Add optional `sort` and `dir` (`asc` | `desc`, default `asc`, `dir` requires `sort`) to `DirectoryQuery::apply()` using a strict per-controller column allowlist (never interpolating raw user input into `ORDER BY`), with deterministic `->orderBy('id', $dir)` tie-breaker and `NULLS LAST` for nullable columns (`email`, `expires_at`, `driver_user_id`):

| Endpoint | Allowlisted `sort` keys |
| :--- | :--- |
| `GET /api/v1/customers` | `name`, `type`, `email` |
| `GET /api/v1/vehicles` | `registration`, `make`, `daily_rate_minor`, `odometer`, `status` |
| `GET /api/v1/quotations` | `id`, `customer_name`, `total_minor`, `status` |
| `GET /api/v1/reservations` | `id`, `customer_name`, `vehicle_registration`, `starts_at`, `status` |
| `GET /api/v1/rentals` | `id`, `vehicle_registration`, `customer_name`, `driver_name`, `status` |
| `GET /api/v1/documents` | `original_name`, `size`, `expires_at` |
| `GET /api/v1/users` | `name`, `email`, `role`, `is_active` |

---

## Milestone 8 — Live Finance, Invoicing, Payments, Refunds, Expenses, AR Ageing & GL (PR #11)

### 8.1 Spatie Roles & Permissions Additions
Add permissions to `RolePermissionSeeder`:
- `invoices.view`, `invoices.manage`
- `payments.manage`
- `expenses.view`, `expenses.manage`
- `gl.view`

Role assignments:
- `company-admin` & `finance`: all 6 permissions above.
- `viewer`: `invoices.view`, `expenses.view` only (NO `gl.view`, NO `.manage`).
- `operations` & `driver`: none.

### 8.2 Database Migrations

#### A. `invoices` & `invoice_lines`
```php
Schema::create('invoices', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
    $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
    $table->string('custom_customer_name', 255)->nullable();
    $table->string('custom_customer_email', 255)->nullable();
    $table->string('custom_customer_phone', 50)->nullable();
    $table->foreignId('rental_id')->nullable()->constrained()->nullOnDelete();
    $table->foreignId('created_by')->constrained('users');
    $table->string('invoice_number', 40);
    $table->string('status', 20)->default('draft'); // draft | issued | void
    $table->timestampTz('due_at');
    $table->timestampTz('issued_at')->nullable();
    $table->timestampTz('voided_at')->nullable();
    $table->decimal('discount_pct', 5, 2)->default(0.00);
    $table->unsignedBigInteger('subtotal_minor')->default(0);
    $table->unsignedBigInteger('discount_minor')->default(0);
    $table->decimal('vat_rate_pct', 5, 2)->default(15.00);
    $table->unsignedBigInteger('vat_minor')->default(0);
    $table->unsignedBigInteger('total_minor')->default(0);
    $table->text('notes')->nullable();
    $table->timestamps();

    $table->unique(['company_id', 'invoice_number']);
    $table->index(['company_id', 'branch_id', 'status']);
    $table->index(['company_id', 'status', 'due_at']);
    $table->index(['company_id', 'rental_id']);
});

Schema::create('invoice_lines', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('invoice_id')->constrained()->cascadeOnDelete();
    $table->string('description', 255);
    $table->unsignedInteger('quantity')->default(1);
    $table->unsignedBigInteger('unit_price_minor');
    $table->unsignedBigInteger('line_total_minor');
    $table->unsignedSmallInteger('sort_order')->default(0);
    $table->timestamps();
});
```

#### B. `payments`, `refunds`, and `expenses`
```php
Schema::create('payments', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
    $table->foreignId('invoice_id')->constrained()->cascadeOnDelete();
    $table->foreignId('recorded_by')->constrained('users');
    $table->unsignedBigInteger('amount_minor');
    $table->string('method', 32); // cash | card | bank_transfer | mobile_money
    $table->string('reference', 120);
    $table->timestampTz('paid_at');
    $table->timestamps();
    $table->index(['company_id', 'branch_id', 'paid_at']);
    $table->index(['invoice_id']);
});

Schema::create('refunds', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
    $table->foreignId('invoice_id')->constrained()->cascadeOnDelete();
    $table->foreignId('recorded_by')->constrained('users');
    $table->unsignedBigInteger('amount_minor');
    $table->string('reason', 500);
    $table->timestampTz('refunded_at');
    $table->timestamps();
    $table->index(['company_id', 'branch_id', 'refunded_at']);
    $table->index(['invoice_id']);
});

Schema::create('expenses', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
    $table->foreignId('vehicle_id')->nullable()->constrained()->nullOnDelete();
    $table->foreignId('recorded_by')->constrained('users');
    $table->string('category', 32); // maintenance | fuel | insurance | tolls_parking | general
    $table->string('description', 255);
    $table->unsignedBigInteger('amount_minor');
    $table->timestampTz('incurred_at');
    $table->timestamps();
    $table->index(['company_id', 'branch_id', 'category', 'incurred_at']);
    $table->index(['company_id', 'vehicle_id']);
});
```

#### C. `gl_accounts`, `journal_entries`, and `journal_lines`
```php
Schema::create('gl_accounts', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->string('code', 20);
    $table->string('name', 120);
    $table->string('type', 20); // asset | liability | equity | revenue | expense
    $table->boolean('is_system')->default(true);
    $table->timestamps();
    $table->unique(['company_id', 'code']);
});

Schema::create('journal_entries', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
    $table->foreignId('created_by')->constrained('users');
    $table->string('source_type', 32); // invoice | payment | refund | expense
    $table->unsignedBigInteger('source_id');
    $table->string('reference', 120);
    $table->string('memo', 255);
    $table->timestampTz('posted_at');
    $table->timestamps();
    $table->index(['company_id', 'branch_id', 'posted_at']);
    $table->index(['company_id', 'source_type', 'source_id']);
});

Schema::create('journal_lines', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('journal_entry_id')->constrained()->cascadeOnDelete();
    $table->foreignId('gl_account_id')->constrained('gl_accounts');
    $table->unsignedBigInteger('debit_minor')->default(0);
    $table->unsignedBigInteger('credit_minor')->default(0);
    $table->timestamps();
    $table->index(['gl_account_id']);
});
```
Seed system accounts automatically on company creation (and backfill existing companies):
- `1000` Cash & Bank (`asset`)
- `1100` Accounts Receivable (`asset`)
- `2100` VAT Payable (`liability`)
- `4000` Rental Revenue (`revenue`)
- `4100` Sales Refunds & Credits (`revenue`, contra-revenue)
- `5000` Fleet & Operating Expenses (`expense`)

### 8.3 Auto-Draft Invoice on Rental Return (`POST /api/v1/rentals/{rental}/return`)
- Accept optional fields: `extra_charge_minor` (integer `>= 0`, default `0`), `extra_charge_description` (string max 255, required when `extra_charge_minor > 0`).
- Inside the existing return `DB::transaction`:
  1. Complete rental, update vehicle status/odometer, complete reservation.
  2. Auto-create a `draft` `Invoice` with `due_at = now()->addDays(14)`:
     - Line 1: Rental charge — if the reservation was converted from a `Quotation`, carry its snapshotted `daily_rate_minor`, `discount_pct`, and `vat_rate_pct`; otherwise use `$vehicle->daily_rate_minor × rental_days` and `$company->vat_rate_pct` (`discount_pct = 0`).
     - Line 2 (optional): if `extra_charge_minor > 0`, add line `{ description: extra_charge_description, quantity: 1, unit_price_minor: extra_charge_minor }`.
  3. Include `invoice_id` on `Rental` responses (nullable int).

### 8.4 Invoice, Payment, Refund, Expense & GL Endpoints

#### A. Invoices (`invoices.view` / `invoices.manage`)
- `GET /api/v1/invoices`: `company_id` required; optional `branch_id`, `status` (`draft|issued|paid|overdue|void`), `customer_id`, `rental_id`, `ageing_bucket` (`current|d1_30|d31_60|d61_90|d90_plus`), `q`, `page`, `sort` (`id|customer_name|due_at|total_minor|outstanding_minor|status|created_at`), `dir`.
  - Each invoice returns computed integer balances: `paid_minor` (`SUM(payments)`), `refunded_minor` (`SUM(refunds)`), `net_paid_minor` (`paid_minor - refunded_minor`), `outstanding_minor` (`status === 'issued' ? max(0, total_minor - paid_minor) : 0`), and `is_overdue` (`status === 'issued' && outstanding_minor > 0 && due_at < now()`).
- `POST /api/v1/invoices`: creates manual `draft` invoice with **either** `customer_id` (existing CRM customer in company/branch) **or** `custom_customer_name` (non-empty string max 255, plus optional `custom_customer_email` email max 255 & `custom_customer_phone` max 50 — mutually exclusive, else `422`), `lines[]` (`min:1`, `max:50`, each `{ description, quantity >= 1, unit_price_minor >= 0 }`), `discount_pct` (`0..100`), `due_at`, `notes?`. Server computes `subtotal_minor`, `discount_minor`, `vat_rate_pct` (from company settings), `vat_minor`, `total_minor`.
- `PATCH /api/v1/invoices/{id}`: updates `draft` invoice only (`409` if `issued` or `void`). Replaces `lines[]`, allows updating `custom_customer_name`/`custom_customer_email`/`custom_customer_phone` on custom-customer drafts, and recomputes totals server-side.
- `POST /api/v1/invoices/{id}/issue`: inside `DB::transaction` locking invoice:
  1. Require `status === 'draft'` (`409`) and `total_minor > 0` (`422`).
  2. Set `status = 'issued'`, `issued_at = now()`.
  3. Post balanced `JournalEntry` (`source_type='invoice'`): `DR 1100 Accounts Receivable (total_minor)`, `CR 4000 Rental Revenue (total_minor - vat_minor)`, `CR 2100 VAT Payable (vat_minor)` (omit VAT line if `vat_minor === 0`).
  4. Audit `invoice.issued`.
- `POST /api/v1/invoices/{id}/void`: inside `DB::transaction` locking invoice:
  1. Require `status !== 'void'` (`409`) and `paid_minor === 0` (`409`, paid invoices must be settled via Refunds).
  2. If previously `issued`, post balanced reversing `JournalEntry`: `DR 4000 (total_minor - vat_minor)`, `DR 2100 (vat_minor)`, `CR 1100 (total_minor)`.
  3. Set `status = 'void'`, `voided_at = now()`. Audit `invoice.voided`.
- `GET /api/v1/invoices/{id}/pdf` (`invoices.view`): authoritative PDF export (`Content-Type: application/pdf`, `nosniff`, `private, no-store`, optional `?download=1`).
- `GET /api/v1/invoices/ageing` (`invoices.view`): `company_id` required, optional `branch_id`. Returns 5 buckets (`current`, `d1_30`, `d31_60`, `d61_90`, `d90_plus` with `{ key, label, count, amount_minor }`), `total_outstanding_minor`, and top `exposures[]` (`{ customer_id: int|null, customer_name, customer_type: 'individual'|'corporate'|'custom', outstanding_minor, overdue_count }`).

#### B. Payments & Refunds (`invoices.view` / `payments.manage`)
- `GET /api/v1/payments`: `company_id` required; optional `branch_id`, `invoice_id`, `method`, `q`, `page`, `sort` (`id|paid_at|amount_minor|method`), `dir`.
- `POST /api/v1/invoices/{id}/payments`: inside `DB::transaction` with `Invoice::lockForUpdate()`:
  1. Require `invoice.status === 'issued'` (`409`).
  2. Require `amount_minor > 0` and `amount_minor <= outstanding_minor` (else `422` on `amount_minor`).
  3. Validate `method` in `['cash', 'card', 'bank_transfer', 'mobile_money']`, `reference` required (max 120).
  4. Insert `Payment`, post balanced `JournalEntry` (`DR 1000 Cash & Bank`, `CR 1100 Accounts Receivable`), audit `payment.recorded`, return `201`.
- `GET /api/v1/refunds`: `company_id` required; optional `branch_id`, `invoice_id`, `q`, `page`, `sort` (`id|refunded_at|amount_minor`), `dir`.
- `POST /api/v1/invoices/{id}/refunds`: inside `DB::transaction` with `Invoice::lockForUpdate()`:
  1. Require `invoice.status === 'issued'` (`409`).
  2. Require `amount_minor > 0` and `amount_minor <= net_paid_minor` (else `422` on `amount_minor`), and `reason` required (max 500).
  3. Insert `Refund`, post balanced `JournalEntry` (`DR 4100 Sales Refunds & Credits`, `CR 1000 Cash & Bank`), audit `refund.recorded`, return `201`.

#### C. Expenses (`expenses.view` / `expenses.manage`)
- `GET /api/v1/expenses`: `company_id` required; optional `branch_id`, `category`, `vehicle_id`, `q`, `page`, `sort` (`id|incurred_at|description|category|amount_minor`), `dir`.
- `POST /api/v1/expenses`: creates immutable expense (`amount_minor > 0`, `category` in `['maintenance','fuel','insurance','tolls_parking','general']`, optional `vehicle_id` in same company/branch), posts balanced `JournalEntry` (`DR 5000 Fleet & Operating Expenses`, `CR 1000 Cash & Bank`), audits `expense.recorded`, returns `201`.

#### D. Double-Entry General Ledger (`gl.view` ONLY — `403` for `viewer`, `operations`, `driver`)
- `GET /api/v1/gl/accounts`: `company_id` required; optional `branch_id`. Returns seeded `gl_accounts` with scoped `debit_minor`, `credit_minor`, `balance_minor`, plus `total_debits_minor`, `total_credits_minor`, and `is_balanced` (`total_debits_minor === total_credits_minor`).
- `GET /api/v1/gl/journal-entries`: `company_id` required; optional `branch_id`, `account_code`, `source_type` (`invoice|payment|refund|expense`), `q`, `page`. Returns paginated entries ordered by `posted_at DESC, id DESC` with nested `lines[]` (`account_code`, `account_name`, `debit_minor`, `credit_minor`).

### 8.5 Required Feature Tests (`tests/Feature/MilestoneEightTest.php`)
1. Returning a rental with optional `extra_charge_minor` atomically creates a `draft` invoice carrying quote discount/VAT (or direct vehicle rate); Finance edits lines and issues it (`DR 1100 / CR 4000 + CR 2100`).
2. Issued invoice rejects `PATCH` (`409`); unpaid issued invoice voids cleanly with reversing GL; paid/partially paid issued invoice rejects `void` (`409`).
3. Concurrent/overpayment `amount_minor > outstanding_minor` returns `422`; refund `amount_minor > net_paid_minor` returns `422`.
4. Posting an expense with optional `vehicle_id` emits `DR 5000 / CR 1000` and is immutable.
5. `GET /api/v1/gl/accounts` & `GET /api/v1/gl/journal-entries` return `403` for `viewer`, `operations`, and `driver`, and always satisfy `SUM(debit_minor) === SUM(credit_minor)`.
6. `GET /api/v1/invoices/ageing` accurately buckets open issued invoices into `current`, `d1_30`, `d31_60`, `d61_90`, `d90_plus`, and `GET /api/v1/invoices/{id}/pdf` streams valid `%PDF-` bytes with `nosniff` + `private, no-store`.

## Milestone 9 — Live Maintenance, Inventory, Procurement & Vehicle 360 (PR #12)

### 9.1 Spatie Roles & Permissions Additions
Add permissions to `RolePermissionSeeder`:
- `work_orders.view`, `work_orders.manage`
- `parts.view`, `parts.manage`
- `suppliers.view`, `suppliers.manage`
- `purchase_orders.view`, `purchase_orders.manage`, `purchase_orders.approve`

Role assignments:
- `company-admin`: all 9 permissions above.
- `operations`: all `.view` & `.manage` permissions above (**NO** `purchase_orders.approve`).
- `finance`: all `.view` permissions above + `purchase_orders.approve`.
- `viewer`: all `.view` permissions above only.
- `driver`: none.

### 9.2 Additional System GL Accounts & Document Entity Types
Seed 3 additional system GL accounts per company (extending Section 8.2C):
- `1200` Spare Parts Inventory (`asset`)
- `1250` Maintenance Work-in-Progress (`asset`)
- `2000` Supplier Payables (`liability`)

Extend allowed values:
- `journal_entries.source_type`: `'invoice' | 'payment' | 'refund' | 'expense' | 'work_order' | 'purchase_order' | 'stock_adjustment'`
- `documents.entity_type`: add `'work_order'` and `'purchase_order'`

### 9.3 Database Migrations
```php
Schema::create('suppliers', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->string('name', 255);
    $table->string('email', 255)->nullable();
    $table->string('phone', 50)->nullable();
    $table->boolean('is_active')->default(true);
    $table->timestamps();
    $table->index(['company_id', 'is_active']);
});

Schema::create('parts', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
    $table->string('sku', 64);
    $table->string('name', 255);
    $table->unsignedBigInteger('unit_cost_minor')->default(0);
    $table->unsignedInteger('min_stock')->default(0);
    $table->timestamps();
    $table->unique(['company_id', 'branch_id', 'sku']);
});

Schema::create('work_orders', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
    $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
    $table->foreignId('created_by')->constrained('users');
    $table->string('title', 255);
    $table->string('status', 20)->default('open'); // open | in_progress | completed | cancelled
    $table->timestampTz('due_at');
    $table->timestampTz('started_at')->nullable();
    $table->timestampTz('completed_at')->nullable();
    $table->unsignedBigInteger('labour_cost_minor')->default(0);
    $table->unsignedBigInteger('parts_cost_minor')->default(0);
    $table->text('notes')->nullable();
    $table->text('completion_notes')->nullable();
    $table->foreignId('expense_id')->nullable()->constrained('expenses')->nullOnDelete();
    $table->timestamps();
    $table->index(['company_id', 'branch_id', 'status']);
    $table->index(['company_id', 'vehicle_id', 'status']);
});

Schema::create('purchase_orders', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
    $table->foreignId('supplier_id')->constrained()->cascadeOnDelete();
    $table->foreignId('created_by')->constrained('users');
    $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
    $table->string('po_number', 40);
    $table->string('status', 20)->default('draft'); // draft | submitted | approved | received | cancelled
    $table->unsignedBigInteger('total_minor')->default(0);
    $table->text('notes')->nullable();
    $table->timestampTz('submitted_at')->nullable();
    $table->timestampTz('approved_at')->nullable();
    $table->timestampTz('received_at')->nullable();
    $table->timestamps();
    $table->unique(['company_id', 'po_number']);
    $table->index(['company_id', 'branch_id', 'status']);
});

Schema::create('purchase_order_lines', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('purchase_order_id')->constrained()->cascadeOnDelete();
    $table->foreignId('part_id')->constrained()->cascadeOnDelete();
    $table->unsignedInteger('quantity');
    $table->unsignedBigInteger('unit_cost_minor');
    $table->unsignedBigInteger('line_total_minor');
    $table->timestamps();
});

Schema::create('stock_movements', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
    $table->foreignId('part_id')->constrained()->cascadeOnDelete();
    $table->foreignId('recorded_by')->constrained('users');
    $table->integer('quantity'); // positive for receipts/positive adjustments, negative for consumption/write-offs
    $table->unsignedBigInteger('unit_cost_minor');
    $table->string('reason', 255);
    $table->foreignId('work_order_id')->nullable()->constrained()->nullOnDelete();
    $table->foreignId('purchase_order_id')->nullable()->constrained()->nullOnDelete();
    $table->timestamps();
    $table->index(['company_id', 'branch_id', 'part_id']);
});
```

### 9.4 Endpoints, Transactions & GL Postings

#### A. Maintenance Work Orders (`work_orders.view` / `work_orders.manage`)
- `GET /api/v1/work-orders`: `company_id` required; optional `branch_id`, `status` (`open|in_progress|completed|cancelled`), `vehicle_id`, `q`, `page`, `sort` (`id|vehicle_registration|title|due_at|total_cost_minor|status`), `dir`.
- `POST /api/v1/work-orders`: `{ company_id, branch_id, vehicle_id, title, due_at, labour_cost_minor?, notes? }` → creates `open` work order.
- `GET /api/v1/work-orders/{id}`: returns work order with `vehicle_registration`, `vehicle_label`, `total_cost_minor` (`labour_cost_minor + parts_cost_minor`), and `movements[]`.
- `POST /api/v1/work-orders/{id}/start`: inside `DB::transaction` locking `vehicle` and `work_order`:
  1. Require `work_order.status === 'open'` (`409`).
  2. Reject if `vehicle.status === 'rented'`, if vehicle has any `confirmed` reservation with `ends_at > now()`, or if another `in_progress` work order exists on the same vehicle (`409`).
  3. Set `work_order.status = 'in_progress'`, `started_at = now()`, `vehicle.status = 'maintenance'`.
- `POST /api/v1/work-orders/{id}/consume-parts`: `{ part_id, quantity >= 1 }` inside `DB::transaction` locking `work_order` & `part`:
  1. Require `work_order.status === 'in_progress'` (`409`) and `part` belongs to same `(company_id, branch_id)` (`422`).
  2. Compute `on_hand = SUM(stock_movements.quantity)`; require `on_hand >= quantity` (else `422` on `quantity`).
  3. Insert negative `stock_movements` (`-quantity`, `unit_cost_minor = part.unit_cost_minor`, `reason = 'Maintenance consumption'`).
  4. Increment `work_order.parts_cost_minor += quantity * part.unit_cost_minor`.
  5. Post balanced GL (`source_type='work_order'`): `DR 1250 Maintenance WIP`, `CR 1200 Spare Parts Inventory`.
- `POST /api/v1/work-orders/{id}/complete`: `{ labour_cost_minor?, completion_notes? }` inside `DB::transaction` locking `work_order` & `vehicle`:
  1. Require `work_order.status === 'in_progress'` (`409`).
  2. Optionally update `labour_cost_minor` (`>= 0`) and `completion_notes`.
  3. Set `work_order.status = 'completed'`, `completed_at = now()`, `vehicle.status = 'available'`.
  4. If `total_cost = labour_cost_minor + parts_cost_minor > 0`: create linked `Expense` (`category='maintenance'`, `vehicle_id`, `amount_minor = total_cost`) and post balanced GL (`source_type='work_order'`): `DR 5000 Fleet & Operating Expenses (total_cost)`, `CR 1250 Maintenance WIP (parts_cost_minor)`, `CR 1000 Cash & Bank (labour_cost_minor)`.
- `POST /api/v1/work-orders/{id}/cancel`: allowed only when `status === 'open'` (`409` otherwise).

#### B. Inventory Parts & Stock Movements (`parts.view` / `parts.manage`)
- `GET /api/v1/parts`: `company_id` required; optional `branch_id`, `low_stock_only` (`1|0`), `q`, `page`, `sort` (`id|sku|name|unit_cost_minor|on_hand|min_stock`), `dir`. Returns server-computed `on_hand` & `is_low_stock` (`on_hand <= min_stock`).
- `POST /api/v1/parts` & `PATCH /api/v1/parts/{id}`: create/edit part (`sku` unique per company+branch, `name`, `unit_cost_minor`, `min_stock`).
- `POST /api/v1/parts/{id}/adjust`: `{ quantity: nonzero int, reason: string (max 255) }` inside `DB::transaction` locking `part`:
  1. Require `on_hand + quantity >= 0` (else `422` on `quantity`).
  2. Insert `stock_movements` row and post balanced GL (`source_type='stock_adjustment'`): if `quantity > 0` → `DR 1200 / CR 5000`; if `quantity < 0` → `DR 5000 / CR 1200` for `abs(quantity) * unit_cost_minor`.
- `GET /api/v1/stock-movements`: `company_id` required; optional `branch_id`, `part_id`, `work_order_id`, `purchase_order_id`, `q`, `page`, `sort` (`id|created_at|part_name|quantity|unit_cost_minor`), `dir`.

#### C. Procurement — Suppliers & Multi-Line Purchase Orders (`suppliers.*` / `purchase_orders.*`)
- `GET/POST /api/v1/suppliers` & `PATCH /api/v1/suppliers/{id}`: `company_id` required on `GET`; optional `is_active`, `q`, `page`, `sort` (`id|name|email|is_active`), `dir`.
- `GET/POST /api/v1/purchase-orders`: `company_id` required on `GET`; optional `branch_id`, `status` (`draft|submitted|approved|received|cancelled`), `supplier_id`, `q`, `page`, `sort` (`id|supplier_name|total_minor|status|created_at`), `dir`. `POST` accepts `supplier_id`, `branch_id`, `notes?`, `lines[]` (`min:1`, `{ part_id, quantity >= 1, unit_cost_minor >= 0 }`).
- `GET/PATCH /api/v1/purchase-orders/{id}`: `PATCH` allowed only while `status === 'draft'` (`409` otherwise).
- `POST /api/v1/purchase-orders/{id}/submit`: `draft` → `submitted` (`purchase_orders.manage`).
- `POST /api/v1/purchase-orders/{id}/approve`: `submitted` → `approved` (`purchase_orders.approve` — `403` for `operations`).
- `POST /api/v1/purchase-orders/{id}/receive`: inside `DB::transaction` with `PurchaseOrder::lockForUpdate()`:
  1. Require `status === 'approved'` (`409` on duplicate receive or wrong state).
  2. Insert positive `stock_movements` for every line (`reason = 'Purchase receipt'`, `purchase_order_id`).
  3. Set `status = 'received'`, `received_at = now()`.
  4. Post balanced GL (`source_type='purchase_order'`): `DR 1200 Spare Parts Inventory (total_minor)`, `CR 2000 Supplier Payables (total_minor)`.
- `POST /api/v1/purchase-orders/{id}/cancel`: allowed while `status` in `['draft', 'submitted', 'approved']` (`409` if already `received` or `cancelled`).

#### D. Live Vehicle 360 Summary (`GET /api/v1/vehicles/{id}/summary`, `vehicles.view`)
- Returns:
  - Always populated: `vehicle_id`, `work_order_count`, `open_work_order_count`, `total_downtime_hours` (sum of `started_at -> completed_at/now` for `in_progress`/`completed` work orders), `recent_work_orders[]` (last 5).
  - Populated **only** when caller holds `invoices.view` (else `null`): `cumulative_revenue_minor` (issued rental invoices for vehicle minus refunds), `maintenance_cost_minor` (completed work orders), `other_expenses_minor` (non-work-order expenses linked to `vehicle_id`), `net_roi_minor` (`cumulative_revenue_minor - maintenance_cost_minor - other_expenses_minor`).

### 9.5 Required Feature Tests (`tests/Feature/MilestoneNineTest.php`)
1. Multi-line PO `draft → submit → approve` (`403` for `operations`, `200` for `finance`) → `receive` increments stock once across all lines, posts `DR 1200 / CR 2000`, and rejects duplicate `receive` (`409`).
2. Work order `start` switches vehicle to `maintenance` and rejects rented/reserved vehicles (`409`); `consume-parts` deducts stock atomically and rejects insufficient stock (`422`); `complete` restores vehicle to `available`, creates `maintenance` Expense, and maintains balanced GL (`SUM(debit) === SUM(credit)`).
3. Manual stock adjustment rejects negative resulting stock (`422`) and posts balanced GL.
4. `GET /api/v1/vehicles/{id}/summary` returns operational downtime & work orders for `operations` with `null` financial fields, and full revenue/cost/Net ROI for `finance` & `company-admin`.

## Milestone 10 — Live Messaging/Chat Center, Notifications, Dashboard KPIs/Infographics, Reports & Audit (PR #13)

### 10.1 Spatie Roles & Permissions Additions
Add permissions to `RolePermissionSeeder`:
- `messages.view`, `messages.send`
- `reports.view`
- `audit.view`

Role assignments:
- `company-admin`: all 4 permissions above.
- `operations`: `messages.view`, `messages.send`, `reports.view` (Fleet report only; `403` on financial report & audit).
- `finance`: `messages.view`, `messages.send`, `reports.view` (`403` on `audit.view`).
- `viewer`: `messages.view`, `reports.view` (`403` on `messages.send` & `audit.view`).
- `driver`: scoped access to `messages` on `drivers` & `dispatch` channels only (`403` on `customers` & `support`, `403` on reports & audit).

### 10.2 Database Migrations
```php
Schema::create('messages', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->foreignId('branch_id')->nullable()->constrained()->nullOnDelete();
    $table->foreignId('sender_user_id')->constrained('users')->cascadeOnDelete();
    $table->string('channel', 24); // dispatch | drivers | customers | support
    $table->text('body');
    $table->string('related_entity_type', 32)->nullable();
    $table->unsignedBigInteger('related_entity_id')->nullable();
    $table->timestamps();
    $table->index(['company_id', 'branch_id', 'channel', 'created_at']);
});

Schema::create('message_reads', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('message_id')->constrained()->cascadeOnDelete();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->timestampTz('read_at');
    $table->unique(['message_id', 'user_id']);
});

Schema::create('user_notifications', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->foreignId('branch_id')->nullable()->constrained()->nullOnDelete();
    $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete(); // null = role/company broadcast
    $table->string('required_permission', 64)->nullable();
    $table->string('severity', 16)->default('info'); // info | warning | danger | success
    $table->string('title', 160);
    $table->string('body', 500);
    $table->string('href', 255)->nullable();
    $table->timestampTz('read_at')->nullable();
    $table->timestamps();
    $table->index(['company_id', 'user_id', 'read_at']);
});
```

### 10.3 Endpoints & Contracts

#### A. Live Dashboard Summary (`GET /api/v1/dashboard/summary`)
- Query: `company_id` (required), optional `branch_id`, `from` (YYYY-MM-DD), `to` (YYYY-MM-DD).
- Returns:
  - `fleet`: `{ total, available, rented, maintenance, damaged, utilization_pct }`
  - `pipeline`: `{ quotations, reservations, active_rentals, issued_invoices }`
  - `approvals`: `{ pending_discount_quotes, pending_purchase_orders, low_stock_parts, overdue_invoices }`
  - `finance` *(populated ONLY when caller holds `invoices.view`, else `null`)*: `{ revenue_minor, vat_minor, receipts_minor, expenses_minor, outstanding_ar_minor, net_position_minor }`
  - `driver_summary` *(populated for `driver` role)*: `{ active_rentals, upcoming_rentals }`

#### B. Messaging & Chat Center (`GET/POST /api/v1/messages`, `POST /api/v1/messages/{id}/read`)
- `GET /api/v1/messages`: `company_id` required; optional `branch_id`, `channel` (`dispatch|drivers|customers|support`), `page`. Driver role restricted to `drivers` & `dispatch` (`403` if requesting `customers` or `support`). Returns paginated messages with `sender_name`, `is_read` (for current user), plus `meta.unread_count`.
- `POST /api/v1/messages`: `{ company_id, branch_id?, channel, body (1..1000), related_entity_type?, related_entity_id? }` → `201`.
- `POST /api/v1/messages/{id}/read`: idempotently marks message read for current user → `200`.

#### C. Notifications (`GET /api/v1/notifications`, `POST /api/v1/notifications/{id}/read`, `POST /api/v1/notifications/read-all`)
- `GET /api/v1/notifications`: `company_id` required; optional `branch_id`, `unread_only` (`1|0`), `page`. Filters out notifications whose `required_permission` the user does not hold. Returns paginated items + `meta.unread_count`.
- `POST /api/v1/notifications/{id}/read` & `POST /api/v1/notifications/read-all` (`{ company_id, branch_id? }`): marks notification(s) read for current user.

#### D. Reports & Immutable Audit Trail
- `GET /api/v1/reports/financial` (`invoices.view`): `company_id` required; optional `branch_id`, `from`, `to`. Returns `summary` (`invoiced_minor`, `vat_minor`, `receipts_minor`, `refunds_minor`, `expenses_minor`, `outstanding_ar_minor`, `net_position_minor`) and `rows[]` (scoped financial breakdown by invoice/expense).
- `GET /api/v1/reports/fleet` (`vehicles.view`): `company_id` required; optional `branch_id`, `from`, `to`. Returns per-vehicle `rows[]` (`vehicle_id`, `registration`, `make_model`, `status`, `rental_count`, `work_order_count`, `downtime_hours`, and when caller holds `invoices.view`, `revenue_minor`, `maintenance_cost_minor`, `net_roi_minor`; else `null`).
- `GET /api/v1/audit-events` (`audit.view` ONLY — `403` for `finance`, `operations`, `viewer`, `driver`): `company_id` required; optional `action`, `entity_type`, `q`, `page`. Returns paginated immutable `audit_events` (`id`, `actor_name`, `action`, `entity_type`, `entity_id`, `summary`, `created_at`).

### 10.4 Required Feature Tests (`tests/Feature/MilestoneTenTest.php`)
1. `GET /api/v1/dashboard/summary` returns accurate fleet/pipeline/approvals counts; omits `finance` (`null`) for `operations` and populates it for `finance`/`company-admin`.
2. `POST /api/v1/messages` & `GET /api/v1/messages`: `driver` can read/send on `drivers` & `dispatch`, receives `403` on `customers`/`support`; `viewer` receives `403` on `POST /api/v1/messages`.
3. `GET /api/v1/notifications` respects `required_permission` & company/branch scope; `read` & `read-all` decrement `meta.unread_count`.
4. `GET /api/v1/reports/financial` returns `403` for `operations`; `GET /api/v1/reports/fleet` nulls financial columns for `operations`; `GET /api/v1/audit-events` returns `403` for `finance`, `operations`, `viewer`, `driver` and `200` for `company-admin`.

## Milestone 11 — Detailed Stats, Customer/Vehicle Rollups & Advanced Filtering (PR #14)

### 11.1 Scope & Security Invariants
- **Period vs. Live AR Semantics:** Flow metrics (`total_spent_minor = max(0, payments - refunds)`, `total_invoiced_minor`, `rental_count`, `avg_rental_value_minor`, `revenue_minor`, `expense_minor`, `net_roi_minor`, `utilization_pct`, `total_km_driven`) filter by optional `from`/`to` (`YYYY-MM-DD`). **`open_ar_minor` is always live point-in-time** (current unpaid balance across issued invoices, unaffected by `from`/`to`).
- **Monetary Side-Channel Protection:** Callers **without** `invoices.view`:
  1. Always receive `null` for monetary rollup fields (`total_spent_minor`, `total_invoiced_minor`, `open_ar_minor`, `avg_rental_value_minor`, `revenue_minor`, `expense_minor`, `net_roi_minor`, `expenses_minor`, `net_position_minor`).
  2. Receive **`403 Forbidden`** if they pass monetary filter params (`min_spend_minor`, `max_spend_minor`, `has_open_ar`) or monetary sort keys (`total_spent_minor`, `open_ar_minor`, `revenue_minor`, `net_roi_minor`).
  3. Never see company-shared `saved_filters` where `requires_finance = true`.
- **Multi-Page Server Sorting:** Computed metrics (`total_spent_minor`, `open_ar_minor`, `rental_count`, `last_rental_at`, `utilization_pct`, `idle_days`, `revenue_minor`, `net_roi_minor`) MUST be sorted in SQL across the full matching dataset **before** `paginate(25)`.

### 11.2 Database Migration (`saved_filters`)
```php
Schema::create('saved_filters', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->string('module', 32); // customers | vehicles | stats_customers | stats_vehicles | stats_branches
    $table->string('name', 80);
    $table->jsonb('filters');
    $table->boolean('is_shared')->default(false);
    $table->boolean('requires_finance')->default(false);
    $table->timestamps();
    $table->index(['company_id', 'module', 'is_shared']);
    $table->index(['company_id', 'user_id', 'module']);
});
```

### 11.3 Endpoints & Contracts

#### A. Extended `GET /api/v1/customers` & Dedicated `GET /api/v1/stats/customers` (`customers.view`)
- Query: `company_id` (required), optional `branch_id`, `type` (`individual|corporate`), `include_stats` (`0|1`), `from`, `to` (`YYYY-MM-DD`), `min_spend_minor`, `max_spend_minor` (non-negative int, requires `invoices.view`), `has_open_ar` (`0|1`, requires `invoices.view`), `q`, `page`, `sort` (`name|type|email|rental_count|total_spent_minor|open_ar_minor|last_rental_at`), `dir` (`asc|desc`).
- Response items include `stats` (always on `/stats/customers`, and when `include_stats=1` on `/customers`):
  `{ rental_count, last_rental_at, total_spent_minor, total_invoiced_minor, open_ar_minor, avg_rental_value_minor }` (monetary fields `null` without `invoices.view`).
- Response `meta.summary`: `{ total_customers, active_rentals_count, total_spent_minor, total_open_ar_minor }` (monetary fields `null` without `invoices.view`).

#### B. Customer 360 Summary (`GET /api/v1/customers/{id}/summary`, `customers.view`)
- Scoped to customer's company/branch; returns `404` if outside caller scope.
- Returns `{ data: { customer_id, rental_count, last_rental_at, total_spent_minor, total_invoiced_minor, open_ar_minor, avg_rental_value_minor, recent_rentals: [...], recent_invoices: [...] } }`.
- When caller lacks `invoices.view`, monetary scalars are `null` and `recent_invoices` is `[]`.

#### C. Extended `GET /api/v1/vehicles` & Dedicated `GET /api/v1/stats/vehicles` (`vehicles.view`)
- Query: `company_id` (required), optional `branch_id`, `status`, `include_stats` (`0|1`), `from`, `to`, `min_rate_minor`, `max_rate_minor`, `functions` (comma-separated slugs, AND/overlap match), `idle_days_min` (non-negative int), `unpriced_only` (`0|1`), `q`, `page`, `sort` (`registration|make|daily_rate_minor|odometer|status|rental_count|utilization_pct|idle_days|revenue_minor|net_roi_minor`), `dir`.
- Response items include `stats`: `{ rental_count, utilization_pct, total_km_driven, idle_days, revenue_minor, expense_minor, net_roi_minor }` (monetary fields `null` without `invoices.view`).
- Response `meta.summary`: `{ total_vehicles, avg_utilization_pct, idle_over_14d_count, unpriced_count, total_net_roi_minor }` (`total_net_roi_minor` is `null` without `invoices.view`).

#### D. Branch Comparison Stats (`GET /api/v1/stats/branches`, `reports.view`)
- Query: `company_id` (required), optional `branch_id`, `from`, `to`.
- Whole-company members receive all company branches (or filtered by `branch_id`); branch-restricted members receive **only** their assigned branch.
- Returns `{ data: [{ branch_id, branch_name, fleet_total, utilization_pct, rental_count, work_order_count, downtime_hours, revenue_minor, expenses_minor, net_position_minor, open_ar_minor }] }` (monetary fields `null` without `invoices.view`).

#### E. Saved Filter Views (`GET/POST /api/v1/saved-filters`, `DELETE /api/v1/saved-filters/{id}`)
- `GET /api/v1/saved-filters?company_id={id}&module={module}`: returns caller's personal views + company-shared views (omitting `requires_finance = true` if caller lacks `invoices.view`).
- `POST /api/v1/saved-filters`: `{ company_id, module, name (1..80), filters: Record<string, string>, is_shared?: boolean }` → `201`. Server computes `requires_finance` from whether `filters` contains monetary keys (`min_spend_minor`, `max_spend_minor`, `has_open_ar`, or monetary `sort`). Rejects `is_shared: true` with `403` unless caller is `company-admin` or platform admin; rejects with `422` if `(company_id, module)` already has >= 50 views.
- `DELETE /api/v1/saved-filters/{id}` → `204`. Allowed only if `user_id === caller.id`, or (`is_shared === true` and caller is `company-admin` / platform admin); otherwise `403`.

### 11.4 Required Feature Tests (`tests/Feature/MilestoneElevenTest.php`)
1. Multi-page sorting (>25 customers) by `total_spent_minor` desc/asc orders across pages 1 and 2 accurately (`payments - refunds`).
2. `from`/`to` date range filters `total_spent_minor` and `rental_count` while `open_ar_minor` remains live point-in-time.
3. `operations` (without `invoices.view`) receives `null` for all monetary rollup fields, `403` when passing `min_spend_minor` / `has_open_ar` / `sort=total_spent_minor`, and does not see `requires_finance=true` shared saved filters.
4. `GET /api/v1/customers/{id}/summary` returns accurate Customer 360 totals + recent rentals/invoices (`[]`/nulls for `operations`).
5. `saved-filters` enforces `is_shared` admin-only creation, delete ownership (`403` on another user's personal view), and the 50-view cap (`422`).

## Milestone 12 — Authentication, Admin Email Invitations & Account Lifecycle (PR #15)

### 12.1 Security & Password Policy Invariants
- **No Public Self-Registration:** Accounts are created ONLY via Admin Email Invitations (`POST /api/v1/invitations`) or the admin `"Create directly"` fallback (`POST /api/v1/users`, which sets `must_change_password = true`).
- **Password Strength Policy:** All password creation/reset/change flows enforce `min:10` characters containing at least one letter and one digit (`Password::min(10)->letters()->numbers()`), plus `confirmed`. Change-password rejects reusing the current password (`422`).
- **Token Storage:** Raw invitation tokens (32 random bytes, hex/base64url) are emailed to the invitee and **never** stored in plaintext; the DB stores `hash('sha256', $rawToken)` in `token_hash`.
- **Single-Use & Atomic Redemption:** `POST /api/v1/invitations/accept` MUST lock the invitation row (`lockForUpdate()`) inside a DB transaction so concurrent requests cannot redeem the same token twice.
- **Multi-Company Existing-User Safety:** When `account_exists = true`, `POST /api/v1/invitations/accept` MUST verify the user's existing password (`Hash::check`) before attaching membership and logging them in — preventing account takeover via an intercepted invite link.
- **Zero Account Enumeration:** `POST /api/v1/auth/forgot-password` ALWAYS returns `200 { "message": "If an account matches that email, a reset link has been sent." }` with consistent timing regardless of whether the email exists.
- **Mandatory Password Rotation Gate:** While `users.must_change_password === true`, middleware rejects all non-auth API requests (`/api/v1/*` except `auth/me`, `auth/logout`, `auth/change-password`) with `403 Forbidden`.

### 12.2 Database Migrations
```php
Schema::table('users', function (Blueprint $table): void {
    $table->boolean('must_change_password')->default(false)->after('is_active');
});

Schema::create('invitations', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->foreignId('branch_id')->nullable()->constrained()->nullOnDelete();
    $table->foreignId('invited_by')->nullable()->constrained('users')->nullOnDelete();
    $table->string('email', 255);
    $table->string('role', 64);
    $table->string('token_hash', 64)->unique();
    $table->timestampTz('expires_at');
    $table->timestampTz('accepted_at')->nullable();
    $table->timestampTz('revoked_at')->nullable();
    $table->timestamps();
    $table->index(['company_id', 'email']);
    $table->index(['company_id', 'accepted_at', 'revoked_at']);
});
```

### 12.3 Endpoints & Contracts

#### A. Admin Invitations (`users.manage`, whole-company only)
- `GET /api/v1/invitations?company_id={id}&status={pending|accepted|revoked|expired}&q=&page=`: Paginated list of invitations (`id`, `company_id`, `branch_id`, `branch_name`, `email`, `role`, `status`, `invited_by_name`, `expires_at`, `accepted_at`, `revoked_at`, `created_at`). Never returns `token_hash`.
- `POST /api/v1/invitations`: `{ company_id, branch_id?, email, role }` → `201`. Rejects if email is already a member of `company_id` or already has a pending unexpired invitation in `company_id` (`422`). Generates 72-hour token, stores `token_hash`, queues invite email.
- `POST /api/v1/invitations/{id}/resend`: Rotates `token_hash` (immediately invalidating prior link), resets `expires_at` to `now()->addHours(72)`, re-sends email → `200`. Returns `409` if already accepted or revoked.
- `POST /api/v1/invitations/{id}/revoke`: Sets `revoked_at = now()` → `200`. Returns `409` if already accepted or revoked.

#### B. Public Invitation Preview & Acceptance (Rate-Limited)
- `GET /api/v1/invitations/preview?token={raw}`: Looks up `hash('sha256', $token)`. Returns `200 { data: { email, company_name, branch_name, role, expires_at, account_exists } }`. Returns `410` if expired, revoked, or already accepted; `404` if unknown.
- `POST /api/v1/invitations/accept`:
  - If `account_exists = false`: `{ token, name, password, password_confirmation }` → creates active user (`must_change_password = false`), attaches role & company/branch membership, marks `accepted_at`, logs user into Sanctum session, returns `200 { data: User, company_id }`.
  - If `account_exists = true`: `{ token, password }` → verifies existing password (`422` if wrong), attaches membership to `company_id`, marks `accepted_at`, logs user into Sanctum session, returns `200 { data: User, company_id }`.

#### C. Public Forgot & Reset Password (Rate-Limited)
- `POST /api/v1/auth/forgot-password`: `{ email }` → `200 { message: "If an account matches that email, a reset link has been sent." }`.
- `POST /api/v1/auth/reset-password`: `{ token, email, password, password_confirmation }` → validates reset token & strength policy, updates password, sets `must_change_password = false`, revokes all active sessions/tokens → `200 { message: "Password reset successfully." }` (`410`/`422` on invalid/expired token).

#### D. Authenticated Profile & Security (`/api/v1/auth/profile`, `/api/v1/auth/change-password`)
- `GET /api/v1/auth/me` & `POST /api/v1/auth/login`: Include `must_change_password: boolean` on the `User` payload.
- `PATCH /api/v1/auth/profile`: `{ name (1..120) }` → updates display name only (ignores/rejects email changes) → `200 { data: User }`.
- `POST /api/v1/auth/change-password`: `{ current_password, password, password_confirmation, revoke_other_sessions?: boolean }` → verifies `current_password` (`422` if wrong), rejects same password (`422`), updates password, sets `must_change_password = false`, optionally revokes other sessions → `200 { data: User }`.

### 12.4 Required Feature Tests (`tests/Feature/MilestoneTwelveTest.php`)
1. Admin invites user → `preview` returns `200`; `resend` rotates token so old token returns `410` and new token returns `200`; `revoke` makes token return `410`.
2. New user accepts invite → creates user, auto-signs in, and second redemption returns `410`.
3. Existing user in Company A invited to Company B → wrong existing password returns `422`; correct existing password attaches Company B membership and auto-signs in.
4. Direct-created user (`must_change_password = true`) receives `403` on `/api/v1/customers` until calling `POST /api/v1/auth/change-password`, after which `/api/v1/customers` returns `200`.
5. `forgot-password` returns identical `200` for existing & nonexistent emails; `reset-password` updates password and invalidates prior sessions.
6. `PATCH /api/v1/auth/profile` updates `name` without permitting email changes.

## Milestone 13 — Digital Inspections, Rate Cards, Preventive Maintenance, Tyres/Batteries & Fuel Management (PR #16)

### 13.1 Canonical Units & Accounting Invariants
- **Canonical Storage:** Backend ALWAYS stores distance/odometer in **kilometres (`km`)**, fuel volume in **litres (`L`)**, weight in **kilograms (`kg`)**, and fuel efficiency in **L/100km** (`litres_per_100km`). Display conversions (`km/L`, `MPG US`, `MPG UK`, `miles`, `US gal`, `lb`) happen client-side using `company_settings` unit preferences.
- **Automatic Fuel Accounting:** `POST /api/v1/fuel-transactions` MUST atomically create a linked `Expense` (`category = 'fuel'`, `vehicle_id`) and balanced `JournalEntry` (`DR 5000 Fleet & Operating Expenses` / `CR 1000 Cash & Bank`) inside a single DB transaction.
- **Workshop Quality Release Lock:** `POST /api/v1/work-orders/{id}/complete` accepts optional `release_passed` (default `true`) and `release_notes`. If `release_passed === false`, the work order remains `in_progress`, `vehicle.status` stays `maintenance` (blocking rental allocation), and failed inspection notes are persisted.

### 13.2 Database Migrations
```php
Schema::table('company_settings', function (Blueprint $table): void {
    $table->boolean('require_inspection_photos')->default(false);
    $table->string('distance_unit', 8)->default('km'); // km | mi
    $table->string('volume_unit', 8)->default('l'); // l | gal_us
    $table->string('fuel_efficiency_unit', 16)->default('l_per_100km'); // l_per_100km | km_per_l | mpg_us | mpg_uk
    $table->string('weight_unit', 8)->default('kg'); // kg | lb
});

Schema::create('rate_cards', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->foreignId('branch_id')->nullable()->constrained()->nullOnDelete();
    $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
    $table->string('name', 120);
    $table->string('vehicle_category', 64)->nullable();
    $table->unsignedBigInteger('daily_rate_minor');
    $table->unsignedBigInteger('weekly_rate_minor')->nullable();
    $table->unsignedBigInteger('monthly_rate_minor')->nullable();
    $table->unsignedBigInteger('chauffeur_daily_minor')->nullable();
    $table->unsignedInteger('daily_km_limit')->nullable();
    $table->unsignedBigInteger('excess_km_rate_minor')->default(0);
    $table->unsignedBigInteger('security_deposit_minor')->default(0);
    $table->unsignedBigInteger('late_return_hourly_minor')->default(0);
    $table->string('fuel_policy', 24)->default('full_to_full'); // full_to_full | same_to_same | prepaid
    $table->boolean('is_active')->default(true);
    $table->timestamps();
});

Schema::create('vehicle_inspections', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
    $table->foreignId('rental_id')->constrained()->cascadeOnDelete();
    $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
    $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
    $table->string('type', 16); // handover | return
    $table->unsignedInteger('odometer');
    $table->unsignedTinyInteger('fuel_level_pct'); // 0..100
    $table->boolean('exterior_ok')->default(true);
    $table->boolean('interior_ok')->default(true);
    $table->boolean('tyres_ok')->default(true);
    $table->boolean('spare_tyre_ok')->default(true);
    $table->boolean('tools_ok')->default(true);
    $table->boolean('accessories_ok')->default(true);
    $table->boolean('documents_ok')->default(true);
    $table->text('damage_notes')->nullable();
    $table->string('customer_acknowledged_by', 120)->nullable();
    $table->timestampTz('customer_acknowledged_at')->nullable();
    $table->timestamps();
});

Schema::create('maintenance_schedules', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
    $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
    $table->string('service_name', 120);
    $table->unsignedInteger('interval_km')->nullable();
    $table->unsignedInteger('interval_days')->nullable();
    $table->unsignedInteger('last_service_odometer')->default(0);
    $table->date('last_service_at')->nullable();
    $table->boolean('is_active')->default(true);
    $table->timestamps();
});

Schema::create('vehicle_components', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
    $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
    $table->string('component_type', 16); // tyre | battery
    $table->string('serial_number', 80);
    $table->string('brand_model', 120);
    $table->string('position', 16); // FL | FR | RL | RR | SPARE | BATTERY
    $table->date('installed_at');
    $table->unsignedInteger('installed_odometer')->default(0);
    $table->date('warranty_expires_at')->nullable();
    $table->string('status', 16)->default('active'); // active | replaced | scrapped
    $table->date('replaced_at')->nullable();
    $table->text('notes')->nullable();
    $table->timestamps();
});

Schema::create('fuel_transactions', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
    $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
    $table->foreignId('driver_user_id')->nullable()->constrained('users')->nullOnDelete();
    $table->foreignId('rental_id')->nullable()->constrained()->nullOnDelete();
    $table->foreignId('expense_id')->nullable()->constrained()->nullOnDelete();
    $table->date('fuel_date');
    $table->string('station', 120)->nullable();
    $table->decimal('litres', 8, 2);
    $table->unsignedBigInteger('amount_minor');
    $table->unsignedInteger('odometer');
    $table->string('payment_method', 32)->default('cash');
    $table->unsignedInteger('km_since_last')->nullable();
    $table->decimal('litres_per_100km', 8, 2)->nullable();
    $table->unsignedBigInteger('cost_per_km_minor')->nullable();
    $table->boolean('is_abnormal')->default(false);
    $table->timestamps();
});
```
Also add optional columns on `work_orders` (`work_order_type`, `complaint`, `diagnosis`, `technician_name`, `estimate_minor`, `schedule_id`, `release_passed`, `release_notes`), `parts` (`location`), and `quotations`/`rentals` (`rate_card_id`).

### 13.3 Required Feature Tests (`tests/Feature/MilestoneThirteenTest.php`)
1. Handover & return with embedded `inspection` persists `vehicle_inspections` rows and returns accurate diff metadata (fuel shortage, newly failed checks, excess km).
2. `POST/PATCH /api/v1/rate-cards` enforces company scoping and validates positive rates.
3. `GET/POST /api/v1/maintenance-schedules` computes `due_soon`/`overdue` accurately; completing a linked work order with `release_passed=false` keeps vehicle in `maintenance`, while `release_passed=true` updates `last_service_odometer` and sets vehicle `available`.
4. `POST /api/v1/fuel-transactions` computes `litres_per_100km` & `is_abnormal` (null on first fill), rejects decreasing odometer (`422`), and atomically creates a linked `fuel` Expense + balanced GL JournalEntry (`DR 5000 / CR 1000`).
5. `POST/PATCH /api/v1/vehicle-components` tracks tyre/battery serials & positions and marks replacements cleanly.

---

## Milestone 14 — Credit Control, Unified Approval Engine & Compliance Expiry Hub (PR #17)

### 14.1 Governance & Credit-Hold Invariants
- **Credit Hold `409` Blocking:** `POST /api/v1/reservations`, `POST /api/v1/quotations/{id}/convert`, and `POST /api/v1/rentals/{id}/handover` MUST return `409 Conflict` if the customer has `is_on_credit_hold = true` OR (`credit_limit_minor > 0` and live `open_ar_minor > credit_limit_minor`). Draft quotations (`POST /api/v1/quotations`), rental returns (`POST /api/v1/rentals/{id}/return`), and customer payments (`POST /api/v1/invoices/{id}/payments`) MUST remain allowed so delinquent accounts can settle and be released.
- **Strict Segregation of Duties (SRS §20):** `POST /api/v1/approvals/{id}/approve` and `/reject` MUST return **`403 Forbidden`** whenever `approval.requester_id === caller.id` (no self-approval). Already-decided requests (`status !== 'pending'`) return `409 Conflict`.
- **Approval Auditability:** Every decision records `approver_id`, `approved_value`, `decision_notes`, and `decided_at` alongside `requester_id`, `previous_value`, and `requested_value`.

### 14.2 Database Migrations
```php
Schema::table('customers', function (Blueprint $table): void {
    $table->string('id_number', 64)->nullable();
    $table->string('driver_licence_number', 64)->nullable();
    $table->string('company_registration', 64)->nullable();
    $table->string('tin', 64)->nullable();
    $table->unsignedBigInteger('credit_limit_minor')->nullable();
    $table->unsignedSmallInteger('payment_terms_days')->default(30);
    $table->boolean('is_on_credit_hold')->default(false);
    $table->string('credit_hold_reason', 255)->nullable();
});

Schema::create('collection_notes', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->foreignId('branch_id')->nullable()->constrained()->nullOnDelete();
    $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
    $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
    $table->string('note_type', 24); // reminder | promise_to_pay | dispute | escalation | general
    $table->unsignedBigInteger('promised_amount_minor')->nullable();
    $table->date('promised_date')->nullable();
    $table->string('status', 16)->default('open'); // open | kept | broken | resolved
    $table->text('notes');
    $table->timestamps();
});

Schema::create('approval_requests', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->foreignId('branch_id')->nullable()->constrained()->nullOnDelete();
    $table->string('type', 32); // discount | credit_limit | vehicle_repair | purchase | refund_writeoff | contract_amendment | vehicle_disposal
    $table->string('entity_type', 32)->nullable();
    $table->unsignedBigInteger('entity_id')->nullable();
    $table->string('title', 160);
    $table->foreignId('requester_id')->constrained('users')->cascadeOnDelete();
    $table->foreignId('approver_id')->nullable()->constrained('users')->nullOnDelete();
    $table->string('previous_value', 120)->nullable();
    $table->string('requested_value', 120);
    $table->string('approved_value', 120)->nullable();
    $table->text('reason');
    $table->text('decision_notes')->nullable();
    $table->string('status', 16)->default('pending'); // pending | approved | rejected | cancelled
    $table->timestampTz('decided_at')->nullable();
    $table->timestamps();
    $table->index(['company_id', 'status', 'type']);
});

Schema::table('documents', function (Blueprint $table): void {
    $table->string('category', 32)->nullable()->after('entity_id'); // insurance | roadworthy | vehicle_licence | driver_licence | contract | kyc | other
});
```

### 14.3 Required Feature Tests (`tests/Feature/MilestoneFourteenTest.php`)
1. Placing a customer on Credit Hold blocks `POST /api/v1/reservations` & `POST /api/v1/rentals/{id}/handover` with `409`, while still allowing payments; releasing hold unblocks booking.
2. `GET /api/v1/customers/{id}/statement` computes accurate running balances across issued invoices, payments, and refunds (`403` without `invoices.view`).
3. `POST /api/v1/approvals` creates a pending request; requester attempting to approve their own request receives **`403`**; a different Finance/Admin approver succeeds (`200`) and second approval returns `409`.
4. `GET /api/v1/compliance/expiries` buckets documents accurately into `expired`, `d7`, `d14`, `d30`, and `valid`.

## Milestone 15 — Full Accounting: AP, Credit Notes, Bank Reconciliation, Fixed Assets & Financial Statements (PR #18)

### 15.1 Accounting Invariants & Role Governance (Exact SRS §3 Roles)
- **Authoritative Access Roles (SRS §3):** Operational accounting actions (`ap.manage`, `banking.manage`, `assets.manage`, `invoices.manage`) belong to **Finance Manager** and **System Administrator**. Executive read & high-level approval decisions (`vehicle_disposal`, AP `purchase` variance overrides, `refund_writeoff` credit notes) are authorized for **CEO**, **General Manager**, **Finance Manager**, and **System Administrator** with strict segregation of duties (`requester_id !== approver_id` → `403`). **Credit Control Manager** has read access to Credit Notes & AR Ageing and may request `refund_writeoff` credit notes.
- **3-Way Match Enforcement:** PO-linked supplier invoices compare `total_minor` against the received Purchase Order total. Any discrepancy sets `match_status = variance` and `POST /api/v1/ap/invoices/{id}/payments` MUST return **`409 Conflict`** until variance is approved via the M14 Approval Engine (`purchase`). Non-PO supplier bills (`match_status = non_po`) require `expense_account_code`.
- **Credit Note Integrity:** `POST /api/v1/invoices/{id}/credit-notes` rejects `draft`/`void` invoices (`409`) and amounts exceeding remaining creditable balance (`422`). Posted credit notes write balanced GL (`DR 4000 Rental Revenue` + `DR 2100 VAT Payable` / `CR 1100 Accounts Receivable`) and appear in `GET /api/v1/customers/{id}/statement` and AR Ageing.
- **Idempotent Monthly Depreciation:** `POST /api/v1/fixed-assets/depreciate` (`period_month: YYYY-MM`) enforces a unique `(fixed_asset_id, period_month)` constraint; re-running skips already-depreciated or fully-depreciated (`net_book_value_minor <= residual_value_minor`) assets and returns `{ period_month, posted_count, skipped_count, total_depreciation_minor }`. Posts balanced GL (`DR 5500 Depreciation Expense / CR 1590 Accumulated Depreciation`).
- **Approval-Gated Vehicle Disposal:** `POST /api/v1/fixed-assets/{id}/request-disposal` creates a `vehicle_disposal` approval request (rejects `409` if linked vehicle is `rented`). `POST /api/v1/fixed-assets/{id}/dispose` requires the linked approval to be `approved` (`409` otherwise), calculates `gain_loss_minor = proceeds_minor - net_book_value_minor`, posts disposal GL (`DR 1000 Bank`, `DR 1590 Accum. Depr.`, `CR 1500 Fixed Assets`, `CR 4900 Gain` or `DR 5900 Loss`), marks asset `disposed`, and updates linked vehicle status to `sold` or `decommissioned` (blocking future reservations/handovers with `409`).
- **Extended Chart of Accounts:** `1000` Cash & Bank (sub-accounts `1010`/`1020`), `1100` Accounts Receivable, `1200` Inventory, `1500` Fleet & Fixed Assets, `1590` Accumulated Depreciation, `2000` Accounts Payable, `2100` VAT Payable, `3000` Retained Earnings / Equity, `4000` Rental Revenue, `4100` Refunds & Allowances, `4900` Gain on Asset Disposal, `5000` Fleet Operating Expenses, `5500` Depreciation Expense, `5600` Bank Charges, `5900` Loss on Asset Disposal.

### 15.2 Database Migrations
```php
Schema::create('supplier_invoices', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
    $table->foreignId('supplier_id')->constrained()->cascadeOnDelete();
    $table->foreignId('purchase_order_id')->nullable()->constrained()->nullOnDelete();
    $table->string('invoice_number', 64);
    $table->date('invoice_date');
    $table->date('due_at');
    $table->unsignedBigInteger('subtotal_minor');
    $table->unsignedBigInteger('vat_minor')->default(0);
    $table->unsignedBigInteger('total_minor');
    $table->unsignedBigInteger('paid_minor')->default(0);
    $table->string('expense_account_code', 20)->nullable();
    $table->string('match_status', 16)->default('non_po'); // matched | variance | non_po
    $table->bigInteger('variance_minor')->default(0);
    $table->foreignId('approval_request_id')->nullable()->constrained('approval_requests')->nullOnDelete();
    $table->string('status', 20)->default('approved'); // draft | pending_approval | approved | partially_paid | paid | void
    $table->text('notes')->nullable();
    $table->timestamps();
    $table->unique(['company_id', 'supplier_id', 'invoice_number']);
});

Schema::create('supplier_payments', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->foreignId('supplier_invoice_id')->constrained()->cascadeOnDelete();
    $table->foreignId('bank_account_id')->nullable()->constrained('bank_accounts')->nullOnDelete();
    $table->unsignedBigInteger('amount_minor');
    $table->string('method', 24); // bank_transfer | cash | card | mobile_money
    $table->string('reference', 80)->nullable();
    $table->date('paid_at');
    $table->foreignId('journal_entry_id')->nullable()->constrained()->nullOnDelete();
    $table->timestamps();
});

Schema::create('credit_notes', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
    $table->foreignId('invoice_id')->constrained()->cascadeOnDelete();
    $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
    $table->string('credit_note_number', 48);
    $table->unsignedBigInteger('subtotal_minor');
    $table->unsignedBigInteger('vat_minor')->default(0);
    $table->unsignedBigInteger('total_minor');
    $table->text('reason');
    $table->string('status', 20)->default('posted'); // pending_approval | posted | rejected
    $table->foreignId('approval_request_id')->nullable()->constrained('approval_requests')->nullOnDelete();
    $table->foreignId('journal_entry_id')->nullable()->constrained()->nullOnDelete();
    $table->timestampTz('posted_at')->nullable();
    $table->timestamps();
});

Schema::create('bank_accounts', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->foreignId('branch_id')->nullable()->constrained()->nullOnDelete();
    $table->string('name', 120);
    $table->string('bank_name', 120);
    $table->string('account_number_masked', 32);
    $table->string('currency', 8)->default('ZMW');
    $table->string('gl_account_code', 20)->default('1000');
    $table->bigInteger('opening_balance_minor')->default(0);
    $table->timestampTz('last_reconciled_at')->nullable();
    $table->boolean('is_active')->default(true);
    $table->timestamps();
});

Schema::create('bank_reconciliations', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->foreignId('bank_account_id')->constrained()->cascadeOnDelete();
    $table->date('statement_date');
    $table->bigInteger('statement_closing_balance_minor');
    $table->bigInteger('reconciled_balance_minor');
    $table->string('status', 16)->default('closed'); // open | closed
    $table->timestampTz('closed_at')->nullable();
    $table->timestamps();
});

Schema::create('bank_transactions', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->foreignId('bank_account_id')->constrained()->cascadeOnDelete();
    $table->date('transaction_date');
    $table->string('description', 200);
    $table->string('reference', 80)->nullable();
    $table->bigInteger('amount_minor'); // signed: +deposit, -withdrawal
    $table->string('match_status', 16)->default('unmatched'); // unmatched | matched | adjusted
    $table->string('matched_entity_type', 32)->nullable();
    $table->unsignedBigInteger('matched_entity_id')->nullable();
    $table->foreignId('reconciliation_id')->nullable()->constrained('bank_reconciliations')->nullOnDelete();
    $table->timestamps();
});

Schema::create('fixed_assets', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
    $table->foreignId('vehicle_id')->nullable()->constrained()->nullOnDelete();
    $table->string('asset_code', 40);
    $table->string('name', 140);
    $table->string('category', 32)->default('vehicle'); // vehicle | workshop_equipment | office_equipment | other
    $table->unsignedBigInteger('acquisition_cost_minor');
    $table->unsignedBigInteger('residual_value_minor')->default(0);
    $table->date('capitalisation_date');
    $table->unsignedSmallInteger('useful_life_months');
    $table->string('depreciation_method', 24)->default('straight_line'); // straight_line | reducing_balance
    $table->unsignedBigInteger('accumulated_depreciation_minor')->default(0);
    $table->string('status', 20)->default('active'); // active | pending_disposal | disposed
    $table->string('disposal_type', 20)->nullable(); // sold | decommissioned
    $table->date('disposal_date')->nullable();
    $table->unsignedBigInteger('disposal_proceeds_minor')->nullable();
    $table->bigInteger('disposal_gain_loss_minor')->nullable();
    $table->foreignId('disposal_approval_id')->nullable()->constrained('approval_requests')->nullOnDelete();
    $table->timestamps();
});

Schema::create('depreciation_entries', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->foreignId('fixed_asset_id')->constrained()->cascadeOnDelete();
    $table->string('period_month', 7); // YYYY-MM
    $table->unsignedBigInteger('amount_minor');
    $table->foreignId('journal_entry_id')->nullable()->constrained()->nullOnDelete();
    $table->timestampTz('posted_at');
    $table->timestamps();
    $table->unique(['fixed_asset_id', 'period_month']);
});
```

### 15.3 Required Feature Tests (`tests/Feature/MilestoneFifteenTest.php`)
1. PO-linked supplier invoice matching PO total becomes `matched` and pays cleanly (GL `DR 2000 / CR 1000`); mismatched total becomes `variance` and blocks payment (`409`) until M14 approval by a second user.
2. Non-PO supplier bill posts GL (`DR Expense / CR 2000`) and updates AP Ageing buckets accurately.
3. Credit note on an issued invoice rejects over-crediting (`422`), posts balanced GL reversal, reduces invoice outstanding balance, and appears in Customer Statement.
4. Bank account creation, CSV/manual statement transaction import, auto-match/manual match, bank-fee posting, and reconciliation close (`422` if unbalanced, `409` unmatch after close).
5. Fixed asset registration, idempotent monthly depreciation run (`YYYY-MM`), approval-gated Vehicle Disposal calculating gain/loss, posting GL, and transitioning vehicle status to `sold` or `decommissioned` (blocking future reservations with `409`).
6. `GET /api/v1/reports/statements/{pnl|balance-sheet|cash-flow}` returns balanced server-computed GL totals and enforces `403` for non-finance roles.

## Milestone 16 — Exact SRS §3 Role Expansion, Lead-to-Quote CRM Pipeline & Privileged TOTP 2FA (PR #19)

### 16.1 Exact SRS §3 Role Catalog & Least-Privilege Governance
Seed all **10 exact SRS §3 roles** plus field `driver` alongside legacy backward-compatible aliases (`company-admin`, `operations`, `finance`, `viewer`):
1. `ceo` (**CEO** — privileged): Full cross-module read + Financial Statements + Audit Trail + Approval Engine decisions (`approvals.decide`, `quotations.approve_discount`, `purchase_orders.approve`). No System Admin settings/security write access.
2. `general-manager` (**General Manager** — privileged): Full operational, commercial & financial read oversight + Approval Engine decisions. No System Admin security mutations.
3. `business-accounts-manager` (**Business Accounts Manager**): CRM Leads (`leads.*`), Customers (`customers.*`), Rate Cards, Quotations (`quotations.*`), Reservations & Contracts (`reservations.*`, `rentals.view`), Documents view. No accounting/GL writes.
4. `operations-manager` (**Operations Manager**): Fleet (`vehicles.*`), Operations/Dispatch, Reservations & Rentals (`reservations.*`, `rentals.*`), Inspections, Fuel Log, Documents/Compliance. No GL/Finance writes.
5. `maintenance-manager` (**Maintenance Manager**): Work Orders (`work_orders.*`), Preventive Schedules, Parts & Tyres/Batteries (`parts.*`), Fuel Log, Suppliers & Purchase Orders (`suppliers.*`, `purchase_orders.view/manage`).
6. `finance-manager` (**Finance Manager** — privileged): Full Finance & Accounting (`invoices.*`, `payments.manage`, `expenses.*`, `gl.view`, `ap.*`, `banking.*`, `assets.*`), Financial Statements, Approval decisions.
7. `credit-control-manager` (**Credit Control Manager** — privileged): Customers view, Invoices/AR Ageing/Statements view, Credit Control (`credit.view/manage`, holds/releases, promises to pay, collection notes), Credit Note requests. Cannot edit GL/AP/Banking/Assets.
8. `hr-admin-manager` (**HR/Admin Manager**): Drivers & non-privileged staff administration (`users.view`, `users.manage_non_privileged`), Documents & Compliance Expiry Hub (`documents.*`). MUST receive **`403 Forbidden`** when attempting to assign/edit privileged roles (`ceo`, `general-manager`, `finance-manager`, `credit-control-manager`, `system-administrator`), edit company financial/security settings, or reset 2FA.
9. `mechanic-technician` (**Mechanic / Technician**): Assigned/branch Work Orders (`work_orders.view_assigned`, `work_orders.manage_assigned` — diagnosis, parts consumption, completion), Parts read (`parts.view`). MUST receive **`403`** on Finance, Customers, Leads, Quotations, and monetary ROI fields.
10. `system-administrator` (**System Administrator** — privileged): Full user/role/invitation administration (`users.*`, `roles.view`), Company & Security Settings (`settings.manage`, `require_2fa_for_privileged`), 2FA Reset (`users/{id}/reset-two-factor`), Audit Trail (`audit.view`), Branches.
11. `driver` (**Driver**): Field-only assigned handovers, returns, inspections, fuel entry for active vehicle, and driver/dispatch chat.

### 16.2 Database Migrations
```php
Schema::create('leads', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
    $table->string('contact_name', 120);
    $table->string('company_name', 140)->nullable();
    $table->string('customer_type', 16)->default('corporate'); // individual | corporate
    $table->string('email', 255)->nullable();
    $table->string('phone', 40)->nullable();
    $table->string('source', 32)->default('corporate_outreach'); // website | referral | corporate_outreach | walk_in | phone | other
    $table->string('stage', 24)->default('new'); // new | contacted | qualified | proposal_sent | won | lost
    $table->text('vehicle_requirements')->nullable();
    $table->date('expected_start_date')->nullable();
    $table->unsignedSmallInteger('expected_days')->nullable();
    $table->unsignedBigInteger('estimated_value_minor')->nullable();
    $table->foreignId('assigned_to_user_id')->nullable()->constrained('users')->nullOnDelete();
    $table->date('next_follow_up_at')->nullable();
    $table->string('lost_reason', 255)->nullable();
    $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
    $table->foreignId('quotation_id')->nullable()->constrained()->nullOnDelete();
    $table->text('notes')->nullable();
    $table->timestamps();
    $table->index(['company_id', 'stage']);
});

Schema::table('users', function (Blueprint $table): void {
    $table->text('two_factor_secret')->nullable(); // encrypted cast
    $table->text('two_factor_recovery_codes')->nullable(); // encrypted JSON of hashed single-use codes
    $table->timestampTz('two_factor_confirmed_at')->nullable();
});

Schema::table('company_settings', function (Blueprint $table): void {
    $table->boolean('require_2fa_for_privileged')->default(false);
});
```

### 16.3 TOTP 2FA Security Contract
- **Enrollment**: `POST /api/v1/auth/two-factor/setup` generates a 160-bit Base32 secret stored encrypted (unconfirmed) and returns `{ secret, otpauth_uri }`. `POST /api/v1/auth/two-factor/confirm` validates a 6-digit RFC 6238 TOTP code (±1 30s window), sets `two_factor_confirmed_at`, generates 8 single-use recovery codes (stored hashed), and returns `{ two_factor_enabled: true, recovery_codes }`.
- **2-Step Login Challenge**: If `user.two_factor_confirmed_at !== null`, `POST /api/v1/auth/login` MUST NOT issue a full session; instead it returns `{ two_factor_required: true, challenge_token }` (single-use random token, 5-minute TTL, rate-limited `5/min`). `POST /api/v1/auth/two-factor/challenge` verifies `{ challenge_token, code }` OR `{ challenge_token, recovery_code }` (consuming the recovery code atomically), establishes the Sanctum session, and returns `{ data: User }`.
- **Privileged Enforcement**: When any user company has `require_2fa_for_privileged = true` and the user holds a privileged role (`ceo`, `general-manager`, `finance-manager`, `credit-control-manager`, `system-administrator`, `is_platform_admin`, or legacy `company-admin`/`finance`) with `two_factor_confirmed_at === null`, `GET /api/v1/auth/me` includes `two_factor_enrollment_required: true` and non-auth/non-2FA routes return `403` until enrolled. `POST /api/v1/auth/two-factor/disable` returns `409` while enforced.
- **Admin Reset**: `POST /api/v1/users/{id}/reset-two-factor` (System Administrator / platform admin only; `409` on self) clears target user's TOTP secret, recovery codes, and `two_factor_confirmed_at`, and logs an `audit_event`.

### 16.4 Required Feature Tests (`tests/Feature/MilestoneSixteenTest.php`)
1. Exact 10 SRS §3 roles + `driver` are assignable; `HR/Admin Manager` receives `403` when assigning privileged roles or resetting 2FA; `Mechanic / Technician` accesses assigned/branch work orders and receives `403` on Finance/Customers/Leads.
2. `POST/PATCH /api/v1/leads` validates stage transitions (`lost` requires `lost_reason`); `POST /api/v1/leads/{id}/convert` creates or links existing Customer by email and moves lead to `proposal_sent`.
3. TOTP 2FA setup → confirm returns 8 recovery codes → next login requires challenge → TOTP code or single-use recovery code succeeds (reusing a recovery code fails `422`).
4. Toggling `require_2fa_for_privileged = true` sets `two_factor_enrollment_required = true` for unenrolled privileged users and blocks disabling 2FA (`409`); `System Administrator` resets another user's 2FA (`200`) and self-reset returns `409`.

---

## Milestone 16.5 — Complete SRS Gap Parity Sweep Across Every Module (PR #20)

### 16.5.1 Extended Master Schemas & Invariants
- **Digital Vehicle File (SRS §4):** Extend `vehicles` with `vin`, `category`, `fuel_type`, `transmission`, `current_location`, `acquisition_date`, `acquisition_cost_minor`, `financing_type`, `financing_provider`, `financing_monthly_minor`, `financing_end_date`, `current_book_value_minor`, `residual_value_minor`, `insurance_policy_number`, `insurance_provider`, `insurance_expires_at`, `roadworthy_expires_at`, `licence_expires_at`, and full 9 SRS statuses (`available`, `reserved`, `rented`, `maintenance`, `damaged`, `accident`, `awaiting_inspection`, `awaiting_repair`, `sold`, `decommissioned`). Financial acquisition/financing/book/residual fields MUST be omitted/nulled when caller lacks `invoices.view`, and ignored/rejected on `PATCH` without finance edit permission. When a linked `FixedAsset` exists, its live `net_book_value_minor` is authoritative for `current_book_value_minor`.
- **Customer KYC & Corporate Profile (SRS §5):** Extend `customers` writable fields with `id_number`, `driver_licence_number`, `driver_licence_expires_at`, `company_registration`, `tin`, `contact_person_name`, `contact_person_phone`, `billing_address` (credit fields writable only with `invoices.manage`).
- **Digital Signatures, Deposits, Amendments & Acceptance (SRS §6, §7):** `vehicle_inspections` stores optional `signature_data_url` (validated PNG base64 ≤ 150 KB); `quotations` supports `POST /api/v1/quotations/{id}/accept` (`customer_accepted_at`, `customer_acceptance_ref`); `rentals` stores `security_deposit_minor` & `deposit_status` (`none | held | refunded | retained`) and supports `POST /api/v1/rentals/{id}/amend` (`early_return | rate_change | terms_variation`).
- **Incidents, Requisitions, Supplier Statements, VAT Return & Approval Thresholds:**
  - `vehicle_incidents` (`accident | breakdown | damage | theft_vandalism`) optionally transitions vehicle to `accident` / `awaiting_repair` (blocking reservations/handovers `409`) and supports `POST /api/v1/incidents/{id}/create-work-order`.
  - `purchase_requisitions` enforces segregation of duties (`requester_id !== approver_id` → `403`) and `POST /api/v1/purchase-requisitions/{id}/convert-to-po` creates a linked draft PO once (`409` if duplicate/unapproved).
  - `GET /api/v1/suppliers/{id}/statement` computes chronological AP invoices & supplier payments; `GET /api/v1/reports/statements/vat-return` computes Output VAT (customer invoices − credit notes) minus Input VAT (supplier invoices) = Net VAT.
  - `GET/PATCH /api/v1/companies/{id}/approval-thresholds` manages configurable thresholds & required SRS §3 approver roles across all 7 SRS §20 approval types.
  - `GET /api/v1/dashboard/summary` optionally includes `credit`, `compliance`, `operations_alerts`, and finance-gated `vehicle_profitability` summaries.

### 16.5.2 Database Migrations
```php
Schema::table('vehicles', function (Blueprint $table): void {
    $table->string('vin', 32)->nullable();
    $table->string('category', 32)->nullable(); // sedan | suv | pickup_4x4 | van_minibus | hatchback | luxury | commercial | other
    $table->string('fuel_type', 24)->nullable(); // petrol | diesel | hybrid | electric | lpg
    $table->string('transmission', 24)->nullable(); // automatic | manual | cvt
    $table->string('current_location', 120)->nullable();
    $table->date('acquisition_date')->nullable();
    $table->unsignedBigInteger('acquisition_cost_minor')->nullable();
    $table->string('financing_type', 24)->nullable(); // cash_purchase | loan | finance_lease | operating_lease
    $table->string('financing_provider', 120)->nullable();
    $table->unsignedBigInteger('financing_monthly_minor')->nullable();
    $table->date('financing_end_date')->nullable();
    $table->unsignedBigInteger('current_book_value_minor')->nullable();
    $table->unsignedBigInteger('residual_value_minor')->nullable();
    $table->string('insurance_policy_number', 64)->nullable();
    $table->string('insurance_provider', 120)->nullable();
    $table->date('insurance_expires_at')->nullable();
    $table->date('roadworthy_expires_at')->nullable();
    $table->date('licence_expires_at')->nullable();
});

Schema::table('customers', function (Blueprint $table): void {
    $table->date('driver_licence_expires_at')->nullable();
    $table->string('contact_person_name', 120)->nullable();
    $table->string('contact_person_phone', 40)->nullable();
    $table->string('billing_address', 255)->nullable();
});

Schema::table('quotations', function (Blueprint $table): void {
    $table->timestampTz('customer_accepted_at')->nullable();
    $table->string('customer_acceptance_ref', 80)->nullable();
});

Schema::table('rentals', function (Blueprint $table): void {
    $table->unsignedBigInteger('security_deposit_minor')->default(0);
    $table->string('deposit_status', 16)->default('none'); // none | held | refunded | retained
});

Schema::table('vehicle_inspections', function (Blueprint $table): void {
    $table->mediumText('signature_data_url')->nullable();
});

Schema::create('vehicle_incidents', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
    $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
    $table->foreignId('rental_id')->nullable()->constrained()->nullOnDelete();
    $table->string('incident_type', 24); // accident | breakdown | damage | theft_vandalism
    $table->string('severity', 16); // minor | moderate | major | total_loss
    $table->date('occurred_at');
    $table->string('location', 160)->nullable();
    $table->string('driver_name', 120)->nullable();
    $table->string('insurance_claim_number', 64)->nullable();
    $table->unsignedBigInteger('estimated_cost_minor')->nullable();
    $table->text('description');
    $table->string('status', 20)->default('reported'); // reported | assessing | repairing | closed
    $table->foreignId('work_order_id')->nullable()->constrained()->nullOnDelete();
    $table->timestamps();
});

Schema::create('purchase_requisitions', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
    $table->foreignId('requester_id')->constrained('users')->cascadeOnDelete();
    $table->foreignId('approver_id')->nullable()->constrained('users')->nullOnDelete();
    $table->foreignId('supplier_id')->nullable()->constrained()->nullOnDelete();
    $table->string('requisition_number', 40);
    $table->string('department', 60);
    $table->date('needed_by');
    $table->text('justification');
    $table->json('items'); // [{ description, quantity, estimated_unit_minor }]
    $table->unsignedBigInteger('estimated_total_minor');
    $table->string('status', 20)->default('pending'); // pending | approved | rejected | converted
    $table->foreignId('purchase_order_id')->nullable()->constrained()->nullOnDelete();
    $table->timestamps();
});

Schema::create('approval_thresholds', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->string('type', 32); // all 7 SRS §20 approval types
    $table->unsignedBigInteger('threshold_minor')->nullable();
    $table->decimal('threshold_pct', 5, 2)->nullable();
    $table->string('approver_role', 40); // exact SRS §3 role slug
    $table->boolean('is_active')->default(true);
    $table->timestamps();
    $table->unique(['company_id', 'type']);
});
```

### 16.5.3 Required Feature Tests (`tests/Feature/MilestoneSixteenFiveTest.php`)
1. Vehicle Digital File persists VIN/category/fuel/transmission/location/compliance dates and hides/protects financial acquisition/financing/book values from `operations` (`403`/omitted); `GET /vehicles/{id}/history` returns scoped rentals, fuel, work orders, incidents, and compliance.
2. Customer KYC & corporate profile fields persist cleanly; Quotation `accept` & Rental `amend` / deposit settlement / canvas signature persist accurately.
3. Incident logging marks vehicle `accident` (blocking bookings `409`) and `create-work-order` links a draft work order cleanly.
4. Purchase Requisition enforces segregation of duties (`403` self-approve), converts once to draft PO (`409` duplicate); Supplier Statement & VAT Return calculate exact integer minor-unit totals (`403` without finance permission); Approval Thresholds matrix persists all 7 SRS types (`settings.manage` only).

---

## Milestone 16.5.5 — Internal Virtual Meetings & Messaging Center Upgrade (PR #21)

Adds company- and branch-scoped internal virtual meetings inside the Messaging & Chat Center (`LiveChatDrawer` → `Meetings` tab + wide embedded Jitsi `MeetingRoomModal`). Supports hybrid hosting: instant embedded **Jitsi Meet** rooms (`meet.jit.si` or self-hosted `DRIVECORE_JITSI_DOMAIN`) or external **Zoom / Microsoft Teams / Google Meet** `https://` links, plus RSVPs, in-app notifications, optional Chat channel join cards, and post-meeting minutes.

### 16.5.5.1 Role Permission Additions (`meetings.view`, `meetings.manage`)
- **All 10 SRS §3 roles** (`ceo`, `general-manager`, `business-accounts-manager`, `operations-manager`, `maintenance-manager`, `finance-manager`, `credit-control-manager`, `hr-admin-manager`, `mechanic-technician`, `system-administrator`) and legacy operational/admin roles (`company-admin`, `operations`, `finance`) receive **both** `meetings.view` and `meetings.manage`.
- `viewer` receives `meetings.view` only (can view/RSVP/join, cannot create or edit).
- `driver` receives **neither** permission globally, but is allowed to view, RSVP, and join meetings where the driver's `user_id` is explicitly in `meeting_participants` (invite-only self-scope).

### 16.5.5.2 API Endpoints & Contracts

| Method | Endpoint | Permission / Access | Request / Query / Behaviour |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/meetings` | `meetings.view` or invited `driver` | Required `company_id`; optional `branch_id`, `status` (`scheduled\|live\|ended\|cancelled`), `scope` (`upcoming\|past\|all`), `page`. Non-privileged `driver` sees only invited meetings. Returns paginated `Meeting[]` with `participants[]` and `my_rsvp`. |
| `POST` | `/api/v1/meetings` | `meetings.manage` | Creates a `scheduled` or instant `live` (`start_now: true`) meeting. Body: `company_id`, `branch_id?`, `title` (max 160), `agenda?` (max 2000), `provider` (`jitsi_embedded\|zoom\|teams\|google_meet`), `external_join_url?` (required `https://` when provider ≠ `jitsi_embedded`), `starts_at` (ISO 8601), `duration_minutes` (5–480), `start_now?` (boolean), `participant_user_ids?` (`int[]`, scoped to company), `related_entity_type?` (`rental\|work_order\|incident\|customer\|vehicle\|quotation\|invoice`), `related_entity_id?`, `post_to_channel?` (boolean), `channel?` (`dispatch\|drivers\|customers\|support`). For `jitsi_embedded`, server generates unguessable `room_slug` (`drivecore-{companyId}-{randomHex}`) and `join_url`. Sends in-app notifications to invited participants; if `post_to_channel=true`, posts a message with `related_entity_type: "meeting"` & `related_entity_id: meeting.id`. |
| `GET` | `/api/v1/meetings/{id}` | `meetings.view` or invited `driver` | Returns full `Meeting` record (404 outside company/branch scope or uninvited driver). |
| `PATCH` | `/api/v1/meetings/{id}` | Organizer or `system-administrator` / `company-admin` / platform admin | Updates `title`, `agenda`, `starts_at`, `duration_minutes`, `provider`, `external_join_url`, `participant_user_ids`, or `minutes` (max 5000). Notifies participants when rescheduled. |
| `POST` | `/api/v1/meetings/{id}/rsvp` | `meetings.view` or invited `driver` | Body: `{ rsvp_status: "accepted" \| "tentative" \| "declined" }`. Upserts caller's RSVP row. |
| `POST` | `/api/v1/meetings/{id}/start` | Organizer or `system-administrator` / `company-admin` / platform admin | Marks `scheduled` → `live`, sets `started_at = now()` (`409` if `ended`/`cancelled`). |
| `POST` | `/api/v1/meetings/{id}/end` | Organizer or `system-administrator` / `company-admin` / platform admin | Marks `live`/`scheduled` → `ended`, sets `ended_at = now()`, optional `{ minutes }` saved on record. |
| `POST` | `/api/v1/meetings/{id}/cancel` | Organizer or `system-administrator` / `company-admin` / platform admin | Marks `scheduled`/`live` → `cancelled` (`409` if already `ended`/`cancelled`), notifies invited participants. |

### 16.5.5.3 Database Schema (Laravel Migration Blueprint)

```php
Schema::create('meetings', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->foreignId('branch_id')->nullable()->constrained()->nullOnDelete();
    $table->foreignId('organizer_user_id')->constrained('users')->cascadeOnDelete();
    $table->string('title', 160);
    $table->text('agenda')->nullable();
    $table->string('provider', 24)->default('jitsi_embedded'); // jitsi_embedded | zoom | teams | google_meet
    $table->string('room_slug', 96)->nullable();
    $table->string('join_url', 512);
    $table->timestampTz('starts_at');
    $table->unsignedSmallInteger('duration_minutes')->default(30);
    $table->string('status', 20)->default('scheduled'); // scheduled | live | ended | cancelled
    $table->timestampTz('started_at')->nullable();
    $table->timestampTz('ended_at')->nullable();
    $table->text('minutes')->nullable();
    $table->string('related_entity_type', 32)->nullable();
    $table->unsignedBigInteger('related_entity_id')->nullable();
    $table->string('channel', 24)->nullable();
    $table->timestamps();
    $table->index(['company_id', 'branch_id', 'starts_at']);
});

Schema::create('meeting_participants', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('meeting_id')->constrained()->cascadeOnDelete();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->string('rsvp_status', 16)->default('pending'); // pending | accepted | tentative | declined
    $table->timestampTz('responded_at')->nullable();
    $table->timestamps();
    $table->unique(['meeting_id', 'user_id']);
});
```

### 16.5.5.4 Required Feature Tests (`tests/Feature/MilestoneSixteenFiveFiveTest.php`)
1. `POST /api/v1/meetings` creates instant `live` Jitsi meeting with server-generated `room_slug`, invites scoped users, dispatches notifications, and posts chat join card when `post_to_channel=true`.
2. External `zoom`/`teams`/`google_meet` meetings require a valid `https://` `external_join_url` (`422` for `javascript:` or `http://`).
3. Only organizer or `system-administrator`/`company-admin`/platform admin may `PATCH`, `start`, `end`, or `cancel` (`403` for other staff).
4. `driver` only sees and RSVPs to meetings where explicitly invited (`404` on uninvited meetings, `403` on `POST /api/v1/meetings`).

## Milestone 17 — Printing & Barcode Scanning (PR #22 — TBD)
*(Will be appended when Milestone 17 is implemented.)*

## Milestone 18 — Car Tracker / GPS Telematics API Integration (PR #23 — Final / TBD)
*(Will be appended once GPS tracker vendor API details are available.)*
