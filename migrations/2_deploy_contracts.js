const VotingSystem = artifacts.require("VotingSystem");
const NIKVerificationOracle = artifacts.require("NIKVerificationOracle");

module.exports = async function(deployer, network, accounts) {
  console.log("🚀 Starting simple deployment...");
  console.log("Network:", network);
  console.log("Deployer:", accounts[0]);
  
  try {
    // 1. Deploy Oracle first (no constructor params)
    console.log("🔮 Deploying Oracle...");
    await deployer.deploy(NIKVerificationOracle);
    const oracle = await NIKVerificationOracle.deployed();
    console.log("✅ Oracle deployed:", oracle.address);
    
    // 2. Deploy VotingSystem (no constructor params)
    console.log("🗳️ Deploying VotingSystem...");
    await deployer.deploy(VotingSystem);
    const voting = await VotingSystem.deployed();
    console.log("✅ VotingSystem deployed:", voting.address);
    
    // 3. Link Oracle to VotingSystem
    console.log("🔗 Linking Oracle to VotingSystem...");
    await voting.setOracleAddress(oracle.address);
    console.log("✅ Oracle linked");
    
    // 4. Setup for development
    if (network === 'development') {
      console.log("⚙️ Setting up development data...");
      
      // Authorize node for Oracle
      await oracle.authorizeNode(accounts[1]);
      console.log("✅ Oracle node authorized");
      
      // Create sample election
      const now = Math.floor(Date.now() / 1000);
      const startTime = now + 60; // Start in 1 minute
      const endTime = startTime + (24 * 60 * 60); // 24 hours
      
      await voting.createElection(
        "Sample Election 2024",
        "Test election for development",
        startTime,
        endTime
      );
      console.log("✅ Sample election created");
      
      // Add candidates
      await voting.addCandidate(1, "Candidate A", "First candidate");
      await voting.addCandidate(1, "Candidate B", "Second candidate");
      console.log("✅ Sample candidates added");
    }
    
    // 5. Save deployment info
    const deploymentInfo = {
      network: network,
      timestamp: new Date().toISOString(),
      contracts: {
        Oracle: oracle.address,
        VotingSystem: voting.address
      },
      accounts: accounts.slice(0, 3)
    };
    
    const fs = require('fs');
    fs.writeFileSync(
      `./deployment-${network}.json`, 
      JSON.stringify(deploymentInfo, null, 2)
    );
    
    // 6. Update .env files
    const frontendEnv = `REACT_APP_VOTING_CONTRACT_ADDRESS=${voting.address}
REACT_APP_ORACLE_CONTRACT_ADDRESS=${oracle.address}
REACT_APP_RPC_URL=http://localhost:8545
REACT_APP_CHAIN_ID=5777
`;
    fs.writeFileSync('.env', frontendEnv);
    
    // Backend env (if folder exists)
    if (fs.existsSync('./backend')) {
      const backendEnv = `ORACLE_CONTRACT_ADDRESS=${oracle.address}
VOTING_CONTRACT_ADDRESS=${voting.address}
RPC_URL=http://localhost:8545
ORACLE_PRIVATE_KEY=0x6cbed15c793ce57650b9877cf6fa156fbef513c4e6134f022a85b1ffdd59b2a1
ORACLE_PORT=3001
`;
      fs.writeFileSync('./backend/.env', backendEnv);
    }
    
    console.log("\n🎉 DEPLOYMENT COMPLETE!");
    console.log("Oracle:", oracle.address);
    console.log("VotingSystem:", voting.address);
    console.log("\n🚀 Next steps:");
    console.log("1. Start backend: cd backend && node oracle-service.js");
    console.log("2. Start frontend: npm start");
    console.log("3. Connect MetaMask to Ganache");
    
  } catch (error) {
    console.error("❌ Deployment failed:", error.message);
    console.error("Stack:", error.stack);
    throw error;
  }
};