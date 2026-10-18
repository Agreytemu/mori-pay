<p align="center">
  <img src="./assets/images/mori%20pay%20official%20logo.png" alt="Mori Pay official logo" width="360" />
</p>

# Mori Pay

A modern mobile-first wallet and payments experience for everyday money movement, built with Expo, NestJS, Prisma, and PostgreSQL.

Mori Pay combines a polished consumer finance interface with a production-minded backend designed around secure wallet operations, transaction ledgers, OTP-based sign-in, PIN protection, and typed API contracts across the stack.

<p align="center">
  <img src="https://img.shields.io/badge/Expo-57.0-000020?logo=expo&logoColor=white" alt="Expo 57" />
  <img src="https://img.shields.io/badge/React%20Native-0.86-61DAFB?logo=react&logoColor=white" alt="React Native 0.86" />
  <img src="https://img.shields.io/badge/NestJS-12-E0234E?logo=nestjs&logoColor=white" alt="NestJS 12" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-316192?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white" alt="Prisma 7" />
</p>

## Why Mori Pay

This repository is not a starter app; it is structured like a real fintech product:

- Mobile wallet flows for balance visibility, deposits, withdrawals, and transfers
- Secure account lifecycle with phone-based auth, OTP challenges, and PIN controls
- Money movement backed by a ledger-first architecture with explicit transaction records
- Shared contract layer to keep the mobile app and backend aligned
- API-first foundation with Swagger docs, environment validation, and throttling
- Designed to scale cleanly from prototype to production finance workflows

## Product overview

Mori Pay is built around a simple principle: every monetary change is traceable, valid, and explainable. The system models wallet balances, transaction entries, and account restrictions explicitly rather than relying on ad hoc state.

This makes it suitable for:

- personal wallet and account management
- merchant or bill payments
- payout and request flows
- PIN-protected account security
- trusted-device and session handling
- future integrations with providers like Abliner, SMS gateways, and KYC/AML flows

## Stack

### Mobile app

- Expo SDK 57
- React Native 0.86
- Expo Router
- TypeScript
- React Native Safe Area, theming, reusable UI primitives

### Backend

- NestJS
- Prisma ORM
- PostgreSQL
- Swagger docs
- Pino structured logging
- Request throttling and validation

### Shared contracts

- Typed domain models for auth, wallet, payments, transactions, and API responses
- Local package used by both app and server layers

## Repository structure

```text
mori-lipa/
â”œâ”€â”€ src/                          # Expo/React Native mobile app
â”‚   â”œâ”€â”€ app/                      # file-based routes and screens
â”‚   â”œâ”€â”€ components/               # reusable UI and feature components
â”‚   â”œâ”€â”€ data/                     # mock/store data for UI development
â”‚   â”œâ”€â”€ theme/                   # color system, tokens, and design config
â”‚   â”œâ”€â”€ utils/                   # formatting and helpers
â”‚   â””â”€â”€ ...
â”œâ”€â”€ server/                       # NestJS API
â”‚   â”œâ”€â”€ src/                     # application modules and services
â”‚   â”œâ”€â”€ prisma/                  # Prisma schema and migrations
â”‚   â”œâ”€â”€ .env.example             # environment template
â”‚   â””â”€â”€ package.json             # server scripts/deps
â”œâ”€â”€ packages/
â”‚   â””â”€â”€ contracts/               # shared TypeScript contracts
â”œâ”€â”€ app.json                     # Expo app config
â”œâ”€â”€ package.json                 # root app scripts and workspace setup
â”œâ”€â”€ tsconfig.json                # app TypeScript config
â”œâ”€â”€ README.md                    # project documentation
â”œâ”€â”€ LICENSE                      # project license
â”œâ”€â”€ .gitignore
â”œâ”€â”€ .npmrc
â”œâ”€â”€ .vscode/                    # editor config
â””â”€â”€ ...
```

## Core capabilities

### Wallet and account flows

