import { Actor } from "https://cdn.jsdelivr.net/npm/@dfinity/agent@0.18.1/+esm";
import { Principal } from "https://cdn.jsdelivr.net/npm/@dfinity/principal@0.18.1/+esm";
import { AccountIdentifier } from "https://cdn.jsdelivr.net/npm/@dfinity/ledger-icp@2.2.1/+esm";

console.log("wallet.js loaded");

const icpLedgerCanisterId = "ryjl3-tyaaa-aaaaa-aaaba-cai";
const icrcLedgerCanisterId = "mxzaz-hqaaa-aaaar-qaada-cai";

const icpLedgerIdl = ({ IDL }) => {
    return IDL.Service({
        account_balance: IDL.Func([IDL.Record({ account: IDL.Vec(IDL.Nat8) })], [IDL.Record({ e8s: IDL.Nat64 })], ['query']),
    });
};

const icrc1Idl = ({ IDL }) => {
    const Account = IDL.Record({
        owner: IDL.Principal,
        subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)),
    });
    return IDL.Service({
        icrc1_balance_of: IDL.Func([Account], [IDL.Nat], ['query']),
        icrc1_fee: IDL.Func([], [IDL.Nat], ['query']),
    });
};

const icpLedgerTransferIdl = ({ IDL }) => {
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
};

const icrc1TransferIdl = ({ IDL }) => {
    const Account = IDL.Record({
        owner: IDL.Principal,
        subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)),
    });
    return IDL.Service({
        icrc1_transfer: IDL.Func(
            [IDL.Record({
                to: Account,
                amount: IDL.Nat,
                fee: IDL.Opt(IDL.Nat),
                memo: IDL.Opt(IDL.Vec(IDL.Nat8)),
                created_at_time: IDL.Opt(IDL.Nat64),
            })],
            [IDL.Variant({ Ok: IDL.Nat, Err: IDL.Text })],
            []
        ),
    });
};

function formatBalance(balance, decimals, displayDecimals) {
    const balanceBigInt = BigInt(balance);
    const divisor = BigInt(10 ** decimals);
    const integerPart = balanceBigInt / divisor;
    const fractionalPart = balanceBigInt % divisor;
    const fractionalStr = fractionalPart.toString().padStart(decimals, '0').slice(0, displayDecimals);
    return `${integerPart}.${fractionalStr.padEnd(displayDecimals, '0')}`;
}

export async function fetchWalletBalances(principal) {
    try {
        if (!window.backendActor || !window.agent) {
            throw new Error("Backend actor or agent not initialized.");
        }

        // Ensure principal is a resolved Principal object
        let validPrincipal;
        if (principal instanceof Promise) {
            console.log("Principal is a Promise, awaiting it");
            validPrincipal = await principal;
        } else if (!(principal instanceof Principal)) {
            console.log("Principal is not a Principal object, fetching from agent");
            validPrincipal = await window.agent.getPrincipal();
        } else {
            validPrincipal = principal;
        }
        console.log("Principal received:", validPrincipal.toText());

        const result = await window.backendActor.get_user_profile_with_wallet();
        console.log("Profile with wallet:", JSON.stringify(result, (key, value) => 
            typeof value === 'bigint' ? value.toString() : value, 2));

        if (!result || result.length === 0) {
            throw new Error("User profile not found after login.");
        }

        const { user_id, name, wallet } = result[0];
        if (!wallet || wallet.length === 0) {
            throw new Error("Wallet not found despite creation attempt.");
        }

        const walletData = wallet[0];
        const icpAccountIdentifier = AccountIdentifier.fromHex(walletData.icp_address);
        const icpAccountBlob = icpAccountIdentifier.toNumbers();

        const icpLedgerActor = Actor.createActor(icpLedgerIdl, { agent: window.agent, canisterId: icpLedgerCanisterId });
        const icrcLedgerActor = Actor.createActor(icrc1Idl, { agent: window.agent, canisterId: icrcLedgerCanisterId });

        const icpBalance = await icpLedgerActor.account_balance({ account: icpAccountBlob });
        const ibtcBalance = await icrcLedgerActor.icrc1_balance_of({ owner: validPrincipal, subaccount: [] });
        const ckbtcBalance = await icrcLedgerActor.icrc1_balance_of({ owner: validPrincipal, subaccount: [] });

        document.getElementById("icp-address").textContent = walletData.icp_address;
        document.getElementById("ibtc-address").textContent = walletData.ibtc_address;
        document.getElementById("btc-address").textContent = walletData.ckbtc_address;

        document.getElementById("icp-balance").textContent = formatBalance(icpBalance.e8s, 8, 5);
        document.getElementById("ibtc-balance").textContent = formatBalance(ibtcBalance, 8, 5);
        document.getElementById("btc-balance").textContent = formatBalance(ckbtcBalance, 8, 5);

        window.balances = {
            ICP: icpBalance.e8s,
            iBTC: ibtcBalance,
            BTC: ckbtcBalance,
        };
        window.fees = {
            ICP: 10000n,
            iBTC: await icrcLedgerActor.icrc1_fee(),
            BTC: await icrcLedgerActor.icrc1_fee(),
        };
    } catch (error) {
        console.error("Failed to fetch wallet balances:", error);
        document.getElementById("icp-balance").textContent = "Error: " + error.message;
        document.getElementById("ibtc-balance").textContent = "Error: " + error.message;
        document.getElementById("btc-balance").textContent = "Error: " + error.message;
    }
}

