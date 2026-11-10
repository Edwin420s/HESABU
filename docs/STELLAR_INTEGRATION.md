# Stellar Integration Plan

## Scope

Stellar is one settlement rail in HESABU, not the product itself. Ordinary USDC transfers should use established Stellar asset and wallet functionality. A custom Soroban contract is not required merely to transfer USDC.

## Required verification

Before a Stellar transaction can settle a HESABU obligation, the verifier must validate:
1. Correct Stellar network (testnet or public).
2. Correct asset code and issuer; do not trust the asset code alone.
3. Exact amount and currency conversion policy.
4. Expected source and destination accounts.
5. HESABU payment/obligation reference where supported.
6. Transaction success and required ledger finality.
7. Transaction hash uniqueness and replay protection.

## Wallet authorisation

The payer should authorise the transaction using a compatible wallet. Never collect a user's secret seed phrase in HESABU or store wallet private keys on the application server.

## Testnet

Testnet transactions are demonstrations and have no real monetary value. Clearly label all testnet assets and records.

## Soroban

Use Soroban/Rust only when programmable business rules genuinely require an on-chain component. Keep private member information and full financial records off-chain. If anchoring a hash, define exactly which canonical record is hashed and how privacy and data minimisation are maintained.

## Current codebase status

The MVP deliberately rejects the Stellar rail until a complete verifier and wallet-authorisation flow are configured. This is safer than presenting an unverified transaction as settled.
