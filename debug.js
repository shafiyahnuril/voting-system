// debug.js - Script untuk debugging masalah voting system

const Web3 = require('web3');
const fs = require('fs');

async function debugSystem() {
  console.log('🔍 Debugging Blockchain Voting System...\n');
  
  // 1. Check Ganache connection
  console.log('1. Checking Ganache connection...');
  try {
    const web3 = new Web3('http://localhost:8545');
    const blockNumber = await web3.eth.getBlockNumber();
    const chainId = await web3.eth.getChainId();
    console.log(`✅ Connected to Ganache - Block: ${blockNumber}, Chain ID: ${chainId}`);
    
    // Check accounts
    const accounts = await web3.eth.getAccounts();
    console.log(`✅ Available accounts: ${accounts.length}`);
    
    if (accounts.length > 0) {
      const balance = await web3.eth.getBalance(accounts[0]);
      const balanceEth = web3.utils.fromWei(balance, 'ether');
      console.log(`✅ Account 0 balance: ${balanceEth} ETH`);
      
      if (parseFloat(balanceEth) < 1) {
        console.log('⚠️ Warning: Low account balance');
      }
    }
    
  } catch (error) {
    console.log('❌ Ganache connection failed:', error.message);
    console.log('💡 Solution: Start Ganache with: ganache-cli --host 0.0.0.0 --port 8545 --deterministic');
    return;
  }
  
  // 2. Check contract deployment
  console.log('\n2. Checking contract deployment...');
  
  // Read contract address from .env
  let contractAddress = null;
  try {
    const envContent = fs.readFileSync('.env', 'utf8');
    const match = envContent.match(/REACT_APP_VOTING_CONTRACT_ADDRESS=(.+)/);
    if (match) {
      contractAddress = match[1].trim();
    }
  } catch (error) {
    console.log('⚠️ Could not read .env file');
  }
  
  if (!contractAddress) {
    console.log('❌ Contract address not found in .env');
    console.log('💡 Solution: Run deployment script or truffle migrate --reset');
    return;
  }
  
  console.log(`📍 Contract address: ${contractAddress}`);
  
  // Check if contract exists
  try {
    const web3 = new Web3('http://localhost:8545');
    const code = await web3.eth.getCode(contractAddress);
    
    if (code === '0x' || code === '0x0') {
      console.log('❌ No contract code found at address');
      console.log('💡 Solution: Deploy contract with: truffle migrate --reset');
      return;
    }
    
    console.log(`✅ Contract code found (${code.length} characters)`);
    
  } catch (error) {
    console.log('❌ Error checking contract:', error.message);
    return;
  }
  
  // 3. Test contract methods
  console.log('\n3. Testing contract methods...');
  
  try {
    const web3 = new Web3('http://localhost:8545');
    const accounts = await web3.eth.getAccounts();
    
    const contractABI = [
      {
        "inputs": [],
        "name": "electionCount",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "owner",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
      }
    ];
    
    const contract = new web3.eth.Contract(contractABI, contractAddress);
    
    // Test view methods
    const electionCount = await contract.methods.electionCount().call();
    console.log(`✅ electionCount(): ${electionCount}`);
    
    const owner = await contract.methods.owner().call();
    console.log(`✅ owner(): ${owner}`);
    
    // Check if current account is owner
    const isOwner = owner.toLowerCase() === accounts[0].toLowerCase();
    console.log(`✅ Is account 0 owner? ${isOwner}`);
    
    if (!isOwner) {
      console.log('⚠️ Warning: Current account is not contract owner');
      console.log('💡 This might cause "Only creator" errors when creating elections');
    }
    
  } catch (error) {
    console.log('❌ Contract method test failed:', error.message);
    console.log('💡 Check if contract ABI matches deployed contract');
    return;
  }
  
  // 4. Test transaction (dry run)
  console.log('\n4. Testing transaction creation...');
  
  try {
    const web3 = new Web3('http://localhost:8545');
    const accounts = await web3.eth.getAccounts();
    
    const createElectionABI = [
      {
        "inputs": [
          {"internalType": "string", "name": "_name", "type": "string"},
          {"internalType": "string", "name": "_description", "type": "string"},
          {"internalType": "uint256", "name": "_startTime", "type": "uint256"},
          {"internalType": "uint256", "name": "_endTime", "type": "uint256"}
        ],
        "name": "createElection",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function"
      }
    ];
    
    const contract = new web3.eth.Contract(createElectionABI, contractAddress);
    
    const now = Math.floor(Date.now() / 1000);
    const startTime = now + 300; // 5 minutes from now
    const endTime = startTime + 86400; // 24 hours later
    
    // Estimate gas
    const gasEstimate = await contract.methods
      .createElection("Test Election", "Test description", startTime, endTime)
      .estimateGas({ from: accounts[0] });
    
    console.log(`✅ Gas estimate for createElection: ${gasEstimate}`);
    
    const gasPrice = await web3.eth.getGasPrice();
    const gasCost = gasEstimate * gasPrice;
    const gasCostEth = web3.utils.fromWei(gasCost.toString(), 'ether');
    
    console.log(`✅ Estimated gas cost: ${gasCostEth} ETH`);
    
    // Check if account has enough balance
    const balance = await web3.eth.getBalance(accounts[0]);
    const balanceBN = web3.utils.toBN(balance);
    const gasCostBN = web3.utils.toBN(gasCost.toString());
    
    if (balanceBN.gte(gasCostBN)) {
      console.log('✅ Account has sufficient balance for transaction');
    } else {
      console.log('❌ Insufficient balance for transaction');
      console.log('💡 Solution: Fund account in Ganache or restart with more ETH');
    }
    
  } catch (error) {
    console.log('❌ Transaction test failed:', error.message);
    
    if (error.message.includes('revert')) {
      console.log('💡 Contract reverted - check contract logic or permissions');
    } else if (error.message.includes('gas')) {
      console.log('💡 Gas-related error - check gas settings');
    }
    return;
  }
  
  console.log('\n🎉 All checks passed! System should be working.');
  console.log('\n📋 If you still have timeout issues:');
  console.log('1. Restart Ganache');
  console.log('2. Clear browser cache');
  console.log('3. Reset MetaMask account (Settings > Advanced > Reset Account)');
  console.log('4. Check browser console for specific errors');
}

// Run debug
debugSystem().catch(console.error);