- wallet dashboard with account balance card
- deposit and withdrawal screens
- payment method management
- profile and account security settings
- notification center and trusted devices

### Security and identity

- OTP-based login flow with expiry and retry controls
- PIN hashing and lockout support at the schema level
- trusted device tracking
- session-based architecture with refresh token support
- secure backend defaults with Helmet, validation, and CORS configuration

### Financial data model

The server schema is organized around real wallet primitives:

- User and account membership
- Wallet and ledger accounts
- Ledger entries as immutable transaction history
- Transaction objects with categories, direction, fees, and provider metadata
- Money requests and saved payment methods
- Notifications, audits, and limit usage tracking

This ledger-based model is a strong foundation for reconciliation, reporting, and future accounting controls.

### Fees and wallet limits

The current fee rules are stored in `FeeRule` and are created by the approved-fees migration:

- Card top-up: 4.5% added to the selected wallet credit amount. That gross total is sent to Abliner; the wallet receives the selected amount. Review the checkout page for any additional card-provider charges.
- Mobile-money withdrawal: the configured withdrawal fee is shown before PIN confirmation. ClickPesa payout fees are provider costs and are not passed through to the customer; bank payouts use a matching `withdrawal:bank` fee rule when configured.
- Wallet transfers and merchant payments: no fee unless a matching active rule is configured.

Fee totals are disclosed before confirmation and saved on each transaction. Outflow limits include both the transaction amount and its fee. Standard defaults are TZS 1,000,000 per rolling 24 hours and TZS 500,000 per transaction; Verified defaults are TZS 5,000,000 and TZS 3,000,000. These limits can be overridden using the `LIMIT_*` variables in `server/.env`.

Deposits can use a saved mobile-money number or a one-time custom number. Saved mobile numbers and bank payout account details are encrypted at rest with `PAYMENT_METHOD_ENCRYPTION_KEY`; configure a unique 32-byte base64 key and keep a secure backup. Saved cards are not charged directly: card deposits continue through Abliner's hosted checkout, where the payer enters card details.

### Transaction feedback

Confirmed deposits, withdrawals, wallet transfers, and merchant/QR payments show an in-app result and use a transaction-ID deduplicated success haptic. On native devices, Mori Pay may request notification permission after a successful transaction and show a private local completion notification; Android uses the `transaction-updates` channel. Notification taps open the authenticated transaction details screen. OS settings can suppress vibration or notifications.

Remote push notifications, push-token registration, and background/terminated delivery are not configured. The local notification and haptic history is best-effort device-side deduplication, not a guarantee of exactly-once delivery across reinstall, storage failure, or OS delivery behavior. Because the notification icon and Android channel are native configuration, rebuild the development/production app after changing this configuration.

### Merchant web portal

The responsive merchant portal is part of the existing Expo Router web application at `/merchant-dashboard`. Sign in through the existing Mori Pay email/password flow, then open **Profile → Merchant account → Open merchant dashboard**. The portal uses the existing bearer-token session and merchant approval records; it does not create a separate user database or payment engine.

Run the web client and API locally from the repository root:

```powershell
$env:EXPO_PUBLIC_API_URL = "http://localhost:4000/api/v1"
npm run server:dev
# In a second terminal:
npm run web
```

For production builds, set `EXPO_PUBLIC_API_URL` to the fully qualified API base URL ending in `/api/v1`, then run `npx expo export --platform web`. Deploy the generated `dist/` directory as a static site and configure the API's `CORS_ORIGINS` to allow the exact portal origin; production does not accept wildcard origins. Configure the static host to serve Expo's generated route files and SPA fallback as appropriate for the host.

The authenticated merchant endpoints are `GET /merchants/portal`, `GET /merchants/portal/transactions`, `GET /merchants/portal/transactions/:transactionId`, `GET /merchants/portal/transactions/export.csv`, and `GET /merchants/portal/qr`. They scope records to the signed-in owner's merchant ledger. Existing application, QR creation, and QR cancellation endpoints are reused. No new environment variables, database migration, payment fee, or payout capability is required by the portal.

