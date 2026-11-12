# Stellar Soroban Smart Contracts

This directory outlines the Stellar Soroban smart contracts developed for HESABU to provide on-chain cryptographic auditability and programmable settlement controls.

---

## 1. Overview of Contracts

The smart contracts are located in `contracts/soroban/contracts/` and written in Rust using `soroban-sdk`.

| Contract | Purpose | Status | Key Functions |
|---|---|---|---|
| **`hesabu_anchor`** | Canonical Statement Anchors | **Implemented & Tested** | `anchor_statement`, `get_anchor`, `verify_statement`, `get_anchor_count` |
| **`hesabu_escrow`** | Programmable Dual-Approval Escrow | **Experimental (Testnet Only)** | `create_request`, `approve_request`, `execute_payout`, `get_request` |

> [!WARNING]
> **Production Deployment Status**: `hesabu_escrow` is currently designated for testnet experimentation only. Do not deploy the escrow contract to Stellar Public Mainnet until formal multi-signature governance, refund timelocks, and token whitelisting are implemented. `hesabu_anchor` is verified for cryptographic period anchoring.

---

## 2. HesabuAnchorContract (`hesabu_anchor`)

### Purpose
Provides immutable on-chain proof of accounting periods. Whenever a financial period is closed, HESABU computes a canonical SHA-256 Merkle root of all double-entry journal entries and records it on the Stellar blockchain via this contract.

### Contract State & Types
```rust
#[contracttype]
pub struct StatementAnchor {
    pub workspace_id: Symbol,
    pub period_start: u64,
    pub period_end: u64,
    pub entry_count: u32,
    pub merkle_root: BytesN<32>,
    pub anchored_at: u64,
    pub author: Address,
}
```

### Methods
- `initialize(env, admin)`: Initializes the contract with an administrator address.
- `anchor_statement(env, author, workspace_id, period_start, period_end, entry_count, merkle_root)`:
  - Requires caller authorization (`author.require_auth()`).
  - Ensures `period_end > period_start`.
  - Enforces period uniqueness to prevent overwriting existing audit records.
  - Emits event: `(Symbol("anchor"), workspace_id), (merkle_root, period_end)`.
- `get_anchor(env, workspace_id, period_end) -> Option<StatementAnchor>`:
  - Fetches the anchor record for external verification.
- `verify_statement(env, workspace_id, period_end, merkle_root) -> bool`:
  - Returns `true` if the supplied Merkle root matches the anchored on-chain fingerprint.
- `get_anchor_count(env, workspace_id) -> u32`:
  - Returns total statements anchored for the workspace.

---

## 3. HesabuEscrowContract (`hesabu_escrow`)

### Purpose
Implements programmable multi-party dual-control escrow on Stellar. Ensures that when group funds or member reimbursements are disbursed, separation of duties is cryptographically enforced on-chain.

### Contract State & Types
```rust
#[contracttype]
pub struct DisbursementRequest {
    pub expense_id: Symbol,
    pub requester: Address,
    pub payee: Address,
    pub token: Address,
    pub amount: i128,
    pub approved_by: Option<Address>,
    pub is_executed: bool,
    pub created_at: u64,
}
```

### Methods
- `initialize(env, admin)`: Initializes escrow contract.
- `create_request(env, requester, expense_id, payee, token, amount)`:
  - Caller authorizes transfer of `amount` of `token` (e.g. Stellar USDC) into the escrow contract.
  - Emits event: `(Symbol("req_new"), expense_id), amount`.
- `approve_request(env, approver, expense_id)`:
  - Enforces separation of duties: `approver != requester`.
  - Records approval on-chain.
  - Emits event: `(Symbol("approved"), expense_id), approver`.
- `execute_payout(env, executor, expense_id)`:
  - Validates that the request has been approved.
  - Transfers tokens directly from the contract to `payee`.
  - Marks request as executed.
  - Emits event: `(Symbol("payout"), expense_id), (payee, amount)`.
- `get_request(env, expense_id) -> Option<DisbursementRequest>`:
  - Queries request state and approval details.

---

## 4. Building and Testing

### Prerequisites
- Rust 1.80+ with `wasm32-unknown-unknown` target.
- Stellar CLI (`stellar --version`).

### Running Tests
Inside `contracts/soroban/`:
```bash
cargo test
```

### Compiling to WASM for Deployment
```bash
cargo build --target wasm32-unknown-unknown --release
```
The optimized WebAssembly binaries are placed in `target/wasm32-unknown-unknown/release/`.

---

## 5. Deployment to Stellar Testnet

Deploy using the Stellar CLI:
```bash
# 1. Deploy hesabu_anchor
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/hesabu_anchor.wasm \
  --source <YOUR_STELLAR_IDENTITY> \
  --network testnet

# 2. Deploy hesabu_escrow
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/hesabu_escrow.wasm \
  --source <YOUR_STELLAR_IDENTITY> \
  --network testnet
```
