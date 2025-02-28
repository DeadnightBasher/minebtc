use candid::{CandidType, Deserialize};
use ic_cdk::{query, update};
use ic_stable_structures::{
    memory_manager::{MemoryManager, VirtualMemory, MemoryId}, // Added MemoryId
    DefaultMemoryImpl,
    StableBTreeMap,
    storable::{Storable, Bound}
};
use serde::Serialize;
use std::borrow::Cow;
use std::cell::RefCell;

// Define max key size manually since Principal::MAX_LENGTH_IN_BYTES is private
const MAX_KEY_SIZE: u32 = 29;  // Max Principal size in bytes
const MAX_VALUE_SIZE: u32 = 1024;  // Arbitrary value for user profile storage

// Define the memory type for stable structures (virtual memory over stable memory)
type Memory = VirtualMemory<DefaultMemoryImpl>;

// Struct to store user data
#[derive(CandidType, Deserialize, Serialize, Clone)]
pub struct UserProfile {
    user_id: u64,
    name: String,
}

// Implement Storable for UserProfile
impl Storable for UserProfile {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(serde_cbor::to_vec(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        serde_cbor::from_slice(bytes.as_ref()).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

// Persistent storage for users and user counter, using thread-local for safety
thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    static USERS: RefCell<StableBTreeMap<Vec<u8>, UserProfile, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(0)))) // Fixed
    );

    static USER_COUNTER: RefCell<StableBTreeMap<u64, u64, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(1)))) // Fixed
    );
}

// Canister init: thread_local storages are initialized above, no further action needed
#[ic_cdk::init]
fn init() {}

// Registers a user and returns their user_id and name (if already set)
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

            users.insert(caller_bytes, UserProfile {
                user_id,
                name: String::new(),
            });

            (user_id, None)
        }
    })
}

// Sets the user's name if it hasn't been set before
#[update]
fn set_user_name(name: String) -> Result<(), String> {
    let caller = ic_cdk::caller();
    let caller_bytes = caller.as_slice().to_vec();

    USERS.with(|users| {
        let mut users = users.borrow_mut();

        if let Some(mut profile) = users.get(&caller_bytes) {
            if profile.name.is_empty() {
                profile.name = name;
                users.insert(caller_bytes, profile);
                Ok(())
            } else {
                Err("Name already set and cannot be changed.".to_string())
            }
        } else {
            Err("User not registered.".to_string())
        }
    })
}

// Retrieves the caller's profile (user_id and name) if it exists
#[query]
fn get_user_profile() -> Option<(u64, String)> {
    let caller = ic_cdk::caller();
    let caller_bytes = caller.as_slice().to_vec();

    USERS.with(|users| {
        users.borrow().get(&caller_bytes)
             .map(|profile| (profile.user_id, profile.name.clone()))
    })
}

// Export the candid interface
ic_cdk::export_candid!();