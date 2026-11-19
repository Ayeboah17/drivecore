# Backend Handoff — Milestone 6: Live Operations, Rentals & Documents (PR #9)

> **Scope:** Exact Laravel API extensions needed in `drivecore-backend` (building on PR #8 `b2a450e`) to complete Milestone 6 Live **Operations**, **Rentals** (`reservations`, `rentals`, `handover`, `extend`, `return`, driver assignment), and **Documents** (scoped listing, polymorphic linking, expiry dates, and driver photo uploads).
>
> **Frontend readiness:** The companion frontend branch `feat/milestone-6-operations-rentals-documents` implements the BFF proxy, typed Zod contracts, UI workspaces, and synthetic Playwright tests against this exact specification.

---

## 1. Database Migrations

### A. Add `driver_user_id` to `rentals`
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
Add `'driver_user_id'` to `Rental::$fillable` (cast `'driver_user_id' => 'integer'`).

### B. Add polymorphic entity linking & expiry to `documents`
```php
Schema::table('documents', function (Blueprint $table): void {
    $table->string('entity_type', 32)->nullable()->after('uploaded_by');
    $table->unsignedBigInteger('entity_id')->nullable()->after('entity_type');
    $table->timestampTz('expires_at')->nullable()->after('size');
    $table->index(['company_id', 'entity_type', 'entity_id']);
});
```
Add `'entity_type'`, `'entity_id'`, `'expires_at'` to `Document::$fillable` and cast integer/datetime columns (`casts()`: `'company_id' => 'integer'`, `'branch_id' => 'integer'`, `'uploaded_by' => 'integer'`, `'size' => 'integer'`, `'entity_id' => 'integer'`, `'expires_at' => 'immutable_datetime'`), or call `->refresh()` on `Document::create(...)` so `POST /api/v1/documents` returns integer IDs rather than multipart strings.

---

## 2. Scoped `DirectoryQuery` on `index()` Endpoints

Update `ReservationController::index`, `RentalController::index`, and `DocumentController::index` to use `DirectoryQuery::apply` (matching `CustomerController` and `VehicleController` from PR #8):

| Endpoint | Required Params | Optional Params | Search (`q`) Columns | Filters |
| :--- | :--- | :--- | :--- | :--- |
| `GET /api/v1/reservations` | `company_id` | `branch_id`, `status`, `vehicle_id`, `customer_id`, `q`, `page` | Linked customer `name` / vehicle `registration` (or reservation ID) | `status` in `['confirmed', 'cancelled', 'completed']`, `vehicle_id` (`int`), `customer_id` (`int`) |
| `GET /api/v1/rentals` | `company_id` | `branch_id`, `status`, `driver_user_id`, `vehicle_id`, `q`, `page` | Linked vehicle `registration` / customer `name` / notes | `status` in `['draft', 'active', 'returned']`, `driver_user_id` (`int`), `vehicle_id` (`int`) |
| `GET /api/v1/documents` | `company_id` | `branch_id`, `entity_type`, `entity_id`, `q`, `page` | `original_name`, `mime_type` | `entity_type` in `['vehicle', 'customer', 'reservation', 'rental']`, `entity_id` (`int`, requires `entity_type`) |

- All three endpoints remain `paginate(25)->withQueryString()`.
- Validate `vehicle_id`, `customer_id`, `driver_user_id`, and `entity_id` as `sometimes|integer|min:1`, rejecting `entity_id` without `entity_type` with `422`.

---

## 3. Rental Extension & Driver Assignment (`routes/api.php` & `RentalController`)

### Routes
```php
Route::post('rentals/{rental}/extend', [RentalController::class, 'extend'])
    ->middleware('can:rentals.manage')
    ->name('rentals.extend');
Route::post('rentals/{rental}/assign-driver', [RentalController::class, 'assignDriver'])
    ->middleware('can:rentals.manage')
    ->name('rentals.assign-driver');
```

### A. Optional `driver_user_id` on `POST /api/v1/rentals` & `POST /api/v1/rentals/{rental}/assign-driver`
- Payload on `POST /api/v1/rentals`: `{ reservation_id: int, driver_user_id?: int|null }`.
- Payload on `POST /api/v1/rentals/{rental}/assign-driver`: `{ driver_user_id: int|null }`.
- Validation when `driver_user_id !== null`:
  - User must exist, have `is_active = true`, hold role `'driver'`, belong to `rental.company_id`, and if branch-restricted match `rental.branch_id` (else `422` on `driver_user_id`).
- `assign-driver` allowed only when `rental.status` is `'draft'` or `'active'` (else `409`).
- Audit event: `rental.driver_assigned`.

### C. Flexible Handover Timing (`TransitionRental::handle`)
- Currently `TransitionRental::handle` hard-blocks `handover` with `409` unless `$reservation->starts_at->lte(now()) && $reservation->ends_at->isFuture()`.
- Update the `handover` guard in `TransitionRental::handle` to remove the scheduled-window hard block so early and late handovers succeed anytime while operational integrity still holds:
  ```php
  abort_unless(
      $rental->status === 'draft'
      && $vehicle->status === 'available'
      && $reservation->status === 'confirmed',
      409,
      'Rental cannot be handed over at this time.'
  );
  ```
- Keep odometer monotonicity (`odometer >= $vehicle->odometer`) and transactional row locking (`lockForUpdate()`).
- Returns (`$action === 'return'`) already have no scheduled-time block (`$rental->status === 'active'`).
- **Recommended audit enrichment:** Record off-schedule delta metadata (`scheduled_at`, `delta_minutes`) in `RecordAudit::write` when handover or return occurs more than 30 minutes before or after `starts_at` / `ends_at`.

### B. `POST /api/v1/rentals/{rental}/extend`
- Payload: `{ ends_at: ISO-8601 datetime, notes?: string (max 1000) }`.
- Transactional rules inside `DB::transaction(..., 3)` locking `vehicle`, `rental`, and `reservation`:
  1. Require `rental.status === 'active'` (else `409`, `'Only active rentals can be extended.'`).
  2. Parse `ends_at` to UTC; require `ends_at->gt($reservation->ends_at)` (else `422` on `ends_at`).
  3. Check overlapping `confirmed` reservations for the same `vehicle_id` excluding `$reservation->id`:
     `where('starts_at', '<', $newEndsAt)->where('ends_at', '>', $reservation->ends_at)->exists()` -> abort `409` (`'Vehicle is already reserved for the extended period.'`).
  4. Update `$reservation->ends_at = $newEndsAt`; optionally append extension note; write `RecordAudit::write($user, 'rental.extended', $rental)`.
  5. Return updated `new RecordResource($rental)`.

---

## 4. Driver Self-Scoped Access (`driver` role)

Per `MilestoneFiveTest::test_branch_admin_and_driver_cannot_administer_users_or_unassigned_rentals`, a `driver` MUST NEVER see or mutate unassigned rentals, reservations, or documents:

- **`GET /api/v1/rentals`:** Allow `driver` role (in addition to `rentals.view`), automatically applying `->where('driver_user_id', $request->user()->id)` for users who lack `rentals.view` and hold the `driver` role.
- **`GET /api/v1/rentals/{rental}`:** Allow `driver` role **only** when `$rental->driver_user_id === $user->id` (else `403`/`404`).
- **`POST /api/v1/rentals/{rental}/{handover|return}`:** Allow `driver` role **only** when `$rental->driver_user_id === $user->id` (and keep `extend` and `assign-driver` strictly restricted to `rentals.manage`).
- **`GET/POST /api/v1/documents` & `GET /api/v1/documents/{document}`:** Allow `driver` role **only** when `entity_type === 'rental'` and the referenced rental has `driver_user_id === $user->id` (else `403`/`404`).

---

## 5. Polymorphic Documents (`StoreDocumentRequest` & `DocumentController`)

- Extend `StoreDocumentRequest::rules()`:
  ```php
  'entity_type' => ['sometimes', 'nullable', Rule::in(['vehicle', 'customer', 'reservation', 'rental'])],
  'entity_id' => ['required_with:entity_type', 'nullable', 'integer', 'min:1'],
  'expires_at' => ['sometimes', 'nullable', 'date'],
  ```
- When `entity_type` & `entity_id` are supplied, verify the target model exists in the same `(company_id, branch_id)` and is accessible to the user (else `404`/`422`).
- Keep existing `mimes:pdf,jpg,jpeg,png`, `max:10240`, `nosniff`, and `private, no-store` streaming headers on `GET /api/v1/documents/{id}`.

---

## 6. Optional Read-Only Summary Fields on `RecordResource` (Recommended)

To avoid N+1 client requests when rendering 25-row Reservations and Rentals tables, eagerly load linked relations (`customer`, `vehicle`, `reservation`, `driver`) and include these optional read-only fields in `RecordResource` (frontend gracefully falls back to `#ID` if omitted):

- On **`Reservation`**: `customer_name`, `vehicle_registration`, `vehicle_label` (`"{make} {model}"`), `has_rental` (`boolean`), `rental_id` (`int|null`).
- On **`Rental`**: `odometer_unit: 'km'`, `customer_id`, `customer_name`, `vehicle_registration`, `vehicle_label`, `driver_name` (`string|null`), `starts_at`, `ends_at`.

---

## 7. Required Backend Feature Tests (`tests/Feature/MilestoneSixTest.php`)
1. Scoped pagination (>25 rows), search, and status/entity filters on `/reservations`, `/rentals`, and `/documents` with cross-company/branch isolation.
2. `POST /api/v1/rentals/{id}/extend`: succeeds when free, returns `409` on overlap with a future confirmed reservation, rejects `draft`/`returned` rentals (`409`) and non-increasing `ends_at` (`422`).
3. `driver_user_id` assignment validation (must be active `driver` in company/branch); driver can list/view/handover/return and upload/download photos for **assigned** rentals only, and receives `403`/`404` for unassigned rentals, other documents, `extend`, and `assign-driver`.
4. Polymorphic `documents` upload (`entity_type`, `entity_id`, `expires_at`), cross-company entity rejection, filtered listing by `(entity_type, entity_id)`, and binary download headers.
