# Stellar Soroban Smart Contract Security Analysis

This document outlines the security architecture, threat model, and mitigation mechanisms implemented across the HESABU Stellar Soroban smart contracts (`hesabu_anchor` and `hesabu_escrow`).

---

## 1. Security Architecture & Threat Model

The smart contracts are written in Rust using `soroban-sdk` and execute in the WebAssembly virtual machine on the Stellar network.

### Primary Threat Vectors Evaluated

1. **Reentrancy**:
   - The Soroban environment does not permit recursive cross-contract calls that allow reentrancy vulnerabilities common in other VM architectures.
   - State mutations precede external token transfers (`is_executed = true` is set before invoking `token::Client::transfer`).

2. **Replay & Collision Protection**:
   - In `hesabu_anchor`, anchors are keyed by `(workspace_id, period_end)`. Duplicate attempts to anchor the same period trigger a deterministic contract panic.
   - In `hesabu_escrow`, requests are uniquely keyed by `expense_id`. An existing expense identifier cannot be overwritten or reused.

3. **Separation of Duties (Privilege Separation)**:
   - In `hesabu_escrow`, the contract explicitly enforces `request.requester != approver`. A user who deposits and requests funds cannot approve their own disbursement.

4. **Caller Authentication**:
   - `author.require_auth()` and `requester.require_auth()` are enforced at the contract interface level, ensuring that transactions can only be executed with signed authorization from the corresponding Stellar account.

---

## 2. Integer Safety & Overflow Mitigation

- In Rust release profile, overflow checks are explicitly enabled (`overflow-checks = true` in `Cargo.toml`).
- Amounts in `hesabu_escrow` use 128-bit signed integers (`i128`), preventing truncation or precision loss when dealing with minor token units.
- Inputs must strictly satisfy `amount > 0`.

---

## 3. Storage Footprint & Data Minimization

- Member personal identifying information (PII), names, phone numbers, and full ledger line narratives are **never stored on-chain**.
- Only cryptographic hashes (SHA-256 Merkle roots in `BytesN<32>`) and contract references (`Symbol`, `Address`) are persisted in contract storage, preserving member privacy and complying with data protection standards.
