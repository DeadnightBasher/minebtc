use ic_cdk_macros::{query, update};

#[query]
fn greet() -> String {
    "Hello from iBTC Ledger!".to_string()
}

#[update]
fn mint_ibtc(to: String, amount: u64) -> Result<String, String> {
    Ok(format!("Minted {} iBTC to {} (stub)", amount, to))
}

ic_cdk::export_candid!();