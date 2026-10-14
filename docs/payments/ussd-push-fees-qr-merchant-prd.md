# Payments, Fees, QR and Merchant Accounts

**Status:** Core implementation complete; deployment and device verification pending
**Scope:** Extend the existing Mori Pay payment, ledger, provider and mobile flows; do not create parallel payment engines.

## Confirmed repository architecture

- The app is Expo SDK 57 / React Native with Expo Router. The API is NestJS, TypeScript, PostgreSQL and Prisma; `packages/contracts` holds shared API contracts.
- Wallets and balances are represented by `Wallet`, `LedgerAccount` and `LedgerEntry`. `Transaction` stores integer TZS amounts, fee, flat fee, fee rate and total.
- `FeesService.resolveFeeDetail()` reads active, amount-bounded `FeeRule` rows. Applied fee details are persisted on transactions. Its current percentage calculation truncates `Number(amount) * percentage`; the intended replacement uses integer arithmetic and an explicit rounding rule.
- `TopUpsService` already creates internal deposit records before contacting Abliner, uses the transaction ID as provider idempotency key, preserves retryable unknown outcomes as pending, and handles card checkout using a customer fee plus-on-top model. Card preview exists at `GET /topups/card/preview`. Mobile-money initiation currently records zero fee and sends only principal to Abliner.
- `SettlementService` and webhook reconciliation are the existing deposit/payout settlement path. Frontend polling does not itself settle funds.
- `WithdrawalsService` holds wallet funds and uses `SettlementService` for payout failure/success. It currently replaces the configured fee with Abliner's higher quote, so the provider cost can silently become the customer fee.
- Existing server tests use Node's test runner and include fee, withdrawal-fee, settlement, reconciliation, provider outcome, Abliner flow and receive-code coverage.
- Personal QR codes are rendered in the app and issued by `ReceiveCodeService` as HMAC-signed 10-minute codes. The app scanner verifies those codes through `POST /transfers/verify-receive-code` and continues through the existing transfer preview, review, PIN and ledger flow.
- Existing catalogue merchant payments still use their original flow. Merchant applications, persisted admin roles, merchant-owned ledger accounts, QR lifecycle and QR payment endpoints are implemented separately using forward-only migrations and the existing ledger executor.
- Migration order in the repository is `20250101000000_init`, then migrations dated 20261010, 20261012, 20261013, 20261014 and 20261015. The 20261014 migration disables prior card-deposit/mobile-money-withdrawal rules and inserts 4.5% card deposit and 2.5% mobile-money withdrawal rules. This is repository history, not confirmation of which migrations have run in production.
- `MoneyRequest` is a payer-phone request with amount/status/expiry, not a suitable merchant QR lifecycle without changing its meaning.
- Before implementation, the app had no camera/barcode scanner dependency; `react-native-qrcode-svg` renders codes only. Expo SDK 57 documentation identifies `expo-camera` `~57.0.6` and `CameraView` QR scanning, which is now installed and configured for QR-only camera permission (the scanner flow still needs app integration and device testing).
- `User.role` defaults to non-admin and merchant admin routes verify the persisted role. `AuditLog` records merchant fee, application-review and account-status administration actions.

## Product policy

All monetary values are integer TZS. Use the existing `FeeRule` and `FeesService`; do not add another fee engine.

| Transaction | Customer fee |
| --- | ---: |
| Mobile-money deposit | 2.5% |
| Card deposit | 4.5% |
| Mobile-money withdrawal | 2.5% |
| Card withdrawal | 4.5% policy reserved; unavailable until a genuine supported payout exists |
| Internal wallet transfer / personal QR | 0% |
| Merchant QR payment | 0% |
| Merchant registration | Paid, but amount remains unset until approved/configured |

Percentage fees are rounded to the nearest whole TZS, with half-TZS rounded up, using integer arithmetic. The rate and calculated fee are captured when the transaction is created; later rule changes do not rewrite transaction history. Customer fee and provider cost are distinct. Provider quotes must not increase the customer's approved fee.

## Deposit amount semantics

For a deposit principal `P` and disclosed customer fee `F`:

- `Transaction.amount = P`, the requested wallet credit.
- `Transaction.fee = F`.
- `Transaction.total = P + F`, the provider collection amount.
- Abliner receives `Transaction.total`; verified settlement credits `P` to the wallet and accounts for `F` separately.

