#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Env, Symbol,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
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

#[contracttype]
pub enum EscrowKey {
    Admin,
    Request(Symbol),
}

#[contract]
pub struct HesabuEscrowContract;

#[contractimpl]
impl HesabuEscrowContract {
    /// Initialize with an administrative address
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&EscrowKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&EscrowKey::Admin, &admin);
    }

    /// Deposit funds into contract and create a disbursement request.
    /// The requester funds the escrow with the specified token amount.
    pub fn create_request(
        env: Env,
        requester: Address,
        expense_id: Symbol,
        payee: Address,
        token: Address,
        amount: i128,
    ) -> DisbursementRequest {
        requester.require_auth();

        if amount <= 0 {
            panic!("amount must be positive");
        }

        let key = EscrowKey::Request(expense_id.clone());
        if env.storage().persistent().has(&key) {
            panic!("request with this expense_id already exists");
        }

        // Transfer token from requester to this contract
        let client = token::Client::new(&env, &token);
        client.transfer(&requester, &env.current_contract_address(), &amount);

        let request = DisbursementRequest {
            expense_id: expense_id.clone(),
            requester,
            payee,
            token,
            amount,
            approved_by: Option::None,
            is_executed: false,
            created_at: env.ledger().timestamp(),
        };

        env.storage().persistent().set(&key, &request);

        env.events().publish(
            (symbol_short!("req_new"), expense_id),
            amount,
        );

        request
    }

    /// Approve an expense disbursement. Enforces separation of duties (approver != requester).
    pub fn approve_request(env: Env, approver: Address, expense_id: Symbol) {
        approver.require_auth();

        let key = EscrowKey::Request(expense_id.clone());
        let mut request: DisbursementRequest = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic!("request not found"));

        if request.is_executed {
            panic!("request already executed");
        }

        if request.requester == approver {
            panic!("separation of duties: requester cannot approve own request");
        }

        request.approved_by = Option::Some(approver.clone());
        env.storage().persistent().set(&key, &request);

        env.events().publish(
            (symbol_short!("approved"), expense_id),
            approver,
        );
    }

    /// Execute the approved payout, transferring tokens to the payee.
    pub fn execute_payout(env: Env, executor: Address, expense_id: Symbol) {
        executor.require_auth();

        let key = EscrowKey::Request(expense_id.clone());
        let mut request: DisbursementRequest = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic!("request not found"));

        if request.is_executed {
            panic!("already executed");
        }

        if request.approved_by.is_none() {
            panic!("cannot execute unapproved request");
        }

        request.is_executed = true;
        env.storage().persistent().set(&key, &request);

        // Transfer tokens from contract to payee
        let client = token::Client::new(&env, &request.token);
        client.transfer(
            &env.current_contract_address(),
            &request.payee,
            &request.amount,
        );

        env.events().publish(
            (symbol_short!("payout"), expense_id),
            (request.payee, request.amount),
        );
    }

    /// Get details of a disbursement request
    pub fn get_request(env: Env, expense_id: Symbol) -> Option<DisbursementRequest> {
        let key = EscrowKey::Request(expense_id);
        env.storage().persistent().get(&key)
    }
}

#[cfg(test)]
mod test;
