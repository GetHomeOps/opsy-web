# Security Audit Report: "Connection Not Secure" Fix

**Date:** March 17, 2025  
**Scope:** Full frontend + backend audit for HTTPS/mixed content/security  
**Target:** https://app.heyopsy.com

---

## Executive Summary

The "Your connection to this site is not secure" warning was caused primarily by:

1. **Mixed content risk**: Frontend defaulted to `http://localhost:3000` when `VITE_BASE_URL` was unset in production builds
2. **Missing security headers**: No HSTS, no Strict-Transport-Security
3. **CORS**: Production domain `https://app.heyopsy.com` not in default allowed origins
4. **Environment variables**: Production `.env` may use HTTP values

---

## 1. Mixed Content

### Issues Found

| File | Line | Problem |
|------|------|---------|
| `homeops-frontend/src/api/api.js` | 4 | When `VITE_BASE_URL` is unset in production, fell back to `"http://localhost:3000"` → mixed content |
| `homeops-frontend/src/api/api.js` | 10 | `buildApiUrl` fallback used `"http://localhost:3000"` when `window` undefined |
| `homeops-frontend/vite.config.js` | 5 | `VITE_API_PROXY_TARGET` defaults to `http://localhost:3000` (dev only; OK) |
| `homeops-backend/docs/BILLING_SETUP.md` | 32 | Example uses `APP_BASE_URL=http://localhost:5173` (docs only) |
| `homeops-backend/docs/CALENDAR_INTEGRATION.md` | 38, 44, 60 | Examples use `http://localhost:3000` (docs only) |
| `homeops-backend/docs/GOOGLE_OAUTH.md` | 24–26, 45 | Examples use `http://localhost` (docs only) |
| `homeops-frontend/src/PROPERTY_DOCUMENTS_API.md` | 7, 166 | Example uses `http://localhost:3000` (docs only) |

### Fixes Applied

- **`homeops-frontend/src/api/api.js`**: Changed production fallback from `"http://localhost:3000"` to `""` so the app uses `window.location.origin` (same-origin) when `VITE_BASE_URL` is unset.

### Remaining (Non-Critical)

- SVG `xmlns="http://www.w3.org/2000/svg"` — XML namespace, not a network request; safe
- JSON schema `$schema`, `$id` — metadata only; safe
- Docs and examples — update when convenient; no runtime impact

---

## 2. Environment Variables

### Production Checklist

Ensure these are set in production (e.g. Railway, Cloudflare):

| Variable | Production Value | Notes |
|----------|------------------|-------|
| `APP_BASE_URL` | `https://app.heyopsy.com` | Used for emails, Stripe, OAuth redirects |
| `APP_WEB_ORIGIN` | `https://app.heyopsy.com` | OAuth, CORS |
| `CORS_ORIGINS` | `https://app.heyopsy.com` | Or leave unset to use defaults (now includes app.heyopsy.com) |
| `BACKEND_URL` | `https://app.heyopsy.com` | If same-origin deploy |
| `GOOGLE_REDIRECT_URI_SIGNIN` | `https://app.heyopsy.com/auth/google/callback/signin` | Must match Google Console |
| `GOOGLE_REDIRECT_URI_SIGNUP` | `https://app.heyopsy.com/auth/google/callback/signup` | Must match Google Console |
| `GOOGLE_CALENDAR_REDIRECT_URI` | `https://app.heyopsy.com/calendar-integrations/oauth/google/callback` | If using calendar |
| `MICROSOFT_REDIRECT_URI` | `https://app.heyopsy.com/calendar-integrations/oauth/outlook/callback` | If using Outlook |
| `VITE_BASE_URL` | `` (empty) | For same-origin; frontend uses `window.location.origin` |

### Fixes Applied

- **`homeops-backend/.env.example`**: Added production example block with HTTPS URLs for app.heyopsy.com.

---

## 3. Network Requests

### API Construction

- **`buildApiUrl()`**: Uses `BASE_URL` or `window.location.origin`; no HTTP hardcoding in production after fix.
- **Direct `fetch(\`${BASE_URL}/...\`)`**: Uses `BASE_URL`; when empty, template yields `/auth/refresh` etc. (relative URLs → same-origin).
- **`useDocumentUpload.js`**: Uses `buildApiUrl("documents/upload")` → correct.
- **Signin/Signup Google OAuth links**: Use `API_BASE_URL`; when empty, `href="/auth/google/signin"` → same-origin.
- **ContractorReportPage**: Uses `API_BASE_URL`; when empty, relative URLs → same-origin.

### No Issues Found

- `axios` not used; all requests via `fetch` or `buildApiUrl`/`API_BASE_URL`.

---

## 4. Cookies & Security

### Findings

- **Auth**: Uses JWT in localStorage (Bearer tokens), not cookies for auth.
- **`cookie-parser`**: Present; no `res.cookie()` usage found.
- **`trust proxy`**: `app.set('trust proxy', 1)` is set in `app.js` (line 59).

### If You Add Session Cookies Later

```javascript
res.cookie('session', token, {
  secure: true,
  httpOnly: true,
  sameSite: 'none',  // if cross-site; use 'lax' for same-site
  maxAge: 3600000,
});
```

---

## 5. Headers

### Fixes Applied

- **helmet** added with:
  - **Strict-Transport-Security (HSTS)**: 1 year, includeSubDomains, preload
  - **X-Frame-Options**: `sameorigin`
  - **X-Content-Type-Options**: `nosniff`
  - **Referrer-Policy**: `strict-origin-when-cross-origin`
  - **Content-Security-Policy**: Disabled for now; can be enabled with a custom policy later

### Optional CSP (Future)

```javascript
contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "https://fonts.googleapis.com"],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    imgSrc: ["'self'", "data:", "https:", "blob:"],
    connectSrc: ["'self'", "https://api.heyopsy.com"],
    frameSrc: ["https://js.stripe.com"],
  },
},
```

---

## 6. Redirects / Canonical URLs

### Findings

- No HTTP→HTTPS redirect logic in app; Cloudflare handles this.
- OAuth redirects use `APP_WEB_ORIGIN` / `AUTH_SUCCESS_REDIRECT`; must be HTTPS in production.
- Password reset, invitations, maintenance emails use `APP_BASE_URL`; must be HTTPS in production.

### Action

- Ensure all production env vars use `https://app.heyopsy.com` (or your canonical domain).

---

## 7. Summary of Code Changes

| File | Change |
|------|--------|
| `homeops-frontend/src/api/api.js` | Production fallback: `"http://localhost:3000"` → `""` |
| `homeops-backend/app.js` | Added helmet with HSTS and security headers; added `https://app.heyopsy.com` to CORS defaults |
| `homeops-backend/.env.example` | Added production HTTPS example block |
| `homeops-backend/package.json` | Added `helmet` dependency |

---

## 8. Deployment Checklist

1. Set production env vars (see Section 2).
2. Rebuild frontend with `VITE_BASE_URL=` (empty) for same-origin.
3. Redeploy backend so helmet and CORS changes take effect.
4. In Cloudflare: SSL/TLS = Full (strict), HSTS enabled.
5. Test: open https://app.heyopsy.com, confirm no mixed-content warnings in DevTools → Network.

---

## 9. Verification

After deploy:

1. Open https://app.heyopsy.com in an incognito window.
2. Open DevTools → Network; reload; ensure no blocked HTTP requests.
3. DevTools → Security: confirm "Secure connection" and valid certificate.
4. Check response headers for `Strict-Transport-Security`.
