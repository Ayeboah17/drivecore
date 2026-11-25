# DriveCore ERP — Backend Requirements (Milestone 16.5.6 — PR #22)

> **Scope:** All Milestone 6 through 16.5.5 requirements in `documentation/BACKEND_REQUIREMENTS_M6_ONWARDS.md` have been implemented. This document specifies **only** the incremental Laravel REST API (`drivecore-backend`) additions for **Milestone 16.5.6**:
> 1. Native DriveCore WebRTC Signaling (`webrtc_native`) for Internal Virtual Meetings
> 2. Scoped Soft-Delete / Company Removal for Users (`DELETE /api/v1/users/{id}`)
> 3. Company-Scoped Role Permissions Editor (`PATCH /api/v1/roles/{roleName}`, `POST /api/v1/roles/{roleName}/reset`)
> 4. Company Email / SMTP Setup & Test Delivery (`GET/PATCH/POST /api/v1/companies/{id}/mail-settings`)
> 5. Finance Manager Default Permission Update (`quotations.manage`)

---

## Quick-Reference Endpoint Index (M16.5.6)

| Feature | Method | Endpoint | Required Permission / Access | Notes |
| :--- | :--- | :--- | :--- | :--- |
| WebRTC | `POST` | `/api/v1/meetings/{id}/rtc/join` | `meetings.view` or invited `driver` | Registers caller as active peer, returns `peer_id`, `peers[]`, `ice_servers[]`, `max_recommended_peers: 6` |
| WebRTC | `GET` | `/api/v1/meetings/{id}/rtc/signals` | `meetings.view` or invited `driver` | Query: `peer_id` (required), `after_id` (optional non-neg int); updates heartbeat & returns active `peers[]` + new `signals[]` |
| WebRTC | `POST` | `/api/v1/meetings/{id}/rtc/signals` | `meetings.view` or invited `driver` | Relays `{ from_peer_id, to_peer_id, type: "offer"\|"answer"\|"ice", payload }` (max 32 KB) |
| WebRTC | `POST` | `/api/v1/meetings/{id}/rtc/leave` | `meetings.view` or invited `driver` | Body: `{ peer_id }`; removes active peer and cleans pending signals |
| Users | `DELETE` | `/api/v1/users/{id}?company_id={id}` | `users.manage` (whole-company) | Soft-deletes / removes company membership, revokes sessions, logs `user.deleted`; blocks self (`409`), last admin (`409`), HR deleting privileged role (`403`) |
| Roles | `PATCH` | `/api/v1/roles/{roleName}` | `system-administrator` / `company-admin` / platform admin | Body: `{ company_id, permissions: string[] }`; protects lockout-critical perms on `system-administrator` (`422`); logs `role.permissions_updated` |
| Roles | `POST` | `/api/v1/roles/{roleName}/reset` | `system-administrator` / `company-admin` / platform admin | Body: `{ company_id }`; restores SRS default permissions for the role in that company; logs `role.permissions_reset` |
| Email | `GET` | `/api/v1/companies/{id}/mail-settings` | `settings.manage` (whole-company) | Returns provider, host, port, encryption, username, `has_password` (never raw secret!), `from_name`, `from_address`, `is_enabled`, `last_tested_at`, `last_test_status` |
| Email | `PATCH` | `/api/v1/companies/{id}/mail-settings` | `settings.manage` (whole-company) | Saves encrypted SMTP/provider password (omitting or blank `password` keeps existing secret); logs `company.mail_settings_updated` |
| Email | `POST` | `/api/v1/companies/{id}/mail-settings/test` | `settings.manage` (whole-company) | Body: `{ to_email }`; sends test invitation-style email using saved company mail config and returns `{ ok, message, tested_at }` |

---

## 1. Native DriveCore WebRTC Signaling (`webrtc_native`)

### 1.1 Meeting Provider Update
- Extend `meetings.provider` allowed enum to: `webrtc_native | jitsi_embedded | zoom | teams | google_meet` (default `webrtc_native`).
- For `webrtc_native`, server sets `room_slug = "drivecore-{companyId}-{randomHex}"` and `join_url = "{APP_URL}/companies/{companyId}/dashboard?meeting={id}"` (in-app room).

