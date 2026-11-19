# Backend Handoff — Custom Vehicle Functions (`vehicles.functions`)

> **Scope:** Small validation update in `drivecore-backend` to replace the fixed 7-slug allowlist on `vehicles.functions` with custom user-defined function tags. **No new database tables or migrations are needed**—`vehicles.functions` is already a `jsonb` column from migration `2026_11_18_184544_add_pricing_and_functions_to_vehicles_table.php`.

---

## 1. Deployment Prerequisite (if functions/users currently fail on live server)
If `GET /api/v1/users?company_id=1` returns `405` or vehicle functions/daily rates are silently dropped on save, the target API server is still running pre-PR #8 code or a stale route cache. Deploy PR #8 (`b2a450e`) + the change below, then run:
```bash
php artisan migrate --force
php artisan db:seed --class=RolePermissionSeeder --force
php artisan optimize:clear
php artisan route:cache
```

---

## 2. Required Change — `app/Http/Requests/SaveVehicleRequest.php`

### Normalize items in `prepareForValidation()`
Trim each tag and collapse repeated internal whitespace so `"  Roof   Rack  "` stores cleanly as `"Roof Rack"`:
```php
protected function prepareForValidation(): void
{
    if (is_string($this->input('registration'))) {
        $this->merge(['registration' => mb_strtoupper($this->input('registration'))]);
    }
    if (is_array($this->input('functions'))) {
        $this->merge([
            'functions' => array_map(
                fn ($item) => is_string($item) ? preg_replace('/\s+/u', ' ', trim($item)) : $item,
                $this->input('functions'),
            ),
        ]);
    }
}
```

### Relax `rules()` from fixed 7-slug enum to custom strings
Replace lines 26–27:
```php
// Before (PR #8):
$rules['functions'] = ['sometimes', 'array', 'list', 'max:7'];
$rules['functions.*'] = ['required', 'string', 'distinct', Rule::in(['gps_tracker', 'automatic', 'awd_4x4', 'air_conditioning', 'chauffeur_eligible', 'bluetooth', 'child_seat'])];

// After (Custom Functions):
$rules['functions'] = ['sometimes', 'array', 'list', 'max:20'];
$rules['functions.*'] = ['required', 'string', 'min:1', 'max:50', 'distinct:ignore_case'];
```

> **Backward compatibility:** Any existing records containing legacy PR #8 slugs (`gps_tracker`, `awd_4x4`, etc.) remain valid strings (`min:1`, `max:50`) and are formatted gracefully by the frontend (`formatVehicleFunction()`).

---

## 3. OpenAPI & Feature Test Updates
- **`public/openapi.json`:** Under `Vehicle` and vehicle create/update request schemas, update `functions`:
  - Remove `"enum"` on `functions.items`.
  - Set `maxItems: 20`, `items: { type: "string", minLength: 1, maxLength: 50 }`.
- **`tests/Feature/MilestoneFiveTest.php`:**
  - Verify custom strings like `['Roof Rack', 'VIP Chauffeur']` persist on `POST /api/v1/vehicles` and `PATCH /api/v1/vehicles/{id}`.
  - Verify case-insensitive duplicates (`['Roof Rack', 'roof rack']`), empty strings (`['   ']`), overlong strings (`> 50` chars), and `> 20` items return `422` validation errors on `functions` / `functions.*`.
