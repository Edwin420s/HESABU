# Security Notes

This is a development MVP, not a production security certification.

## Implemented baseline
- bcrypt password hashing.
- JWT authentication.
- Workspace membership checks on workspace routes.
- Role checks for obligation creation and membership management.
- Request validation with Zod.
- Helmet security headers.
- Restricted CORS origin.
- BigInt minor-unit amounts.
- Unique idempotency keys and settlement payment IDs.
- Development payment mode explicitly distinguished from real rails.

## Required before production
- Refresh-token rotation, revocation and secure session management.
- Email verification, password reset and MFA.
- Rate limits and brute-force protections.
- Signed invitation tokens with expiry.
- Provider callback signature verification and replay protection.
- Stronger separation of duties and configurable approval thresholds.
- File upload scanning and private object storage.
- Secret manager / HSM for signing keys.
- Structured logs with PII redaction.
- Dependency scanning, SAST, DAST and penetration testing.
- Data retention, privacy notices, access/export/deletion processes.
- Tested database backups and disaster recovery.
- Legal and regulatory assessment for each operating jurisdiction.

Never put seed credentials, API keys, signing secrets, private keys or customer PII in source control.
