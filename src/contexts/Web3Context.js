// src/contexts/Web3Context.js - Updated dengan logout functionality

import React, { createContext, useState, useEffect, useCallback } from 'react';
import Web3 from 'web3';
import { toast } from 'react-toastify';

// Import contract ABI dari file JSON
import VotingSystemContract from '../contracts/VotingSystem.json';

// Simplified ABI for basic functions
const BASIC_VOTING_ABI = [
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
      {"internalType": "bool", "name": "active", "type": "bool"}
    ],
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
      {"internalType": "address", "name": "_voter", "type": "address"}
    ],
    "name": "getVoterStatus",
    "outputs": [
      {"internalType": "enum VotingSystem.VoterStatus", "name": "", "type": "uint8"},
      {"internalType": "bool", "name": "", "type": "bool"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// Get contract address from environment
const CONTRACT_ADDRESS = process.env.REACT_APP_VOTING_CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3';

const Web3Context = createContext(null);

const Web3Provider = ({ children }) => {
  const [web3, setWeb3] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [chainId, setChainId] = useState(null);
  const [networkName, setNetworkName] = useState('');
  const [contractAddress, setContractAddress] = useState(CONTRACT_ADDRESS);

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

      // Get network info
      try {
        const chain = await web3Instance.eth.getChainId();
        setChainId(chain);
        setNetworkName(getNetworkName(chain));
        console.log(`📡 Network: ${getNetworkName(chain)} (${chain})`);
      } catch (error) {
        console.warn('⚠️ Could not get network info:', error);
      }

      // Check if already connected (tanpa request permission)
      try {
        const accs = await web3Instance.eth.getAccounts();
        if (accs.length > 0) {
          setAccounts(accs);
          setConnected(true);
          console.log('✅ Already connected:', accs[0]);
          
          // Initialize contract jika sudah connected
          initializeContract(web3Instance);
        }
      } catch (error) {
        console.warn('⚠️ Could not check existing connection:', error);
      }

      // Setup event listeners
      setupEventListeners();
      
    } catch (error) {
      console.error('❌ Error initializing Web3:', error);
    }
  }, []);

  // Initialize contract
  const initializeContract = (web3Instance = null) => {
    const web3ToUse = web3Instance || web3;
    if (!web3ToUse || !contractAddress) return;

    try {
      const votingContract = new web3ToUse.eth.Contract(
        BASIC_VOTING_ABI,
        contractAddress
      );
      setContract(votingContract);
      console.log('✅ Contract initialized:', contractAddress);
    } catch (error) {
      console.error('❌ Error initializing contract:', error);
    }
  };

  // Setup event listeners
  const setupEventListeners = () => {
    if (!window.ethereum) return;

    // Remove existing listeners
    if (window.ethereum.removeAllListeners) {
      window.ethereum.removeAllListeners();
    }

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
    window.ethereum.on('disconnect', handleDisconnect);

    console.log('✅ Event listeners setup');
  };

  // Connect wallet (explicit user action)
  const connectWallet = async () => {
    if (!window.ethereum) {
      toast.error('MetaMask tidak terdeteksi! Silakan install MetaMask terlebih dahulu.');
      return;
    }

    try {
      setLoading(true);
      console.log('🔄 Requesting wallet connection...');

      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      console.log('✅ Wallet connected:', accounts[0]);

      // Update state
      setAccounts(accounts);
      setConnected(true);

      // Get network info
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      const chainIdDecimal = parseInt(chainId, 16);
      setChainId(chainIdDecimal);
      setNetworkName(getNetworkName(chainIdDecimal));

      // Check if correct network
      if (chainIdDecimal !== 5777 && chainIdDecimal !== 1337) {
        toast.warning('Anda berada di network yang salah. Silakan switch ke Ganache Local (Chain ID: 5777)');
        console.warn('⚠️ Wrong network:', chainIdDecimal);
      }

      // Initialize contract
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

  // Logout/Disconnect wallet
  const disconnectWallet = async () => {
    try {
      console.log('🔄 Disconnecting wallet...');
      
      // Clear application state
      setAccounts([]);
      setConnected(false);
      setContract(null);
      
      // Clear any stored connection state
      if (window.ethereum && window.ethereum.selectedAddress) {
        // Note: MetaMask doesn't have a programmatic disconnect method
        // The connection will persist in MetaMask, but our app state is cleared
        console.log('📝 App state cleared - user can manually disconnect in MetaMask');
      }
      
      // Store disconnection preference to prevent auto-reconnect
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
    
    // Check if user disconnected manually from MetaMask
    const wasDisconnectedManually = localStorage.getItem('walletDisconnected') === 'true';
    
    if (accounts.length === 0) {
      setConnected(false);
      setAccounts([]);
      setContract(null);
      
      if (!wasDisconnectedManually) {
        toast.info('Wallet terputus dari MetaMask');
      }
    } else {
      // Clear manual disconnect flag when accounts are available
      localStorage.removeItem('walletDisconnected');
      
      setAccounts(accounts);
      setConnected(true);
      initializeContract(); // Re-initialize contract
      
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
    
    // Re-initialize contract dengan network baru
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

  // Enhanced voter registration
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

      // Estimate gas
      const gasEstimate = await contract.methods
        .registerVoter(electionId, name, nik)
        .estimateGas({ from: accounts[0] });

      console.log('⛽ Gas estimate:', gasEstimate);

      // Send transaction
      const transaction = await contract.methods
        .registerVoter(electionId, name, nik)
        .send({
          from: accounts[0],
          gas: Math.floor(gasEstimate * 1.2) // Add 20% buffer
        });

      console.log('✅ Registration successful:', transaction.transactionHash);
      return transaction;

    } catch (error) {
      console.error('❌ Registration error:', error);
      
      // Handle specific errors
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

  // Get voter status
  const getVoterStatusWithVerification = async (electionId, voterAddress = null) => {
    if (!contract) {
      throw new Error('Contract tidak tersedia');
    }

    const address = voterAddress || accounts[0];
    if (!address) {
      throw new Error('Address tidak tersedia');
    }

    try {
      const result = await contract.methods
        .getVoterStatus(electionId, address)
        .call();

      const status = parseInt(result[0]);
      const isVerified = result[1];

      return {
        status: status,
        isVerified: isVerified,
        statusText: getStatusText(status)
      };

    } catch (error) {
      console.warn('⚠️ getVoterStatus not available, using fallback');
      // Fallback to basic status
      return {
        status: 0,
        isVerified: false,
        statusText: 'Belum Terdaftar'
      };
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

  // Update contract address
  const updateContractAddress = (newAddress) => {
    setContractAddress(newAddress);
    if (web3 && connected) {
      // Re-initialize contract dengan address baru
      const votingContract = new web3.eth.Contract(BASIC_VOTING_ABI, newAddress);
      setContract(votingContract);
      console.log('✅ Contract address updated:', newAddress);
    }
  };

  // Initialize on mount
  useEffect(() => {
    initializeWeb3();
    
    // Cleanup on unmount
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
    disconnectWallet, // 🆕 New logout function
    updateContractAddress,
    
    // Enhanced functions
    registerVoterWithNIK,
    getVoterStatusWithVerification,
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