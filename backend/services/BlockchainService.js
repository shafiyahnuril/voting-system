// backend/services/BlockchainService.js - Blockchain interaction service
const Web3 = require('web3');
const { EventEmitter } = require('events');

// Complete ABI for VotingSystem contract
const VOTING_SYSTEM_ABI = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "uint256", "name": "electionId", "type": "uint256"},
      {"indexed": true, "internalType": "uint256", "name": "candidateId", "type": "uint256"},
      {"indexed": false, "internalType": "string", "name": "name", "type": "string"},
      {"indexed": false, "internalType": "string", "name": "details", "type": "string"}
    ],
    "name": "CandidateAdded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "uint256", "name": "electionId", "type": "uint256"},
      {"indexed": false, "internalType": "string", "name": "name", "type": "string"},
      {"indexed": false, "internalType": "uint256", "name": "startTime", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "endTime", "type": "uint256"},
      {"indexed": false, "internalType": "address", "name": "creator", "type": "address"}
    ],
    "name": "ElectionCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "uint256", "name": "electionId", "type": "uint256"},
      {"indexed": true, "internalType": "address", "name": "voter", "type": "address"},
      {"indexed": false, "internalType": "bytes32", "name": "requestId", "type": "bytes32"}
    ],
    "name": "VoterRegistrationRequested",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "uint256", "name": "electionId", "type": "uint256"},
      {"indexed": true, "internalType": "uint256", "name": "candidateId", "type": "uint256"},
      {"indexed": true, "internalType": "address", "name": "voter", "type": "address"}
    ],
    "name": "VoteSubmitted",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "electionCount",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "name": "elections",
    "outputs": [
      {"internalType": "uint256", "name": "id", "type": "uint256"},
      {"internalType": "string", "name": "name", "type": "string"},
      {"internalType": "string", "name": "description", "type": "string"},
      {"internalType": "uint256", "name": "startTime", "type": "uint256"},
      {"internalType": "uint256", "name": "endTime", "type": "uint256"},
      {"internalType": "uint256", "name": "candidateCount", "type": "uint256"},
      {"internalType": "uint256", "name": "totalVotes", "type": "uint256"},
      {"internalType": "bool", "name": "active", "type": "bool"},
      {"internalType": "address", "name": "creator", "type": "address"}
    ],
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
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "_electionId", "type": "uint256"},
      {"internalType": "string", "name": "_name", "type": "string"},
      {"internalType": "string", "name": "_details", "type": "string"}
    ],
    "name": "addCandidate",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
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
    "inputs": [
      {"internalType": "uint256", "name": "_electionId", "type": "uint256"},
      {"internalType": "uint256", "name": "_candidateId", "type": "uint256"}
    ],
    "name": "castVote",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "_electionId", "type": "uint256"}],
    "name": "getElectionCandidates",
    "outputs": [{"internalType": "uint256[]", "name": "", "type": "uint256[]"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "_candidateId", "type": "uint256"}],
    "name": "getCandidateInfo",
    "outputs": [
      {"internalType": "uint256", "name": "", "type": "uint256"},
      {"internalType": "string", "name": "", "type": "string"},
      {"internalType": "string", "name": "", "type": "string"},
      {"internalType": "uint256", "name": "", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "_electionId", "type": "uint256"},
      {"internalType": "address", "name": "_voter", "type": "address"}
    ],
    "name": "getVoterStatus",
    "outputs": [
      {"internalType": "enum VotingSystem.VoterStatus", "name": "", "type": "uint8"},
      {"internalType": "bool", "name": "", "type": "bool"}
    ],
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
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "_electionId", "type": "uint256"},
      {"internalType": "address", "name": "_voter", "type": "address"}
    ],
    "name": "getUserVote",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "_electionId", "type": "uint256"},
      {"internalType": "address", "name": "_voter", "type": "address"}
    ],
    "name": "getUserVoteTimestamp",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "_electionId", "type": "uint256"}],
    "name": "isElectionActive",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  }
];

class BlockchainService extends EventEmitter {
  constructor() {
    super();
    this.web3 = null;
    this.contract = null;
    this.account = null;
    this.isInitialized = false;
    this.eventListeners = new Map();
  }