### 1.2 Signaling Contracts
- **`POST /api/v1/meetings/{id}/rtc/join`**
  - Request body: `{ audio_enabled?: boolean, video_enabled?: boolean }`
  - Rejects `409` if `meeting.status === "cancelled" || meeting.status === "ended"`.
  - If `meeting.status === "scheduled"` and caller is organizer/admin, optionally auto-transitions to `live`.
  - Prunes peers whose `last_seen_at < now() - 15 seconds`.
  - Returns `200`:
    ```json
    {
      "data": {
        "peer_id": "peer-abc123",
        "max_recommended_peers": 6,
        "ice_servers": [
          { "urls": ["stun:stun.l.google.com:19302"] }
        ],
        "peers": [
          {
            "peer_id": "peer-xyz789",
            "user_id": 3,
            "name": "Ama Osei (Operations Mgr)",
            "audio_enabled": true,
            "video_enabled": true,
            "screen_sharing": false,
            "last_seen_at": "2026-11-25T18:00:00Z"
          }
        ]
      }
    }
    ```
  - **TURN Configuration:** Read `DRIVECORE_TURN_URLS`, `DRIVECORE_TURN_USERNAME`, `DRIVECORE_TURN_CREDENTIAL` (or HMAC time-limited secret) from backend `.env` and append to `ice_servers[]` when configured.

- **`GET /api/v1/meetings/{id}/rtc/signals?peer_id={peerId}&after_id={int}`**
  - Updates `last_seen_at = now()` on `peer_id` (verifying `peer_id` belongs to authenticated `user.id`).
  - Optional query params: `audio_enabled` (`0|1`), `video_enabled` (`0|1`), `screen_sharing` (`0|1`) to sync media state on heartbeat.
  - Returns active `peers[]` (excluding expired peers >15s) and all signals where `to_peer_id === peer_id && id > after_id`, ordered by `id ASC`.

- **`POST /api/v1/meetings/{id}/rtc/signals`**
  - Request body: `{ from_peer_id: string, to_peer_id: string, type: "offer" | "answer" | "ice", payload: object }`
  - Verifies `from_peer_id` belongs to authenticated user and `to_peer_id` is an active peer in the same meeting.
  - Returns `201 { data: { id, created_at } }`.

- **`POST /api/v1/meetings/{id}/rtc/leave`**
  - Request body: `{ peer_id: string }`
  - Deletes peer record and its queued signals; returns `200 { data: { ok: true } }`.

---

## 2. Scoped User Deletion (`DELETE /api/v1/users/{id}?company_id={companyId}`)

- **Authorization:** Requires whole-company `users.manage`.
  - If caller has role `hr-admin-manager` (and is not `system-administrator` / `company-admin` / platform admin), reject `403` when target user holds any privileged role (`ceo`, `general-manager`, `finance-manager`, `credit-control-manager`, `system-administrator`, `company-admin`, `finance`).
- **Safety Guardrails (inside DB transaction with `lockForUpdate()`):**
  - Target user === authenticated caller → `409 Conflict` (`"You cannot delete your own account."`).
  - Target user is the last active `system-administrator` or `company-admin` in `company_id` → `409 Conflict` (`"Cannot delete the last active administrator for this company."`).
- **Soft-Delete / Membership Removal:**
  - Removes/soft-deletes target's membership in `company_id`, revokes all active Sanctum sessions/tokens for that user, and soft-deletes the user record if they belong to no other companies.
  - **Audit Integrity:** Historical foreign-key references (`audit_events`, `invoices`, `rentals`, `work_orders`, `meetings`, `messages`) remain intact with the user's historical name.
  - Writes audit event `action: "user.deleted"`, `entity_type: "user"`, `entity_id: target.id`.
- **Response:** `200 { data: { deleted: true, id: target.id } }`.

---

## 3. Company-Scoped Role Permissions Editor