export function setupWalletButtonListeners() {
    console.log("Setting up wallet button listeners");

    document.querySelectorAll('.send-btn').forEach(btn => {
        console.log("Adding listener to send-btn:", btn);
        btn.addEventListener('click', () => {
            const currency = btn.getAttribute('data-currency');
            console.log("Send button clicked, showing modal for:", currency);
            showSendModal(currency);
        });
    });

    document.querySelectorAll('.receive-btn').forEach(btn => {
        console.log("Adding listener to receive-btn:", btn);
        btn.addEventListener('click', () => {
            const walletItem = btn.closest('.wallet-item');
            const currency = walletItem.querySelector('h3').textContent;
            console.log("Receive button clicked, showing modal for:", currency);
            showReceiveModal(currency);
        });
    });
}

function generateQRCode(address, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    const qr = new QRious({ element: document.createElement('canvas'), value: address, size: 250 });
    container.appendChild(qr.element);
}

function showSendModal(currency) {
    console.log("showSendModal called with currency:", currency);
    const modal = document.getElementById('sendModal');
    if (!modal) {
        console.error("Send modal element not found!");
        return;
    }
    modal.style.display = 'flex';
    modal.classList.remove('hidden');

    document.getElementById('sendCurrency').textContent = currency;
    const balance = window.balances[currency];
    const fee = window.fees[currency];
    const formattedBalance = formatBalance(balance, 8, 5);
    document.getElementById('sendBalance').textContent = formattedBalance;
    const logoSrc = document.querySelector(`#wallet-${currency.toLowerCase()} .wallet-logo`).src;
    document.getElementById('sendLogo').src = logoSrc;
    document.getElementById('transferFee').textContent = formatBalance(fee, 8, 5);

    document.getElementById('destination').value = '';
    document.getElementById('amount').value = '';
    document.getElementById('warning').classList.add('hidden');
    document.getElementById('destination').placeholder = currency === 'ICP' 
        ? 'Enter Account ID (64 hex chars)' 
        : 'Enter Internet Identity Principal (e.g., etnz4-orqxp-ng4qk-...)';
    document.getElementById('sendForm').classList.remove('hidden');
    document.getElementById('sendResult').classList.add('hidden');

    document.getElementById('maxButton').onclick = () => {
        const maxAmount = balance > fee ? balance - fee : 0n;
        document.getElementById('amount').value = formatBalance(maxAmount, 8, 5);
        checkAmount(balance, fee);
    };

    document.getElementById('amount').oninput = () => checkAmount(balance, fee);
    document.getElementById('backButton').onclick = () => {
        console.log("Back button clicked, hiding modal");
        modal.style.display = 'none';
        modal.classList.add('hidden');
    };
    document.getElementById('continueButton').onclick = () => performTransfer(currency, balance, fee);
    document.getElementById('closeButton').onclick = () => {
        console.log("Close button clicked, hiding modal");
        modal.style.display = 'none';
        modal.classList.add('hidden');
    };
}

