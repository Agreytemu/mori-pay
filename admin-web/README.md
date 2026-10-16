# Mori Pay Admin Console

Standalone staff operations website. The first delivery stage implements
password sign-in, backend-confirmed admin authorization, session refresh,
logout, and the responsive console shell. Operational modules are explicitly
marked as planned until their APIs and policies are delivered.

## Local development

Create `admin-web/.env.local` with the public API base URL:

```env
VITE_MORI_API_URL=http://localhost:4000/api/v1
```

Then install and run:

```sh
npm ci --prefix admin-web --workspaces=false
npm run admin:web
```

## Build and deployment

```sh
npm ci --prefix admin-web --workspaces=false
npm run admin:web:build
```

Deploy `admin-web/dist` to a dedicated HTTPS origin. Add that exact origin to
the API's production `CORS_ORIGINS` allowlist. The Vite environment variable
contains only the public API URL; never put secrets in browser configuration.

The website sends credentials to the existing `/auth/email/login` endpoint,
then verifies the access token against `/admin/session` before storing tokens
in tab-scoped `sessionStorage`. The API checks the persisted admin role for
every protected admin-session request. The UI is not an authorization
boundary.

## Current limitations

- The console currently verifies that the signed-in user has the existing
  `admin` role and grants only the `admin:access` capability.
- MFA/step-up authentication, staff provisioning, granular roles, and the
  operational modules are not implemented. Do not treat this foundation as
  production-ready staff access until the plan's login and provisioning
  decisions are approved.
- No user, transaction, merchant, audit, finance, or system-setting records
  are currently exposed by this website.
