# Mori Pay Admin Console — Product and Delivery Plan

**Status:** Implementation is in progress — Phases 1/2 and the read-only
feature scope of Phase 3 are implemented, as are staff-role capabilities,
provisioning/revocation controls, and read-only configuration visibility.
Phase exit and production approval remain open for representative-data and
PostgreSQL integration tests, broader audit coverage, MFA policy, and
deployment/operations controls. Controlled configuration and financial writes
remain blocked on explicit policy approval.
**Audience:** Product, engineering, and operations.

## 1. Goal

Build a secure, separately deployable Mori Pay operations website for authorized
staff to oversee the wallet application and merchant lifecycle. It should give
staff useful visibility and narrowly controlled operational actions without
creating a second payment engine or weakening the mobile app, merchant portal,
ledger, or provider reconciliation rules.

“Manage all of the app” is treated as an operations scope, not permission to
edit arbitrary database fields. All changes to customer, merchant, payment, or
configuration state must go through validated backend domain operations and
leave an attributable audit record.

## 2. Repository findings

The following reflects the current checkout, including files that were already
modified locally when this plan was written:

- The consumer application is Expo Router / React Native; the API is NestJS
  with Prisma and PostgreSQL; shared TypeScript contracts live in
  `packages/contracts`.
- `merchant-web/` is an existing standalone React/Vite website and can inform
  the admin site's separate-build/deploy pattern. Its session and UI are
  merchant-specific and should not be reused as an authorization boundary.
- The schema has a single `UserRole` distinction (`user` / `admin`), user
  status and account tier, transactions, wallet/ledger records, merchant
  applications/accounts/QRs, fee rules, webhook events, and audit logs.
- `AdminRoleGuard` looks up the persisted user role for protected merchant
  admin actions. The current checkout's merchant controller includes
  administrator endpoints for application review, registration-fee changes,
  and merchant-account status. These are a useful starting point, but they
  are currently part of the merchant controller rather than a general admin
  API.
- The current admin endpoints use the existing `AuditLog` for merchant
  actions. The admin API exposes session confirmation, overview, filtered
  audit, merchant-account listing, bounded user/transaction search and safe
  detail views. Merchant application review, account status changes, and
  registration-fee changes use existing merchant domain endpoints. The audit
  model is not yet a complete operations audit product; access/change coverage
  must be completed before production.
- The common auth response does not include the persisted role. The Phase 1
  foundation now verifies access through authenticated `GET /admin/session`;
  the guard checks the persisted admin role and active user status.
- A standalone `admin-web/` application now provides password sign-in,
  tab-scoped session storage, token refresh/logout, a protected shell, overview,
  merchant operations, audit filters, user and transaction search/details,
  read-only system settings, and a staff-access screen.
- Existing customer routes cover wallet, transactions, account, transfers,
  requests, top-ups, withdrawals, and merchants. The admin API includes
  bounded user and transaction search, safe individual details, ledger
  summaries, and webhook reconciliation summaries. Fine-grained staff
  permission APIs and broader provider/reconciliation operations remain
  outstanding.
- The overview shows all-time transaction counts by channel and unprocessed
  and error-bearing webhook counts. The settings screen reports a configuration
  snapshot and credential presence only; it does not perform live integration
  health checks.
- Production CORS is configured by an explicit origin allowlist. A separate
  admin website will need its exact HTTPS origin added to that allowlist.

**Working-tree note:** Merchant controller/service/schema/test changes were
already uncommitted at inspection time. This document does not stage, alter, or
claim ownership of those changes. Before implementation, confirm the
authoritative branch/commit and preserve unrelated local work.

## 3. Product principles and financial safety

1. **Backend is authoritative.** Hiding a screen or button is not access
   control. Enforce authentication, persisted role/permission, ownership,
   validation, and state-transition rules on every API request.
2. **Least privilege.** Start with a small staff audience and explicit
   capabilities. Do not expose admin self-registration, public role promotion,
   secrets, or provider credentials.
3. **Ledger integrity.** The UI must never write balances or ledger entries
   directly. Do not allow staff to mark a payment successful, failed, settled,
   or refunded based solely on a browser action.