- **`PATCH /api/v1/roles/{roleName}`**
  - Authorization: `system-administrator`, `company-admin`, or platform admin (`403` otherwise).
  - Body: `{ company_id: number, permissions: string[] }`.
  - Validates every permission slug against the canonical DriveCore permission catalogue (`422` for unknown slugs).
  - **Lockout Protection:** When `roleName === "system-administrator"` or `roleName === "company-admin"`, `permissions` MUST include `users.manage`, `roles.view`, and `settings.manage` (`422` otherwise).
  - Persists company-scoped override in `company_role_permissions (company_id, role_name, permissions_json)` so `GET /api/v1/roles?company_id=...` and `GET /api/v1/auth/me` immediately reflect the updated permissions.
  - Writes audit event `role.permissions_updated`.
  - Returns `200 { data: { name, permissions, is_customized: true } }`.

- **`POST /api/v1/roles/{roleName}/reset`**
  - Authorization: `system-administrator`, `company-admin`, or platform admin.
  - Body: `{ company_id: number }`.
  - Deletes company override for `(company_id, role_name)`, restoring canonical SRS defaults, logs `role.permissions_reset`, and returns `200 { data: { name, permissions, is_customized: false } }`.

---

## 4. Company Email / SMTP Setup & Test Delivery

- **Database Table (`company_mail_settings`):**
  - `company_id` (unique FK), `provider` (`google_workspace | microsoft_365 | zoho | resend | sendgrid | postmark | custom_smtp`), `host` (string 255), `port` (smallint 1–65535), `encryption` (`tls | ssl | none`), `username` (nullable string 255), `password_encrypted` (nullable text, Laravel `Crypt::encryptString`), `from_name` (string 120), `from_address` (string 255), `is_enabled` (boolean), `last_tested_at` (timestampTz nullable), `last_test_status` (`passed | failed | null`).
- **`GET /api/v1/companies/{id}/mail-settings`** (`settings.manage`, whole-company):
  - Returns settings with `has_password: boolean` — **NEVER** returns raw `password` or `password_encrypted`.
- **`PATCH /api/v1/companies/{id}/mail-settings`** (`settings.manage`, whole-company):
  - If `password` is omitted or empty string, preserve existing `password_encrypted`.
  - When `is_enabled === true`, outbound user invitations (`POST /api/v1/invitations`, `resend`) and password reset emails use the company's configured SMTP mailer dynamically (`Mail::build([...])`), falling back to global app mail if disabled.
  - Logs `company.mail_settings_updated`.
- **`POST /api/v1/companies/{id}/mail-settings/test`** (`settings.manage`, whole-company):
  - Body: `{ to_email: string }`.
  - Attempts live SMTP handshake + test message delivery using the company's saved settings, updates `last_tested_at` and `last_test_status`, and returns `200 { data: { ok: true, message: "...", tested_at: "..." } }` (or `422` with clear actionable error message if delivery/auth fails).

---

## 5. Finance Manager Default Permission Update

- Add `"quotations.manage"` to the canonical SRS default permission list for `finance-manager` (alongside existing `"quotations.view"` and `"quotations.approve_discount"`).
- Ensure `RoleSeeder` / default role matrix grants `finance-manager` `quotations.manage` for all newly seeded and existing companies unless overridden in `company_role_permissions`.

---

## 6. Required Feature Tests (`tests/Feature/MilestoneSixteenFiveSixTest.php`)
1. WebRTC signaling: two authenticated company users join a `webrtc_native` meeting via `/rtc/join`, exchange `offer`/`answer`/`ice` via `/rtc/signals`, verify driver invite-only scoping (`404` uninvited), and clean up on `/rtc/leave`.
2. User deletion: System Admin deletes non-self user (`200`), sessions revoked, user excluded from `GET /users`, historical audit/rental names intact; self-delete (`409`), last-admin delete (`409`), and HR deleting `ceo` (`403`) all rejected.
3. Role permissions: System Admin updates `operations-manager` permissions (`200`), verifies `GET /roles` & `GET /auth/me` reflect change, resets to defaults (`200`), and verifies `system-administrator` lockout guard (`422`).
4. Mail settings: System Admin saves Google Workspace SMTP config, verifies `GET` returns `has_password: true` without exposing raw password, leaves password blank on subsequent edit (secret retained), and runs `/mail-settings/test`.
5. Finance Manager default: seeded `finance-manager` holds `quotations.manage` and can `POST /api/v1/quotations`.
