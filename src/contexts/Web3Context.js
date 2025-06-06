// src/contexts/Web3Context.js - Enhanced with better voting support

import React, { createContext, useState, useEffect, useCallback } from 'react';
import Web3 from 'web3';
import { toast } from 'react-toastify';

// Complete ABI untuk VotingSystem contract with enhanced methods
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
      {"indexed": false, "internalType": "bool", "name": "active", "type": "bool"}
    ],
    "name": "ElectionStatusChanged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "previousOwner", "type": "address"},
      {"indexed": true, "internalType": "address", "name": "newOwner", "type": "address"}
    ],
    "name": "OwnershipTransferred",
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
      {"indexed": true, "internalType": "address", "name": "voter", "type": "address"},
      {"indexed": false, "internalType": "bool", "name": "verified", "type": "bool"}
    ],
    "name": "VoterVerified",
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
    "inputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "name": "candidates",
    "outputs": [
      {"internalType": "uint256", "name": "id", "type": "uint256"},
      {"internalType": "uint256", "name": "electionId", "type": "uint256"},
      {"internalType": "string", "name": "name", "type": "string"},
      {"internalType": "string", "name": "details", "type": "string"},
      {"internalType": "uint256", "name": "voteCount", "type": "uint256"}
    ],
    "stateMutability": "view",
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
    "inputs": [{"internalType": "uint256", "name": "_electionId", "type": "uint256"}],
    "name": "getElectionCandidates",
    "outputs": [{"internalType": "uint256[]", "name": "", "type": "uint256[]"}],
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
  },
  {
    "inputs": [],
    "name": "nikOracle",
    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
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
      {"internalType": "bool", "name": "_active", "type": "bool"}
    ],
    "name": "setElectionStatus",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "_oracleAddress", "type": "address"}],
    "name": "setOracleAddress",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "newOwner", "type": "address"}],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
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

// Function untuk mendapatkan contract address
function getContractAddress() {
  if (process.env.REACT_APP_VOTING_CONTRACT_ADDRESS) {
    return process.env.REACT_APP_VOTING_CONTRACT_ADDRESS;
  }
  return '0xe78A0F7E598Cc8b0Bb87894B0F60dD2a88d6a8Ab'; // Default fallback
}

const Web3Context = createContext(null);

