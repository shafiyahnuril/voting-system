// backend/services/OracleService.js - Enhanced NIK Verification Oracle Service
const Web3 = require('web3');
const { EventEmitter } = require('events');
const crypto = require('crypto');
const axios = require('axios');

// Oracle Contract ABI
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
    "inputs": [{"internalType": "string", "name": "_nik", "type": "string"}, {"internalType": "string", "name": "_nama", "type": "string"}],
    "name": "verifyNIK",
    "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [{"indexed": true, "internalType": "bytes32", "name": "requestId", "type": "bytes32"}, {"indexed": true, "internalType": "address", "name": "requester", "type": "address"}, {"indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256"}],
    "name": "VerificationRequested",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [{"indexed": true, "internalType": "bytes32", "name": "requestId", "type": "bytes32"}, {"indexed": false, "internalType": "bool", "name": "isValid", "type": "bool"}],
    "name": "VerificationCompleted",
    "type": "event"
  }
];

class OracleService extends EventEmitter {
  constructor() {
    super();
    this.web3 = null;
    this.oracleContract = null;
    this.account = null;
    this.isInitialized = false;
    this.verificationRequests = new Map(); // In-memory storage for demo
    this.processingQueue = [];
    this.stats = {
      totalRequests: 0,
      completedRequests: 0,
      pendingRequests: 0,
      successfulVerifications: 0,
      failedVerifications: 0,
      averageProcessingTime: 0
    };
  }

  async initialize() {
    try {
      console.log('🔮 Initializing OracleService...');

      // Initialize Web3
      const rpcUrl = process.env.RPC_URL || 'http://localhost:8545';
      this.web3 = new Web3(rpcUrl);

      // Test connection
      const blockNumber = await this.web3.eth.getBlockNumber();
      console.log(`✅ Oracle connected to blockchain - Block: ${blockNumber}`);

      // Get oracle contract address
      const oracleAddress = process.env.ORACLE_CONTRACT_ADDRESS;
      if (oracleAddress && oracleAddress !== '') {
        try {
          this.oracleContract = new this.web3.eth.Contract(ORACLE_ABI, oracleAddress);
          console.log(`✅ Oracle contract initialized at: ${oracleAddress}`);
        } catch (error) {
          console.warn('⚠️ Oracle contract not available, running in simulation mode');
        }
      } else {
        console.warn('⚠️ Oracle contract address not configured, running in simulation mode');
      }

      // Setup account for oracle operations
      const privateKey = process.env.ORACLE_PRIVATE_KEY;
      if (privateKey) {
        this.account = this.web3.eth.accounts.privateKeyToAccount(privateKey);
        this.web3.eth.accounts.wallet.add(this.account);
        console.log(`✅ Oracle account: ${this.account.address}`);
      } else {
        // Fallback to first available account
        const accounts = await this.web3.eth.getAccounts();
        if (accounts.length > 0) {
          this.account = { address: accounts[0] };
          console.log(`✅ Using fallback account: ${this.account.address}`);
        }
      }

      // Setup event listeners for oracle contract
      if (this.oracleContract) {
        this.setupEventListeners();
      }

      // Start processing queue
      this.startProcessingQueue();

      this.isInitialized = true;
      console.log('✅ OracleService initialized successfully');

    } catch (error) {
      console.error('❌ OracleService initialization failed:', error);
      throw error;
    }
  }

  setupEventListeners() {
    if (!this.oracleContract) return;

    console.log('🔄 Setting up Oracle event listeners...');

    // Listen for verification requests
    const verificationRequestedListener = this.oracleContract.events.VerificationRequested({
      fromBlock: 'latest'
    });

    verificationRequestedListener.on('data', (event) => {
      console.log('📝 VerificationRequested event:', event.returnValues);
      this.handleVerificationRequestEvent(event);
    });

    verificationRequestedListener.on('error', (error) => {
      console.error('❌ Error in VerificationRequested listener:', error);
    });

    console.log('✅ Oracle event listeners setup complete');
  }

