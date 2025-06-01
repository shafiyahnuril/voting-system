// test-register.js - Script untuk test registrasi voter
const Web3 = require('web3');

const VOTING_ABI = [
  {
    "inputs": [
      {"internalType": "uint256", "name": "_electionId", "type": "uint256"},
      {"internalType": "string", "name": "_name", "type": "string"},
      {"internalType": "string", "name": "_nik", "type": "string"}
    ],
    "name": "registerVoter",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "electionCount",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "_electionId", "type": "uint256"},
      {"internalType": "address", "name": "_voter", "type": "address"}
    ],
    "name": "voterStatus",
    "outputs": [{"internalType": "enum VotingSystem.VoterStatus", "name": "", "type": "uint8"}],
    "stateMutability": "view",
    "type": "function"
  }
];

const CONTRACT_ADDRESS = '0xe78A0F7E598Cc8b0Bb87894B0F60dD2a88d6a8Ab';

async function testRegistration() {
  try {
    console.log('🔄 Testing voter registration...');
    
    // Connect to Ganache
    const web3 = new Web3('http://localhost:8545');
    const accounts = await web3.eth.getAccounts();
    
    console.log('📍 Using account:', accounts[1]); // Use second account
    console.log('📍 Contract address:', CONTRACT_ADDRESS);
    
    // Create contract instance
    const contract = new web3.eth.Contract(VOTING_ABI, CONTRACT_ADDRESS);
    
    // Check election count
    const electionCount = await contract.methods.electionCount().call();
    console.log('📊 Available elections:', electionCount);
    
    if (electionCount == 0) {
      console.error('❌ No elections available');
      return;
    }
    
    // Check voter status before registration
    const statusBefore = await contract.methods.voterStatus(1, accounts[1]).call();
    console.log('📋 Voter status before:', statusBefore);
    
    // Test data
    const testData = {
      electionId: 1,
      name: "Test User",
      nik: "1234567890123456"
    };
    
    console.log('🔄 Attempting registration with:', testData);
    
    // Estimate gas
    const gasEstimate = await contract.methods
      .registerVoter(testData.electionId, testData.name, testData.nik)
      .estimateGas({ from: accounts[1] });
    
    console.log('⛽ Gas estimate:', gasEstimate);
    
    // Send transaction
    const result = await contract.methods
      .registerVoter(testData.electionId, testData.name, testData.nik)
      .send({ 
        from: accounts[1],
        gas: Math.floor(gasEstimate * 1.5)
      });
    
    console.log('✅ Registration successful!');
    console.log('📋 Transaction hash:', result.transactionHash);
    console.log('⛽ Gas used:', result.gasUsed);
    
    // Check voter status after registration
    const statusAfter = await contract.methods.voterStatus(1, accounts[1]).call();
    console.log('📋 Voter status after:', statusAfter);
    
  } catch (error) {
    console.error('❌ Registration failed:', error.message);
    
    if (error.message.includes('revert')) {
      console.error('💡 Contract revert - check requirements');
    } else if (error.message.includes('gas')) {
      console.error('💡 Gas issue - try increasing gas limit');
    }
  }
}

// Run test
testRegistration();