const Web3Provider = ({ children }) => {
  const [web3, setWeb3] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [chainId, setChainId] = useState(null);
  const [networkName, setNetworkName] = useState('');
  const [contractAddress, setContractAddress] = useState('');

  // Initialize Web3 (tanpa auto-connect)
  const initializeWeb3 = useCallback(async () => {
    try {
      console.log('🔄 Initializing Web3...');
      
      if (typeof window.ethereum === 'undefined') {
        console.warn('⚠️ MetaMask not detected');
        return;
      }

      const web3Instance = new Web3(window.ethereum);
      setWeb3(web3Instance);
      console.log('✅ Web3 initialized');

      // Get contract address
      const address = getContractAddress();
      setContractAddress(address);
      console.log('📍 Contract address:', address);

      // Get network info
      try {
        const chain = await web3Instance.eth.getChainId();
        setChainId(chain);
        setNetworkName(getNetworkName(chain));
        console.log(`📡 Network: ${getNetworkName(chain)} (${chain})`);
      } catch (error) {
        console.warn('⚠️ Could not get network info:', error);
      }

      // Check if already connected
      try {
        const accs = await web3Instance.eth.getAccounts();
        if (accs.length > 0) {
          setAccounts(accs);
          setConnected(true);
          console.log('✅ Already connected:', accs[0]);
          initializeContract(web3Instance, address);
        }
      } catch (error) {
        console.warn('⚠️ Could not check existing connection:', error);
      }

      setupEventListeners();
      
    } catch (error) {
      console.error('❌ Error initializing Web3:', error);
    }
  }, []);

  // Initialize contract
  const initializeContract = (web3Instance = null, address = null) => {
    const web3ToUse = web3Instance || web3;
    const addressToUse = address || contractAddress;
    
    if (!web3ToUse || !addressToUse) {
      console.error('❌ Cannot initialize contract: missing web3 or contract address');
      return;
    }

    try {
      console.log('🔄 Initializing contract with address:', addressToUse);
      
      // Test if contract exists at address
      web3ToUse.eth.getCode(addressToUse)
        .then(code => {
          if (code === '0x' || code === '0x0') {
            console.error('❌ No contract found at address:', addressToUse);
            toast.error('Contract not deployed. Please run: truffle migrate --reset');
            return;
          }
          console.log('✅ Contract code found at address');
        });
      
      const votingContract = new web3ToUse.eth.Contract(
        VOTING_SYSTEM_ABI,
        addressToUse
      );
      
      setContract(votingContract);
      console.log('✅ Contract initialized successfully');
      
      // Test contract methods
      if (votingContract.methods.electionCount) {
        votingContract.methods.electionCount().call()
          .then(count => {
            console.log('✅ Contract test successful - Election count:', count);
          })
          .catch(err => {
            console.error('❌ Contract test failed:', err);
          });
      }
      
    } catch (error) {
      console.error('❌ Error initializing contract:', error);
    }
  };

  // Setup event listeners
  const setupEventListeners = () => {
    if (!window.ethereum) return;

    if (window.ethereum.removeAllListeners) {
      window.ethereum.removeAllListeners();
    }

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
    window.ethereum.on('disconnect', handleDisconnect);

    console.log('✅ Event listeners setup');
  };

  // Connect wallet
  const connectWallet = async () => {
    if (!window.ethereum) {
      toast.error('MetaMask tidak terdeteksi! Silakan install MetaMask terlebih dahulu.');
      return;
    }

    try {
      setLoading(true);
      console.log('🔄 Requesting wallet connection...');

      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      console.log('✅ Wallet connected:', accounts[0]);

      setAccounts(accounts);
      setConnected(true);

      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      const chainIdDecimal = parseInt(chainId, 16);
      setChainId(chainIdDecimal);
      setNetworkName(getNetworkName(chainIdDecimal));

      if (chainIdDecimal !== 5777 && chainIdDecimal !== 1337) {
        toast.warning('Anda berada di network yang salah. Silakan switch ke Ganache Local (Chain ID: 5777)');
        console.warn('⚠️ Wrong network:', chainIdDecimal);
      }

      initializeContract();
      toast.success('Wallet berhasil terhubung!');

    } catch (error) {
      console.error('❌ Connection error:', error);
      
      if (error.code === 4001) {
        toast.warning('Koneksi wallet dibatalkan oleh user');
      } else if (error.code === -32002) {
        toast.warning('Permintaan koneksi sudah ada. Silakan check MetaMask.');
      } else {
        toast.error('Gagal menghubungkan wallet: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Disconnect wallet
  const disconnectWallet = async () => {
    try {
      console.log('🔄 Disconnecting wallet...');
      
      setAccounts([]);
      setConnected(false);
      setContract(null);
      
      localStorage.setItem('walletDisconnected', 'true');
      
      toast.success('Wallet berhasil terputus dari aplikasi');
      console.log('✅ Wallet disconnected from app');
      
    } catch (error) {
      console.error('❌ Disconnect error:', error);
      toast.error('Gagal memutus koneksi wallet');
    }
  };

  // Handle account changes
  const handleAccountsChanged = (accounts) => {
    console.log('🔄 Accounts changed:', accounts);
    
    const wasDisconnectedManually = localStorage.getItem('walletDisconnected') === 'true';
    
    if (accounts.length === 0) {
      setConnected(false);
      setAccounts([]);
      setContract(null);
      
      if (!wasDisconnectedManually) {
        toast.info('Wallet terputus dari MetaMask');
      }
    } else {
      localStorage.removeItem('walletDisconnected');
      
      setAccounts(accounts);
      setConnected(true);
      initializeContract();
      
      if (accounts[0] !== (accounts[0] || '')) {
        toast.info('Account berubah ke: ' + accounts[0].substring(0, 8) + '...');
      }
    }
  };

  // Handle chain changes
  const handleChainChanged = (chainId) => {
    const chainIdDecimal = parseInt(chainId, 16);
    console.log('🔄 Chain changed:', chainIdDecimal);
    
    setChainId(chainIdDecimal);
    setNetworkName(getNetworkName(chainIdDecimal));
    
    if (chainIdDecimal !== 5777 && chainIdDecimal !== 1337) {
      toast.warning('Network berubah. Silakan switch ke Ganache Local untuk development.');
    }
    
    if (connected) {
      initializeContract();
    }
  };

  // Handle disconnect
  const handleDisconnect = () => {
    console.log('🔄 Wallet disconnected');
    setConnected(false);
    setAccounts([]);
    setContract(null);
    toast.info('Wallet terputus');
  };

  // Get network name
  const getNetworkName = (chainId) => {
    const networks = {
      1: 'Ethereum Mainnet',
      5: 'Goerli Testnet',
      11155111: 'Sepolia Testnet',
      5777: 'Ganache Local',
      1337: 'Hardhat Local'
    };
    return networks[chainId] || `Network ${chainId}`;
  };

  // Enhanced voter registration dengan better error handling
  const registerVoterWithNIK = async (electionId, name, nik) => {
    if (!contract || !connected) {
      throw new Error('Wallet belum terhubung atau contract belum tersedia');
    }

    if (!accounts[0]) {
      throw new Error('Tidak ada account yang terhubung');
    }

    if (nik.length !== 16 || !/^\d{16}$/.test(nik)) {
      throw new Error('NIK harus 16 digit angka');
    }

    try {
      console.log('🔄 Registering voter:', { electionId, name, nik: nik.substring(0, 4) + '****' });

      const gasEstimate = await contract.methods
        .registerVoter(electionId, name, nik)
        .estimateGas({ from: accounts[0] });

      console.log('⛽ Gas estimate:', gasEstimate);

      const transaction = await contract.methods
        .registerVoter(electionId, name, nik)
        .send({
          from: accounts[0],
          gas: Math.floor(gasEstimate * 1.2)
        });

      console.log('✅ Registration successful:', transaction.transactionHash);
      return transaction;

    } catch (error) {
      console.error('❌ Registration error:', error);
      
      if (error.message.includes('revert')) {
        const revertReason = error.message.split('revert ')[1]?.split('"')[0];
        throw new Error(revertReason || 'Transaction reverted');
      } else if (error.code === 4001) {
        throw new Error('Transaksi dibatalkan oleh user');
      } else {
        throw new Error(error.message || 'Transaction failed');
      }
    }
  };

  // Enhanced voter status checking
  const getVoterStatusWithVerification = async (electionId, voterAddress = null) => {
    if (!contract) {
      throw new Error('Contract tidak tersedia');
    }

    const address = voterAddress || accounts[0];
    if (!address) {
      throw new Error('Address tidak tersedia');
    }

    try {
      // Try enhanced getVoterStatus method first
      try {
        const result = await contract.methods
          .getVoterStatus(electionId, address)
          .call();

        const status = parseInt(result[0]);
        const isVerified = result[1];

        return {
          status: status,
          isVerified: isVerified,
          statusText: getStatusText(status),
          method: 'getVoterStatus'
        };
      } catch (error) {
        console.log('⚠️ getVoterStatus not available, using fallback...');
        
        // Fallback to basic voterStatus method
        const status = await contract.methods
          .voterStatus(electionId, address)
          .call();

        return {
          status: parseInt(status),
          isVerified: status !== '0', // Assume verified if registered in simplified contract
          statusText: getStatusText(parseInt(status)),
          method: 'voterStatus'
        };
      }

    } catch (error) {
      console.error('❌ Error getting voter status:', error);
      throw error;
    }
  };

  // Enhanced vote casting with pre-flight checks
  const castVoteWithValidation = async (electionId, candidateId) => {
    if (!contract || !connected) {
      throw new Error('Wallet belum terhubung atau contract belum tersedia');
    }

    if (!accounts[0]) {
      throw new Error('Tidak ada account yang terhubung');
    }

    try {
      console.log('🗳️ Casting vote:', { electionId, candidateId, voter: accounts[0] });

      // Pre-flight validation
      const [voterStatus, electionData, candidateIds] = await Promise.all([
        getVoterStatusWithVerification(electionId),
        contract.methods.elections(electionId).call(),
        contract.methods.getElectionCandidates(electionId).call()
      ]);

      // Validation checks
      const currentTime = Math.floor(Date.now() / 1000);
      const startTime = parseInt(electionData.startTime || electionData[3]);
      const endTime = parseInt(electionData.endTime || electionData[4]);
      const isActive = await contract.methods.isElectionActive(electionId).call();

      const validationChecks = {
        voterRegistered: voterStatus.status === 2, // Registered status
        voterVerified: voterStatus.isVerified,
        hasNotVoted: voterStatus.status !== 3, // Not voted yet
        electionActive: isActive,
        withinTimeWindow: currentTime >= startTime && currentTime <= endTime,
        validCandidate: candidateIds.includes(candidateId.toString())
      };

      console.log('📋 Validation checks:', validationChecks);

      // Check for validation failures
      const failedChecks = Object.entries(validationChecks)
        .filter(([key, value]) => !value)
        .map(([key]) => key);

      if (failedChecks.length > 0) {
        const errorMessages = {
          voterRegistered: 'Anda belum terdaftar untuk pemilihan ini',
          voterVerified: 'Identitas Anda belum terverifikasi',
          hasNotVoted: 'Anda sudah memberikan suara sebelumnya',
          electionActive: 'Pemilihan tidak sedang aktif',
          withinTimeWindow: currentTime < startTime ? 'Pemilihan belum dimulai' : 'Pemilihan sudah berakhir',
          validCandidate: 'Kandidat tidak valid untuk pemilihan ini'
        };

        const errorMessage = failedChecks.map(check => errorMessages[check]).join('; ');
        throw new Error(errorMessage);
      }

      // Estimate gas
      const gasEstimate = await contract.methods
        .castVote(electionId, candidateId)
        .estimateGas({ from: accounts[0] });

      console.log('⛽ Gas estimate:', gasEstimate);

      // Send transaction
      const transaction = await contract.methods
        .castVote(electionId, candidateId)
        .send({
          from: accounts[0],
          gas: Math.floor(gasEstimate * 1.2)
        });

      console.log('✅ Vote cast successfully:', transaction.transactionHash);
      return transaction;

    } catch (error) {
      console.error('❌ Vote casting error:', error);
      
      if (error.message.includes('revert')) {
        const revertReason = error.message.split('revert ')[1]?.split('"')[0];
        throw new Error(revertReason || 'Smart contract rejected the transaction');
      } else if (error.code === 4001) {
        throw new Error('Transaksi dibatalkan oleh user');
      } else {
        throw new Error(error.message || 'Vote casting failed');
      }
    }
  };

  // Get status text
  const getStatusText = (status) => {
    const statusMap = {
      0: 'Belum Terdaftar',
      1: 'Menunggu Verifikasi NIK', 
      2: 'Terverifikasi - Dapat Voting',
      3: 'Sudah Memilih'
    };
    return statusMap[status] || 'Status Tidak Dikenal';
  };

  // Check election eligibility for voting
  const checkElectionEligibility = async (electionId) => {
    if (!contract) {
      throw new Error('Contract tidak tersedia');
    }

    try {
      const [electionData, isActive, candidateIds] = await Promise.all([
        contract.methods.elections(electionId).call(),
        contract.methods.isElectionActive(electionId).call(),
        contract.methods.getElectionCandidates(electionId).call()
      ]);

      const currentTime = Math.floor(Date.now() / 1000);
      const startTime = parseInt(electionData.startTime || electionData[3]);
      const endTime = parseInt(electionData.endTime || electionData[4]);

      return {
        electionExists: electionData.id || electionData[0],
        isActive: isActive,
        hasStarted: currentTime >= startTime,
        hasNotEnded: currentTime <= endTime,
        hasCandidates: candidateIds.length > 0,
        candidateCount: candidateIds.length,
        startTime: new Date(startTime * 1000),
        endTime: new Date(endTime * 1000),
        timeStatus: currentTime < startTime ? 'upcoming' : 
                   currentTime > endTime ? 'ended' : 'active'
      };
    } catch (error) {
      console.error('❌ Error checking election eligibility:', error);
      throw error;
    }
  };

  // Update contract address
  const updateContractAddress = (newAddress) => {
    setContractAddress(newAddress);
    if (web3 && connected) {
      const votingContract = new web3.eth.Contract(VOTING_SYSTEM_ABI, newAddress);
      setContract(votingContract);
      console.log('✅ Contract address updated:', newAddress);
    }
  };

  // Initialize on mount
  useEffect(() => {
    initializeWeb3();
    
    return () => {
      if (window.ethereum && window.ethereum.removeAllListeners) {
        window.ethereum.removeAllListeners();
      }
    };
  }, [initializeWeb3]);

  // Re-initialize contract when address changes
  useEffect(() => {
    if (web3 && connected && contractAddress) {
      initializeContract();
    }
  }, [contractAddress, web3, connected]);

  // Context value
  const contextValue = {
    // Basic state
    web3,
    accounts,
    contract,
    loading,
    connected,
    chainId,
    networkName,
    contractAddress,
    
    // Actions
    connectWallet,
    disconnectWallet,
    updateContractAddress,
    
    // Enhanced functions
    registerVoterWithNIK,
    getVoterStatusWithVerification,
    castVoteWithValidation,
    checkElectionEligibility,
    getStatusText,
    
    // Utilities
    isCorrectNetwork: chainId === 5777 || chainId === 1337,
    hasMetaMask: typeof window.ethereum !== 'undefined'
  };

  return (
    <Web3Context.Provider value={contextValue}>
      {children}
    </Web3Context.Provider>
  );
};

export { Web3Context, Web3Provider };