  async handleVerificationRequestEvent(event) {
    const { requestId, requester, timestamp } = event.returnValues;
    
    console.log(`🔄 Processing verification request: ${requestId}`);

    try {
      // Get request details from contract
      const requestDetails = await this.oracleContract.methods
        .getVerificationRequest(requestId)
        .call();

      if (requestDetails.processed) {
        console.log(`⚠️ Request ${requestId} already processed`);
        return;
      }

      // Add to processing queue
      this.processingQueue.push({
        requestId,
        requester,
        timestamp: parseInt(timestamp),
        createdAt: new Date().toISOString()
      });

      console.log(`✅ Added request ${requestId} to processing queue`);

    } catch (error) {
      console.error(`❌ Error handling verification request ${requestId}:`, error);
    }
  }

  async requestNIKVerification({ nik, name, walletAddress, electionId, metadata = {} }) {
    this.ensureInitialized();

    try {
      // Generate unique request ID
      const requestId = this.generateRequestId(nik, walletAddress, Date.now());
      
      console.log(`🔄 Creating NIK verification request: ${requestId}`);

      // Create verification request record
      const verificationRequest = {
        requestId,
        nik: this.hashNIK(nik), // Store hashed NIK for privacy
        name,
        walletAddress,
        electionId,
        status: 'pending',
        isVerified: false,
        createdAt: new Date().toISOString(),
        completedAt: null,
        metadata,
        processingStartedAt: null,
        estimatedCompletion: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes
      };

      // Store request
      this.verificationRequests.set(requestId, verificationRequest);
      this.stats.totalRequests++;
      this.stats.pendingRequests++;

      // If oracle contract is available, create on-chain request
      if (this.oracleContract && this.account) {
        try {
          console.log('📝 Creating on-chain verification request...');
          
          const result = await this.oracleContract.methods
            .verifyNIK(nik, name)
            .send({
              from: this.account.address,
              gas: 300000
            });

          console.log(`✅ On-chain request created: ${result.transactionHash}`);
          
          // Update request with transaction details
          verificationRequest.onChainRequestTx = result.transactionHash;
          verificationRequest.blockNumber = result.blockNumber;
          
        } catch (error) {
          console.warn('⚠️ Failed to create on-chain request, proceeding with off-chain only:', error.message);
        }
      }

      // Start verification process immediately for demo
      setTimeout(() => {
        this.processVerificationRequest(requestId, nik, name);
      }, 1000);

      // Emit event
      this.emit('verificationRequested', {
        requestId,
        walletAddress,
        electionId,
        timestamp: verificationRequest.createdAt
      });

      return {
        requestId,
        status: 'pending',
        createdAt: verificationRequest.createdAt,
        estimatedCompletion: verificationRequest.estimatedCompletion
      };

    } catch (error) {
      console.error('❌ Error requesting NIK verification:', error);
      throw error;
    }
  }

  async processVerificationRequest(requestId, nik, name) {
    try {
      console.log(`🔄 Processing verification request: ${requestId}`);

      const request = this.verificationRequests.get(requestId);
      if (!request) {
        console.error(`❌ Request ${requestId} not found`);
        return;
      }

      // Update status to processing
      request.status = 'processing';
      request.processingStartedAt = new Date().toISOString();
      this.verificationRequests.set(requestId, request);

      // Simulate verification process with realistic delays
      await this.delay(2000); // Initial processing delay

      // Step 1: Validate NIK format
      request.status = 'validating';
      this.verificationRequests.set(requestId, request);
      await this.delay(1000);

      const isValidFormat = this.validateNIKFormat(nik);
      if (!isValidFormat) {
        await this.completeVerification(requestId, false, 'Invalid NIK format');
        return;
      }

      // Step 2: Simulate government API call
      request.status = 'verifying';
      this.verificationRequests.set(requestId, request);
      await this.delay(2000);

      const verificationResult = await this.verifyWithGovernmentAPI(nik, name);

      // Step 3: Complete verification
      await this.completeVerification(requestId, verificationResult.isValid, verificationResult.reason);

    } catch (error) {
      console.error(`❌ Error processing verification ${requestId}:`, error);
      await this.completeVerification(requestId, false, `Processing error: ${error.message}`);
    }
  }

