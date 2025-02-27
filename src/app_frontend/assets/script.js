async function fetchBackendData() {
    try {
        const instructions = `Instructions:\n1: Connect your Internet Identity\n2: Deposit ICP\n3: The app will farm ckBTC daily for the rest of your life\n4: You can withdraw ckBTC whenever you want`;
        
        document.getElementById("result").innerText = instructions;
        
        const button = document.querySelector("button");
        button.style.backgroundColor = "green";
        button.innerText = "Data Loaded!";
        
    } catch (error) {
        console.error("Error fetching data:", error);
        document.getElementById("result").innerText = "Error fetching data.";
    }
}
