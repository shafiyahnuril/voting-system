const VotingSystem = artifacts.require("VotingSystem");
const NIKVerificationOracle = artifacts.require("NIKVerificationOracle");

module.exports = async function(deployer, network, accounts) {
  console.log("🚀 Starting deployment...");
  console.log("Network:", network);
  console.log("Deployer:", accounts[0]);
  console.log("Available accounts:", accounts.slice(0, 3));
  
  try {
    // 1. Deploy Oracle first (no constructor params)
    console.log("🔮 Deploying NIKVerificationOracle...");
    await deployer.deploy(NIKVerificationOracle);
    const oracle = await NIKVerificationOracle.deployed();
    console.log("✅ Oracle deployed at:", oracle.address);
    
    // 2. Deploy VotingSystem (no constructor params)
    console.log("🗳️ Deploying VotingSystem...");
    await deployer.deploy(VotingSystem);
    const voting = await VotingSystem.deployed();
    console.log("✅ VotingSystem deployed at:", voting.address);
    
    // 3. Verify contract deployment by calling basic functions
    console.log("🔍 Verifying contract deployment...");
    try {
      const owner = await voting.owner();
      const electionCount = await voting.electionCount();
      console.log("✅ Contract owner:", owner);
      console.log("✅ Initial election count:", electionCount.toString());
      
      // Verify Oracle
      const oracleOwner = await oracle.owner();
      console.log("✅ Oracle owner:", oracleOwner);
    } catch (verifyError) {
      console.error("❌ Contract verification failed:", verifyError);
      throw verifyError;
    }
    
    // 4. Link Oracle to VotingSystem
    console.log("🔗 Linking Oracle to VotingSystem...");
    try {
      await voting.setOracleAddress(oracle.address);
      console.log("✅ Oracle linked successfully");
    } catch (linkError) {
      console.warn("⚠️ Could not link Oracle (may not be required):", linkError.message);
    }
    
    // 5. Setup for development
    if (network === 'development') {
      console.log("⚙️ Setting up development environment...");
      
      try {
        // Authorize oracle node
        console.log("🔑 Authorizing oracle node...");
        await oracle.authorizeNode(accounts[1]);
        console.log("✅ Oracle node authorized:", accounts[1]);
        
        // Create sample election
        const now = Math.floor(Date.now() / 1000);
        const startTime = now + 300; // Start in 5 minutes
        const endTime = startTime + (7 * 24 * 60 * 60); // 7 days duration
        
        console.log("📊 Creating sample election...");
        console.log("Start time:", new Date(startTime * 1000).toLocaleString());
        console.log("End time:", new Date(endTime * 1000).toLocaleString());
        
        const createTx = await voting.createElection(
          "Pemilihan Demonstrasi 2024",
          "Pemilihan contoh untuk testing dan demonstrasi sistem voting blockchain",
          startTime,
          endTime
        );
        
        console.log("✅ Sample election created, transaction:", createTx.tx);
        
        // Add sample candidates
        console.log("👥 Adding sample candidates...");
        await voting.addCandidate(1, "Kandidat Alpha", "Visi: Transparansi dan inovasi teknologi untuk kemajuan bersama");
        await voting.addCandidate(1, "Kandidat Beta", "Visi: Pemberdayaan masyarakat melalui partisipasi aktif dan kolaboratif");
        await voting.addCandidate(1, "Kandidat Gamma", "Visi: Sustainable development dan good governance untuk masa depan");
        
        console.log("✅ Sample candidates added successfully");
        
        // Verify election creation
        const finalElectionCount = await voting.electionCount();
        console.log("✅ Final election count:", finalElectionCount.toString());
        
      } catch (setupError) {
        console.error("❌ Development setup failed:", setupError);
        // Don't throw here, deployment was successful
      }
    }
    
    // 6. Save deployment info
    console.log("💾 Saving deployment information...");
    const deploymentInfo = {
      network: network,
      timestamp: new Date().toISOString(),
      contracts: {
        VotingSystem: {
          address: voting.address,
          owner: await voting.owner()
        },
        NIKVerificationOracle: {
          address: oracle.address,
          owner: await oracle.owner()
        }
      },
      accounts: accounts.slice(0, 5),
      gasUsed: {
        VotingSystem: voting.constructor.class_defaults.gas,
        Oracle: oracle.constructor.class_defaults.gas
      }
    };
    
    const fs = require('fs');
    const deploymentFile = `./deployment-${network}-${Date.now()}.json`;
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    console.log("✅ Deployment info saved to:", deploymentFile);
    
    // 7. Update environment files
    console.log("🔧 Updating environment files...");
    
    // Frontend .env
    const frontendEnv = `# Generated on ${new Date().toISOString()}
REACT_APP_VOTING_CONTRACT_ADDRESS=${voting.address}
REACT_APP_ORACLE_CONTRACT_ADDRESS=${oracle.address}
REACT_APP_RPC_URL=http://localhost:8545
REACT_APP_CHAIN_ID=5777
REACT_APP_NETWORK_NAME=Ganache Local
`;
    
    fs.writeFileSync('.env', frontendEnv);
    console.log("✅ Frontend .env updated");
    
    // Backend .env (if backend folder exists)
    if (fs.existsSync('./backend')) {
      const backendEnv = `# Generated on ${new Date().toISOString()}
VOTING_CONTRACT_ADDRESS=${voting.address}
ORACLE_CONTRACT_ADDRESS=${oracle.address}
RPC_URL=http://localhost:8545
NETWORK_ID=5777
ORACLE_PRIVATE_KEY=${process.env.ORACLE_PRIVATE_KEY || '0x6cbed15c793ce57650b9877cf6fa156fbef513c4e6134f022a85b1ffdd59b2a1'}
ORACLE_PORT=3001
NODE_ENV=development
DEBUG=true
`;
      fs.writeFileSync('./backend/.env', backendEnv);
      console.log("✅ Backend .env updated");
    }
    
    // 8. Final verification
    console.log("🔍 Final contract verification...");
    try {
      // Test VotingSystem methods
      const testElectionCount = await voting.electionCount();
      console.log("✅ VotingSystem.electionCount():", testElectionCount.toString());
      
      // Test Oracle methods
      const testOracleOwner = await oracle.owner();
      console.log("✅ Oracle.owner():", testOracleOwner);
      
      // Test if methods exist
      console.log("✅ VotingSystem methods available:", [
        'createElection' in voting.methods,
        'addCandidate' in voting.methods,
        'registerVoter' in voting.methods,
        'castVote' in voting.methods
      ]);
      
    } catch (testError) {
      console.error("❌ Final verification failed:", testError);
    }
    
    console.log("\n🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!");
    console.log("=" * 50);
    console.log("📋 Contract Addresses:");
    console.log("   VotingSystem:", voting.address);
    console.log("   Oracle:", oracle.address);
    console.log("\n🚀 Next Steps:");
    console.log("1. Start frontend: npm start");
    console.log("2. Connect MetaMask to http://localhost:8545");
    console.log("3. Import account:", accounts[0]);
    console.log("4. (Optional) Start oracle service: cd backend && npm start");
    console.log("=" * 50);
    
    return {
      votingSystem: voting.address,
      oracle: oracle.address
    };
    
  } catch (error) {
    console.error("❌ DEPLOYMENT FAILED!");
    console.error("Error:", error.message);
    console.error("Stack:", error.stack);
    
    // Try to provide helpful debugging info
    if (error.message.includes('revert')) {
      console.error("💡 This looks like a contract revert. Check:");
      console.error("   - Contract constructor parameters");
      console.error("   - Gas limits");
      console.error("   - Account permissions");
    }
    
    if (error.message.includes('out of gas')) {
      console.error("💡 Out of gas error. Try:");
      console.error("   - Increasing gas limit in truffle-config.js");
      console.error("   - Simplifying contract logic");
    }
    
    throw error;
  }
};