  async initialize() {
    try {
      console.log('🔄 Initializing BlockchainService...');

      // Initialize Web3
      const rpcUrl = process.env.RPC_URL || 'http://localhost:8545';
      this.web3 = new Web3(rpcUrl);

      // Test connection
      const blockNumber = await this.web3.eth.getBlockNumber();
      console.log(`✅ Connected to blockchain - Latest block: ${blockNumber}`);

      // Get contract address
      const contractAddress = process.env.VOTING_CONTRACT_ADDRESS;
      if (!contractAddress) {
        throw new Error('VOTING_CONTRACT_ADDRESS not found in environment variables');
      }

      // Initialize contract
      this.contract = new this.web3.eth.Contract(VOTING_SYSTEM_ABI, contractAddress);
      console.log(`✅ Contract initialized at: ${contractAddress}`);

      // Setup account (for contract calls that require an account)
      const accounts = await this.web3.eth.getAccounts();
      if (accounts.length > 0) {
        this.account = accounts[0];
        console.log(`✅ Using account: ${this.account}`);
      } else {
        console.warn('⚠️ No accounts available - some operations may fail');
      }

      // Test contract call
      const electionCount = await this.contract.methods.electionCount().call();
      console.log(`✅ Contract test successful - Elections: ${electionCount}`);

      // Setup event listeners
      this.setupEventListeners();

      this.isInitialized = true;
      console.log('✅ BlockchainService initialized successfully');

    } catch (error) {
      console.error('❌ BlockchainService initialization failed:', error);
      throw error;
    }
  }

  setupEventListeners() {
    console.log('🔄 Setting up blockchain event listeners...');

    // Listen for ElectionCreated events
    const electionCreatedListener = this.contract.events.ElectionCreated({
      fromBlock: 'latest'
    });

    electionCreatedListener.on('data', (event) => {
      console.log('📊 ElectionCreated event:', event.returnValues);
      this.emit('electionCreated', {
        electionId: event.returnValues.electionId,
        name: event.returnValues.name,
        creator: event.returnValues.creator,
        transactionHash: event.transactionHash
      });
    });

    // Listen for VoteSubmitted events
    const voteSubmittedListener = this.contract.events.VoteSubmitted({
      fromBlock: 'latest'
    });

    voteSubmittedListener.on('data', (event) => {
      console.log('🗳️ VoteSubmitted event:', event.returnValues);
      this.emit('voteSubmitted', {
        electionId: event.returnValues.electionId,
        candidateId: event.returnValues.candidateId,
        voter: event.returnValues.voter,
        transactionHash: event.transactionHash
      });
    });

    // Listen for VoterRegistrationRequested events
    const voterRegistrationListener = this.contract.events.VoterRegistrationRequested({
      fromBlock: 'latest'
    });

    voterRegistrationListener.on('data', (event) => {
      console.log('📝 VoterRegistrationRequested event:', event.returnValues);
      this.emit('voterRegistrationRequested', {
        electionId: event.returnValues.electionId,
        voter: event.returnValues.voter,
        requestId: event.returnValues.requestId,
        transactionHash: event.transactionHash
      });
    });

    this.eventListeners.set('electionCreated', electionCreatedListener);
    this.eventListeners.set('voteSubmitted', voteSubmittedListener);
    this.eventListeners.set('voterRegistration', voterRegistrationListener);

    console.log('✅ Event listeners setup complete');
  }

  // Election Management Methods
  async getAllElections() {
    this.ensureInitialized();

    try {
      const electionCount = await this.contract.methods.electionCount().call();
      const elections = [];

      for (let i = 1; i <= parseInt(electionCount); i++) {
        try {
          const election = await this.getElection(i);
          if (election) {
            elections.push(election);
          }
        } catch (error) {
          console.warn(`⚠️ Could not load election ${i}:`, error.message);
        }
      }

      return elections;
    } catch (error) {
      console.error('❌ Error getting all elections:', error);
      throw error;
    }
  }

  async getElection(electionId) {
    this.ensureInitialized();

    try {
      const electionData = await this.contract.methods.elections(electionId).call();
      
      return {
        id: electionData.id || electionData[0],
        name: electionData.name || electionData[1],
        description: electionData.description || electionData[2],
        startTime: electionData.startTime || electionData[3],
        endTime: electionData.endTime || electionData[4],
        candidateCount: electionData.candidateCount || electionData[5],
        totalVotes: electionData.totalVotes || electionData[6],
        active: electionData.active || electionData[7],
        creator: electionData.creator || electionData[8]
      };
    } catch (error) {
      console.error(`❌ Error getting election ${electionId}:`, error);
      throw error;
    }
  }

