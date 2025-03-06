const { HttpAgent } = require("@dfinity/agent");

async function testAgent() {
  try {
    const agent = new HttpAgent({ host: "https://ic0.app" });
    await agent.fetchRootKey();
    console.log("DFINITY agent is working correctly!");
  } catch (error) {
    console.error("Error testing DFINITY agent:", error);
  }
}

testAgent();