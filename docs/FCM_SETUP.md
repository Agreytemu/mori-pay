# Mori Pay FCM setup and operations

Mori Pay uses one Firebase project. Android and both Vite portals register their native FCM tokens with the authenticated Mori Pay API; server-side business events decide recipients and create delivery records. The app does not use Firebase Authentication, client-side notification sends, FCM topics, or Expo Push Service.

## Firebase project and apps

1. Create or select the single Firebase project for Mori Pay and enable Firebase Cloud Messaging.
2. Register separate Firebase apps in that project for:
   - Android package `com.mori_dev.lipanaagreytemu`.
   - The admin web portal.
   - The merchant web portal.
3. In Firebase Console > Project settings > Cloud Messaging, configure Web Push certificates and record the VAPID public key.
4. Download the Android app's `google-services.json`. Keep the file outside source control; the root `.gitignore` excludes it.
5. Create a server service account authorized to send FCM messages. Store its project ID, client email, and private key only in the API hosting environment. Do not upload this server key to a web build or Android app.

Firebase web API keys, app IDs, sender IDs, project IDs, and the VAPID key are public application configuration, not server credentials. Restrict public API keys in Google Cloud to the needed APIs and application origins where supported.

## Backend environment

Set these variables on the API service in Render (or the actual server host) before setting `FCM_ENABLED=true`:

| Variable | Value |
| --- | --- |
| `FCM_ENABLED` | `true` |
| `FIREBASE_PROJECT_ID` | Shared Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Server service-account email |
| `FIREBASE_PRIVATE_KEY` | Server service-account private key; preserve newlines or use `\n` escapes |
| `ADMIN_WEB_URL` | HTTPS production origin of the admin portal |
| `MERCHANT_WEB_URL` | HTTPS production origin of the merchant portal |

The API normalizes escaped `\n` in the private key. Keep FCM disabled (`FCM_ENABLED=false`) while configuring the project. When enabled, startup rejects incomplete Firebase credentials; production also requires both HTTPS portal origins. Health liveness reports only whether FCM is enabled, never credential values. Configure origins in Render's protected environment, not in committed runtime files. `render.yaml` contains all variable names as dashboard prompts; adding those declarations does not set production values.

Use the matching placeholders in [server/.env.example](../server/.env.example) for local development. Use a test Firebase project and a test service account locally. Never copy production `.env` values into the repository, examples, logs, or support tickets.

## Web portals

Configure each portal's build environment using its own Vite app registration:

```dotenv
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_VAPID_KEY=
```

Place the admin values in `admin-web/.env.local` or the admin hosting build environment, and merchant values in `merchant-web/.env.local` or its hosting build environment. The root ignore rules exclude local `.env` files; do not include private credentials in any `VITE_` variable.

After a user chooses **Enable** while signed in, a supported HTTPS browser registers the portal-root `firebase-messaging-sw.js`, asks for notification permission, obtains an FCM token, and sends the token to the authenticated API. `localhost` is supported for development. The worker is copied from each portal's `public/` directory to its build root; static hosting must serve it at `/firebase-messaging-sw.js` with JavaScript content type and must not rewrite it to `index.html`. Background display and clicks use FCM's web notification link; foreground notifications are displayed once by the portal. On logout, the portal unregisters its installation before revoking its API session.

Build and deploy independently:

```powershell
npm --prefix admin-web run build
npm --prefix merchant-web run build
```

Both production origins must use HTTPS and be included in API `CORS_ORIGINS`. Configure the Firebase Web Push certificate in the same Firebase project as the server.

## Android app

The app is Expo SDK 57, uses `expo-notifications`, and declares an Android notification channel named `transaction-updates`. Android push requires a development or production build; remote notifications do not work in Expo Go on Android. The app creates the channel and requests notification permission the first time its main interface opens. If permission was previously denied, the user can retry from the **Enable Android push notifications** control on the in-app Notifications screen.

