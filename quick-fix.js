#!/usr/bin/env node

// quick-fix.js - Script untuk mengatasi masalah loading stuck

const Web3 = require('web3');
const fs = require('fs');
const path = require('path');

class QuickFix {
  constructor() {
    this.web3 = null;
    this.accounts = [];
    this.issues = [];
    this.fixes = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = {
      info: '📍',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      fix: '🔧'
    };
    
    console.log(`${prefix[type]} [${timestamp}] ${message}`);
  }

  async checkGanache() {
    this.log('Checking Ganache connection...');
    
    try {
      this.web3 = new Web3('http://localhost:8545');
      const blockNumber = await this.web3.eth.getBlockNumber();
      const chainId = await this.web3.eth.getChainId();
      
      this.log(`Ganache connected - Block: ${blockNumber}, Chain ID: ${chainId}`, 'success');
      return true;
    } catch (error) {
      this.log(`Ganache connection failed: ${error.message}`, 'error');
      this.issues.push('ganache_disconnected');
      return false;
    }
  }

  async checkAccounts() {
    this.log('Checking accounts...');
    
    try {
      this.accounts = await this.web3.eth.getAccounts();
      
      if (this.accounts.length === 0) {
        this.log('No accounts found', 'error');
        this.issues.push('no_accounts');
        return false;
      }
      
      this.log(`Found ${this.accounts.length} accounts`, 'success');
      
      // Check balances
      for (let i = 0; i < Math.min(3, this.accounts.length); i++) {
        const balance = await this.web3.eth.getBalance(this.accounts[i]);
        const balanceEth = this.web3.utils.fromWei(balance, 'ether');
        this.log(`Account ${i}: ${this.accounts[i]} (${balanceEth} ETH)`);
        
        if (parseFloat(balanceEth) < 1) {
          this.log(`Account ${i} has low balance`, 'warning');
          this.issues.push('low_balance');
        }
      }
      
      return true;
    } catch (error) {
      this.log(`Account check failed: ${error.message}`, 'error');
      this.issues.push('account_error');
      return false;
    }
  }

  async checkContracts() {
    this.log('Checking deployed contracts...');
    
    try {
      // Read .env file
      const envPath = path.join(process.cwd(), '.env');
      let contractAddress = null;
      
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/REACT_APP_VOTING_CONTRACT_ADDRESS=(.+)/);
        if (match) {
          contractAddress = match[1].trim();
        }
      }
      
      if (!contractAddress) {
        this.log('Contract address not found in .env', 'error');
        this.issues.push('no_contract_address');
        return false;
      }
      
      this.log(`Contract address: ${contractAddress}`);
      
      // Check if contract exists
      const code = await this.web3.eth.getCode(contractAddress);
      if (code === '0x' || code === '0x0') {
        this.log('No contract code found at address', 'error');
        this.issues.push('contract_not_deployed');
        return false;
      }
      
      this.log(`Contract code found (${code.length} chars)`, 'success');
      
      // Test basic contract call
      const basicABI = [
        {
          "inputs": [],
          "name": "electionCount",
          "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
          "stateMutability": "view",
          "type": "function"
        }
      ];
      
      const contract = new this.web3.eth.Contract(basicABI, contractAddress);
      const electionCount = await contract.methods.electionCount().call();
      
