# HESABU Audit Trail & Regulatory Compliance Guide

## 1. Compliance Architecture Overview
For formal cooperative societies, registered chamas, and small-and-medium enterprises (SMEs), statutory compliance requires continuous, immutable proof of every financial and governance decision.

HESABU enforces a dual-layer audit trail:
1. **Application-Level Immutable Audit Log**: Database-backed append-only ledger tracking all user, system, and webhook operations.
2. **Blockchain-Level Statement Anchoring**: Monthly and quarterly statement Merkle roots anchored to Stellar Soroban smart contracts for tamper-proof public verifiability.

---

## 2. Audit Event Schema
Every recorded event contains the following attributes:
- `id`: Globally unique identifier with monotonic timestamp characteristics.
- `workspaceId`: The target organization or Chama.
- `actorId`: User ID of the logged-in administrator, approver, or null for system webhooks.
- `action`: Specific standardized audit event code (e.g., `PAYMENT_CONFIRMED_MPESA_CALLBACK`, `EXPENSE_APPROVED`, `MERKLE_ROOT_ANCHORED`).
- `entityType`: The affected domain model (`Payment`, `Obligation`, `Expense`, `JournalEntry`, `Workspace`).
- `entityId`: Unique identifier of the affected record.
- `details`: Structured JSON payload capturing pre- and post-state deltas, provider transaction references, or external verification proofs.
- `createdAt`: ISO 8601 UTC timestamp.

---

## 3. CSV Compliance Export Specification
The audit export endpoint (`GET /api/workspaces/:workspaceId/audit-logs/export`) generates RFC 4180 compliant CSV files with full string quoting to avoid CSV injection vulnerabilities.

### Column Layout:
- `Timestamp`: UTC creation time of the log entry.
- `LogID`: Unique audit record identifier.
- `Action`: Standardized action enumeration.
- `EntityType`: Target domain entity.
- `EntityID`: Unique ID of the modified entity.
- `ActorEmail`: Email address of the initiating member or `SYSTEM`.
- `DetailsJSON`: Serialized JSON payload with double-quote escaping.

---

## 4. Role-Based Access Control
Audit log inspection and compliance exports are restricted:
- **OWNER & ADMIN**: Full visibility of workspace logs and permission to trigger CSV compliance exports.
- **AUDITOR**: Read-only inspection privileges for financial and compliance oversight.
- **MEMBER & APPROVER**: Restricted to viewing personal transactions and assigned approval queues. Unauthenticated requests are rejected with HTTP 401 Unauthorized.
