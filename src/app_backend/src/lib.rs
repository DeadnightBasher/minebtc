use candid::{CandidType, Deserialize};
use ic_cdk::{query, update};
use ic_stable_structures::{
    memory_manager::{MemoryManager, VirtualMemory, MemoryId},
    DefaultMemoryImpl,
    StableBTreeMap,
    storable::{Storable, Bound}
};
use serde::Serialize;
use std::borrow::Cow;
use std::cell::RefCell;

mod wallet; // Import wallet.rs

use wallet::{get_wallet, get_or_create_wallet, Wallet}; // Import necessary functions

const MAX_KEY_SIZE: u32 = 29;
const MAX_VALUE_SIZE: u32 = 1024;

type Memory = VirtualMemory<DefaultMemoryImpl>;

#[derive(CandidType, Deserialize, Serialize, Clone)]
pub struct UserProfile {
    user_id: u64,
    name: String,
}

impl Storable for UserProfile {
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

    static USERS: RefCell<StableBTreeMap<Vec<u8>, UserProfile, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(0))))
    );

    static USER_COUNTER: RefCell<StableBTreeMap<u64, u64, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(1))))
    );
}

#[ic_cdk::init]
fn init() {}

#[update]
fn register_user() -> (u64, Option<String>) {
    let caller = ic_cdk::caller();
    let caller_bytes = caller.as_slice().to_vec();

    USERS.with(|users| {
        let mut users = users.borrow_mut();
        if let Some(profile) = users.get(&caller_bytes) {
            (profile.user_id, Some(profile.name.clone()))
        } else {
            let user_id = USER_COUNTER.with(|counter| {
                let mut counter = counter.borrow_mut();
                let new_id = counter.len() as u64;
                counter.insert(new_id, new_id);
                new_id
            });

            users.insert(caller_bytes.clone(), UserProfile {
                user_id,
                name: String::new(),
            });

            // Automatically create a wallet for the user
            let _ = get_or_create_wallet(); // This ensures wallet creation on first login

            (user_id, None)
        }
    })
}

#[update]
fn set_user_name(name: String) -> Result<(), String> {
    let caller = ic_cdk::caller();
    let caller_bytes = caller.as_slice().to_vec();

    USERS.with(|users| {
        let mut users = users.borrow_mut();
        if let Some(mut profile) = users.get(&caller_bytes) {
            profile.name = name;
            users.insert(caller_bytes, profile);
            Ok(())
        } else {
            Err("User not registered.".to_string())
        }
    })
}

#[query]
fn get_user_profile() -> Option<(u64, String)> {
    let caller = ic_cdk::caller();
    let caller_bytes = caller.as_slice().to_vec();

    USERS.with(|users| {
        users.borrow().get(&caller_bytes)
             .map(|profile| (profile.user_id, profile.name.clone()))
    })
}

#[query]
fn get_user_profile_with_wallet() -> Option<(u64, String, Option<Wallet>)> {
    let caller = ic_cdk::caller();
    let caller_bytes = caller.as_slice().to_vec();

    USERS.with(|users| {
        users.borrow().get(&caller_bytes).map(|profile| {
            let wallet = get_wallet(); // Retrieve the user's wallet
            (profile.user_id, profile.name.clone(), wallet)
        })
    })
}

#[update]
fn create_wallet_for_user() -> Result<Wallet, String> {
    get_or_create_wallet() // Calls wallet.rs function to create/get wallet
}

ic_cdk::export_candid!();