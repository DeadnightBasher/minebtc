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
      console.error("Backend actor or agent not initialized.");
      document.getElementById("icp-balance").textContent = "Error: Agent not initialized";
      document.getElementById("ibtc-balance").textContent = "Error: Agent not initialized";
      document.getElementById("btc-balance").textContent = "Error: Agent not initialized";
      return;
    }

    console.log("Principal received:", principal.toText());
    if (!principal || typeof principal.toText !== 'function') {
      console.error("Invalid principal:", principal);
      document.getElementById("icp-balance").textContent = "Error: Invalid Principal";
      document.getElementById("ibtc-balance").textContent = "Error: Invalid Principal";
      document.getElementById("btc-balance").textContent = "Error: Invalid Principal";
      return;
    }

    const result = await window.backendActor.get_user_profile_with_wallet();
    console.log("Profile with wallet:", JSON.stringify(result, (key, value) => 
      typeof value === 'bigint' ? value.toString() : value, 2));

    if (result && result.length > 0) {
      const [user_id, name, walletOpt] = result[0];
      if (walletOpt && walletOpt.length > 0) {
        const wallet = walletOpt[0];

        const icpPrincipalText = wallet.icp_address.split('-ICP')[0];
        const icpPrincipal = Principal.fromText(icpPrincipalText);
        const accountIdentifier = AccountIdentifier.fromPrincipal({ principal: icpPrincipal });
        const icpAccountBlob = accountIdentifier.toNumbers();
        console.log("ICP Account Blob:", icpAccountBlob, icpAccountBlob.length);

        const icpLedgerActor = Actor.createActor(icpLedgerIdl, { agent: window.agent, canisterId: icpLedgerCanisterId });
        const icrcLedgerActor = Actor.createActor(icrc1Idl, { agent: window.agent, canisterId: icrcLedgerCanisterId });

        const icpBalance = await icpLedgerActor.account_balance({ account: icpAccountBlob });
        const ibtcBalance = await icrcLedgerActor.icrc1_balance_of({ owner: principal, subaccount: [] });
        const ckbtcBalance = await icrcLedgerActor.icrc1_balance_of({ owner: principal, subaccount: [] });

        document.getElementById("icp-address").textContent = accountIdentifier.toHex();
        document.getElementById("ibtc-address").textContent = wallet.ibtc_address;
        document.getElementById("btc-address").textContent = wallet.ckbtc_address;

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
      }
    }
  } catch (error) {
    console.error("Failed to fetch wallet balances:", error);
    document.getElementById("icp-balance").textContent = "Error";
    document.getElementById("ibtc-balance").textContent = "Error";
    document.getElementById("btc-balance").textContent = "Error";
  }
}

export function setupSendButtonListeners() {
  console.log("Setting up send button listeners");
  document.querySelectorAll('.send-btn').forEach(btn => {
    console.log("Adding listener to send-btn:", btn);
    btn.addEventListener('click', () => {
      const currency = btn.getAttribute('data-currency');
      console.log("Send button clicked, showing modal for:", currency);
      showSendModal(currency);
    });
  });

  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const walletItem = btn.closest('.wallet-item');
      const addressSpan = walletItem.querySelector('.wallet-address span');
      copyAddress(addressSpan.id);
    });
  });

  document.querySelectorAll('.qr-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const walletItem = btn.closest('.wallet-item');
      const addressSpan = walletItem.querySelector('.wallet-address span');
      const qrContainer = walletItem.querySelector('.qr-container');
      toggleQRCode(addressSpan.id, qrContainer.id);
    });
  });
}

function copyAddress(elementId) {
  const addressText = document.getElementById(elementId).textContent;
  navigator.clipboard.writeText(addressText)
    .then(() => alert('Address copied to clipboard!'))
    .catch((err) => console.error('Error copying address:', err));
}

function generateQRCode(address, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  const qr = new QRious({ element: document.createElement('canvas'), value: address, size: 150 });
  container.appendChild(qr.element);
}

function toggleQRCode(addressElementId, qrContainerId) {
  const container = document.getElementById(qrContainerId);
  if (container.innerHTML.trim() !== '') {
    container.innerHTML = '';
  } else {
    const address = document.getElementById(addressElementId).textContent;
    generateQRCode(address, qrContainerId);
  }
}

function showSendModal(currency) {
  console.log("showSendModal called with currency:", currency);
  const modal = document.getElementById('sendModal');
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
  modal.classList.remove('hidden');

  document.getElementById('maxButton').onclick = () => {
    const maxAmount = balance > fee ? balance - fee : 0n;
    document.getElementById('amount').value = formatBalance(maxAmount, 8, 5);
    checkAmount(balance, fee);
  };

  document.getElementById('amount').oninput = () => checkAmount(balance, fee);
  document.getElementById('backButton').onclick = () => {
    console.log("Back button clicked, hiding modal");
    modal.classList.add('hidden');
  };
  document.getElementById('continueButton').onclick = () => performTransfer(currency, balance, fee);
  document.getElementById('closeButton').onclick = () => {
    console.log("Close button clicked, hiding modal");
    modal.classList.add('hidden');
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
    fetchWalletBalances(window.agent.getPrincipal());
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