Example: TZS 10,000 mobile-money principal, TZS 250 fee, TZS 10,250 collection and TZS 10,000 wallet credit.

Both mobile-money and card deposits must show authoritative amount, fee and total before confirmation. A provider timeout or unknown result remains pending until verified reconciliation. Preserve provider signing/references, webhook verification, idempotency and exactly-once settlement.

## Withdrawal behavior

Mobile-money payout charges the customer the configured 2.5% fee only. The wallet is held for principal plus customer fee. Abliner payout quote/cost is not passed through without an approved policy; keep provider outcome unknown as pending and retain existing safe hold/refund behavior. Card payout is not available because the current provider supports mobile-money payout only. Do not route it through card checkout.

## QR and merchant product requirements

### Personal receive QR

Reuse the existing HMAC-signed, 10-minute receive code and wallet transfer implementation. Backend verification resolves the recipient; user reviews verified identity and amount and confirms through existing PIN and ledger flows. Reject tampered/expired codes and self-transfer; keep transfers free and idempotent.

### Merchant accounts and QR

- A merchant account belongs to one MORI PAY user and is unavailable until required registration payment is verified (when a fee is configured) and an authorized administrator approves it.
- Registration fee is centrally configurable but initially unset. An unset fee blocks payment and merchant activation; never invent a price.
- Static merchant QR identifies an approved/active merchant and lets the customer enter amount.
- Fixed-amount merchant QR fixes amount server-side; support one-time and reusable codes with expiry/revocation and backend usage enforcement.
- Payments debit the payer and credit an account attributable to that merchant in the existing ledger, atomically. Merchant QR customer fee is zero.
- Prevent duplicate active applications. Pending payment, awaiting review, approved, rejected and suspended/revoked states must not grant merchant privileges prematurely.
- Do not infer or invent a refund policy for rejected paid applications; document that business decision.
- Protect admin configuration/review endpoints with backend authorization, default users to non-admin, and record administrative actions using `AuditLog`. If the current identity model has no safe role source, do not expose a self-service promotion path.

## Security and accounting invariants

- Do not accept frontend settlement claims or unverified webhook data as proof of payment.
- Use the existing provider request signing, provider references, webhook signature verifier, reconciliation lookup, idempotency and `SettlementService`.
- Record balanced ledger entries atomically with financial transaction state changes; never double-credit or release a hold twice.
- Never put PINs, credentials or secrets in QR codes.
- Verify merchant ownership, approval, active state, QR amount, expiry, revocation and use count on the backend.
- Registration payment uses a supported provider flow and verified settlement; never synthesize a charge.

## External dependencies and open business decisions

- A genuine card payout integration is missing; card withdrawals remain unavailable.
- Registration fee amount is undecided; keep the setting unset.
- Refund treatment for paid applications rejected by an administrator is undecided.
- Production migration application, live Abliner settlement, credentials, and device camera behavior require deployment/provider/device verification and are not asserted by repository tests.

## Implementation and verification status

- Mobile personal receive QR scanning, merchant QR scanning/payments, and merchant application/owner QR management are wired to the existing backend contracts and payment/PIN patterns.
- The merchant registration fee remains unset by default; the mobile flow explains that no payment can be requested while it is unset.
- Verification completed locally: server tests (91 passed), server lint/typecheck/build, mobile lint/typecheck, and `git diff --check`.
- Database migration application, live provider settlement, and physical-device camera/scanner behavior remain unverified.

## Acceptance criteria

1. Fee examples and amount/fee/total use the approved rates and integer rounding.
2. Mobile-money and card deposits disclose correct fees, collect principal plus fee, and settle only the principal after verified success.
3. Provider fees never silently increase the customer fee.
4. Mobile-money withdrawal fee remains 2.5%, keeps safe holds and refunds, and card withdrawal is not advertised or exposed.
5. Internal wallet/personal QR/merchant QR payments remain free.
6. Personal QR and merchant QR reject invalid, expired, revoked, self, unauthorized and duplicate flows as applicable.
7. Merchant settlement is attributable to the approved merchant; unpaid/unapproved users cannot use merchant features.
8. Registration amount is configurable and unset by default; no application is paid or activated without verified requirements.
9. Relevant server tests, app lint/typechecks and builds pass; this document and the checklist report remaining provider/business blockers accurately.
