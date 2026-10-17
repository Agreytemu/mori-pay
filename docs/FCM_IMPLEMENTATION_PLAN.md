# Mori Pay Unified FCM Implementation Plan

## Audit findings

Repository paths and behavior below were verified in the current monorepo:

- The root application is Expo SDK 57 / React Native 0.86, with Expo Router and `expo-notifications` configured in `app.json`. Notification display setup is in `src/lib/transaction-notifications.ts`; notification taps route to `/transaction/[id]` through `src/components/notifications/TransactionNotificationObserver.tsx`. This is an Expo managed/CNG app: there are no checked-in `android/` or `ios/` native projects.
- Mobile auth already carries stable `installationId`, platform, name, and optional `pushToken` in `DeviceInfo` (`packages/contracts/src/schemas.ts`). The backend upserts `Device` by `(userId, installationId)` in `server/src/auth/auth.service.ts`. `Device.pushToken` is already in `server/prisma/schema.prisma`. Account APIs list and remove devices under authenticated ownership.
- The existing backend is NestJS 12, Prisma 7, and PostgreSQL. `Notification` and `NotificationPreference` models and authenticated history/read/preference APIs already exist (`server/prisma/schema.prisma`, `server/src/account/account.controller.ts`, `server/src/account/account.service.ts`). Several transaction/payment paths write history rows in their business transaction using `server/src/account/notification-writer.ts`. Deposit and withdrawal settlement also finalizes asynchronously in `server/src/settlement/settlement.service.ts`.
- The two browser apps are Vite 7 + React: `admin-web/` and `merchant-web/`. Both authenticate with Mori Pay access/refresh tokens and the same `/auth` API; the merchant portal operates for a merchant owner, and the admin portal's sessions represent staff users. Neither currently has a service worker, Firebase SDK integration, or push-token registration. Their environment variables use the `VITE_` prefix. The native app uses `EXPO_PUBLIC_` for public build-time configuration.
- Production API deployment is described by `render.yaml`; it provisions PostgreSQL and Redis, runs Prisma deploy migrations, and has a public readiness endpoint. There is no Firebase Admin/FCM dependency or notification queue/worker in the server package. Local `server/.env` exists and is intentionally not read or modified.
- Existing example files are `server/.env.example`, `admin-web/.env.example`, and `merchant-web/.env.example`. Existing notification preferences are user-level, and no real Firebase project identifiers, VAPID key, or service-account credentials were present in the audited public configuration.

## Target architecture

Use one Firebase project, one server-side Firebase Admin client, and the existing Mori Pay PostgreSQL user/device/notification records. Web and Android clients obtain their platform-native FCM tokens and submit them only while authenticated. The backend binds each token to the authenticated `userId`, client platform, and stable installation ID; no client-supplied user ID grants ownership or recipient selection. The backend resolves recipients from trusted business events and sends minimal data-only or safe display payloads. Browser and Android tokens remain distinct native tokens.

Web admin and merchant sessions use the same backend identity model, but their audiences and authorization differ. A notification must be created for the appropriate authenticated user by trusted server logic; neither web client gets a send-to-user API. Admin-facing security or operational alerts must not be sent to ordinary account users, and merchant portal events must be restricted to the owning merchant user. Registration is opt-in and only attempted after a user gesture grants browser permission.

## Device/token lifecycle and API

- Reuse `Device` and its installation uniqueness constraint; extend its platform/token representation only if current platform values cannot safely distinguish iOS, Android, admin web, and merchant web.
- Add an authenticated token registration/update endpoint that validates installation ID, platform, and token; derives user ID from `@CurrentUser`; performs an ownership-safe upsert; and replaces stale token values without exposing them in responses/logs.
- Add authenticated unregistration, invoked on explicit opt-out/device removal and browser logout when possible. Existing account device removal already checks owner identity and must clear its stored token through cascading device deletion.
- Keep existing authenticated notification history/read APIs and preferences. Push delivery is a transport for existing eligible events, not a separate client-controlled notification authority.
- Record durable, idempotent delivery work linked to the existing notification/event record, with bounded retry state and per-device outcomes. Do not claim device delivery/read based on FCM acceptance. Invalid FCM tokens are cleared from their owning device. Financial transaction notification eligibility must use the committed authoritative status; delivery failure must never roll back a successful transaction.

## Event taxonomy and payload