Reports use posted merchant-ledger credits and customer transaction records. The displayed balance is an internal merchant ledger balance, not a bank settlement or guaranteed withdrawable balance. Merchant fees have not been configured; customer transaction fees are shown separately and are not described as merchant fees. The current backend does not retain merchant-linked pending or failed attempts; settlement, refund, and reversal reports are also unavailable because it has no merchant payout or reversal/refund records. QR secrets are stored as hashes and can only be displayed or printed at creation time; older QR values cannot be recovered. Business identity editing and notification preferences are not supported by the current API.

## Getting started

### Prerequisites

Before you begin, make sure the following are installed:

- Node.js 20+ or 22+
- npm 10+
- PostgreSQL 14+ or 16+
- Optional: Docker for local PostgreSQL if you prefer containerized setup

### Install dependencies

From the repository root:

```bash
npm install
```

This workspace also includes the backend package, so root scripts can launch both the app and the API.

### Environment setup

Create a backend environment file:

```bash
cp server/.env.example server/.env
```

Then update the values in `server/.env`, especially:

```env
DATABASE_URL="postgresql://user:pass@host:5432/mori_pay?schema=public"
JWT_ACCESS_SECRET="your-access-secret"
JWT_REFRESH_SECRET="your-refresh-secret"
LOG_LEVEL=debug
PORT=4000
```

For local development, the project includes a sample configuration with placeholders and comments in `server/.env.example`.

### Database setup

From the `server` directory:

```bash
cd server
npx prisma generate
npx prisma migrate dev
```

If you want to open Prisma Studio:

```bash
npm run prisma:studio
```

## Running the app

### Start the Expo app

```bash
npm start
```

Or explicitly:

```bash
npx expo star
```

For platform-specific launch:

```bash
npm run android
npm run ios
npm run web
```

### Start the API server

```bash
npm run server:dev
```

This runs the NestJS API in watch mode. By default, the app exposes:

- API base: `http://localhost:4000/api/v1`
- Swagger Docs: `http://localhost:4000/docs`
- Health checks: `http://localhost:4000/api/v1/health`

## Deployment

This project has two deployable parts:

1. the Expo mobile app
2. the NestJS API + PostgreSQL database

Each part should be deployed separately, with the app pointing to the deployed API URL.

### 1) Deploy the Expo app

The mobile app is best deployed through Expo Application Services (EAS).

#### Install EAS CLI

```bash
npm install -g eas-cli
```

Or use npx:

```bash
npx eas-cli@latest --help
```

#### Log in

```bash
npx eas-cli@latest login
```

#### Initialize EAS

```bash
npx eas-cli@latest init
```

This creates the EAS configuration used for build profiles and app metadata.

#### Configure app identifiers

Update the project values in `app.json` and create the Android/iOS app identifiers in your Expo/EAS project settings.

Typical required configuration:

- app name and slug
- bundle identifiers for Android/iOS
- icon/splash metadata
- deep link scheme (`lipanaagreytemu` in this repo)
- environment configuration for production settings

#### Create build profiles

Example `eas.json` profile structure:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

Use:

```bash
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest build --platform ios --profile production
```

#### OTA updates with EAS Update

After a build, you can ship JavaScript updates without re-submitting the app:

```bash
npx eas-cli@latest update --branch production --message "wallet hotfix"
```

For production builds, use a real API base URL in app config or environment settings rather than a localhost URL.

#### Recommended mobile production settings

- API URL should point to the deployed backend, not local development host
- Set it via `app.json` → `expo.extra.apiUrl` or `EXPO_PUBLIC_API_URL` (see section 4)
- disable debug-only flows in production builds
- set secure app names and correct bundle identifiers
- store build secrets in EAS environment variables when needed

### 2) Deploy the API backend

The backend is a NestJS app and should be deployed as a Node.js service.

Common deployment targets:

- Render
- Railway
- Fly.io
- DigitalOcean App Platform
- AWS ECS / EC2
- VPS with PM2 or Docker

#### Render deployment (recommended)

The repository ships a [`render.yaml`](./render.yaml) Blueprint that provisions
the API, a managed Postgres database and a Render Key Value (Redis) instance.

1. Push this repository to GitHub.
2. In the Render Dashboard choose **New + → Blueprint** and connect the repo.
3. Render reads `render.yaml` and creates:
   - `mori-pay-api` — the Node web service
   - `mori-pay-db` — managed Postgres 16 (private network only)
   - `mori-pay-kv` — Render Key Value / Redis (private network only)
4. Fill in the values marked `sync: false` when prompted (they are stored as
   secrets, never in git):

   | Variable | Notes |
   | --- | --- |
   | `CORS_ORIGINS` | Comma-separated allowed browser origins (Expo web / admin). |
   | `ABLINER_API_KEY` | Enabled Abliner key, starts with `tsl_live_`. |
   | `ABLINER_WEBHOOK_SECRET` | Exact webhook signing secret generated in Abliner Dashboard (starts with `whsec_`); do not use or prepend the API key. |
   | `ABLINER_CALLBACK_URL` | `https://<public-api-host>/api/v1/webhooks/abliner` (set to the deployed API host and register the exact URL with Abliner). |
   | `CLICKPESA_CLIENT_ID` / `CLICKPESA_API_KEY` | Optional ClickPesa application credentials. |
   | `CLICKPESA_CHECKSUM_KEY` | ClickPesa checksum key used to validate application webhook callbacks. |
   | `PAYMENT_METHOD_ENCRYPTION_KEY` | Unique base64-encoded 32-byte key used to encrypt saved mobile-money numbers and bank payout details; keep it stable and back it up securely. |
   | `RESEND_API_KEY` / `EMAIL_FROM` | Transactional email; required in production. Verify the sender domain in Resend first; use an address such as `noreply@agreyflix.online`. |
   | `SMS_API_KEY` | Credentials for the configured `SMS_PROVIDER`. |
   | `SENTRY_DSN` | Optional error reporting. |

   `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are generated by Render
   (`generateValue: true`).

5. The Blueprint is a npm workspace monorepo, so it builds from the **repo
   root** (not `server/`) and runs migrations on every deploy via
   `preDeployCommand`:

   ```bash
   # build
   npm ci && npm run build --workspace @mori-pay/server
   # pre-deploy (forward-only migrations)
   npm run prisma:deploy --workspace @mori-pay/server
   # start
   node server/dist/main.js
   ```

6. After the first deploy, register the exact public HTTPS `ABLINER_CALLBACK_URL`
   in the Abliner dashboard and confirm the health checks below are reachable.

#### ClickPesa collections and payouts

ClickPesa is optional. Configure
`CLICKPESA_CLIENT_ID`, `CLICKPESA_API_KEY`, and `CLICKPESA_CHECKSUM_KEY` together
to enable it in the administrator’s **System settings → Payment providers and
services** panel. The admin can independently enable both gateways and select
one primary provider for new mobile-money collections and mobile-money payouts.
Bank payouts use ClickPesa when it is enabled; Abliner bank payouts are not
implemented. The primary selection and enable flags are stored in PostgreSQL
and audited. Disabling a provider stops new requests on its flows without
deleting or changing existing transactions.

Under **System settings → Payment methods**, administrators can independently
show or hide mobile money, bank accounts, and cards in the app, including hiding
all three. The selection is audited and enforced by the API when a customer adds
or edits a method. Mobile-money forms ask customers to select a network before
showing the phone-number input.

In the ClickPesa application dashboard, configure the application webhook URL
as `https://<public-api-host>/api/v1/webhooks/clickpesa` for collections and
payouts, and enable webhook checksums with the matching checksum key. The
endpoint validates HMAC-SHA256 checksums and reconciles only transactions whose
reference, amount, currency, channel, and final status match. ClickPesa limits
create-payout requests to one per merchant every 60 seconds; Mori Pay reserves
that interval in PostgreSQL and does not release a wallet hold while the
provider result is uncertain. Bank account number and account-holder name are
encrypted at rest using `PAYMENT_METHOD_ENCRYPTION_KEY`; keep that key stable
and backed up, or existing bank payouts cannot be recovered after key loss.

