import { Actor } from "https://cdn.jsdelivr.net/npm/@dfinity/agent@0.18.1/+esm";
import { AccountIdentifier } from "https://cdn.jsdelivr.net/npm/@dfinity/ledger-icp@2.2.1/+esm";
import { fetchWalletBalances } from "./wallet.js";

// Function to transfer ICP
async function transferICP(toAccountId, amountE8s) {
    const icpLedgerActor = Actor.createActor(({ IDL }) => {
        return IDL.Service({
            transfer: IDL.Func(
                [IDL.Record({
                    to: IDL.Vec(IDL.Nat8),
                    amount: IDL.Record({ e8s: IDL.Nat64 }),
                    fee: IDL.Record({ e8s: IDL.Nat64 }),
                    memo: IDL.Nat64,
                    created_at_time: IDL.Opt(IDL.Nat64),
                })],
                [IDL.Variant({ Ok: IDL.Nat64, Err: IDL.Text })],
                []
            ),
        });
    }, { agent: window.agent, canisterId: "ryjl3-tyaaa-aaaaa-aaaba-cai" });
    const destAccount = AccountIdentifier.fromHex(toAccountId);
    const result = await icpLedgerActor.transfer({
        to: destAccount.toNumbers(),
        amount: { e8s: amountE8s },
        fee: { e8s: 10000n }, // 0.0001 ICP
        memo: 0n,
        created_at_time: [],
    });
    return result;
}

// Function to fetch backend data
export async function fetchBackendData() {
    try {
        const instructions = `Instructions:\n1: Connect your Internet Identity\n2: Deposit ICP\n3: The app will farm ckBTC daily for the rest of your life\n4: You can withdraw ckBTC whenever you want`;
        document.getElementById("result").innerText = instructions;
        const button = document.getElementById("fetchDataBtn");
        button.style.backgroundColor = "green";
        button.innerText = "Data Loaded!";
        button.disabled = true;
    } catch (error) {
        console.error("Error fetching data:", error);
        document.getElementById("result").innerText = "Error fetching data.";
    }
}

// Function to load a video
export function loadCatVideo() {
    const mediaContainer = document.getElementById("media-container");
    const existingImage = document.getElementById("bjornImage");
    if (existingImage) existingImage.remove();
    if (!document.getElementById("catVideo")) {
        const video = document.createElement("video");
        video.id = "catVideo";
        video.src = "catvideo.mp4";
        video.controls = true;
        video.autoplay = true;
        mediaContainer.appendChild(video);
    }
}

// Function to show Wallet Dashboard
function showWalletDashboard() {
    document.getElementById('walletDashboardContent').classList.remove('hidden');
    document.getElementById('mineBitcoinContent').classList.add('hidden');
}

// Function to show Mine Bitcoin view
function showMineBitcoin() {
    document.getElementById('walletDashboardContent').classList.add('hidden');
    document.getElementById('mineBitcoinContent').classList.remove('hidden');
}

// Event listeners for navigation buttons
document.getElementById('walletDashboardBtn').addEventListener('click', showWalletDashboard);
document.getElementById('mineBitcoinBtn').addEventListener('click', showMineBitcoin);

// Initially show Wallet Dashboard
showWalletDashboard();

// Record Deposit functionality
async function recordDeposit() {
    const amountInput = document.getElementById('depositAmount').value;
    if (!amountInput || isNaN(amountInput) || parseFloat(amountInput) <= 0) {
        alert('Please enter a valid ICP amount.');
        return;
    }

    const amountE8s = BigInt(Math.round(parseFloat(amountInput) * 1e8));

    try {
        // Get deposit address from financial_engine
        const depositAddress = await window.financialEngineActor.get_deposit_address();
        console.log("Deposit address:", depositAddress);

        // Transfer ICP to financial_engine
        const transferResult = await transferICP(depositAddress, amountE8s);
        if ('Err' in transferResult) {
            throw new Error(transferResult.Err);
        }
        console.log("Transfer successful, block index:", transferResult.Ok);

        // Claim deposit in financial_engine
        const claimResult = await window.financialEngineActor.claim_deposit();
        if ('Err' in claimResult) {
            throw new Error(claimResult.Err);
        }
        console.log("Claim deposit successful, delta:", claimResult.Ok);

        // Commit for mining and get USD value
        const commitResult = await window.financialEngineActor.commit_for_mining(amountE8s);
        if ('Err' in commitResult) {
            throw new Error(commitResult.Err);
        }
        const usdValue = commitResult.Ok;

        alert(`Mining started successfully!\nCommitted ${amountInput} ICP ($${usdValue.toFixed(2)} USD)`);
        await fetchWalletBalances(window.principal); // Refresh balances
        document.getElementById('minedSatoshi').textContent = "Pending backend update";
        document.getElementById('ibtcHolding').textContent = "Pending backend update";
    } catch (error) {
        console.error('Error starting mining:', error);
        alert(`Error: ${error.message}`);
    }
}

// Event listeners for Mine Bitcoin dashboard buttons
document.getElementById('startMiningBtn').addEventListener('click', recordDeposit);

document.getElementById('claimSatoshiBtn').addEventListener('click', () => {
    alert('Claiming Satoshi! (Functionality to be implemented - requires backend support)');
});

document.getElementById('claimIbtcBtn').addEventListener('click', () => {
    alert('Claiming iBTC! (Functionality to be implemented - requires backend support)');
});

document.getElementById('maxDepositBtn').addEventListener('click', () => {
    const icpBalance = window.balances?.ICP || 0n;
    const maxAmount = Number(icpBalance) / 1e8 - 0.0001; // Subtract fee (0.0001 ICP)
    if (maxAmount > 0) {
        document.getElementById('depositAmount').value = maxAmount.toFixed(5);
    } else {
        alert('Insufficient ICP balance.');
    }
});

// Existing event listeners
document.getElementById("fetchDataBtn").addEventListener("click", fetchBackendData);
document.getElementById("loadVideoBtn").addEventListener("click", loadCatVideo);