console.log("login.js loaded");

import { AuthClient } from "https://cdn.jsdelivr.net/npm/@dfinity/auth-client@0.18.1/+esm";
import { Actor, HttpAgent } from "https://cdn.jsdelivr.net/npm/@dfinity/agent@0.18.1/+esm";
import { idlFactory } from "./app_backend.did.js";
import { fetchWalletBalances, setupSendButtonListeners } from "./wallet.js"; // Import setup function

const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const backendCanisterId = isLocal
  ? "bd3sg-teaaa-aaaaa-qaaba-cai"
  : "umafp-4yaaa-aaaag-at42q-cai";

async function updateUserProfile(principal) {
  try {
    const profile = await window.backendActor.get_user_profile();
    console.log("Profile fetched:", profile);
    if (profile.length > 0) {
      document.getElementById("userIdField").value = profile[0][0];
      document.getElementById("userNameField").value = profile[0][1] || "";
      await showWalletDashboard(principal);
    } else {
      document.getElementById("userIdField").value = "";
      document.getElementById("userNameField").value = "";
    }
  } catch (error) {
    console.error("Failed to get user profile:", error);
  }
}

async function login() {
  console.log("Login button clicked");
  const authClient = await AuthClient.create();

  authClient.login({
    identityProvider: isLocal
      ? "http://localhost:4943?canisterId=be2us-64aaa-aaaaa-qaabq-cai"
      : "https://identity.ic0.app/#authorize",
    onSuccess: async () => {
      const identity = authClient.getIdentity();
      const principal = await identity.getPrincipal(); // Resolve principal here
      console.log("Principal set:", principal.toText());

      const agent = new HttpAgent({
        identity,
        host: isLocal ? "http://localhost:4943" : "https://icp0.io",
      });

      if (isLocal) {
        await agent.fetchRootKey();
      }

      window.agent = agent;
      window.backendActor = Actor.createActor(idlFactory, { agent, canisterId: backendCanisterId });
      console.log("Backend actor created, available methods:", Object.keys(window.backendActor));

      document.getElementById("principal").innerText = "Logged in as: " + principal.toText();
      document.getElementById("authFields").classList.remove("hidden");
      document.getElementById("wallet-dashboard").classList.remove("hidden");

      const profile = await window.backendActor.get_user_profile();
      if (profile.length === 0) {
        console.log("User not registered, registering now...");
        const regResult = await window.backendActor.register_user();
        console.log("Registration result:", regResult);
      }

      await updateUserProfile(principal);
      await fetchWalletBalances(principal); // Pass principal directly
      setupSendButtonListeners(); // Set up listeners after DOM update
    },
    onError: (err) => {
      console.error("Login failed:", err);
    },
  });
}

async function handleSubmitName() {
  const nameInput = document.getElementById("inputField1").value;
  if (!nameInput) {
    alert("Please enter a name.");
    return;
  }

  try {
    const response = await window.backendActor.set_user_name(nameInput);
    if ("Ok" in response) {
      alert("Name updated successfully!");
      await updateUserProfile(window.agent.getPrincipal());
    } else {
      alert("Failed to update name: " + response.Err);
    }
  } catch (error) {
    console.error("Failed to update name due to an error:", error);
    alert("An error occurred while updating your name.");
  }
}

document.getElementById("loginButton").addEventListener("click", login);
document.getElementById("actionButton1").addEventListener("click", handleSubmitName);

async function showWalletDashboard(principal) {
  document.getElementById("left-section").classList.add("hidden");
  document.getElementById("wallet-dashboard").classList.remove("hidden");
  await fetchWalletBalances(principal);
}