The admin panel reports configured/enabled service status without polling
gateways. Current network assets are in `assets/images/` for M-Pesa, Airtel
Money, Mixx by Yas, and HaloPesa. There are no bank logos in the project assets;
the bank picker uses the supported-bank list returned by ClickPesa, so logos
are not required for the payout flow. ClickPesa does not provide a sandbox:
API calls against its production service can move real money, so automated
tests use stubs and do not call ClickPesa.

#### Abliner payment testing

Abliner does not provide a sandbox. Automated tests use the recorded fixtures
in `server/test/fixtures/abliner-contract.fixtures.ts` and never make provider
network calls. Before a production release, perform a controlled live smoke
test with at least TZS 500 and the public callback registered in the Abliner
dashboard; verify both the provider transaction status and Mori Pay ledger
result. Final provider callbacks can take about 25 seconds after a transaction
ends; the app keeps showing an animated pending state and checks Abliner after
a 30-second grace period if a callback has not updated the transaction. Do not
use real customer funds for automated tests.

For mobile-money numbers, Mori Pay uses Abliner's `/api/v1/lookup` result to
show and record the detected network on transaction details and receipts.
Abliner still performs the actual payment-rail routing.

#### Production operations checks

- Use `/api/v1/health` for process liveness and `/api/v1/health/ready` for
  readiness; Render routes traffic only after the readiness check succeeds.
- Render's `preDeployCommand` applies forward-only Prisma migrations before
  traffic reaches a release. Confirm the deploy log shows migration success,
  especially when a release adds or changes fee rules.
- Keep `RECONCILIATION_ENABLED=true`; the default sweeper checks provider
  transactions older than 180 seconds every 120 seconds. Review Render logs for
  `Reconciliation sweep failed`, `Sweep reconcile failed`, and repeated
  `outcome is unknown` warnings.
- For a delayed payment, check the transaction and Abliner status first, then
  allow webhook delivery or reconciliation to finish. Never manually credit or
  release a hold just because a webhook is late or absent.
- Before a live release, verify the callback URL and signing secret in both
  Render and Abliner, then run the controlled smoke test above and confirm the
  customer-visible fee, provider amount, transaction total, and balanced ledger.
- `SENTRY_DSN` is optional. Until an alert integration is configured, review
  Render application logs and failed readiness/deploy events as the operational
  signal.

#### Railway deployment

Railway is a simple option for a Node API plus PostgreSQL.

1. Create a new Railway project.
2. Add a PostgreSQL service.
3. Add a Node.js service from the repository.
4. Set the service root to `server`.
5. Set the start command:

```bash
npm run start:prod
```

6. Configure the service variables:

```env
NODE_ENV=production
PORT=8080
APP_NAME="Mori Pay API"
LOG_LEVEL=info
CORS_ORIGINS="https://yourmobileapp.com"
DATABASE_URL="postgresql://postgres:password@host:port/railway?schema=public"
JWT_ACCESS_SECRET="strong-random-access-secret"
JWT_REFRESH_SECRET="strong-random-refresh-secret"
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
OTP_TTL_SECONDS=300
OTP_MAX_ATTEMPTS=5
ABLINER_BASE_URL="https://abliner.net"
ABLINER_API_KEY="your-live-key"
ABLINER_WEBHOOK_SECRET="your-whsec-secret"
ABLINER_CALLBACK_URL="https://your-api.example.com/api/v1/webhooks/abliner"
CLICKPESA_CLIENT_ID="your-clickpesa-client-id"
CLICKPESA_API_KEY="your-clickpesa-api-key"
CLICKPESA_CHECKSUM_KEY="your-clickpesa-checksum-key"
PAYMENT_METHOD_ENCRYPTION_KEY="generate-a-unique-base64-32-byte-key"
SMS_PROVIDER="abliner"
```

