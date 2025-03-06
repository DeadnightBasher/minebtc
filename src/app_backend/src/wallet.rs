use candid::{CandidType, Deserialize, Principal};
use ic_stable_structures::{
    memory_manager::{MemoryManager, VirtualMemory, MemoryId},
    DefaultMemoryImpl,
    StableBTreeMap,
    storable::{Storable, Bound}
};
use serde::Serialize;
use sha2::{Sha224, Digest};
use crc32fast::Hasher as Crc32Hasher;
use std::borrow::Cow;
use std::cell::RefCell;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Wallet {
    pub icp_address: String,
    pub ibtc_address: String,
    pub ckbtc_address: String,
}

impl Storable for Wallet {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(serde_cbor::to_vec(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        serde_cbor::from_slice(bytes.as_ref()).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    static WALLETS: RefCell<StableBTreeMap<Vec<u8>, Wallet, VirtualMemory<DefaultMemoryImpl>>> =
        RefCell::new(StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(2)))));
}

fn compute_account_id(principal: &Principal) -> String {
    let mut hasher = Sha224::new();
    hasher.update(b"\x0Aaccount-id");
    hasher.update(principal.as_slice());
    hasher.update([0u8; 32]); // Default subaccount (32 zeros)
    let hash = hasher.finalize();

    let mut crc32_hasher = Crc32Hasher::new();
    crc32_hasher.update(&hash);
    let checksum = crc32_hasher.finalize();

    let account_id_bytes: Vec<u8> = checksum.to_be_bytes().to_vec().into_iter().chain(hash.to_vec()).collect();
    hex::encode(account_id_bytes)
}

#[ic_cdk::update]
pub fn get_or_create_wallet() -> Result<Wallet, String> {
    let caller = ic_cdk::caller();
    let caller_bytes = caller.as_slice().to_vec();

    WALLETS.with(|wallets| {
        let mut wallets = wallets.borrow_mut();
        if let Some(wallet) = wallets.get(&caller_bytes) {
            return Ok(wallet.clone());
        }
        let principal_str = caller.to_text();
        let new_wallet = Wallet {
            icp_address: compute_account_id(&caller),
            ibtc_address: principal_str.clone(),
            ckbtc_address: principal_str,
        };
        wallets.insert(caller_bytes, new_wallet.clone());
        Ok(new_wallet)
    })
}

#[ic_cdk::query]
pub fn get_wallet() -> Option<Wallet> {
    let caller = ic_cdk::caller();
    let caller_bytes = caller.as_slice().to_vec();
    
    WALLETS.with(|wallets| wallets.borrow().get(&caller_bytes).map(|wallet| wallet.to_owned()))
}