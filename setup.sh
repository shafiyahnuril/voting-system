#!/bin/bash

echo "🚀 Setting up Blockchain Voting System..."

# Check if Ganache is running
echo "🔍 Checking Ganache connection..."
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  http://localhost:8545 > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo "❌ Ganache is not running!"
    echo "📋 Please start Ganache first:"
    echo "   ganache-cli --host 0.0.0.0 --port 8545 --deterministic --accounts 10 --defaultBalanceEther 100"
    exit 1
fi

echo "✅ Ganache is running"

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf build/

# Compile contracts
echo "🔨 Compiling contracts..."
truffle compile

if [ $? -ne 0 ]; then
    echo "❌ Contract compilation failed!"
    exit 1
fi

echo "✅ Contracts compiled successfully"

# Deploy contracts
echo "🚀 Deploying contracts..."
truffle migrate --reset

if [ $? -ne 0 ]; then
    echo "❌ Contract deployment failed!"
    exit 1
fi

echo "✅ Contracts deployed successfully"

# Extract contract addresses from build artifacts
VOTING_ADDRESS=$(node -e "
try {
  const fs = require('fs');
  const artifact = JSON.parse(fs.readFileSync('./build/contracts/VotingSystem.json', 'utf8'));
  const networks = artifact.networks;
  const networkId = Object.keys(networks)[0];
  console.log(networks[networkId].address);
} catch(e) {
  console.log('0x5FbDB2315678afecb367f032d93F642f64180aa3');
}
")

ORACLE_ADDRESS=$(node -e "
try {
  const fs = require('fs');
  const artifact = JSON.parse(fs.readFileSync('./build/contracts/NIKVerificationOracle.json', 'utf8'));
  const networks = artifact.networks;
  const networkId = Object.keys(networks)[0];
  console.log(networks[networkId].address);
} catch(e) {
  console.log('0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512');
}
")

# Update .env file
echo "📝 Updating .env file..."
cat > .env << EOF
# Generated on $(date)
REACT_APP_VOTING_CONTRACT_ADDRESS=$VOTING_ADDRESS
REACT_APP_ORACLE_CONTRACT_ADDRESS=$ORACLE_ADDRESS
REACT_APP_RPC_URL=http://localhost:8545
REACT_APP_CHAIN_ID=5777
REACT_APP_NETWORK_NAME=Ganache Local
EOF

echo "✅ .env file updated"
echo "📍 VotingSystem address: $VOTING_ADDRESS"
echo "📍 Oracle address: $ORACLE_ADDRESS"

# Test contract deployment
echo "🧪 Testing contract deployment..."
node -e "
const Web3 = require('web3');
const web3 = new Web3('http://localhost:8545');

async function testContract() {
  try {
    const accounts = await web3.eth.getAccounts();
    console.log('✅ Accounts available:', accounts.length);
    
    const abi = [{
      'inputs': [],
      'name': 'electionCount',
      'outputs': [{'internalType': 'uint256', 'name': '', 'type': 'uint256'}],
      'stateMutability': 'view',
      'type': 'function'
    }];
    
    const contract = new web3.eth.Contract(abi, '$VOTING_ADDRESS');
    const count = await contract.methods.electionCount().call();
    console.log('✅ Contract test successful - Election count:', count);
    
    const balance = await web3.eth.getBalance(accounts[0]);
    console.log('✅ Account balance:', web3.utils.fromWei(balance, 'ether'), 'ETH');
    
  } catch (error) {
    console.error('❌ Contract test failed:', error.message);
    process.exit(1);
  }
}

testContract();
"

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Setup completed successfully!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Start frontend: npm start"
    echo "2. Open browser: http://localhost:3000"
    echo "3. Connect MetaMask to http://localhost:8545"
    echo "4. Import account with private key from Ganache"
    echo ""
    echo "🔧 Troubleshooting:"
    echo "- If still getting timeout, restart Ganache and run this script again"
    echo "- Make sure MetaMask is connected to localhost:8545"
    echo "- Check browser console for any errors"
else
    echo "❌ Setup failed! Check the errors above."
    exit 1
fi