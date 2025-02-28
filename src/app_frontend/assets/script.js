async function fetchBackendData() {
    try {
        const instructions = `Instructions:\n1: Connect your Internet Identity\n2: Deposit ICP\n3: The app will farm ckBTC daily for the rest of your life\n4: You can withdraw ckBTC whenever you want`;
        
        document.getElementById("result").innerText = instructions;
        
        const button = document.getElementById("fetchDataBtn");
        button.style.backgroundColor = "green";
        button.innerText = "Data Loaded!";
        button.disabled = true; // Prevents further clicks
    } catch (error) {
        console.error("Error fetching data:", error);
        document.getElementById("result").innerText = "Error fetching data.";
    }
}

function loadCatVideo() {
    const mediaContainer = document.getElementById("media-container");

    // Remove existing image if present
    const existingImage = document.getElementById("bjornImage");
    if (existingImage) {
        existingImage.remove();
    }

    // Check if the video is already added
    if (!document.getElementById("catVideo")) {
        const video = document.createElement("video");
        video.id = "catVideo";
        video.src = "catvideo.mp4";
        video.controls = true;
        video.autoplay = true;

        mediaContainer.appendChild(video);
    }
}