      this.log(`Contract responsive - Election count: ${electionCount}`, 'success');
      return true;
      
    } catch (error) {
      this.log(`Contract check failed: ${error.message}`, 'error');
      this.issues.push('contract_error');
      return false;
    }
  }

  async checkPendingTransactions() {
    this.log('Checking for pending transactions...');
    
    try {
      if (!this.accounts.length) return true;
      
      const account = this.accounts[0];
      const [latestNonce, pendingNonce] = await Promise.all([
        this.web3.eth.getTransactionCount(account, 'latest'),
        this.web3.eth.getTransactionCount(account, 'pending')
      ]);
      
      if (pendingNonce > latestNonce) {
        const pendingCount = pendingNonce - latestNonce;
        this.log(`Found ${pendingCount} pending transactions`, 'warning');
        this.issues.push('pending_transactions');
        this.fixes.push(`Reset MetaMask nonce or wait for transactions to complete`);
      } else {
        this.log('No pending transactions', 'success');
      }
      
      return true;
    } catch (error) {
      this.log(`Pending transaction check failed: ${error.message}`, 'error');
      return false;
    }
  }

  async checkGasPrice() {
    this.log('Checking gas price...');
    
    try {
      const gasPrice = await this.web3.eth.getGasPrice();
      const gasPriceGwei = this.web3.utils.fromWei(gasPrice, 'gwei');
      
      this.log(`Current gas price: ${gasPriceGwei} Gwei`, 'success');
      
      if (parseFloat(gasPriceGwei) > 100) {
        this.log('Gas price seems high for local network', 'warning');
        this.issues.push('high_gas_price');
      }
      
      return true;
    } catch (error) {
      this.log(`Gas price check failed: ${error.message}`, 'error');
      return false;
    }
  }

  generateFixes() {
    this.log('Generating fixes based on issues found...', 'fix');
    
    const fixCommands = [];
    
    if (this.issues.includes('ganache_disconnected')) {
      this.log('Fix: Start Ganache', 'fix');
      fixCommands.push('ganache-cli --host 0.0.0.0 --port 8545 --deterministic --accounts 10 --defaultBalanceEther 100');
    }
    
    if (this.issues.includes('contract_not_deployed') || this.issues.includes('no_contract_address')) {
      this.log('Fix: Redeploy contracts', 'fix');
      fixCommands.push('rm -rf build/');
      fixCommands.push('truffle compile');
      fixCommands.push('truffle migrate --reset');
    }
    
    if (this.issues.includes('low_balance')) {
      this.log('Fix: Fund accounts in Ganache', 'fix');
    }
    
    if (this.issues.includes('pending_transactions')) {
      this.log('Fix: Reset MetaMask or wait for pending transactions', 'fix');
    }
    
    // Create fix script
    if (fixCommands.length > 0) {
      const fixScript = `#!/bin/bash
# Auto-generated fix script
echo "🔧 Running auto-fix..."

${fixCommands.join('\n')}

echo "✅ Fix completed. Restart your frontend: npm start"
`;
      
      fs.writeFileSync('auto-fix.sh', fixScript);
      fs.chmodSync('auto-fix.sh', '755');
      this.log('Created auto-fix.sh script', 'fix');
    }
  }

  async testCreateElection() {
    this.log('Testing createElection function...');
    
    try {
      if (!this.accounts.length || this.issues.length > 0) {
        this.log('Skipping createElection test due to previous issues', 'warning');
        return false;
      }
      
      // Full ABI for createElection
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
      
      // Get contract address
      const envPath = path.join(process.cwd(), '.env');
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/REACT_APP_VOTING_CONTRACT_ADDRESS=(.+)/);
      const contractAddress = match[1].trim();
      
      const contract = new this.web3.eth.Contract(createElectionABI, contractAddress);
      
      // Test parameters
      const now = Math.floor(Date.now() / 1000);
      const startTime = now + 300; // 5 minutes from now
      const endTime = startTime + 86400; // 24 hours later
      
      // Estimate gas
      const gasEstimate = await contract.methods
        .createElection("Test Election", "Test description", startTime, endTime)
        .estimateGas({ from: this.accounts[0] });
      
      this.log(`Gas estimate for createElection: ${gasEstimate}`, 'success');
      
      // Send transaction (dry run)
      this.log('createElection method is available and callable', 'success');
      return true;
      
    } catch (error) {
      this.log(`createElection test failed: ${error.message}`, 'error');
      this.issues.push('create_election_error');
      
      if (error.message.includes('createElection is not a function')) {
        this.fixes.push('Update Web3Context.js with complete ABI');
      }
      
      return false;
    }
  }

  async runDiagnostic() {
    this.log('🔍 Starting comprehensive diagnostic...', 'info');
    this.log('='.repeat(50), 'info');
    
    const checks = [
      { name: 'Ganache Connection', fn: () => this.checkGanache() },
      { name: 'Accounts', fn: () => this.checkAccounts() },
      { name: 'Contracts', fn: () => this.checkContracts() },
      { name: 'Pending Transactions', fn: () => this.checkPendingTransactions() },
      { name: 'Gas Price', fn: () => this.checkGasPrice() },
      { name: 'CreateElection Test', fn: () => this.testCreateElection() }
    ];
    
    const results = {};
    
    for (const check of checks) {
      this.log(`\n--- ${check.name} ---`);
      results[check.name] = await check.fn();
    }
    
    // Summary
    this.log('\n📊 DIAGNOSTIC SUMMARY', 'info');
    this.log('='.repeat(50), 'info');
    
    Object.entries(results).forEach(([name, passed]) => {
      const status = passed ? 'PASSED' : 'FAILED';
      const icon = passed ? '✅' : '❌';
      this.log(`${icon} ${name}: ${status}`);
    });
    
    this.log(`\n🔍 Issues found: ${this.issues.length}`, 'info');
    if (this.issues.length > 0) {
      this.issues.forEach(issue => this.log(`  - ${issue}`, 'warning'));
    }
    
    // Generate fixes
    this.generateFixes();
    
    // Final recommendations
    this.log('\n🔧 RECOMMENDED ACTIONS:', 'info');
    if (this.issues.length === 0) {
      this.log('✅ All checks passed! Your setup looks good.', 'success');
      this.log('If you\'re still experiencing issues:', 'info');
      this.log('  1. Clear browser cache and reload', 'info');
      this.log('  2. Restart MetaMask', 'info');
      this.log('  3. Check browser console for errors', 'info');
    } else {
      this.log('1. Run the auto-fix script: ./auto-fix.sh', 'fix');
      this.log('2. Update Web3Context.js with complete ABI', 'fix');
      this.log('3. Clear browser cache: rm -rf node_modules/.cache', 'fix');
      this.log('4. Restart development server: npm start', 'fix');
    }
    
    return results;
  }
}

// Run diagnostic if called directly
if (require.main === module) {
  const quickFix = new QuickFix();
  quickFix.runDiagnostic()
    .then(() => {
      console.log('\n🎉 Diagnostic completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Diagnostic failed:', error.message);
      process.exit(1);
    });
}

module.exports = QuickFix;