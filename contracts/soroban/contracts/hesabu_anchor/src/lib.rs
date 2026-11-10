#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, BytesN, Env, Symbol,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StatementAnchor {
    pub workspace_id: Symbol,
    pub period_start: u64,
    pub period_end: u64,
    pub entry_count: u32,
    pub merkle_root: BytesN<32>,
    pub anchored_at: u64,
    pub author: Address,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Anchor(Symbol, u64), // (workspace_id, period_end)
    AnchorCount(Symbol), // count of anchors for workspace
}

#[contract]
pub struct HesabuAnchorContract;

#[contractimpl]
impl HesabuAnchorContract {
    /// Initialize the contract with an administrative address.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    /// Anchor a financial period statement hash on-chain.
    /// The author (finance manager or auditor) must authorize the call.
    pub fn anchor_statement(
        env: Env,
        author: Address,
        workspace_id: Symbol,
        period_start: u64,
        period_end: u64,
        entry_count: u32,
        merkle_root: BytesN<32>,
    ) -> StatementAnchor {
        author.require_auth();

        if period_end <= period_start {
            panic!("period_end must be greater than period_start");
        }

        let key = DataKey::Anchor(workspace_id.clone(), period_end);
        if env.storage().persistent().has(&key) {
            panic!("statement anchor for this period already exists");
        }

        let timestamp = env.ledger().timestamp();
        let anchor = StatementAnchor {
            workspace_id: workspace_id.clone(),
            period_start,
            period_end,
            entry_count,
            merkle_root: merkle_root.clone(),
            anchored_at: timestamp,
            author: author.clone(),
        };

        env.storage().persistent().set(&key, &anchor);

        // Update count
        let count_key = DataKey::AnchorCount(workspace_id.clone());
        let current_count: u32 = env.storage().persistent().get(&count_key).unwrap_or(0);
        env.storage().persistent().set(&count_key, &(current_count + 1));

        // Publish event for indexing
        env.events().publish(
            (symbol_short!("anchor"), workspace_id),
            (merkle_root, period_end),
        );

        anchor
    }

    /// Retrieve an anchored statement by workspace and period_end.
    pub fn get_anchor(env: Env, workspace_id: Symbol, period_end: u64) -> Option<StatementAnchor> {
        let key = DataKey::Anchor(workspace_id, period_end);
        env.storage().persistent().get(&key)
    }

    /// Verify whether a supplied Merkle root matches the anchored proof on Stellar.
    pub fn verify_statement(
        env: Env,
        workspace_id: Symbol,
        period_end: u64,
        merkle_root: BytesN<32>,
    ) -> bool {
        let key = DataKey::Anchor(workspace_id, period_end);
        if let Some(anchor) = env.storage().persistent().get::<DataKey, StatementAnchor>(&key) {
            anchor.merkle_root == merkle_root
        } else {
            false
        }
    }

    /// Return total anchors recorded for a workspace.
    pub fn get_anchor_count(env: Env, workspace_id: Symbol) -> u32 {
        let count_key = DataKey::AnchorCount(workspace_id);
        env.storage().persistent().get(&count_key).unwrap_or(0)
    }
}

#[cfg(test)]
mod test;
