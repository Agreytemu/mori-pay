# Mori Pay Merchant website

This is a separately buildable and deployable website for larger merchant
management. It uses Mori Pay's existing authentication and merchant API; the
Expo mobile app keeps its own approved-merchant dashboard.

Unauthenticated visitors see a merchant landing page describing the available
workspace features and onboarding flow. Signing in uses only the existing Mori
Pay email/password or email/PIN options. The workspace overview welcomes the
signed-in user by first name when available from the session.

## Local development

Install the standalone website dependencies and start it from the repository
root:

```sh
npm ci --prefix merchant-web
npm run merchant:web
```

Create `merchant-web/.env.local` with the Mori Pay API's public base URL:

```env
VITE_MORI_API_URL=https://api.example.com/api/v1
```

For local development, use `http://localhost:4000/api/v1` if the API is running
locally. This URL is public configuration, not a secret. Never put API keys,
payment encryption keys, or other server secrets in a `VITE_` variable.

## Production build and deployment

Build and deploy the standalone merchant site from the repository root:

```sh
npm ci --prefix merchant-web
npm run merchant:web:build
```

Publish the generated `merchant-web/dist` directory to a static website host.
Set `VITE_MORI_API_URL` in the hosting provider's build environment before
building. The checked-in `.env.example` uses the API host currently referenced
by the server's Abliner webhook callback; confirm the actual API deployment URL
before routing production website traffic.

Add the website's exact origin (scheme and hostname, no path) to the API
server's production `CORS_ORIGINS` allowlist, for example:

```env
CORS_ORIGINS=https://merchant.example.com,https://existing-app.example.com
```

Keep the API on HTTPS and restrict CORS to the real deployed app and website
origins. Authentication uses only Mori Pay's existing email/password or
email/PIN login endpoints. The short-lived bearer-token session is held in
`sessionStorage` and is cleared when the browser tab session ends. Any signed-in
user can check their merchant application status; access to merchant data and
QR operations remains enforced by the authenticated backend.

## Favicons, SEO and web app metadata

The portal ships a complete icon set, a web app manifest, social/SEO metadata
and crawler files. The icon set (`favicon.ico`, `favicon-16/32/48`, the
`apple-touch-icon`, the 192/512 app icons, the maskable icon and `og-image.png`),
`public/site.webmanifest` (installable PWA + iOS/Android icons) and
`public/browserconfig.xml` (Windows tiles) are committed. `robots.txt` and
`sitemap.xml` are generated at build and dev time, so they are not committed.

Configure the deployment origin and indexing policy in the hosting provider's
build environment:

```env
VITE_SITE_URL=https://merchant.example.com   # canonical origin, no trailing slash
VITE_ALLOW_INDEXING=false                    # true only for a public, indexable site
VITE_GOOGLE_SITE_VERIFICATION=               # optional Search Console token
```

- `VITE_SITE_URL` fills the canonical link, the Open Graph/Twitter URLs and the
  `sitemap.xml`, and provides the `Sitemap:` line in `robots.txt`.
- `VITE_ALLOW_INDEXING=false` (the default) emits
  `<meta name="robots" content="noindex, nofollow">` and `Disallow: /`, which is
  correct for a private merchant portal. Set it to `true` to allow crawling.
- `VITE_GOOGLE_SITE_VERIFICATION` injects the `google-site-verification` meta tag.

Replace the `merchant.example.com` placeholder with the real origin before going
live. To make the portal findable on Google, set `VITE_ALLOW_INDEXING=true`,
deploy, then verify the property in Google Search Console and submit
`https://<origin>/sitemap.xml`.

## Current backend limitations

Pending and failed merchant attempts are not linked to the merchant ledger;
merchant fees, settlements, payouts, refunds, and reversals are not supported
by the current backend. The website labels those values as unavailable rather
than reporting invented totals. Previously created QR secrets cannot be
recovered; a newly generated QR must be saved or printed when it is created.
