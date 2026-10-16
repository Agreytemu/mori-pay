# Mori Pay Merchant website

This is a separately buildable and deployable website for larger merchant
management. It uses Mori Pay's existing authentication and merchant API; the
Expo mobile app keeps its own approved-merchant dashboard.

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
origins. Authentication uses Mori Pay's existing email/password, email/PIN, or phone
SMS OTP login endpoints. Phone OTP requires the number already linked to an
existing Mori Pay account; new users must register in the mobile app first.
The short-lived bearer-token session is held in `sessionStorage` and is cleared
when the browser tab session ends. Any signed-in user can check their merchant
application status; access to merchant data and QR operations remains enforced
by the authenticated backend.

## Current backend limitations

Pending and failed merchant attempts are not linked to the merchant ledger;
merchant fees, settlements, payouts, refunds, and reversals are not supported
by the current backend. The website labels those values as unavailable rather
than reporting invented totals. Previously created QR secrets cannot be
recovered; a newly generated QR must be saved or printed when it is created.
