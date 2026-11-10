#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, Env, Symbol,
};

#[test]
fn test_escrow_deposit_approve_and_payout() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(HesabuEscrowContract, ());
    let client = HesabuEscrowContractClient::new(&env, &contract_id);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_client = token::Client::new(&env, &token_contract.address());
    let token_admin_client = token::StellarAssetClient::new(&env, &token_contract.address());

    let admin = Address::generate(&env);
    let requester = Address::generate(&env);
    let approver = Address::generate(&env);
    let payee = Address::generate(&env);

    client.initialize(&admin);

    // Mint 10,000 tokens to requester
    token_admin_client.mint(&requester, &10_000);
    assert_eq!(token_client.balance(&requester), 10_000);

    let expense_id = Symbol::new(&env, "exp_401");
    let amount: i128 = 2_500;

    env.ledger().set_timestamp(1770001000);

    // Requester creates disbursement request
    let request = client.create_request(
        &requester,
        &expense_id,
        &payee,
        &token_contract.address(),
        &amount,
    );

    assert_eq!(request.amount, 2_500);
    assert_eq!(request.is_executed, false);
    assert_eq!(token_client.balance(&requester), 7_500);
    assert_eq!(token_client.balance(&contract_id), 2_500);

    // Approver approves request
    client.approve_request(&approver, &expense_id);

    let updated_req = client.get_request(&expense_id).unwrap();
    assert_eq!(updated_req.approved_by, Option::Some(approver.clone()));

    // Execute payout
    client.execute_payout(&admin, &expense_id);

    let finalized_req = client.get_request(&expense_id).unwrap();
    assert_eq!(finalized_req.is_executed, true);

    // Check balances
    assert_eq!(token_client.balance(&payee), 2_500);
    assert_eq!(token_client.balance(&contract_id), 0);
}

#[test]
#[should_panic(expected = "separation of duties: requester cannot approve own request")]
fn test_requester_cannot_approve_own_request() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(HesabuEscrowContract, ());
    let client = HesabuEscrowContractClient::new(&env, &contract_id);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_admin_client = token::StellarAssetClient::new(&env, &token_contract.address());

    let admin = Address::generate(&env);
    let requester = Address::generate(&env);
    let payee = Address::generate(&env);

    client.initialize(&admin);
    token_admin_client.mint(&requester, &5_000);

    let expense_id = Symbol::new(&env, "exp_402");
    client.create_request(
        &requester,
        &expense_id,
        &payee,
        &token_contract.address(),
        &1_000,
    );

    // Requester attempts to approve own request -> PANIC
    client.approve_request(&requester, &expense_id);
}