  async createElection({ name, description, startTime, endTime, creatorAddress }) {
    this.ensureInitialized();

    try {
      console.log(`🔄 Creating election: ${name}`);

      // Use provided creator address
      const fromAddress = creatorAddress || this.account;
      if (!fromAddress) {
        throw new Error('No account available for transaction');
      }

      // Estimate gas
      const gasEstimate = await this.contract.methods
        .createElection(name, description, startTime, endTime)
        .estimateGas({ from: fromAddress });

      console.log(`⛽ Gas estimate: ${gasEstimate}`);

      // Send transaction
      const result = await this.contract.methods
        .createElection(name, description, startTime, endTime)
        .send({
          from: fromAddress,
          gas: Math.floor(gasEstimate * 1.2)
        });

      console.log(`✅ Election created - TX: ${result.transactionHash}`);

      // Extract election ID from events
      let electionId = null;
      if (result.events && result.events.ElectionCreated) {
        electionId = result.events.ElectionCreated.returnValues.electionId;
      } else {
        // Fallback: get latest election count
        const electionCount = await this.contract.methods.electionCount().call();
        electionId = electionCount;
      }

      return {
        electionId: parseInt(electionId),
        transactionHash: result.transactionHash,
        blockNumber: result.blockNumber,
        gasUsed: result.gasUsed
      };

    } catch (error) {
      console.error('❌ Error creating election:', error);
      throw error;
    }
  }

  async addCandidate({ electionId, name, details, creatorAddress }) {
    this.ensureInitialized();

    try {
      console.log(`🔄 Adding candidate ${name} to election ${electionId}`);

      const fromAddress = creatorAddress || this.account;
      if (!fromAddress) {
        throw new Error('No account available for transaction');
      }

      // Estimate gas
      const gasEstimate = await this.contract.methods
        .addCandidate(electionId, name, details)
        .estimateGas({ from: fromAddress });

      // Send transaction
      const result = await this.contract.methods
        .addCandidate(electionId, name, details)
        .send({
          from: fromAddress,
          gas: Math.floor(gasEstimate * 1.2)
        });

      console.log(`✅ Candidate added - TX: ${result.transactionHash}`);

      // Extract candidate ID from events
      let candidateId = null;
      if (result.events && result.events.CandidateAdded) {
        candidateId = result.events.CandidateAdded.returnValues.candidateId;
      }

      return {
        candidateId: candidateId ? parseInt(candidateId) : null,
        candidate: { name, details },
        transactionHash: result.transactionHash,
        blockNumber: result.blockNumber,
        gasUsed: result.gasUsed
      };

    } catch (error) {
      console.error('❌ Error adding candidate:', error);
      throw error;
    }
  }

  async getElectionCandidates(electionId) {
    this.ensureInitialized();

    try {
      const candidateIds = await this.contract.methods.getElectionCandidates(electionId).call();
      return candidateIds.map(id => parseInt(id));
    } catch (error) {
      console.error(`❌ Error getting candidates for election ${electionId}:`, error);
      throw error;
    }
  }

  async getCandidateInfo(candidateId) {
    this.ensureInitialized();

    try {
      const candidateInfo = await this.contract.methods.getCandidateInfo(candidateId).call();
      
      return {
        id: parseInt(candidateInfo[0]),
        name: candidateInfo[1],
        details: candidateInfo[2],
        voteCount: parseInt(candidateInfo[3])
      };
    } catch (error) {
      console.error(`❌ Error getting candidate info for ${candidateId}:`, error);
      throw error;
    }
  }

