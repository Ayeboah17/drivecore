# DriveCore ERP — Consolidated Backend Requirements (Milestone 6 Onwards)

> **Single Source of Truth (M6+):** This document consolidates **all** Laravel REST API (`drivecore-backend`) requirements from **Milestone 6** onwards in PR implementation order. It supersedes the standalone `BACKEND_MILESTONE_6_SPEC.md` file.
>
> **Milestone 5 Prerequisite:** Ensure PR #8 (`b2a450e`) plus the small custom vehicle functions validation update in `documentation/BACKEND_CUSTOM_VEHICLE_FUNCTIONS.md` are deployed before PR #9.
>
> **Backend Source Constraint:** `drivecore-backend` was not modified by the frontend repo. Every contract, query parameter, payload, validation rule, concurrency lock, permission, and status code below matches the live Next.js BFF proxy (`apps/web/src/lib/server/backend-proxy.ts`), Zod contracts (`apps/web/src/lib/api/contracts.ts`), and Playwright E2E suite.

---

## Master Quick-Reference Index (M6–M8)

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
*(Will be appended when Milestone 11 is implemented.)*

## Milestone 12 — Authentication, Admin Email Invitations & Account Lifecycle (PR #15)
*(Will be appended when Milestone 12 is implemented.)*

## Milestone 13 — Car Tracker / GPS Telematics API Integration (PR #16 — TBD)
*(Will be appended once GPS tracker vendor API details are available.)*
