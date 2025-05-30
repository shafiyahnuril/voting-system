// oracle-service.js - Backend service untuk menangani verifikasi NIK
const Web3 = require('web3');
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

// Konfigurasi
const CONFIG = {
  RPC_URL: 'http://localhost:8545', // Ganache local
  ORACLE_CONTRACT_ADDRESS: '0x...', // Address dari deployed Oracle contract
  VOTING_CONTRACT_ADDRESS: '0x...', // Address dari deployed Voting contract
  PRIVATE_KEY: '0x...', // Private key dari authorized node
  PORT: 3001
};

// ABI contracts (hanya function yang diperlukan)
const ORACLE_ABI = [
  {
    "inputs": [{"internalType": "bytes32", "name": "_requestId", "type": "bytes32"}, {"internalType": "bool", "name": "_isValid", "type": "bool"}],
    "name": "completeVerification",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes32", "name": "_requestId", "type": "bytes32"}],
    "name": "getVerificationRequest",
    "outputs": [{"internalType": "address", "name": "requester", "type": "address"}, {"internalType": "bool", "name": "processed", "type": "bool"}, {"internalType": "bool", "name": "isValid", "type": "bool"}, {"internalType": "uint256", "name": "timestamp", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [{"indexed": true, "internalType": "bytes32", "name": "requestId", "type": "bytes32"}, {"indexed": true, "internalType": "address", "name": "requester", "type": "address"}, {"indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256"}],
    "name": "VerificationRequested",
    "type": "event"
  }
];

class NIKVerificationService {
  constructor() {
    this.web3 = new Web3(CONFIG.RPC_URL);
    this.account = this.web3.eth.accounts.privateKeyToAccount(CONFIG.PRIVATE_KEY);
    this.web3.eth.accounts.wallet.add(this.account);
    
    this.oracleContract = new this.web3.eth.Contract(ORACLE_ABI, CONFIG.ORACLE_CONTRACT_ADDRESS);
    
    this.pendingRequests = new Map(); // Store pending verification requests
    this.processedRequests = new Set(); // Track processed requests
    
    this.setupEventListeners();
    this.startService();
  }
  
  // Setup event listeners untuk menangkap request verifikasi
  setupEventListeners() {
    console.log('Setting up event listeners...');
    
    this.oracleContract.events.VerificationRequested({
      fromBlock: 'latest'
    })
    .on('data', (event) => {
      console.log('New verification request received:', event);
      this.handleVerificationRequest(event);
    })
    .on('error', (error) => {
      console.error('Event listener error:', error);
    });
  }
  
  // Handle verification request dari smart contract
  async handleVerificationRequest(event) {
    const { requestId, requester, timestamp } = event.returnValues;
    
    console.log(`Processing verification request: ${requestId}`);
    
    // Cek apakah request sudah diproses
    if (this.processedRequests.has(requestId)) {
      console.log(`Request ${requestId} already processed`);
      return;
    }
    
    try {
      // Get request details dari contract
      const requestDetails = await this.oracleContract.methods
        .getVerificationRequest(requestId)
        .call();
      
      if (requestDetails.processed) {
        console.log(`Request ${requestId} already processed on-chain`);
        this.processedRequests.add(requestId);
        return;
      }
      
      // Simulate NIK verification process
      // Dalam implementasi nyata, ini akan memanggil API pemerintah
      const isValid = await this.verifyNIKWithGovernmentAPI(requestId);
      
      // Complete verification di smart contract
      await this.completeVerification(requestId, isValid);
      
      this.processedRequests.add(requestId);
      console.log(`Verification completed for request ${requestId}: ${isValid}`);
      
    } catch (error) {
      console.error(`Error processing request ${requestId}:`, error);
    }
  }
  
  // Simulasi verifikasi NIK dengan API pemerintah
  async verifyNIKWithGovernmentAPI(requestId) {
    // Simulasi delay API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simulasi logic verifikasi:
    // - NIK dengan digit terakhir genap = valid
    // - NIK dengan digit terakhir ganjil = invalid
    // Dalam implementasi nyata, ini akan memanggil API Dukcapil
    
    const randomResult = Math.random() > 0.2; // 80% chance valid untuk testing
    console.log(`NIK verification result for ${requestId}: ${randomResult}`);
    
    return randomResult;
  }
  
  // Implementasi nyata untuk verifikasi NIK (contoh)
  async verifyNIKWithRealAPI(nik, nama) {
    // CATATAN: Ini contoh implementasi dengan API fiktif
    // Dalam implementasi nyata, gunakan API resmi Dukcapil
    
    try {
      const response = await fetch('https://api.dukcapil.kemendagri.go.id/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_API_KEY', // API key dari Dukcapil
        },
        body: JSON.stringify({
          nik: nik,
          nama: nama
        })
      });
      
      const result = await response.json();
      return result.isValid && result.namaMatch;
      
    } catch (error) {
      console.error('Error calling government API:', error);
      return false; // Default to invalid if API call fails
    }
  }
  
  // Complete verification di smart contract
  async completeVerification(requestId, isValid) {
    try {
      const gasEstimate = await this.oracleContract.methods
        .completeVerification(requestId, isValid)
        .estimateGas({ from: this.account.address });
      
      const transaction = await this.oracleContract.methods
        .completeVerification(requestId, isValid)
        .send({
          from: this.account.address,
          gas: Math.floor(gasEstimate * 1.2), // Add 20% buffer
          gasPrice: await this.web3.eth.getGasPrice()
        });
      
      console.log(`Verification completed on-chain: ${transaction.transactionHash}`);
      return transaction;
      
    } catch (error) {
      console.error('Error completing verification on-chain:', error);
      throw error;
    }
  }
  
  // Start the service
  startService() {
    const app = express();
    app.use(cors());
    app.use(express.json());
    
    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({
        status: 'running',
        timestamp: new Date().toISOString(),
        account: this.account.address,
        pendingRequests: this.pendingRequests.size,
        processedRequests: this.processedRequests.size
      });
    });
    
    // Manual verification endpoint (untuk testing)
    app.post('/verify-manual', async (req, res) => {
      const { requestId, isValid } = req.body;
      
      try {
        await this.completeVerification(requestId, isValid);
        res.json({ success: true, message: 'Verification completed' });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
    
    // Get service stats
    app.get('/stats', (req, res) => {
      res.json({
        pendingRequests: Array.from(this.pendingRequests.keys()),
        processedCount: this.processedRequests.size,
        accountAddress: this.account.address,
        contractAddress: CONFIG.ORACLE_CONTRACT_ADDRESS
      });
    });
    
    app.listen(CONFIG.PORT, () => {
      console.log(`🔮 NIK Verification Oracle Service running on port ${CONFIG.PORT}`);
      console.log(`📍 Oracle Contract: ${CONFIG.ORACLE_CONTRACT_ADDRESS}`);
      console.log(`👤 Service Account: ${this.account.address}`);
      console.log(`🌐 Health Check: http://localhost:${CONFIG.PORT}/health`);
    });
  }
}

// Jalankan service
if (require.main === module) {
  // Load environment variables
  require('dotenv').config();
  
  // Update config dengan environment variables
  CONFIG.RPC_URL = process.env.RPC_URL || CONFIG.RPC_URL;
  CONFIG.ORACLE_CONTRACT_ADDRESS = process.env.ORACLE_CONTRACT_ADDRESS || CONFIG.ORACLE_CONTRACT_ADDRESS;
  CONFIG.VOTING_CONTRACT_ADDRESS = process.env.VOTING_CONTRACT_ADDRESS || CONFIG.VOTING_CONTRACT_ADDRESS;
  CONFIG.PRIVATE_KEY = process.env.ORACLE_PRIVATE_KEY || CONFIG.PRIVATE_KEY;
  CONFIG.PORT = process.env.ORACLE_PORT || CONFIG.PORT;
  
  console.log('🚀 Starting NIK Verification Oracle Service...');
  new NIKVerificationService();
}

module.exports = NIKVerificationService;