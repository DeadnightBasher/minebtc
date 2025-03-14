use ic_cdk_macros::{query, update, pre_upgrade, post_upgrade};
use ic_cdk::api::call::call;
use ic_cdk::storage;
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::HashMap;
use ic_ledger_types::{
    AccountIdentifier, Subaccount, Tokens, TransferArgs, TransferResult, Memo, DEFAULT_SUBACCOUNT,
};
use ic_cdk::api::management_canister::http_request::{
    http_request, CanisterHttpRequestArgument, HttpResponse, TransformArgs, TransformContext, HttpMethod,
};

// Define the struct for the account_balance argument
#[derive(CandidType)]
struct AccountBalanceArgs {
    account: AccountIdentifier,
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
struct State {
    balances: HashMap<Principal, u64>,
    last_known_balances: HashMap<Principal, u64>,
    committed_balances: HashMap<Principal, u64>,
    usd_values: HashMap<Principal, f64>,
}

thread_local! {
    static STATE: RefCell<State> = RefCell::new(State {
        balances: HashMap::new(),
        last_known_balances: HashMap::new(),
        committed_balances: HashMap::new(),
        usd_values: HashMap::new(),
    });
}

fn compute_subaccount(principal: &Principal) -> Subaccount {
    let mut subaccount = [0; 32];
    let principal_bytes = principal.as_slice();
    subaccount[..principal_bytes.len()].copy_from_slice(principal_bytes);
    Subaccount(subaccount)
}

async fn get_ledger_balance(account: AccountIdentifier) -> Result<Tokens, String> {
    let ledger_canister_id = Principal::from_text("ryjl3-tyaaa-aaaaa-aaaba-cai")
        .map_err(|e| format!("Invalid ledger ID: {:?}", e))?;
    let args = AccountBalanceArgs { account };
    let result: (Tokens,) = call(ledger_canister_id, "account_balance", (args,))
        .await
        .map_err(|e| format!("Failed to call ledger: {:?}", e))?;
    Ok(result.0)
}

#[query]
fn greet() -> String {
    "Hello from Financial Engine!".to_string()
}

#[query]
fn get_deposit_address() -> String {
    let caller = ic_cdk::caller();
    let subaccount = compute_subaccount(&caller);
    let account = AccountIdentifier::new(&ic_cdk::id(), &subaccount);
    account.to_string()
}

#[query]
fn get_internal_balance() -> u64 {
    let caller = ic_cdk::caller();
    STATE.with(|state| state.borrow().balances.get(&caller).cloned().unwrap_or(0))
}

#[update]
async fn claim_deposit() -> Result<u64, String> {
    let caller = ic_cdk::caller();
    let subaccount = compute_subaccount(&caller);
    let account = AccountIdentifier::new(&ic_cdk::id(), &subaccount);
    let current_balance = get_ledger_balance(account).await?.e8s();

    STATE.with(|state| {
        let mut state = state.borrow_mut();
        let last_known_balance = state.last_known_balances.get(&caller).cloned().unwrap_or(0);
        if current_balance > last_known_balance {
            let delta = current_balance - last_known_balance;
            let user_balance = state.balances.entry(caller).or_insert(0);
            *user_balance += delta;
            state.last_known_balances.insert(caller, current_balance);
            Ok(delta)
        } else {
            Err("No new deposit found".to_string())
        }
    })
}

#[update]
async fn withdraw_icp(amount_e8s: u64, destination: String) -> Result<(), String> {
    let destination = AccountIdentifier::from_hex(&destination)
        .map_err(|e| format!("Invalid destination address: {:?}", e))?;
    let caller = ic_cdk::caller();
    let fee = 10_000; // 0.0001 ICP
    let total_cost = amount_e8s.checked_add(fee).ok_or("Amount too large")?;

    let balance = STATE.with(|state| state.borrow().balances.get(&caller).cloned().unwrap_or(0));
    if balance < total_cost {
        return Err("Insufficient balance".to_string());
    }

    let subaccount = compute_subaccount(&caller);
    let transfer_args = TransferArgs {
        from_subaccount: Some(subaccount),
        to: destination,
        amount: Tokens::from_e8s(amount_e8s),
        fee: Tokens::from_e8s(fee),
        memo: Memo(0),
        created_at_time: None,
    };

    let ledger_canister_id = Principal::from_text("ryjl3-tyaaa-aaaaa-aaaba-cai")
        .map_err(|e| format!("Invalid ledger ID: {:?}", e))?;
    let transfer_result: (TransferResult,) = call(ledger_canister_id, "transfer", (transfer_args,))
        .await
        .map_err(|e| format!("Transfer failed: {:?}", e))?;

    match transfer_result.0 {
        Ok(_) => {
            STATE.with(|state| {
                let mut state = state.borrow_mut();
                let balance = state.balances.get_mut(&caller).unwrap();
                *balance -= total_cost;
            });
            Ok(())
        }
        Err(e) => Err(format!("Transfer error: {:?}", e)),
    }
}

#[update]
async fn icp_to_usd_rate() -> Result<f64, String> {
    let request = CanisterHttpRequestArgument {
        method: HttpMethod::GET,
        url: "https://api.coingecko.com/api/v3/simple/price?ids=internet-computer&vs_currencies=usd".to_string(),
        max_response_bytes: Some(2000),
        headers: vec![],
        body: Some(vec![]),
        transform: Some(TransformContext::from_name("transform".to_string(), vec![])),
    };

    let response: Result<(HttpResponse,), _> = http_request(request, 500_000_000).await;
    match response {
        Ok((http_response,)) => {
            let body_str = String::from_utf8(http_response.body).map_err(|e| format!("UTF-8 error: {}", e))?;
            let rate = body_str
                .split("\"usd\":")
                .nth(1)
                .and_then(|s| s.split("}").next())
                .and_then(|s| s.parse::<f64>().ok())
                .ok_or("Failed to parse USD rate")?;
            Ok(rate)
        }
        Err(e) => Err(format!("HTTP request failed: {:?}", e)),
    }
}

#[query]
fn transform(raw: TransformArgs) -> HttpResponse {
    let mut response = raw.response;
    response.headers = vec![];
    response
}

#[update]
async fn commit_for_mining(amount_e8s: u64) -> Result<f64, String> {
    let caller = ic_cdk::caller();
    let usd_rate = icp_to_usd_rate().await?;
    let amount_usd = (amount_e8s as f64 / 1e8) * usd_rate;

    STATE.with(|state| {
        let mut state = state.borrow_mut();
        let balance = state.balances.get(&caller).cloned().unwrap_or(0);
        if balance < amount_e8s {
            return Err("Insufficient balance".to_string());
        }
        let committed = state.committed_balances.entry(caller).or_insert(0);
        *committed += amount_e8s;
        let balance = state.balances.get_mut(&caller).unwrap();
        *balance -= amount_e8s;
        let usd_values = state.usd_values.entry(caller).or_insert(0.0);
        *usd_values += amount_usd;
        Ok(amount_usd)
    })
}

#[pre_upgrade]
fn pre_upgrade() {
    STATE.with(|state| {
        storage::stable_save(((*state.borrow()).clone(),)).expect("Failed to save state");
    });
}

#[post_upgrade]
fn post_upgrade() {
    match storage::stable_restore::<(State,)>(){
        Ok((state,)) => {
            STATE.with(|s| *s.borrow_mut() = state);
        }
        Err(_) => {
            // If restoration fails, reset to default state
            STATE.with(|s| *s.borrow_mut() = State {
                balances: HashMap::new(),
                last_known_balances: HashMap::new(),
                committed_balances: HashMap::new(),
                usd_values: HashMap::new(),
            });
        }
    }
}

ic_cdk::export_candid!();