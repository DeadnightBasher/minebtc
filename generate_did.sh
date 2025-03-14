#!/usr/bin/env bash
set -eu

target_dir="./target/wasm32-unknown-unknown/release"

# Build all canisters
cargo build --target wasm32-unknown-unknown --release -p app_backend
cargo build --target wasm32-unknown-unknown --release -p financial_engine
cargo build --target wasm32-unknown-unknown --release -p ibtc

# Generate Candid files
mkdir -p src/declarations/app_backend
mkdir -p src/declarations/financial_engine
mkdir -p src/declarations/ibtc
candid-extractor "$target_dir/app_backend.wasm" > "src/declarations/app_backend/app_backend.did"
candid-extractor "$target_dir/financial_engine.wasm" > "src/declarations/financial_engine/financial_engine.did"
candid-extractor "$target_dir/ibtc.wasm" > "src/declarations/ibtc/ibtc.did"