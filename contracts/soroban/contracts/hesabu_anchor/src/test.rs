#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::{Address as _, Ledger}, Address, BytesN, Env, Symbol};

#[test]
fn test_anchor_and_verify_statement() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(HesabuAnchorContract, ());
    let client = HesabuAnchorContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let author = Address::generate(&env);

    client.initialize(&admin);

    let workspace_id = Symbol::new(&env, "chama_nbi");
    let period_start: u64 = 1770000000;
    let period_end: u64 = 1772592000;
    let entry_count: u32 = 42;
    let merkle_root = BytesN::from_array(&env, &[7u8; 32]);

    env.ledger().set_timestamp(1772592100);

    let anchor = client.anchor_statement(
        &author,
        &workspace_id,
        &period_start,
        &period_end,
        &entry_count,
        &merkle_root,
    );

    assert_eq!(anchor.workspace_id, workspace_id);
    assert_eq!(anchor.entry_count, 42);
    assert_eq!(anchor.merkle_root, merkle_root);
    assert_eq!(anchor.anchored_at, 1772592100);

    // Verify correct root
    let is_valid = client.verify_statement(&workspace_id, &period_end, &merkle_root);
    assert!(is_valid);

    // Verify incorrect root fails
    let fake_root = BytesN::from_array(&env, &[9u8; 32]);
    let is_fake_valid = client.verify_statement(&workspace_id, &period_end, &fake_root);
    assert!(!is_fake_valid);

    // Check count
    assert_eq!(client.get_anchor_count(&workspace_id), 1);
}

#[test]
#[should_panic(expected = "already initialized")]
fn test_cannot_reinitialize() {
    let env = Env::default();
    let contract_id = env.register(HesabuAnchorContract, ());
    let client = HesabuAnchorContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);
    client.initialize(&admin);
}
