## Render deployment

This repo can be deployed to Render as a single Node web service serving both the API and the built frontend.

### Render settings

- Service type: `Web Service`
- Runtime: `Node`
- Build command: `npm ci && npm run build`
- Start command: `npm run start`
- Health check path: `/api/healthz`
- Public URL: `https://nixyah.onrender.com`

If you use Render Blueprints, the repo now includes [render.yaml](/Users/macbookpro/Downloads/Project-Document-Reviewer/render.yaml).

### Required environment variables

These must be set in Render before the service can boot correctly:

- `DATABASE_URL`
- `ADMIN_TOKEN`
- `SECRET_TOKEN`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `PAYSTACK_SECRET_KEY`

These are strongly recommended for real production behavior:

- `APP_BASE_URL=https://www.nixyah.com`
- `CORS_ORIGINS=https://www.nixyah.com,https://nixyah.onrender.com`
- `ADMIN_EMAIL`
- `RESEND_API_KEY`
- `RESEND_FROM`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `TURNSTILE_SECRET_KEY`
- `VITE_TURNSTILE_SITE_KEY`
- `VITE_PAYSTACK_PUBLIC_KEY`

### Verification checklist

After deploy, confirm these endpoints on the live service:

- `https://nixyah.onrender.com/api/healthz`
- `https://nixyah.onrender.com/api/support`
- `https://nixyah.onrender.com/api/tokens/packages`
- `https://nixyah.onrender.com/api/csrf-token`

Expected results:

- `/api/healthz` returns JSON with `ok: true`
- `/api/support` returns JSON, not HTML
- `/api/tokens/packages` returns `packages`, `providers`, and `defaultProvider`
- `/api/csrf-token` returns JSON with a CSRF token

### Important note about the current remote

The local repo and `origin/main` currently diverged earlier in the session. The deployment-safe code was published to the branch `copilot/paystack-hardening`.

If Render is configured to deploy from `main`, either:

1. merge that branch into `main`, or
2. temporarily point the Render service at `copilot/paystack-hardening`

Until one of those happens, `https://nixyah.onrender.com` will continue to serve the older code already running on Render.