4. **Reconciliation before resolution.** An uncertain provider result remains
   pending/unknown until the backend reconciles authoritative provider
   evidence. Any safe recheck/retry action must use the existing idempotent
   backend workflow.
5. **Audit every privileged change.** Record actor, action, target, timestamp,
   request/correlation ID, outcome, and only necessary before/after metadata.
   Never store credentials, full payment identifiers, or secrets in audit
   metadata.
6. **Minimize sensitive data.** Search results should be masked and
   paginated. Reveal additional personal information only when an approved
   support task requires it, with access audited.
7. **Keep customer and merchant experiences separate.** The admin site is an
   operations tool; it does not replace the customer app or merchant portal.
8. **Errors are honest and safe.** Show clear pending, unavailable, forbidden,
   and failed states; never expose raw provider payloads, stack traces, or
   internal secrets.

## 4. Target scope — complete admin console

The requested outcome is a complete staff console, from sign-in through
management of the app and merchant operations. The areas below are all in the
target scope. They should be delivered in the sequence in Section 7; phasing
reduces rollout risk and does not mean the later capabilities are out of scope.

- **Admin sign-in and staff access:** existing Mori Pay identity/session
  infrastructure, a server-confirmed admin gate, MFA or step-up verification
  as decided for privileged actions, staff provisioning, role assignment and
  revocation, and immediate invalidation of active sessions when access is
  removed. No public admin registration or client-trusted role.
- **System overview:** accurate, time-bounded operational KPIs covering users,
  merchant applications/accounts, transaction states, payment channels,
  reconciliation exceptions, and integration health. Show source freshness
  and drill through to authorized detail; define all metrics before
  publication.
- **User and account management:** bounded search and profile inspection;
  status, verification level, wallet/account health, device/session overview;
  approved support actions such as restriction, restoration, or session
  revocation, each with a reason, authorization, impact preview where
  appropriate, and audit trail.
- **Transaction and finance operations:** searchable transaction details,
  provider/reconciliation timeline, linked ledger entries (read-only),
  controlled reconciliation refresh, reports/exports, and settlement or
  exception workflows where supported by authoritative backend/provider
  operations. User actions must never set financial outcomes directly.
- **Merchant operations:** application queue and review; account inspection,
  suspension/reactivation; merchant QR/account status visibility; registration
  fee and later approved merchant configuration management. Reuse current
  merchant domain services and preserve existing approval/payment rules.
- **System configuration:** view operational settings and integration health;
  manage approved fee/limit/feature settings through validated backend
  workflows with previews, effective-time/history information, audit, and
  rollback policy. Provider secrets are never displayed or stored in the
  browser.
- **Audit and compliance support:** searchable access to administrative
  changes and sensitive record access, with actor/target/outcome/correlation
  details, safe redaction, retention, and controlled access.
- **Role-based capabilities:** distinct staff capabilities for system
  administration, merchant review, support, finance/reconciliation, and
  platform operations. Permission checks are enforced by the API, not only
  the navigation.
- **Operational usability:** responsive desktop-first interface that remains
  usable on mobile; accessible navigation, keyboard support, safe confirmations,
  automatic transient feedback, explicit loading/empty/error/denied states.

## 5. Safety boundaries (apply to every phase)

- No manual wallet-balance editing or direct ledger manipulation.
- No client-side transaction status overrides, forced settlement, or
  unsupported refund/payout controls.
- No exposing payment encryption keys, API secrets, full card/mobile-money
  credentials, or raw gateway/webhook payloads.
- No merchant customer-facing payments or merchant portal redesign.
- No public admin registration or automatic promotion of existing user
  accounts. Existing records already marked `role=admin` are migrated to
  `super_admin` to preserve existing access; new role assignments are explicit
  and only available to super admins. Staff cannot change their own role.
- No claim that an admin dashboard replaces provider reconciliation,
  accounting review, fraud/compliance policy, or production monitoring.

## 6. Recommended technical shape

### Web application

- Create a standalone `admin-web/` React/Vite application, following the
  repository's merchant site's build/deploy conventions while keeping admin
  session keys, API types, route tree, and branding distinct.
- Use the Mori Pay brand system and shared contracts where the contracts
  genuinely represent API domain types. Keep admin-specific screens and
  orchestration out of the Expo app's `src/app/` routes.