Initial taxonomy follows existing functionality: transaction status (transfer/payment, deposit/top-up, withdrawal), money request, merchant-payment confirmation, and account/security events where the server already has an authoritative trigger. Audit each event source before wiring delivery. Use transaction/notification IDs as idempotency keys. Push payloads contain only a notification ID, event kind, and non-sensitive deep-link identifiers needed to fetch details after authentication. Never include balances, full account/phone/NIN data, credentials, or full financial references.

## Configuration and environment ownership

Select one canonical server credential method: Render-managed `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` (with newline normalization); permit the hosting platform's native identity only if available and verified. `FCM_ENABLED` explicitly controls initialization/delivery. Missing credentials disable FCM in development with a safe readiness/config status; production must fail startup or readiness when FCM is enabled but credentials are incomplete. Never expose server credentials in frontend or Expo public configuration.

Add only public Firebase Web SDK settings to the two Vite build environments using their `VITE_` convention: project ID, app ID, sender ID, API key, and VAPID public key. Add only the public Firebase project/app/sender configuration needed for the Expo build under Expo's public configuration convention. A VAPID key is public. Update example files and Render Blueprint variable definitions with placeholders/secret flags; do not edit production dashboards unless authorized dashboard access exists.

Required external operator configuration: create/register the two browser apps and Android app in the same Firebase project; enable Firebase Cloud Messaging and Web Push certificates; configure the Android package `com.mori_dev.lipanaagreytemu` and its Firebase Android app file through supported Expo config/build settings; set server credentials and public web configuration in hosting/build environments; and confirm production web origins and HTTPS domains.

## Web push

Each Vite app needs its own compatible Firebase Messaging service-worker entry at the deployed root scope, including correct production base-path and Firebase app initialization. Register only after a permission gesture, obtain/refresh an FCM web token using the configured VAPID key, and register it with the authenticated backend. Handle foreground display once, background messages/clicks, authenticated routing, denied/unsupported browsers, and cleanup. Verify current Firebase SDK and service-worker deployment requirements against official Firebase docs before implementation; ensure both static deployments serve the worker with JavaScript content type and no SPA HTML fallback.

## Android push

Retain Expo Notifications as the Android notification/permission/channel integration already configured in the app. Obtain a native device FCM token (not an Expo push-service token), register/update it with the authenticated backend, refresh it when the SDK reports a change, and unregister where possible at logout. Preserve existing foreground handling and transaction tap routing while adding safe notification-ID navigation. Configure the Android Firebase app through Expo app config/EAS secrets, not copied web settings or manually edited generated native projects. Validate APIs and package compatibility against Expo SDK 57 documentation before changing Expo code; the versioned Expo docs and docs index were unavailable from the current environment during this audit, so this is a verification prerequisite.

## Delivery/reliability and security

Use the existing Postgres deployment as durable state and avoid adding a permanent worker, Redis queue dependency, or paid service until hosting behavior and expected volume justify it. A delivery queue/outbox must be durable across process restarts, idempotent, bounded, observable, and processed without holding business transaction locks. Distinguish queued, FCM-accepted, failed, and read states. Redact tokens and credentials, validate payloads, apply the existing global throttling plus a narrower registration limit, and expose no unauthenticated or arbitrary-send endpoint.

## Deployment, testing, and rollback

Apply a forward-only Prisma migration through the existing Render pre-deploy command. Deploy backend schema/API before clients; configure server identity and Firebase project first; then deploy web workers/configuration and the Android development/production build. Roll back by disabling `FCM_ENABLED` and reverting clients/backend while retaining additive schema/data; do not delete notification history or device records as rollback.

Checks: focused backend tests for registration ownership, update/revoke, idempotency, invalid tokens, partial delivery and failure isolation; Prisma validation/migration checks; backend lint/typecheck/tests; both web TypeScript production builds; Expo lint/typecheck and config validation; targeted secret-leak checks. Real browser push, real Android delivery, production HTTPS/VAPID, and Firebase credentials require external configuration/devices and must be reported separately from mocked code verification.

## Acceptance criteria and blockers

Acceptance requires all three clients to register platform-native tokens against one backend/Firebase project; authenticated ownership and server-originated recipient selection; appropriate existing business events delivered without changing transaction success semantics; correct foreground/background/tap behavior; durable delivery observability and invalid-token cleanup; and reproducible setup/deployment instructions.

Current blockers to production verification are missing Firebase project/app identifiers, VAPID public key, server-side service identity, production dashboard access, and real browser/Android devices. Expo SDK 57-specific notification documentation could not be fetched in this environment. Implementation should complete code and mock verification where possible, and mark these external checks as unverified rather than claiming production delivery.
