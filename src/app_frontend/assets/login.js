console.log("login.js loaded");

import { AuthClient } from "https://cdn.jsdelivr.net/npm/@dfinity/auth-client@0.18.1/+esm";
import { Actor, HttpAgent } from "https://cdn.jsdelivr.net/npm/@dfinity/agent@0.18.1/+esm";
import { idlFactory } from "./app_backend.did.js";
import { fetchWalletBalances, setupWalletButtonListeners } from "./wallet.js";

const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const backendCanisterId = isLocal ? "bd3sg-teaaa-aaaaa-qaaba-cai" : "umafp-4yaaa-aaaag-at42q-cai";

async function updateUserProfile(principal) {
  console.log("updateUserProfile: Starting with principal:", principal.toText());
  try {
    const profile = await window.backendActor.get_user_profile();
    console.log("updateUserProfile: Raw profile response:", JSON.stringify(profile, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
    if (profile.length > 0) {
      const { user_id, name } = profile[0];
      console.log("updateUserProfile: Extracted user_id:", user_id.toString(), "name:", name);
      document.getElementById("userIdField").value = user_id.toString();
      document.getElementById("userNameField").value = name || "";
      await showWalletDashboard(principal);
    } else {
      console.log("updateUserProfile: No profile found, clearing fields");
      document.getElementById("userIdField").value = "";
      document.getElementById("userNameField").value = "";
    }
  } catch (error) {
    console.error("updateUserProfile: Failed to get user profile:", error);
  }
}

async function login() {
  console.log("login: Login button clicked");
  const authClient = await AuthClient.create();
  console.log("login: AuthClient created");

  authClient.login({
    identityProvider: isLocal
      ? "http://localhost:4943?canisterId=be2us-64aaa-aaaaa-qaabq-cai"
      : "https://identity.ic0.app/#authorize",
    onSuccess: async () => {
      console.log("login: onSuccess callback started");
      const identity = authClient.getIdentity();
      const principal = await identity.getPrincipal();
      console.log("login: Principal set:", principal.toText());

      window.principal = principal;

      const agent = new HttpAgent({
        identity,
        host: isLocal ? "http://localhost:4943" : "https://icp0.io",
      });
      console.log("login: HttpAgent created with host:", agent.host);

      if (isLocal) {
        console.log("login: Fetching root key for local environment");
        await agent.fetchRootKey();
        console.log("login: Root key fetched");
      }

      window.agent = agent;
      window.backendActor = Actor.createActor(idlFactory, { agent, canisterId: backendCanisterId });
      console.log("login: Backend actor created, available methods:", Object.keys(window.backendActor));

      document.getElementById("principal").innerText = "Logged in as: " + principal.toText();
      document.getElementById("authFields").classList.remove("hidden");
      document.getElementById("wallet-dashboard").classList.remove("hidden");
      console.log("login: UI updated to show auth fields and wallet dashboard");

      // Ensure user is registered
      console.log("login: Fetching user profile to check registration");
      const profile = await window.backendActor.get_user_profile();
      console.log("login: Raw get_user_profile response:", JSON.stringify(profile, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
      if (profile.length === 0) {
        console.log("login: User not registered, registering now...");
        const regResult = await window.backendActor.register_user();
        console.log("login: Registration result:", JSON.stringify(regResult, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
      } else {
        console.log("login: User already registered:", profile[0]);
      }

      // Ensure wallet exists
      console.log("login: Fetching user profile with wallet");
      const walletProfile = await window.backendActor.get_user_profile_with_wallet();
      console.log("login: Raw get_user_profile_with_wallet response:", JSON.stringify(walletProfile, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
      if (walletProfile.length === 0 || !walletProfile[0].wallet.length) {
        console.log("login: Wallet not found, creating one now...");
        const walletResult = await window.backendActor.create_wallet_for_user();
        console.log("login: Wallet creation result:", JSON.stringify(walletResult, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
        if ("Ok" in walletResult) {
          console.log("login: Wallet created successfully:", walletResult.Ok);
        } else {
          console.error("login: Failed to create wallet:", walletResult.Err);
          throw new Error("Wallet creation failed");
        }
      } else {
        console.log("login: Wallet already exists:", walletProfile[0].wallet);
      }

      console.log("login: Calling updateUserProfile");
      await updateUserProfile(principal);
      console.log("login: Calling fetchWalletBalances");
      await fetchWalletBalances(principal);
      console.log("login: Setting up wallet button listeners");
      setupWalletButtonListeners();
      console.log("login: onSuccess callback completed");
    },
    onError: (err) => {
      console.error("login: Login failed:", err);
    },
  });
}

async function handleSubmitName() {
  console.log("handleSubmitName: Starting");
  const nameInput = document.getElementById("inputField1").value;
  if (!nameInput) {
    console.log("handleSubmitName: No name entered");
    alert("Please enter a name.");
    return;
  }

  try {
    console.log("handleSubmitName: Setting user name to:", nameInput);
    const response = await window.backendActor.set_user_name(nameInput);
    console.log("handleSubmitName: Set name response:", JSON.stringify(response, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
    if ("Ok" in response) {
      alert("Name updated successfully!");
      await updateUserProfile(window.principal);
      console.log("handleSubmitName: Name updated successfully");
    } else {
      alert("Failed to update name: " + response.Err);
      console.log("handleSubmitName: Failed to update name:", response.Err);
    }
  } catch (error) {
    console.error("handleSubmitName: Failed to update name due to an error:", error);
    alert("An error occurred while updating your name.");
  }
}

document.getElementById("loginButton").addEventListener("click", () => {
  console.log("Event listener: Login button clicked, calling login()");
  login();
});
document.getElementById("actionButton1").addEventListener("click", () => {
  console.log("Event listener: Submit name button clicked, calling handleSubmitName()");
  handleSubmitName();
});

async function showWalletDashboard(principal) {
  console.log("showWalletDashboard: Starting with principal:", principal.toText());
  document.getElementById("left-section").classList.add("hidden");
  document.getElementById("wallet-dashboard").classList.remove("hidden");
  console.log("showWalletDashboard: UI updated, calling fetchWalletBalances");
  await fetchWalletBalances(principal);
  console.log("showWalletDashboard: Completed");
}