- Keep access tokens in the browser session (not local storage), clear state
  on logout/denial, and do not make authorization decisions from cached role
  data.
- Build navigation around Overview, Users, Transactions/Finance, Merchants,
  System settings, Staff access, and Audit. Render only sections the server
  confirms the session can access.

### Backend

- Add a focused admin API module (proposed prefix: `/admin`) for session
  confirmation, overview, audit, and later operational queries/actions.
- Reuse/refactor the existing persisted-role guard into shared admin policy
  enforcement; do not rely on role claims in a long-lived token. Keep the
  merchant admin endpoints compatible while moving their controllers or
  delegating through the same authorization and audit policy.
- Add typed contracts and request validation for filters, pagination, review
  decisions, status changes, and configuration updates.
- Keep all writes in existing domain services or narrowly scoped admin
  services that call those domain operations. Use database transactions to
  pair state changes with audit records where possible.
- Treat user search, transaction lookup, and audit browsing as sensitive
  endpoints: pagination, query bounds, rate limits, field allowlists, redaction,
  and explicit authorization.
- Add indexes only from measured queries and with forward-only migrations.
  Do not add speculative denormalized financial aggregates to the first build.

### Deployment

- Deploy the admin site separately from the public merchant site and API; use a
  dedicated HTTPS origin and add only that origin to production `CORS_ORIGINS`.
- Configure only the public API base URL in the web build. Keep all secrets on
  the server/provider side.
- Define environment separation and admin URL access controls before
  production launch. CORS is not an authorization mechanism.

## 7. Delivery phases and exit criteria

### Phase 0 — Decisions, threat model, and API inventory

- Confirm staff identity/provisioning, login requirements, and whether MFA or
  step-up verification is required.
- Confirm which actions belong in each rollout phase and who may perform
  them; the target scope remains the complete console described above.
- Define sensitive-field visibility, audit retention/access, and user/merchant
  status-transition policy.
- Record the API/data inventory, capability matrix, threat model, production
  owner, and approved deployment origin. Track any unresolved policy decision
  as a release blocker rather than silently selecting a permissive default.

**Exit:** signed-off capability matrix, data visibility rules, and endpoint
contract; no unresolved financial-state mutation policy.

### Phase 1 — Secure admin foundation

- Implement admin site shell and sign-in, session check, protected route
  handling, safe logout/session expiry, accessible feedback and navigation.
- Implement backend admin-session/capability check and tests for anonymous,
  regular-user, admin, and revoked-session access.
- Establish staff provisioning/revocation policy, initial capability model,
  shared audit context, and safe audit metadata conventions.

**Exit:** no admin page or API data is accessible to a non-admin; tests cover
direct API calls as well as browser route access.

**Current implementation status:** The backend admin-session endpoint and
persisted active-admin guard are implemented, and the admin site verifies
access before storing session tokens. The backend unit tests cover ordinary,
missing, deleted, and restricted accounts. Production readiness still depends
on agreeing staff provisioning and MFA/step-up policy; the current sign-in
uses the existing Mori Pay email/password flow. Role-based staff assignment and
revocation are implemented; the initial set of legacy admins is backfilled as
super admins by the migration and must be reviewed before deployment.

### Phase 2 — Overview, audit, and merchant operations

- Connect system overview, audit explorer, applications queue, detail/review,
  account lookup/status changes,
  and registration fee configuration to existing business logic.
- Show validated current state and review history; confirm consequential
  actions and capture reasons.
- Add merchant queue counts to overview only if query definitions are
  consistent with domain states.

**Exit:** permission, validation, conflicting-state, transaction/audit
atomicity, and UI outcome tests pass; merchant portal/mobile behavior remains
unchanged.

**Current implementation status:** Initial overview, audit listing,
merchant-account listing, merchant-application review, account status changes,
and registration-fee configuration are connected to the backend. Before
declaring this phase production-ready, close gaps in audit coverage and
atomicity, verify action-specific permissions, and complete the negative,
concurrency, and end-to-end tests listed in Section 8. Audit action/date
filters are implemented, but the audit product still needs retention/access
ownership and complete operation coverage.

### Phase 3 — Users and read-only transaction operations