  async verifyWithGovernmentAPI(nik, name) {
    try {
      console.log('🌐 Simulating government API verification...');

      // Simulate API call delay
      await this.delay(1500);

      // Simulate verification logic
      // In real implementation, this would call actual government API
      const isValid = this.simulateNIKVerification(nik, name);
      
      const confidenceScore = isValid ? 
        Math.random() * 0.2 + 0.8 : // 80-100% for valid
        Math.random() * 0.3;       // 0-30% for invalid

      return {
        isValid,
        reason: isValid ? 'NIK verified successfully' : 'NIK not found in government database',
        confidenceScore,
        verificationMethod: 'simulated_government_api',
        apiResponseTime: 1500
      };

    } catch (error) {
      console.error('❌ Government API verification failed:', error);
      return {
        isValid: false,
        reason: `API verification failed: ${error.message}`,
        confidenceScore: 0,
        verificationMethod: 'error',
        apiResponseTime: 0
      };
    }
  }

  simulateNIKVerification(nik, name) {
    // Simulation logic for demo purposes
    // In production, this would interface with real government databases
    
    // Basic validation rules for demonstration:
    // 1. NIK starting with '32' (Central Java) are considered valid
    // 2. Names longer than 3 characters are more likely to be valid
    // 3. Add some randomness for realistic simulation
    
    const nikStartsWithValidRegion = nik.startsWith('32') || nik.startsWith('33');
    const nameIsReasonable = name.length >= 3;
    const randomFactor = Math.random() > 0.1; // 90% success rate for valid-looking data
    
    // Special test cases for demo
    if (nik === '1234567890123456') return true;  // Always valid test NIK
    if (nik === '0000000000000000') return false; // Always invalid test NIK
    
    return nikStartsWithValidRegion && nameIsReasonable && randomFactor;
  }

  async completeVerification(requestId, isVerified, reason = '') {
    try {
      console.log(`🔄 Completing verification ${requestId}: ${isVerified}`);

      const request = this.verificationRequests.get(requestId);
      if (!request) {
        console.error(`❌ Request ${requestId} not found for completion`);
        return;
      }

      // Calculate processing time
      const processingTime = request.processingStartedAt ? 
        new Date() - new Date(request.processingStartedAt) : 0;

      // Update request record
      request.status = 'completed';
      request.isVerified = isVerified;
      request.completedAt = new Date().toISOString();
      request.reason = reason;
      request.processingTime = processingTime;
      
      this.verificationRequests.set(requestId, request);

      // Update stats
      this.stats.completedRequests++;
      this.stats.pendingRequests = Math.max(0, this.stats.pendingRequests - 1);
      
      if (isVerified) {
        this.stats.successfulVerifications++;
      } else {
        this.stats.failedVerifications++;
      }

      // Update average processing time
      this.stats.averageProcessingTime = 
        (this.stats.averageProcessingTime * (this.stats.completedRequests - 1) + processingTime) / 
        this.stats.completedRequests;

      // Complete verification on blockchain if contract available
      if (this.oracleContract && this.account) {
        try {
          console.log('📝 Completing on-chain verification...');
          
          const result = await this.oracleContract.methods
            .completeVerification(requestId, isVerified)
            .send({
              from: this.account.address,
              gas: 200000
            });

          console.log(`✅ On-chain verification completed: ${result.transactionHash}`);
          request.completionTx = result.transactionHash;
          
        } catch (error) {
          console.warn('⚠️ Failed to complete on-chain verification:', error.message);
        }
      }

      // Emit completion event
      this.emit('verificationCompleted', {
        requestId,
        isVerified,
        walletAddress: request.walletAddress,
        electionId: request.electionId,
        processingTime,
        completedAt: request.completedAt
      });

      console.log(`✅ Verification ${requestId} completed: ${isVerified} (${processingTime}ms)`);

    } catch (error) {
      console.error(`❌ Error completing verification ${requestId}:`, error);
    }
  }

  async getVerificationStatus(requestId) {
    this.ensureInitialized();

    const request = this.verificationRequests.get(requestId);
    if (!request) {
      return null;
    }

    return {
      requestId: request.requestId,
      status: request.status,
      isVerified: request.isVerified,
      createdAt: request.createdAt,
      completedAt: request.completedAt,
      processingTime: request.processingTime,
      reason: request.reason,
      electionId: request.electionId,
      walletAddress: request.walletAddress,
      verificationMethod: request.metadata?.verificationMethod,
      confidenceScore: request.metadata?.confidenceScore,
      error: request.error
    };
  }

