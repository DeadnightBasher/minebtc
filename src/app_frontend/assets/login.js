// Load Internet Identity AuthClient and Actor from @dfinity/agent
import { AuthClient } from "https://cdn.jsdelivr.net/npm/@dfinity/auth-client@latest/+esm";
import { Actor, HttpAgent } from "https://cdn.jsdelivr.net/npm/@dfinity/agent@latest/+esm";
// Import the IDL factory from the generated bindings
import { idlFactory } from "./declarations/app_backend/app_backend.did.js";

// Determine the environment and canister ID
const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const backendCanisterId = isLocal
  ? "bd3sg-teaaa-aaaaa-qaaba-cai"  // Local canister ID
  : "umafp-4yaaa-aaaag-at42q-cai"; // Mainnet canister ID (update after deployment)
let backendActor;

// Internet Identity Login Flow
async function login() {
  const authClient = await AuthClient.create();

  authClient.login({
    identityProvider: isLocal
      ? "http://localhost:4943?canisterId=be2us-64aaa-aaaaa-qaabq-cai" // Local Internet Identity
      : "https://identity.ic0.app/#authorize",                       // Mainnet Internet Identity
    onSuccess: async () => {
      const identity = authClient.getIdentity();
      const principal = identity.getPrincipal().toText();
      document.getElementById("principal").innerText = "Logged in as: " + principal;

      // Create an HTTP agent with the user's identity
      const agent = new HttpAgent({
        identity,
        host: isLocal ? "http://localhost:4943" : "https://icp0.io",
      });

      // For local development, fetch the root key (not needed on mainnet)
      if (isLocal) {
        await agent.fetchRootKey();
      }

      // Create the actor using the IDL factory and canister ID
      backendActor = Actor.createActor(idlFactory, {
        agent,
        canisterId: backendCanisterId,
      });

      // Show input fields after login
      document.getElementById("authFields").classList.remove("hidden");

      // Fetch and display the user's current profile
      try {
        const profile = await backendActor.get_user_profile();
        if (profile) {
          document.getElementById("userIdField").value = profile[0]; // user_id
          document.getElementById("userNameField").value = profile[1]; // name
        }
      } catch (error) {
        console.error("Failed to get user profile:", error);
      }
    },
    onError: (err) => {
      console.error("Login failed:", err);
    },
  });
}

// Attach event listener to login button
document.getElementById("loginButton").addEventListener("click", login);