7. Railway can provision the DB URL automatically; copy that value into `DATABASE_URL`.

#### Docker deployment

If you prefer self-hosting or a container-based workflow, use Docker.

Create a `Dockerfile` in the `server` directory:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 4000
CMD ["npm", "run", "start:prod"]
```

Then build and run:

```bash
docker build -t mori-pay-api ./server
docker run -p 4000:4000 --env-file ./server/.env mori-pay-api
```

For production, prefer a managed database instead of running Postgres in the same container unless you explicitly want a single-node setup.

#### Recommended production environment

Set these values in your hosting platform environment variables:

```env
NODE_ENV=production
PORT=4000
APP_NAME="Mori Pay API"
LOG_LEVEL=info
CORS_ORIGINS="https://yourmobileapp.com,https://admin.example.com"
DATABASE_URL="postgresql://user:pass@host:5432/mori_pay?schema=public"
JWT_ACCESS_SECRET="strong-random-access-secret"
JWT_REFRESH_SECRET="strong-random-refresh-secret"
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
OTP_TTL_SECONDS=300
OTP_MAX_ATTEMPTS=5
ABLINER_BASE_URL="https://abliner.net"
ABLINER_API_KEY="your-live-key"
ABLINER_WEBHOOK_SECRET="your-whsec-secret"
ABLINER_CALLBACK_URL="https://your-api.example.com/api/v1/webhooks/abliner"
CLICKPESA_CLIENT_ID="your-clickpesa-client-id"
CLICKPESA_API_KEY="your-clickpesa-api-key"
CLICKPESA_CHECKSUM_KEY="your-clickpesa-checksum-key"
PAYMENT_METHOD_ENCRYPTION_KEY="generate-a-unique-base64-32-byte-key"
SMS_PROVIDER="abliner"
```

> `NODE_ENV=production` makes the API fail fast on boot when a required value
> (Abliner key/secret, public HTTPS callback, Resend email config) is missing.

#### Build the server

```bash
cd server
npm install
npm run build
```

#### Run in production

```bash
cd server
npm run start:prod
```

If deploying on a platform that uses a build and start command, use:

- build: `npm run build`
- start: `node dist/main.js`

#### Health and docs checks

Once deployed, the service should expose (all under the global `/api/v1` prefix):

- `/api/v1/health` — liveness probe (process is up)
- `/api/v1/health/ready` — readiness probe (Postgres + heap); use this for the platform health check
- `/api/v1` — API base route for traffic
- `/docs` — Swagger UI (disabled in production)

### 3) Deploy PostgreSQL

The database is a critical dependency. Use a managed PostgreSQL service if possible.

Recommended providers:

- Supabase
- Neon
- Render Postgres
- Railway Postgres
- AWS RDS
- DigitalOcean Managed Database

#### Database setup steps

1. Create a PostgreSQL database
2. Set the database connection URL in `server/.env` or hosting env variables
3. Apply migrations after deployment (on Render this runs automatically as the
   Blueprint's `preDeployCommand`; run it manually on other hosts)

```bash
cd server
npx prisma generate
npx prisma migrate deploy
```

If the provider supports it, also set a backup strategy and enable SSL connections.

### 4) Connect the app to the deployed backend

The app resolves its API base URL in `src/lib/api.ts` with this precedence:

1. `EXPO_PUBLIC_API_URL` environment variable (per-environment, Expo inline)
2. `app.json` → `expo.extra.apiUrl`
3. Fallback: `http://localhost:4000/api/v1` (local development)

So for production, either set the value in `app.json`:

```json
{ "expo": { "extra": { "apiUrl": "https://api.yourdomain.com/api/v1" } } }
```

or provide `EXPO_PUBLIC_API_URL` when building/starting (e.g. `.env.production`):

