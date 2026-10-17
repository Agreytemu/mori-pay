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

## Favicons, SEO and web app metadata

The console ships a complete icon set, a web app manifest, social/SEO metadata
and crawler files. The icon set (`favicon.ico`, `favicon-16/32/48`, the
`apple-touch-icon`, the 192/512 app icons, the maskable icon and `og-image.png`),
`public/site.webmanifest` (installable PWA + iOS/Android icons) and
`public/browserconfig.xml` (Windows tiles) are committed. `robots.txt` and
`sitemap.xml` are generated at build and dev time, so they are not committed.

Configure the deployment origin and indexing policy in the hosting provider's
build environment:

```env
VITE_SITE_URL=https://admin.example.com   # canonical origin, no trailing slash
VITE_ALLOW_INDEXING=false                 # true only for a public, indexable site
VITE_GOOGLE_SITE_VERIFICATION=            # optional Search Console token
```

- `VITE_SITE_URL` fills the canonical link, the Open Graph/Twitter URLs and the
  `sitemap.xml`, and provides the `Sitemap:` line in `robots.txt`.
- `VITE_ALLOW_INDEXING=false` (the default) emits
  `<meta name="robots" content="noindex, nofollow">` and `Disallow: /`, which is
  correct for a private staff console. Set it to `true` to allow crawling.
- `VITE_GOOGLE_SITE_VERIFICATION` injects the `google-site-verification` meta tag.

Replace the `admin.example.com` placeholder with the real origin before going
live. To make the console findable on Google, set `VITE_ALLOW_INDEXING=true`,
deploy, then verify the property in Google Search Console and submit
`https://<origin>/sitemap.xml`.

## Current limitations

- The console currently verifies that the signed-in user has the existing
  `admin` role and grants only the `admin:access` capability.
- MFA/step-up authentication, staff provisioning, granular roles, and the
  operational modules are not implemented. Do not treat this foundation as
  production-ready staff access until the plan's login and provisioning
  decisions are approved.
- No user, transaction, merchant, audit, finance, or system-setting records
  are currently exposed by this website.