  // Voter Management Methods
  async registerVoter({ electionId, name, nik, voterAddress }) {
    this.ensureInitialized();

    try {
      console.log(`🔄 Registering voter ${voterAddress} for election ${electionId}`);

      // Use the voter's address for the transaction
      const fromAddress = voterAddress;

      // Estimate gas
      const gasEstimate = await this.contract.methods
        .registerVoter(electionId, name, nik)
        .estimateGas({ from: fromAddress });

      // Send transaction
      const result = await this.contract.methods
        .registerVoter(electionId, name, nik)
        .send({
          from: fromAddress,
          gas: Math.floor(gasEstimate * 1.2)
        });

      console.log(`✅ Voter registered - TX: ${result.transactionHash}`);

      return {
        voterAddress,
        electionId: parseInt(electionId),
        transactionHash: result.transactionHash,
        blockNumber: result.blockNumber,
        gasUsed: result.gasUsed
      };

    } catch (error) {
      console.error('❌ Error registering voter:', error);
      throw error;
    }
  }

  async getVoterStatus(electionId, voterAddress) {
    this.ensureInitialized();

    try {
      let status, isVerified;

      // Try enhanced getVoterStatus method first
      try {
        const result = await this.contract.methods.getVoterStatus(electionId, voterAddress).call();
        status = result[0] || result;
        isVerified = result[1] !== false;
      } catch (error) {
        // Fallback to basic voterStatus method
        status = await this.contract.methods.voterStatus(electionId, voterAddress).call();
        isVerified = status !== '0';
      }

      // Convert status to text
      const statusText = this.getStatusText(parseInt(status));

      return {
        status: status.toString(),
        statusText,
        isVerified
      };

    } catch (error) {
      console.error(`❌ Error getting voter status for ${voterAddress}:`, error);
      throw error;
    }
  }

  getStatusText(status) {
    const statusMap = {
      0: 'Not Registered',
      1: 'Pending Verification',
      2: 'Registered & Verified',
      3: 'Already Voted'
    };
    return statusMap[status] || 'Unknown Status';
  }

  // Voting Methods
  async castVote({ electionId, candidateId, voterAddress }) {
    this.ensureInitialized();

    try {
      console.log(`🗳️ Casting vote: Election ${electionId}, Candidate ${candidateId}, Voter ${voterAddress}`);

      // Estimate gas
      const gasEstimate = await this.contract.methods
        .castVote(electionId, candidateId)
        .estimateGas({ from: voterAddress });

      // Send transaction
      const result = await this.contract.methods
        .castVote(electionId, candidateId)
        .send({
          from: voterAddress,
          gas: Math.floor(gasEstimate * 1.2)
        });

      console.log(`✅ Vote cast successfully - TX: ${result.transactionHash}`);

      return {
        electionId: parseInt(electionId),
        candidateId: parseInt(candidateId),
        voterAddress,
        transactionHash: result.transactionHash,
        blockNumber: result.blockNumber,
        gasUsed: result.gasUsed
      };

    } catch (error) {
      console.error('❌ Error casting vote:', error);
      throw error;
    }
  }

  async checkVotingEligibility({ electionId, candidateId, voterAddress }) {
    this.ensureInitialized();

    try {
      // Get voter status
      const voterStatus = await this.getVoterStatus(electionId, voterAddress);
      
      // Get election data
      const election = await this.getElection(electionId);
      
      // Get current time
      const currentTime = Math.floor(Date.now() / 1000);
      const startTime = parseInt(election.startTime);
      const endTime = parseInt(election.endTime);

      // Check if candidate exists (if specified)
      let validCandidate = true;
      if (candidateId) {
        try {
          await this.getCandidateInfo(candidateId);
          const candidates = await this.getElectionCandidates(electionId);
          validCandidate = candidates.includes(parseInt(candidateId));
        } catch (error) {
          validCandidate = false;
        }
      }

      const checks = {
        voterRegistered: voterStatus.status === '2',
        voterVerified: voterStatus.isVerified,
        hasNotVoted: voterStatus.status !== '3',
        electionActive: election.active,
        electionStarted: currentTime >= startTime,
        electionNotEnded: currentTime <= endTime,
        validCandidate: candidateId ? validCandidate : true
      };

      const eligible = Object.values(checks).every(check => check === true);

      const reasons = [];
      if (!checks.voterRegistered) reasons.push('Voter not registered');
      if (!checks.voterVerified) reasons.push('Voter not verified');
      if (!checks.hasNotVoted) reasons.push('Voter already voted');
      if (!checks.electionActive) reasons.push('Election not active');
      if (!checks.electionStarted) reasons.push('Election not started');
      if (!checks.electionNotEnded) reasons.push('Election ended');
      if (!checks.validCandidate) reasons.push('Invalid candidate');

      return {
        eligible,
        checks,
        reasons
      };

    } catch (error) {
      console.error('❌ Error checking voting eligibility:', error);
      throw error;
    }
  }

