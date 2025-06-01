#!/bin/bash

echo "🔧 Quick Fix for Deployment Error"
echo "================================="

# Step 1: Replace migration file
echo "📝 Updating migration file..."
cp migrations/2_deploy_contracts.js migrations/2_deploy_contracts.js.backup 2>/dev/null

# Create minimal migration
cat > migrations/2_deploy_contracts.js << 'EOF'
const VotingSystem = artifacts.require("VotingSystem");

module.exports = async function(deployer, network, accounts) {
  console.log("🚀 Deploying VotingSystem only...");
  console.log("Network:", network);
  console.log("Deployer:", accounts[0]);
  
  try {
    // Deploy VotingSystem
    await deployer.deploy(VotingSystem);
    const voting = await VotingSystem.deployed();
    console.log("✅ VotingSystem deployed at:", voting.address);
    
    // Verify basic functionality
    const owner = await voting.owner();
    const electionCount = await voting.electionCount();
    console.log("✅ Owner:", owner);
    console.log("✅ Election count:", electionCount.toString());
    
    // Update .env
    const fs = require('fs');
    const envContent = `REACT_APP_VOTING_CONTRACT_ADDRESS=${voting.address}
REACT_APP_RPC_URL=http://localhost:8545
REACT_APP_CHAIN_ID=5777
REACT_APP_NETWORK_NAME=Ganache Local
`;
    fs.writeFileSync('.env', envContent);
    console.log("✅ .env updated");
    
    console.log("\n🎉 DEPLOYMENT SUCCESS!");
    console.log("Contract Address:", voting.address);
    
  } catch (error) {
    console.error("❌ Deployment failed:", error.message);
    throw error;
  }
};
EOF

echo "✅ Migration file updated"

# Step 2: Clean and redeploy
echo "🧹 Cleaning build directory..."
rm -rf build/

echo "🔨 Compiling contracts..."
truffle compile

if [ $? -ne 0 ]; then
    echo "❌ Compilation failed!"
    exit 1
fi

echo "🚀 Deploying contracts..."
truffle migrate --reset

if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
    
    # Test the deployment
    echo "🧪 Testing deployment..."
    node -e "
    const Web3 = require('web3');
    const fs = require('fs');
    
    async function test() {
      try {
        const web3 = new Web3('http://localhost:8545');
        
        // Get contract address from .env
        const envContent = fs.readFileSync('.env', 'utf8');
        const match = envContent.match(/REACT_APP_VOTING_CONTRACT_ADDRESS=(.+)/);
        const contractAddress = match[1].trim();
        
        console.log('Contract address:', contractAddress);
        
        // Test basic contract call
        const abi = [{
          'inputs': [],
          'name': 'electionCount',
          'outputs': [{'internalType': 'uint256', 'name': '', 'type': 'uint256'}],
          'stateMutability': 'view',
          'type': 'function'
        }];
        
        const contract = new web3.eth.Contract(abi, contractAddress);
        const count = await contract.methods.electionCount().call();
        
        console.log('✅ Contract test successful');
        console.log('✅ Election count:', count);
        
      } catch (error) {
        console.error('❌ Test failed:', error.message);
      }
    }
    
    test();
    "
    
    echo ""
    echo "🎯 NEXT STEPS:"
    echo "1. Start frontend: npm start"
    echo "2. Connect MetaMask to http://localhost:8545"
    echo "3. Import Ganache account"
    echo "4. Try creating an election"
    
else
    echo "❌ Deployment failed!"
    echo ""
    echo "🔧 Try these solutions:"
    echo "1. Restart Ganache: pkill ganache && ganache-cli --host 0.0.0.0 --port 8545 --deterministic"
    echo "2. Use minimal contract: cp contracts/MinimalVotingSystem.sol contracts/VotingSystem.sol"
    echo "3. Check Solidity version in truffle-config.js"
fi