- Agree on user/transaction data minimization and field-level access.
- Add bounded, paginated user and transaction search, with masked identifiers
  and links to safe detail views. Add approved support actions only after
  state transitions and reasons are defined.
- Add reconciliation timeline from authoritative backend records only.

**Exit:** search limits, redaction, role checks, audit of sensitive access, and
performance are tested against representative data.

**Current implementation status:** Bounded, paginated user and transaction
search is now available to active administrators. The API validates query
length and pagination (maximum page 10,000 / page size 100), applies per-route
throttling, logs each search without storing the search term, masks
contact/reference identifiers, and excludes credentials, national IDs, wallet
balances, provider references, and raw gateway payloads. The admin web exposes
read-only user and transaction search and detail panels. User details show
masked contact/wallet identifiers, limited device metadata, and session
counts; transaction details show monetary fields, ledger-entry summaries
without running balances, and webhook-event summaries without payload/error
text. Detail access is audited. Automated tests cover query validation,
pagination, masking, safe output, audit metadata/filtering, detail redaction,
overview channel/webhook counts, and settings secret exclusion. Remaining exit
items are representative-data performance tests and end-to-end authorization
and integration tests against PostgreSQL.

### Phase 4 — System configuration and controlled finance/support actions

- Provide read-only settings visibility for effective fee rules, tier limits,
  merchant registration fee, reconciliation configuration, and integration
  credential-presence state; never return credentials or claim presence means
  connectivity.
- Add approved fee, limit, feature, and integration operations; settlement and
  exception workflows; and support actions only after each policy, valid state
  transition, rollback or recovery path, audit payload, and dual-control need
  are agreed.
- Prefer domain-specific actions (e.g. restrict account, revoke session) over
  arbitrary field editing.

**Exit:** negative, concurrency, retry, and audit tests pass; operational
runbooks and staff training are ready.

**Current implementation status:** The admin console provides read-only
configuration snapshots and explicitly does not expose the underlying provider
credentials or write controls. Existing merchant registration-fee changes
remain connected to the established merchant domain operation. System-wide fee
rule/limit edits and controlled financial/support operations remain blocked
until their approval, dual-control, audit, rollback, and authorization rules
are signed off.

### Phase 5 — Staff capabilities, production readiness, and rollout

- Keep the approved capability model enforced on every endpoint; navigation
  visibility remains a convenience, never an authorization boundary.
- Exercise staff provisioning/revocation and session invalidation workflows
  against PostgreSQL and review initial super-admin provisioning.
  Add MFA/step-up before enabling high-impact actions if required by the
  approved policy.
- Complete deployment controls: dedicated HTTPS origin, exact production CORS
  allowlist, environment-specific API configuration, secrets review, alerting,
  backup/retention ownership, and incident/rollback runbooks.
- Pilot with a small authorized staff group, monitor API errors and audit
  events, capture support feedback, and expand access only after the exit
  criteria pass.

**Exit:** production security review and operational readiness approval;
authorized staff can be provisioned and removed; monitoring, support,
rollback, and incident procedures have named owners.

**Current implementation status:** The server reads a persisted staff role on
each protected request and checks endpoint capabilities. The role matrix is:
super admin (all capabilities), merchant operations (overview and merchant
read/write), customer support (overview and user-record read), and
finance/reconciliation (overview and transaction read). Audit, settings,
registration-fee writes, and staff management remain super-admin-only.
Super-admin staff search is bounded, masked, and audited; role updates are
audited in the same serializable transaction as session revocation. The server
blocks self-role changes and removal of the last active super admin. The web
navigation and merchant-fee form are capability-gated. These controls still
require database-backed concurrency/integration testing and a production
security review.

### One-time initial super-admin provisioning

The API can create the first super-admin during startup when both
`INITIAL_SUPER_ADMIN_EMAIL` and `INITIAL_SUPER_ADMIN_PASSWORD` are configured.
`INITIAL_SUPER_ADMIN_NAME` is optional. Run database migrations first, set the
credentials in the deployment environment (or local server `.env`), then start
the API. The bootstrap creates an active, email-verified super-admin with a
wallet and initial ledger account; the password is stored using the existing
scrypt password hash. It writes an audit record in the same transaction.

