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

// Function to fetch and display the user profile
async function updateUserProfile() {
  try {
    const profile = await backendActor.get_user_profile();
    console.log("Profile fetched:", profile); // Debug log
    if (profile.length > 0) {
      document.getElementById("userIdField").value = profile[0][0]; // user_id
      document.getElementById("userNameField").value = profile[0][1] || ""; // name, default to empty string if null
    } else {
      document.getElementById("userIdField").value = "";
      document.getElementById("userNameField").value = "";
    }
  } catch (error) {
    console.error("Failed to get user profile:", error);
  }
}

// Internet Identity Login Flow
async function login() {
  const authClient = await AuthClient.create();

  authClient.login({
    identityProvider: isLocal
      ? "http://localhost:4943?canisterId=be2us-64aaa-aaaaa-qaabq-cai"
      : "https://identity.ic0.app/#authorize",
    onSuccess: async () => {
      const identity = authClient.getIdentity();
      const principal = identity.getPrincipal().toText();
      document.getElementById("principal").innerText = "Logged in as: " + principal;

      // Create an HTTP agent with the user's identity
      const agent = new HttpAgent({
        identity,
        host: isLocal ? "http://localhost:4943" : "https://icp0.io",
      });

      // For local development, fetch the root key
      if (isLocal) {
        await agent.fetchRootKey();
      }

      // Create the actor
      backendActor = Actor.createActor(idlFactory, {
        agent,
        canisterId: backendCanisterId,
      });

      // Show input fields after login
      document.getElementById("authFields").classList.remove("hidden");

      // Check if user is registered, register if not
      const profile = await backendActor.get_user_profile();
      if (profile.length === 0) {
        console.log("User not registered, registering now...");
        const regResult = await backendActor.register_user();
        console.log("Registration result:", regResult);
      }

      // Fetch and display user profile
      await updateUserProfile();
    },
    onError: (err) => {
      console.error("Login failed:", err);
    },
  });
}

// Handle submit button click
async function handleSubmitName() {
  const nameInput = document.getElementById("inputField1").value.trim();
  if (!nameInput) {
    alert("Please enter a name.");
    return;
  }

  try {
    const result = await backendActor.set_user_name(nameInput);
    console.log("Set name result:", result); // Debug log
    if ("Ok" in result) {
      alert("Name updated successfully!"); // Changed to "updated" for clarity
      await updateUserProfile(); // Refresh profile after setting name
    } else {
      alert("Error updating name: " + result.Err);
    }
  } catch (error) {
    console.error("Failed to update user name:", error);
    alert("Failed to update name due to an error.");
  }
}

// Attach event listeners
document.getElementById("loginButton").addEventListener("click", login);
document.getElementById("actionButton1").addEventListener("click", handleSubmitName);