```
EXPO_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
```

The server mounts the REST API under the `/api/v1` prefix, so the base URL must
include that prefix. Use environment files or app config for this separation so
you do not accidentally point the production app to localhost.

### 5) Production deployment checklist

Before going live, confirm the following:

- `DATABASE_URL` points to the real production database
- JWT secrets are strong and unique
- CORS origins include only the actual domains you use
- `NODE_ENV=production`
- API and Swagger endpoints are reachable
- EAS build and app identifiers are set correctly
- app uses production API URL, not local development host
- SSL/HTTPS is enabled everywhere
- backups and monitoring are configured

### 6) Simple deployment flow

For a typical setup:

1. Deploy PostgreSQL
2. Deploy backend to Render/Railway/VPS
3. Run Prisma migrations
4. Verify `/api/v1/health/ready` and `/docs`
5. Configure production API URL in mobile app
6. Build the Expo app with EAS
7. Submit to stores or distribute via internal app builds

### 7) Best-practice deployment architecture

A clean production setup looks like this:

```text
Mobile app (Expo) -> API (NestJS) -> PostgreSQL
                           -> Render Key Value (Redis)
                           -> optional SMS provider
                           -> optional Abliner provider
```

This separation keeps the mobile client lightweight while the backend remains the source of truth for wallets, transactions, security, and business logic.

## Scripts

### Root workspace

```bash
npm start                 # expo start
npm run android           # launch Android
npm run ios               # launch iOS
npm run web               # launch web
npm run lint              # Expo lint
npm run typecheck         # TypeScript validation
npm run server:dev        # NestJS dev server
npm run server:build      # compile server
npm run server:lint       # server linting
npm run server:typecheck  # server typecheck
npm run server:test       # backend tests
```

### Server package

```bash
cd server
npm run build
npm run start
npm run start:dev
npm run start:debug
npm run lint
npm run typecheck
npm run test
npm run prisma:generate
npm run prisma:migrate
npm run prisma:deploy
npm run prisma:studio
```

## Architecture notes

This monorepo is intentionally split to keep concerns clean:

- `src/` is the end-user app layer
- `server/` is the backend authority for business logic and persistence
- `packages/contracts/` defines robust shared types used across both sides

That separation makes the project easier to evolve as the product grows, while keeping the mobile client and backend in sync through shared contracts instead of loosely duplicated models.

## API and developer workflow

The server includes:

- global validation with `ValidationPipe`
- CORS configuration
- Helmet security middleware
- request ID tracing
- Swagger/OpenAPI setup
- request throttling
- centralized exception handling
- structured logger configuration with pino

This gives the project a more production-like skeleton than a typical starter app, and it aligns with the expectations of a real service-backed fintech product.

## Development conventions

- Prefer typed interfaces over loose JSON structures
- Treat money as integer-based TZS amounts; never use floating point for balances or transaction totals
- Keep business logic in the server, not the mobile app
- Use the shared contracts package for API data alignment
- Favor explicit ledger and transaction records for all financial mutations

## Roadmap

Planned evolution for the project includes:

- OTP login and registration completion flow
- real payment provider integration
- wallet funding and payout orchestration
- enhanced KYC and risk controls
- transaction filtering and reporting
- push notifications and device sync
- production deployment pipeline
- automated quality gates and CI checks

## Contributing

Contributions are welcome. A good contribution usually includes:

1. a focused change with clear intent
2. type-safe implementation
3. validation via the relevant lint or TypeScript checks
4. a concise summary of the user-facing impact

Before submitting a patch:

```bash
npm run lint
npm run typecheck
npm run server:typecheck
```

## License

This project is licensed under the MIT license. See [LICENSE](LICENSE) for details.

## Project status

Mori Pay is in active product-oriented development and is structured as a real-world fintech application starter with a mobile client, typed API contracts, and production-minded backend architecture.

If you're building a wallet, mobile-money, or payments product, this repo is designed to give you a stronger foundation than a plain starter template.