function showReceiveModal(currency) {
    console.log("showReceiveModal called with currency:", currency);
    const modal = document.getElementById('receiveModal');
    if (!modal) {
        console.error("Receive modal element not found!");
        return;
    }
    modal.style.display = 'flex';
    modal.classList.remove('hidden');

    document.getElementById('receiveCurrency').textContent = currency;
    const logoSrc = document.querySelector(`#wallet-${currency.toLowerCase()} .wallet-logo`).src;
    document.getElementById('receiveLogo').src = logoSrc;

    const addressElementId = `${currency.toLowerCase()}-address`;
    const address = document.getElementById(addressElementId).textContent;
    document.getElementById('receiveAddress').textContent = address;
    generateQRCode(address, 'receiveQR');

    document.getElementById('receiveCopyButton').onclick = () => {
        navigator.clipboard.writeText(address)
            .then(() => alert('Address copied to clipboard!'))
            .catch((err) => console.error('Error copying address:', err));
    };

    document.getElementById('receiveFinishButton').onclick = () => {
        console.log("Finish button clicked, hiding receive modal");
        modal.style.display = 'none';
        modal.classList.add('hidden');
        document.getElementById('wallet-dashboard').classList.remove('hidden');
    };
}

function checkAmount(balance, fee) {
    const amountStr = document.getElementById('amount').value;
    const amountBigInt = BigInt(Math.round(parseFloat(amountStr) * 10 ** 8));
    const warning = document.getElementById('warning');
    if (amountBigInt <= 0n) {
        warning.textContent = 'Amount must be greater than 0';
        warning.classList.remove('hidden');
    } else if (amountBigInt > balance - fee) {
        warning.textContent = 'Insufficient balance';
        warning.classList.remove('hidden');
    } else {
        warning.classList.add('hidden');
    }
}

async function performTransfer(currency, balance, fee) {
    const destination = document.getElementById('destination').value;
    const amountStr = document.getElementById('amount').value;
    const amountBigInt = BigInt(Math.round(parseFloat(amountStr) * 10 ** 8));

    if (!destination || !amountStr) {
        document.getElementById('resultMessage').textContent = 'Please fill all fields';
        showResult();
        return;
    }
    if (amountBigInt <= 0n || amountBigInt > balance - fee) {
        document.getElementById('resultMessage').textContent = 'Invalid amount';
        showResult();
        return;
    }

    try {
        if (currency === 'ICP') {
            if (!/^[0-9a-fA-F]{64}$/.test(destination)) {
                throw new Error('Invalid Account ID: Must be 64 hex characters');
            }
            const icpLedgerActor = Actor.createActor(icpLedgerTransferIdl, { agent: window.agent, canisterId: icpLedgerCanisterId });
            const destAccount = AccountIdentifier.fromHex(destination);
            const result = await icpLedgerActor.transfer({
                to: destAccount.toNumbers(),
                amount: { e8s: amountBigInt },
                fee: { e8s: fee },
                memo: 0n,
                created_at_time: [],
            });
            if ('Err' in result) throw new Error(result.Err);
        } else {
            if (!iiPrincipalRegex.test(destination) || destination.length < 60) {
                throw new Error('Invalid Principal: Must be a valid Internet Identity Principal (e.g., etnz4-orqxp-ng4qk-...)');
            }
            let principal;
            try {
                principal = Principal.fromText(destination);
            } catch (e) {
                throw new Error('Invalid Principal format');
            }
            const icrcLedgerActor = Actor.createActor(icrc1TransferIdl, { agent: window.agent, canisterId: icrcLedgerCanisterId });
            const result = await icrcLedgerActor.icrc1_transfer({
                to: { owner: principal, subaccount: [] },
                amount: amountBigInt,
                fee: [fee],
                memo: [],
                created_at_time: [],
            });
            if ('Err' in result) throw new Error(result.Err);
        }
        document.getElementById('resultMessage').textContent = '✓ Successful transfer';
        await fetchWalletBalances(await window.agent.getPrincipal());
    } catch (error) {
        console.error(`Transfer ${currency} failed:`, error);
        document.getElementById('resultMessage').textContent = `Transfer failed: ${error.message}`;
    }
    showResult();
}

function showResult() {
    document.getElementById('sendForm').classList.add('hidden');
    document.getElementById('sendResult').classList.remove('hidden');
}

const iiPrincipalRegex = /^[a-z2-7]{5}(-[a-z2-7]{5})+$/;