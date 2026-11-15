# DriveCore Production Authentication & Deployment Setup

This document captures the required **Laravel API (`drivecore-backend`)** and **Next.js BFF (`drivecore-frontend/apps/web`)** environment configuration needed for production cookie-based Sanctum authentication, without requiring backend source code edits.

---

## 1. Root Cause Summary (`www.drivecore.innovize-tech.com` -> `api.drivecore.innovize-tech.com`)

Probing the live production deployment surfaced why sign-in fails with `GET /api/backend/api/v1/auth/me 401 (Unauthorized)`:

1. **Split Route Middleware in Laravel (`routes/web.php` vs `routes/api.php`)**:
   - `POST /api/v1/auth/login` is registered in `drivecore-backend/routes/web.php` (`web` middleware), so login sets the encrypted session cookie regardless of Sanctum stateful-domain matching.
   - `GET /api/v1/auth/me` and all `/api/v1/*` domain routes live in `drivecore-backend/routes/api.php` behind `auth:sanctum` and `$middleware->statefulApi()`.
   - When the remote API `.env` omits the frontend hostnames from `SANCTUM_STATEFUL_DOMAINS`, Sanctum skips cookie session middleware on `GET /api/v1/auth/me` and immediately returns `401 Unauthorized` right after `POST /api/v1/auth/login` succeeds.
   - Probing `https://api.drivecore.innovize-tech.com/sanctum/csrf-cookie` directly showed `Access-Control-Allow-Origin: http://localhost:3000`, confirming the remote Laravel server `.env` still carries local development defaults.
2. **Session Cookie Name Naming (`drivecore-session` vs `drivecore_session`)**:
   - Laravel `config/session.php` derives the default cookie name as `Str::slug(env('APP_NAME', 'laravel')) . '-session'`. With `APP_NAME=DriveCore`, the backend emits `Set-Cookie: drivecore-session=...` (hyphenated).
   - `apps/web/.env.example` previously listed `drivecore_session` (underscore), which causes `backend-proxy.ts` (`forwardedCookies` / `browserCookie`) to drop the session cookie if copied into an environment unchanged.
3. **Apex vs `www` Domain Alignment**:
   - `https://drivecore.innovize-tech.com` returns `308` to `https://www.drivecore.innovize-tech.com`. Supporting comma-separated origins in `DRIVECORE_APP_ORIGIN` prevents `403 Invalid request origin.` if traffic hits either hostname.

---

## 2. Required Backend Server Configuration (`api.drivecore.innovize-tech.com`)

Set these environment variables on the **Laravel API server** (no backend PHP code modifications required):

```env
APP_ENV=production
APP_DEBUG=false
APP_NAME=DriveCore
APP_URL=https://api.drivecore.innovize-tech.com

# Explicit web origins allowed by Sanctum & CORS (no wildcards with credentials)
CORS_ALLOWED_ORIGINS=https://www.drivecore.innovize-tech.com,https://drivecore.innovize-tech.com
SANCTUM_STATEFUL_DOMAINS=www.drivecore.innovize-tech.com,drivecore.innovize-tech.com

# Cookie & HTTPS enforcement matching Next.js BFF defaults
SESSION_DRIVER=database
SESSION_COOKIE=drivecore-session
SESSION_DOMAIN=null
SESSION_PATH=/
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=lax
AUTH_REQUIRE_HTTPS=true
```

After updating `.env` on the API server, refresh Laravel's configuration cache:

```bash
php artisan config:clear && php artisan config:cache
```

> **Reverse Proxy Note (`nginx` / TLS termination):**
> Because Laravel's `RequireSecureAuthentication` checks `$request->isSecure()`, ensure Nginx forwards `X-Forwarded-Proto https` (`proxy_set_header X-Forwarded-Proto $scheme;`) and Laravel trusts the upstream TLS proxy (configured in `bootstrap/app.php` if terminated behind a reverse proxy or Cloudflare). Note that `/api/v1/auth/login` returning `422` over the Next proxy confirms `$request->isSecure()` currently passes, so the primary blocker is `SANCTUM_STATEFUL_DOMAINS` / `CORS_ALLOWED_ORIGINS`.

---

## 3. Required Frontend Runtime Configuration (Vercel / Next.js)

Configure these server-only environment variables in the Next.js deployment:

```env
DRIVECORE_API_ORIGIN=https://api.drivecore.innovize-tech.com
DRIVECORE_APP_ORIGIN=https://www.drivecore.innovize-tech.com,https://drivecore.innovize-tech.com
DRIVECORE_SESSION_COOKIE_NAME=drivecore-session
DRIVECORE_API_TIMEOUT_MS=15000
DRIVECORE_MODE=live
```

---

## 4. Verification Checklist After Updating API `.env`

1. **Verify backend CORS & session cookie name** (replace Origin header check):
   ```bash
   curl -i -H "Origin: https://www.drivecore.innovize-tech.com" https://api.drivecore.innovize-tech.com/sanctum/csrf-cookie
   ```
   - `Access-Control-Allow-Origin` must echo `https://www.drivecore.innovize-tech.com` (not `http://localhost:3000`).
   - `Set-Cookie` must include `XSRF-TOKEN` and `drivecore-session`.
2. **Verify frontend login in browser**:
   - Visit `https://www.drivecore.innovize-tech.com/login` (initial unauthenticated `GET /api/backend/api/v1/auth/me` returning `401` is normal before signing in).
   - Submit valid credentials: `POST /api/backend/api/v1/auth/login` returns `200`, followed by `GET /api/backend/api/v1/auth/me` returning `200` and navigating to `/companies`.
