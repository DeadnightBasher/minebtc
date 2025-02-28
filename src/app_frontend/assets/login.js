// ✅ Load Internet Identity AuthClient
import { AuthClient } from "https://cdn.jsdelivr.net/npm/@dfinity/auth-client@latest/+esm";

// 👉 Define your backend canister ID
const backendCanisterId = "umafp-4yaaa-aaaag-at42q-cai"; 

// 🚀 Internet Identity Login Flow
async function login() {
    const authClient = await AuthClient.create();

    authClient.login({
        identityProvider: "https://identity.ic0.app/#authorize",
        onSuccess: async () => {
            const identity = authClient.getIdentity();
            const principal = identity.getPrincipal().toText();
            document.getElementById("principal").innerText = "Logged in as: " + principal;

            // Show input fields after login
            document.getElementById("authFields").classList.remove("hidden");
        },
        onError: (err) => {
            console.error("Login failed:", err);
        }
    });
}

// Attach event listener to login button
document.getElementById("loginButton").addEventListener("click", login);
