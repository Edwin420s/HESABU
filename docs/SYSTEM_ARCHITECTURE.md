# System Architecture

## 1. Architecture style

Start with a modular monolith. One API deployment, one relational database and explicit module boundaries. Do not introduce microservices before operational scale justifies them.

## 2. Logical components

- React web client: presentation, forms and workspace navigation.
- Express API: authentication, authorisation, domain rules and integrations.
- PostgreSQL: source of truth for users, workspaces, obligations, payment attempts, settlements, expenses, journals and audit records.
- Prisma: schema management and data access.
- Payment adapters: provider-specific request, callback and verification logic.
- Ledger service: balanced posting and traceable reversals.
- Reconciliation service: compare expected obligation against independently verified payment evidence.

## 3. Tenancy and access

Every business record is associated with a workspace. A membership is required before reading or changing workspace data. Roles are checked in API middleware and in domain services. Never trust a workspace ID or role supplied by the browser.

## 4. Payment lifecycle

`CREATED -> PENDING -> PROCESSING -> CONFIRMED | FAILED | EXPIRED`

A `Settlement` is created only after provider verification. A confirmed payment is unique by payment ID and external reference. Verification must check network, asset, amount, sender, destination, reference and finality as appropriate to the rail.

## 5. Financial data

- Use integer minor units (`BigInt` in the database).
- Never use JavaScript floating-point values for money arithmetic.
- Store currency with every monetary record.
- Never derive funds held from obligations due.
- Journal entries must balance per currency.
- Posted entries are not edited; corrections use reversals and replacement entries.

## 6. Security boundaries

- Passwords hashed with bcrypt.
- Short-lived access tokens in this MVP; production needs refresh rotation and revocation.
- Helmet and restricted CORS.
- Zod request validation.
- Server-side membership and role checks.
- No secret keys in the frontend.
- No personal information or private financial details on public chains.
- Provider callbacks must be authenticated and idempotent.

## 7. Production evolution

Add a queue/outbox for provider callbacks and notifications, object storage for receipts, observability, rate limiting, backup/restore drills, key management, MFA, account recovery, formal audit retention and penetration testing.
