// src/utils/contractHelper.js - Helper untuk deteksi contract yang benar

import Web3 from 'web3';

// ABI yang disederhanakan untuk testing
const SIMPLE_VOTING_ABI = [
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
    "inputs": [{"internalType": "uint256", "name": "_electionId", "type": "uint256"}],
    "name": "isElectionActive",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  }
];

export class ContractHelper {
  constructor(web3, contractAddress) {
    this.web3 = web3;
    this.contractAddress = contractAddress;
    this.contract = null;
  }

  // Deteksi contract address yang benar
  async detectContractAddress() {
    const possibleAddresses = [
      process.env.REACT_APP_VOTING_CONTRACT_ADDRESS,
      '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
      '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0'
    ].filter(Boolean);

    console.log('🔍 Testing contract addresses...');

    for (const address of possibleAddresses) {
      try {
        console.log(`Testing address: ${address}`);
        
        // Check if contract exists
        const code = await this.web3.eth.getCode(address);
        if (code === '0x' || code === '0x0') {
          console.log(`❌ No contract at ${address}`);
          continue;
        }

        // Test basic contract call
        const contract = new this.web3.eth.Contract(SIMPLE_VOTING_ABI, address);
        const electionCount = await contract.methods.electionCount().call();
        
        console.log(`✅ Found working contract at ${address}`);
        console.log(`✅ Election count: ${electionCount}`);
        
        this.contractAddress = address;
        this.contract = contract;
        return address;

      } catch (error) {
        console.log(`❌ Error testing ${address}:`, error.message);
        continue;
      }
    }

    throw new Error('No working contract found');
  }

  // Inisialisasi contract dengan ABI yang benar
  async initializeContract() {
    if (!this.contractAddress) {
      await this.detectContractAddress();
    }

    try {
      this.contract = new this.web3.eth.Contract(SIMPLE_VOTING_ABI, this.contractAddress);
      
      // Test contract methods
      const owner = await this.contract.methods.owner().call();
      const electionCount = await this.contract.methods.electionCount().call();
      
      console.log('✅ Contract initialized successfully');
      console.log(`✅ Owner: ${owner}`);
      console.log(`✅ Election count: ${electionCount}`);
      
      return this.contract;
    } catch (error) {
      console.error('❌ Contract initialization failed:', error);
      throw error;
    }
  }

  // Get election data dengan error handling
  async getElectionSafely(electionId) {
    try {
      if (!this.contract) {
        await this.initializeContract();
      }

      console.log(`📖 Reading election ${electionId}...`);
      
      // Test apakah election exists dengan election count
      const electionCount = await this.contract.methods.electionCount().call();
      console.log(`Total elections: ${electionCount}`);
      
      if (parseInt(electionId) > parseInt(electionCount)) {
        throw new Error(`Election ${electionId} does not exist. Only ${electionCount} elections available.`);
      }

      // Read election data
      const electionData = await this.contract.methods.elections(electionId).call();
      console.log('✅ Election data retrieved:', electionData);
      
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
      console.error(`❌ Error reading election ${electionId}:`, error);
      throw error;
    }
  }

  // Get all elections dengan error handling
  async getAllElectionsSafely() {
    try {
      if (!this.contract) {
        await this.initializeContract();
      }

      const electionCount = await this.contract.methods.electionCount().call();
      console.log(`📊 Total elections: ${electionCount}`);
      
      if (parseInt(electionCount) === 0) {
        return [];
      }

      const elections = [];
      for (let i = 1; i <= parseInt(electionCount); i++) {
        try {
          const election = await this.getElectionSafely(i);
          elections.push(election);
        } catch (error) {
          console.warn(`⚠️ Skipping election ${i}:`, error.message);
        }
      }

      return elections;
    } catch (error) {
      console.error('❌ Error getting all elections:', error);
      throw error;
    }
  }

  // Refresh contract dengan address baru
  async refreshContract() {
    console.log('🔄 Refreshing contract...');
    this.contract = null;
    this.contractAddress = null;
    return await this.initializeContract();
  }
}

export { SIMPLE_VOTING_ABI };