  async getUserVote(electionId, voterAddress) {
    this.ensureInitialized();

    try {
      const candidateId = await this.contract.methods.getUserVote(electionId, voterAddress).call();
      return parseInt(candidateId);
    } catch (error) {
      console.error(`❌ Error getting user vote for ${voterAddress}:`, error);
      throw error;
    }
  }

  async getUserVoteTimestamp(electionId, voterAddress) {
    this.ensureInitialized();

    try {
      const timestamp = await this.contract.methods.getUserVoteTimestamp(electionId, voterAddress).call();
      return parseInt(timestamp);
    } catch (error) {
      console.error(`❌ Error getting vote timestamp for ${voterAddress}:`, error);
      throw error;
    }
  }

  async getVotingHistory(voterAddress) {
    this.ensureInitialized();

    try {
      console.log(`📊 Getting voting history for ${voterAddress}`);

      const electionCount = await this.contract.methods.electionCount().call();
      const votingHistory = [];

      for (let i = 1; i <= parseInt(electionCount); i++) {
        try {
          const voterStatus = await this.getVoterStatus(i, voterAddress);
          
          if (voterStatus.status === '3') { // Has voted
            try {
              const candidateId = await this.getUserVote(i, voterAddress);
              const timestamp = await this.getUserVoteTimestamp(i, voterAddress);
              
              votingHistory.push({
                electionId: i,
                candidateId,
                timestamp,
                voterAddress
              });
            } catch (error) {
              console.warn(`⚠️ Could not get vote details for election ${i}:`, error.message);
              // Add partial record
              votingHistory.push({
                electionId: i,
                candidateId: null,
                timestamp: 0,
                voterAddress,
                error: 'Could not retrieve vote details'
              });
            }
          }
        } catch (error) {
          console.warn(`⚠️ Could not check voter status for election ${i}:`, error.message);
        }
      }

      return votingHistory;
    } catch (error) {
      console.error('❌ Error getting voting history:', error);
      throw error;
    }
  }

  // Utility Methods
  async isNIKUsed(electionId, nik) {
    // This would require additional smart contract functionality
    // For now, return false (not implemented in current contract)
    return false;
  }

  async setElectionStatus({ electionId, active, creatorAddress }) {
    this.ensureInitialized();

    try {
      const fromAddress = creatorAddress || this.account;
      if (!fromAddress) {
        throw new Error('No account available for transaction');
      }

      // Note: This method needs to be implemented in the smart contract
      // For now, we'll simulate it
      console.log(`🔄 Setting election ${electionId} status to ${active}`);
      
      // This is a placeholder - implement when contract method is available
      throw new Error('setElectionStatus method not implemented in current contract');

    } catch (error) {
      console.error('❌ Error setting election status:', error);
      throw error;
    }
  }

  // Helper Methods
  ensureInitialized() {
    if (!this.isInitialized) {
      throw new Error('BlockchainService not initialized. Call initialize() first.');
    }
  }

  async getGasPrice() {
    return await this.web3.eth.getGasPrice();
  }

  async getBlockNumber() {
    return await this.web3.eth.getBlockNumber();
  }

  async getTransactionReceipt(txHash) {
    return await this.web3.eth.getTransactionReceipt(txHash);
  }

  async getAccountBalance(address) {
    const balance = await this.web3.eth.getBalance(address);
    return this.web3.utils.fromWei(balance, 'ether');
  }

  // Event handling cleanup
  async cleanup() {
    console.log('🔄 Cleaning up BlockchainService...');
    
    for (const [name, listener] of this.eventListeners) {
      try {
        listener.unsubscribe();
        console.log(`✅ Unsubscribed from ${name} events`);
      } catch (error) {
        console.warn(`⚠️ Error unsubscribing from ${name}:`, error.message);
      }
    }
    
    this.eventListeners.clear();
    this.removeAllListeners();
    
    console.log('✅ BlockchainService cleanup complete');
  }
}

module.exports = BlockchainService;