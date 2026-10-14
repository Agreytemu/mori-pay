# Payments, Fees, QR and Merchant Implementation Checklist

Status is updated as implementation and verification proceed. The authoritative requirements are in [the PRD](./ussd-push-fees-qr-merchant-prd.md).

## Phase 1 — Documentation and repository mapping

- [x] Read `AGENTS.md`, schema, migration history, fee/top-up/withdrawal/payment services and existing tests.
- [x] Create repository-aligned PRD and checklist before beginning implementation.
- [x] Complete QR/merchant/mobile-flow architecture inventory and update the PRD with confirmed implementation details.

## Phase 2 — Fee policy and deposits

- [x] Add a forward-only fee-rule migration for approved deposit/withdrawal rates and explicit zero-fee internal channels; inspect idempotence and active-rule behavior.
- [x] Use exact integer fee arithmetic and document/test nearest-TZS, half-up rounding.
- [x] Add mobile-money fee preview and expose the same preview for card deposits.
- [x] Persist mobile-money principal, fee breakdown and total; collect principal plus fee and preserve exactly-once verified settlement of principal.
- [x] Bind confirmation to the previewed fee and add tests for retries, pending outcomes and fee/rate history.

## Phase 3 — Withdrawals

- [x] Keep the 2.5% configured customer fee separate from Abliner payout costs/quotes.
- [x] Preserve holds, idempotency, verified reconciliation and exactly-once failure refund.
- [x] Document/verify that card withdrawal is unavailable without card payout provider support.

## Phase 4 — Merchant application and accounts

- [x] Map auth/admin capabilities and existing audit patterns.
- [x] Add merchant ownership, application lifecycle, centrally configured optional registration fee and merchant-specific ledger attribution using forward migration(s).
- [x] Add wallet registration-fee payment, admin-only approval/rejection, audit records and authorization tests.
- [x] Keep registration fee unset by default and rejected-application refund policy explicitly unresolved.

## Phase 5 — QR payments

- [x] Complete personal QR scan/resolve/review/confirm through existing receive-code and transfer services.
- [x] Implement static and fixed-amount one-time/reusable merchant QR with backend-enforced expiry, revocation and usage.
- [x] Add an Expo SDK-compatible camera scanner only after confirming dependency availability and SDK 57 documentation.
- [x] Verify zero-fee internal QR payment logic, merchant ownership, PIN and idempotency in focused server tests; integration/database concurrency still requires a PostgreSQL-backed run.

## Phase 6 — Integration and verification

- [x] Run available fee, provider, deposit, withdrawal, reconciliation, QR and merchant tests (91 passed).
- [x] Run server lint/typecheck/build, mobile lint/typecheck and Android JS export.
- [ ] Check migration/schema consistency against PostgreSQL and run a native device build.
- [x] Update this checklist and the PRD with completed outcomes and precise unresolved external blockers.

## Current verified outcomes

- Documentation files created before implementation.
- Expo SDK 57, existing FeeRule, Transaction and ledger models, existing Abliner/withdrawal code and test runner identified.
- Fee/deposit/withdrawal code and forward fee migration implemented; full server tests passed (91 tests).
- Expo SDK 57-compatible `expo-camera` installed and camera permission configured; personal and merchant scan flows are integrated. Expo doctor reported five SDK patch mismatches (`@expo/ui`, `expo`, `expo-crypto`, `expo-router`, `expo-splash-screen`); camera itself matched the SDK.
- Merchant onboarding, optional wallet registration payment, role-protected admin lifecycle, merchant-specific ledger accounts, QR create/preview/pay/revoke and mobile owner/customer flows are implemented. Server lint, typecheck and build passed; mobile lint, typecheck and Android JS export passed.
- `git diff --check` passed.

## Current blockers (not yet tested)

- Card payout provider integration does not exist.
- Merchant registration fee and rejected-paid-application refund policy are not established.
- Forward migrations have not been applied to a PostgreSQL database; no production database, live provider settlement, or physical-device camera flow has been verified.