The bootstrap takes a PostgreSQL advisory lock and checks whether any
super-admin already exists before creating an account. Restarts and multiple
API replicas therefore do not create another initial super-admin. It never
resets a password, promotes a matching regular account, or changes an existing
staff role. If the configured email belongs to a regular account and there is
no super-admin yet, startup fails explicitly so an operator can choose a
different email.

After the first successful startup, sign in and remove the bootstrap variables
from the hosting environment, then restart the API. The application cannot
delete variables stored in a hosting provider's deployment settings. If the
variables are accidentally left configured, the database check still prevents
recreation; they should nevertheless be removed to reduce secret exposure.

## 8. Verification plan

- **Authorization:** no token, expired/revoked session, ordinary user,
  administrator, and tampered request; exercise direct endpoints regardless
  of UI visibility.
- **Merchant actions:** unpaid application, stale/conflicting review,
  duplicate approval, invalid status transition, missing/long review reason,
  audit failure, and concurrent review.
- **Financial invariants:** admin endpoints cannot create ledger entries or
  alter balances; transaction success is derived only from authoritative
  reconciliation; retry is idempotent.
- **Privacy:** masked list values, no password/PIN/hash/token/provider secret
  in APIs or logs, search caps, export policy, and audit metadata redaction.
- **UI:** loading, empty, denied, expired, network failure, validation,
  successful update, narrow mobile viewport, keyboard and screen-reader
  navigation.
- **Operations:** production CORS origin, HTTPS, environment separation,
  database migrations, database query limits/indexes, audit access, backup
  and retention policy.
- Run focused server tests, admin-web tests/build, server lint/typecheck/build,
  app lint/typecheck, and an integration pass against a test PostgreSQL
  database before rollout.

**Latest local verification:** Backend test suite: 169 passed, 0 failed;
backend lint, typecheck, and build passed; admin-web production build passed;
Expo lint and typecheck passed. Role authorization, staff search redaction,
session revocation, self-change and last-super-admin protections, and initial
super-admin bootstrap behavior are covered by unit tests. No test PostgreSQL integration or
representative-production-volume performance run was available in this
validation pass.

## 9. Open rollout decisions and approvals

The overall scope is confirmed: the target is the complete staff console in
Section 4, delivered in phases. The following policy choices still need an
owner's approval before the affected features can be released. Recommended
defaults are included so decisions can be made explicitly:

| Decision | Recommended default | Required before |
|---|---|---|
| Staff provisioning and revocation | Super-admin assignment to active users with verified email; no self-role changes; role changes revoke sessions. Review the migration's legacy super-admin backfill. | Production admin access |
| Authentication strength | Existing Mori Pay password login is implemented; decide MFA/step-up before production use or enabling high-impact actions. | Production pilot / Phase 4 |
| Staff capabilities | Four implemented roles: super admin, merchant operations, customer support, and finance/reconciliation. Verify the initial staff roster and role assignments. | Production use of user/transaction access |
| Customer support actions | Read-only first; add restrictions/session revocation only with reason capture, approval policy, audit, and customer-impact rules | Phase 3 writes |
| Transaction and finance actions | Read-only investigation and backend reconciliation refresh; no manual financial state override | Any transaction action |
| Sensitive data and audit | Mask identifiers by default; audit sensitive access and changes; approve retention and access ownership | Production use of user/transaction search |
| Deployment | Dedicated HTTPS admin origin, exact CORS allowlist, separate environment configuration, and named hosting/operations owner | Production release |

## 10. Execution order and completion definition

1. Close Phase 0 decisions and record the approved capability/data matrix.
2. Close the Phase 1/2 production-readiness gaps without expanding existing
   merchant or financial behavior.
3. Deliver Phase 3 read-only user and transaction investigation.
4. Deliver Phase 4 only for individually approved operations with explicit
   domain validation, audit, recovery, and (where required) dual control.
5. Deliver Phase 5 staff capabilities, deployment hardening, pilot, and
   operational handover.

The admin-console program is complete only when every in-scope capability in
Section 4 is either delivered and covered by its exit criteria or explicitly
deferred by an accountable product/security owner; API authorization,
financial/privacy invariants, automated tests, production configuration, and
operational ownership are verified. A navigation item or screen by itself
does not count as a delivered capability.
