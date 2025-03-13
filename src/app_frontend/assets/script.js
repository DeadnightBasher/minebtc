import { fetchWalletBalances } from "./wallet.js";

// Function to fetch backend data (unchanged)
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

// Function to load a video (unchanged)
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

// Record Deposit functionality (replacing startMining)
async function recordDeposit() {
    const amountInput = document.getElementById('depositAmount').value;
    if (!amountInput || isNaN(amountInput) || parseFloat(amountInput) <= 0) {
        alert('Please enter a valid ICP amount.');
        return;
    }

    const amountE8s = BigInt(Math.round(parseFloat(amountInput) * 1e8));
    const blockIndex = 0n; // Placeholder: In a real app, this should come from an actual ICP transfer confirmation

    try {
        const result = await window.backendActor.record_deposit(amountE8s, blockIndex);
        if ('Ok' in result) {
            const usdValue = result.Ok;
            alert(`Deposit recorded successfully!\nDeposited ${amountInput} ICP ($${usdValue.toFixed(2)} USD)`);
            await fetchWalletBalances(window.principal); // Refresh balances
            // Optionally update mined Satoshi or iBTC display here if backend tracks it
            document.getElementById('minedSatoshi').textContent = "Pending backend update";
            document.getElementById('ibtcHolding').textContent = "Pending backend update";
        } else {
            alert(`Failed to record deposit: ${result.Err}`);
        }
    } catch (error) {
        console.error('Error recording deposit:', error);
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