// setup-debug.js - Script untuk debug dan verifikasi contract deployment

const Web3 = require('web3');
const fs = require('fs');
const path = require('path');

// Contract ABIs
const VotingSystemABI = [
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
  },
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

class ContractDebugger {
  constructor() {
    this.web3 = new Web3('http://localhost:8545');
    this.accounts = [];
    this.votingContract = null;
    this.contractAddress = null;
  }

  async initialize() {
    try {
      console.log('🔍 Initializing contract debugger...');
      
      // Get accounts
      this.accounts = await this.web3.eth.getAccounts();
      console.log('✅ Available accounts:', this.accounts.length);
      console.log('👤 Using account:', this.accounts[0]);
      
      // Get contract address from .env
      const envPath = path.join(__dirname, '.env');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/REACT_APP_VOTING_CONTRACT_ADDRESS=(.+)/);
        if (match) {
          this.contractAddress = match[1].trim();
          console.log('📍 Contract address from .env:', this.contractAddress);
        }
      }
      
      if (!this.contractAddress) {
        console.error('❌ Contract address not found in .env file');
        return false;
      }
      
      // Initialize contract
      this.votingContract = new this.web3.eth.Contract(VotingSystemABI, this.contractAddress);
      console.log('✅ Contract initialized');
      
      return true;
    } catch (error) {
      console.error('❌ Initialization failed:', error);
      return false;
    }
  }

  async testBasicFunctions() {
    console.log('\n🧪 Testing basic contract functions...');
    
    try {
      // Test owner
      const owner = await this.votingContract.methods.owner().call();
      console.log('✅ Contract owner:', owner);
      
      // Test electionCount
      const electionCount = await this.votingContract.methods.electionCount().call();
      console.log('✅ Election count:', electionCount);
      
      // Check if our account is the owner
      const isOwner = owner.toLowerCase() === this.accounts[0].toLowerCase();
      console.log('👤 Is deployer account owner?', isOwner);
      
      return true;
    } catch (error) {
      console.error('❌ Basic function test failed:', error);
      return false;
    }
  }

  async testCreateElection() {
    console.log('\n🗳️ Testing createElection function...');
    
    try {
      const now = Math.floor(Date.now() / 1000);
      const startTime = now + 300; // 5 minutes from now
      const endTime = startTime + (24 * 60 * 60); // 24 hours later
      
      console.log('📅 Start time:', new Date(startTime * 1000).toLocaleString());
      console.log('📅 End time:', new Date(endTime * 1000).toLocaleString());
      
      // Estimate gas first
      const gasEstimate = await this.votingContract.methods
        .createElection(
          "Test Election",
          "Test election for debugging",
          startTime,
          endTime
        )
        .estimateGas({ from: this.accounts[0] });
      
      console.log('⛽ Gas estimate:', gasEstimate);
      
      // Send transaction
      console.log('📤 Sending createElection transaction...');
      const result = await this.votingContract.methods
        .createElection(
          "Test Election",
          "Test election for debugging",
          startTime,
          endTime
        )
        .send({ 
          from: this.accounts[0],
          gas: Math.floor(gasEstimate * 1.2)
        });
      
      console.log('✅ Transaction successful!');
      console.log('📋 Transaction hash:', result.transactionHash);
      console.log('⛽ Gas used:', result.gasUsed);
      
      // Check election count again
      const newElectionCount = await this.votingContract.methods.electionCount().call();
      console.log('✅ New election count:', newElectionCount);
      
      return true;
    } catch (error) {
      console.error('❌ createElection test failed:', error);
      
      // Detailed error analysis
      if (error.message.includes('revert')) {
        console.error('💡 Contract reverted. Possible reasons:');
        console.error('   - Only owner can create elections');
        console.error('   - Invalid time parameters');
        console.error('   - Contract not properly deployed');
      }
      
      return false;
    }
  }

  async checkNetworkConnection() {
    console.log('\n🌐 Checking network connection...');
    
    try {
      const blockNumber = await this.web3.eth.getBlockNumber();
      console.log('✅ Latest block:', blockNumber);
      
      const chainId = await this.web3.eth.getChainId();
      console.log('✅ Chain ID:', chainId);
      
      const gasPrice = await this.web3.eth.getGasPrice();
      console.log('✅ Gas price:', gasPrice, 'wei');
      
      // Check account balance
      const balance = await this.web3.eth.getBalance(this.accounts[0]);
      const balanceEth = this.web3.utils.fromWei(balance, 'ether');
      console.log('💰 Account balance:', balanceEth, 'ETH');
      
      if (parseFloat(balanceEth) < 1) {
        console.warn('⚠️ Low account balance. Make sure Ganache is funded.');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Network connection failed:', error);
      console.error('💡 Make sure Ganache is running on http://localhost:8545');
      return false;
    }
  }

  async checkContractExists() {
    console.log('\n📋 Checking if contract exists...');
    
    try {
      const code = await this.web3.eth.getCode(this.contractAddress);
      
      if (code === '0x' || code === '0x0') {
        console.error('❌ No contract code found at address:', this.contractAddress);
        console.error('💡 Contract may not be deployed or address is incorrect');
        return false;
      }
      
      console.log('✅ Contract code found (length:', code.length, 'characters)');
      return true;
    } catch (error) {
      console.error('❌ Failed to check contract code:', error);
      return false;
    }
  }

  async runFullDiagnostic() {
    console.log('🔍 Running full contract diagnostic...\n');
    
    const results = {
      initialization: false,
      networkConnection: false,
      contractExists: false,
      basicFunctions: false,
      createElection: false
    };
    
    // Run all tests
    results.initialization = await this.initialize();
    if (!results.initialization) return results;
    
    results.networkConnection = await this.checkNetworkConnection();
    results.contractExists = await this.checkContractExists();
    results.basicFunctions = await this.testBasicFunctions();
    
    // Only test createElection if basic functions work
    if (results.basicFunctions) {
      results.createElection = await this.testCreateElection();
    }
    
    // Summary
    console.log('\n📊 DIAGNOSTIC SUMMARY:');
    console.log('=' * 40);
    Object.entries(results).forEach(([test, passed]) => {
      const status = passed ? '✅' : '❌';
      console.log(`${status} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
    });
    
    const allPassed = Object.values(results).every(result => result);
    console.log('\n' + (allPassed ? '🎉 All tests passed!' : '⚠️ Some tests failed'));
    
    if (!allPassed) {
      console.log('\n🔧 TROUBLESHOOTING STEPS:');
      if (!results.networkConnection) {
        console.log('1. Make sure Ganache is running on http://localhost:8545');
        console.log('2. Check if the RPC URL is correct');
      }
      if (!results.contractExists) {
        console.log('3. Redeploy contracts: truffle migrate --reset');
        console.log('4. Check if contract address in .env is correct');
      }
      if (!results.basicFunctions) {
        console.log('5. Check contract ABI matches deployed contract');
        console.log('6. Verify account has sufficient balance');
      }
      if (!results.createElection) {
        console.log('7. Make sure deployer account is contract owner');
        console.log('8. Check gas limits and network settings');
      }
    }
    
    return results;
  }
}

// Run if called directly
if (require.main === module) {
  const debugger = new ContractDebugger();
  debugger.runFullDiagnostic()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = ContractDebugger;