All EAS build profiles enable FCM and validate the Android Firebase file before building. The app config uses `server/google-services.json` by default, and `.easignore` explicitly includes this client Firebase app configuration in the EAS archive while continuing to exclude service-account credentials. It must contain the Android package `com.mori_dev.lipanaagreytemu`; builds fail early if it is missing, invalid, or mismatched. `GOOGLE_SERVICES_JSON` may override the path when building with a different Firebase app config. The client obtains a native Android device token (not an Expo push token), registers it while authenticated, and unregisters on logout.

Build through EAS after setting the Android file and signing credentials:

```powershell
npx eas-cli@latest build --platform android --profile development
npx eas-cli@latest build --platform android --profile production
```

The server's Firebase Admin service account sends directly to the native device token. An EAS FCM service-account upload for Expo Push Service is not part of this design. A development build or a production-compatible Android device is required to verify end-to-end delivery.

## API and data behavior

- `PUT /api/v1/account/push-devices` registers/replaces the authenticated user's token. Required body: `{ "name": "...", "platform": "android" | "ios" | "web", "clientApp": "mobile" | "admin-web" | "merchant-web", "installationId": "...", "token": "..." }`. The server enforces that web clients use `web`, and mobile clients use a native platform. It derives ownership from the bearer session and returns no token.
- `DELETE /api/v1/account/push-devices/:installationId` removes the authenticated user's token for that installation. Existing device removal and logout revoke/clear stored tokens as well.
- Existing `/api/v1/account/notifications` history/read APIs remain authoritative. History now includes `deliveryStatus`: `not_queued`, `queued`, `sent_to_fcm`, `partially_sent`, or `failed`. `sent_to_fcm` means only that FCM accepted a send; it does not mean the device displayed it or that it was read. `read` remains a separate in-app state.
- `NotificationDelivery` rows are created in the same database transaction as the source notification/business transition, uniquely per notification and device. A bounded API-process poller claims work durably, retries failures with exponential backoff (maximum five attempts), removes confirmed-invalid tokens, and records per-device outcomes. FCM errors do not reverse committed wallet/payment transactions.
- Push content is intentionally generic and contains only notification kind and identifiers. The app fetches any transaction detail through its authenticated API. Recipients originate from server-side business logic; there is no client send API or private topic subscription.

The initial event sources are existing transaction notifications for immediate completed transactions, settlement status changes, and existing incoming money requests. Pending transactions are not pushed before an authoritative terminal status. Security, refund/reversal, and other event categories require a verified existing server-side event before being wired; they are not fabricated.

## Migrations and deployment sequence

The `20261017130000_add_fcm_delivery` migration adds the client-app discriminator, enforces unique non-null FCM tokens (clearing duplicate legacy token values), and creates durable delivery rows/indexes. The Render Blueprint applies migrations through its existing pre-deploy command:

```powershell
npm run prisma:deploy --workspace @mori-pay/server
```

Deploy backend code/schema first with FCM disabled, configure and validate Firebase server variables, deploy both Vite builds with their public config, create an Android build with its Firebase app file, then enable FCM. Keep `FCM_ENABLED=false` to pause sends without rolling back business transactions. The migration is additive; rollback should disable FCM and roll back code without deleting history or delivery records.

## Verification and troubleshooting

From the repository root:

```powershell
npm run server:lint
npm run server:typecheck
npm run server:test
npm run admin:web:build
npm run merchant:web:build
npm run lint
npm run typecheck
npx expo config --type public
```

Confirm the Android app has the expected package and Firebase file path in Expo's resolved config. Use the browser's site settings and developer console to check permission state, HTTPS, service-worker scope/response content type, VAPID configuration, and `getToken` errors. Check API logs for FCM error codes only; tokens and private key values are not logged. A token marked invalid is cleared and the browser/app must register again. A queued delivery retries transient FCM failures; inspect its status and bounded attempt count in PostgreSQL. FCM acceptance does not prove a visible notification.

The repository does not contain the Firebase project/app identifiers, VAPID key, service-account credentials, Android `google-services.json`, production dashboard values, or production portal domains. Configure those with the authorized operators before enabling production delivery. No real browser or Android device delivery can be claimed until that setup is complete and tested.
