use candid::{CandidType, Deserialize, Principal};
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

mod wallet;
use wallet::{get_or_create_wallet, Wallet};

type Memory = VirtualMemory<DefaultMemoryImpl>;

const HYBRID_WALLET_ACCOUNT_ID: &str = "ac56a701340ea9dbcea23664c516557d04c0630556e2c9192c8df03e820293fc";

// UserProfile struct
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

// Struct for get_user_profile_with_wallet
#[derive(CandidType, Deserialize, Serialize)]
struct UserProfileWithWallet {
    user_id: u64,
    name: String,
    wallet: Option<Wallet>,
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

            get_or_create_wallet().expect("Failed to create wallet on registration");
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
fn get_user_profile() -> Option<UserProfile> {
    let caller = ic_cdk::caller();
    let caller_bytes = caller.as_slice().to_vec();

    USERS.with(|users| {
        users.borrow().get(&caller_bytes).map(|profile| UserProfile {
            user_id: profile.user_id,
            name: profile.name.clone(),
        })
    })
}

#[query]
fn get_user_profile_with_wallet() -> Option<UserProfileWithWallet> {
    let caller = ic_cdk::caller();
    let caller_bytes = caller.as_slice().to_vec();

    USERS.with(|users| {
        users.borrow().get(&caller_bytes).map(|profile| {
            let wallet = wallet::get_wallet();
            UserProfileWithWallet {
                user_id: profile.user_id,
                name: profile.name.clone(),
                wallet,
            }
        })
    })
}

#[update]
fn create_wallet_for_user() -> Result<Wallet, String> {
    get_or_create_wallet()
}

#[query]
fn fetch_wallet() -> Option<Wallet> {
    wallet::get_wallet()
}

ic_cdk::export_candid!();