  async getActiveVerificationRequest(walletAddress, electionId) {
    for (const [requestId, request] of this.verificationRequests) {
      if (request.walletAddress.toLowerCase() === walletAddress.toLowerCase() &&
          request.electionId == electionId &&
          (request.status === 'pending' || request.status === 'processing')) {
        return {
          requestId,
          status: request.status,
          createdAt: request.createdAt,
          estimatedCompletion: request.estimatedCompletion
        };
      }
    }
    return null;
  }

  async getVerificationHistory({ walletAddress, status, electionId, page = 1, limit = 10 }) {
    this.ensureInitialized();

    let requests = Array.from(this.verificationRequests.values());

    // Filter by wallet address
    if (walletAddress) {
      requests = requests.filter(r => 
        r.walletAddress.toLowerCase() === walletAddress.toLowerCase()
      );
    }

    // Filter by status
    if (status) {
      requests = requests.filter(r => r.status === status);
    }

    // Filter by election ID
    if (electionId) {
      requests = requests.filter(r => r.electionId == electionId);
    }

    // Sort by creation date (newest first)
    requests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Pagination
    const total = requests.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedRequests = requests.slice(startIndex, endIndex);

    return {
      data: paginatedRequests.map(r => ({
        requestId: r.requestId,
        status: r.status,
        isVerified: r.isVerified,
        electionId: r.electionId,
        createdAt: r.createdAt,
        completedAt: r.completedAt,
        processingTime: r.processingTime,
        reason: r.reason
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: endIndex < total,
        hasPrev: startIndex > 0
      }
    };
  }

  async monitorVerification(requestId, { electionId, voterAddress, onComplete }) {
    const checkStatus = async () => {
      const status = await this.getVerificationStatus(requestId);
      
      if (status && status.status === 'completed') {
        console.log(`🔔 Verification monitoring complete: ${requestId} -> ${status.isVerified}`);
        if (onComplete) {
          onComplete(status.isVerified);
        }
        return;
      }

      // Continue monitoring
      setTimeout(checkStatus, 5000); // Check every 5 seconds
    };

    checkStatus();
  }

  async getServiceStats() {
    return {
      ...this.stats,
      requestsLast24h: this.getRequestsInTimeframe(24 * 60 * 60 * 1000),
      requestsLastHour: this.getRequestsInTimeframe(60 * 60 * 1000),
      currentLoad: this.processingQueue.length,
      serviceUptime: process.uptime(),
      verificationMethods: ['simulated_government_api'],
      failureReasons: this.getFailureReasons(),
      geographicDistribution: { 'Indonesia': 100 },
      lastMaintenanceWindow: null
    };
  }

  getRequestsInTimeframe(timeframeMs) {
    const cutoff = new Date(Date.now() - timeframeMs);
    let count = 0;
    
    for (const request of this.verificationRequests.values()) {
      if (new Date(request.createdAt) > cutoff) {
        count++;
      }
    }
    
    return count;
  }

  getFailureReasons() {
    const reasons = {};
    
    for (const request of this.verificationRequests.values()) {
      if (!request.isVerified && request.reason) {
        reasons[request.reason] = (reasons[request.reason] || 0) + 1;
      }
    }
    
    return reasons;
  }

  startProcessingQueue() {
    setInterval(() => {
      if (this.processingQueue.length > 0) {
        const request = this.processingQueue.shift();
        console.log(`🔄 Processing queued request: ${request.requestId}`);
        // Process request would be handled by event listeners in real implementation
      }
    }, 1000);
  }

  // Utility Methods
  generateRequestId(nik, walletAddress, timestamp) {
    const data = `${nik}-${walletAddress}-${timestamp}`;
    return '0x' + crypto.createHash('sha256').update(data).digest('hex');
  }

  hashNIK(nik) {
    return crypto.createHash('sha256').update(nik).digest('hex');
  }

  validateNIKFormat(nik) {
    return /^\d{16}$/.test(nik);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  ensureInitialized() {
    if (!this.isInitialized) {
      throw new Error('OracleService not initialized. Call initialize() first.');
    }
  }

  async cleanup() {
    console.log('🔄 Cleaning up OracleService...');
    this.removeAllListeners();
    this.verificationRequests.clear();
    console.log('✅ OracleService cleanup complete');
  }
}

module.exports = OracleService;