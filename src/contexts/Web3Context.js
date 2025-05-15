// src/contexts/Web3Context.js - Context untuk menyediakan state web3 ke seluruh aplikasi

import React, { createContext, useState, useEffect, useCallback } from 'react';
import Web3 from 'web3';
import VotingSystemABI from '../contracts/VotingSystem.json';
import { toast } from 'react-toastify';
    
// Alamat kontrak (ganti dengan alamat kontrak yang di-deploy)
const CONTRACT_ADDRESS = '0x50e48d66b13ca53a3efef43c7545947b9c942ce9f547001af78cf93e50dc0284';

// Membuat context
export const Web3Context = createContext(null);

export const Web3Provider = ({ children }) => {
  const [web3, setWeb3] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [chainId, setChainId] = useState(null);
  const [networkName, setNetworkName] = useState('');

  // Inisialisasi Web3
  const initializeWeb3 = useCallback(async () => {
    try {
      setLoading(true);
      // Jika browser memiliki Ethereum provider (e.g., MetaMask)
      if (window.ethereum) {
        const web3Instance = new Web3(window.ethereum);
        setWeb3(web3Instance);

        // Dapatkan accounts
        const accs = await web3Instance.eth.getAccounts();
        if (accs.length > 0) {
          setAccounts(accs);
          setConnected(true);
        }

        // Dapatkan chainId dan nama network
        const chain = await web3Instance.eth.getChainId();
        setChainId(chain);
        setNetworkName(getNetworkName(chain));

        // Inisialisasi kontrak
        const votingContract = new web3Instance.eth.Contract(
          VotingSystemABI.abi,
          CONTRACT_ADDRESS
        );
        setContract(votingContract);

        // Listener untuk perubahan accounts
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        // Listener untuk perubahan chainId
        window.ethereum.on('chainChanged', handleChainChanged);
      } else {
        toast.error('Silakan instal MetaMask untuk menggunakan aplikasi ini!');
      }
    } catch (error) {
      console.error('Error initializing web3:', error);
      toast.error('Gagal menghubungkan ke blockchain!');
    } finally {
      setLoading(false);
    }
  }, []);

  // Connect wallet
  const connectWallet = async () => {
    try {
      setLoading(true);
      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });
      handleAccountsChanged(accounts);
      toast.success('Wallet berhasil terhubung!');
    } catch (error) {
      console.error('Error connecting wallet:', error);
      toast.error('Gagal menghubungkan wallet!');
    } finally {
      setLoading(false);
    }
  };

  // Handle account changes
  const handleAccountsChanged = (accounts) => {
    if (accounts.length === 0) {
      setConnected(false);
      setAccounts([]);
      toast.info('Silakan hubungkan wallet Anda.');
    } else {
      setAccounts(accounts);
      setConnected(true);
    }
  };

  // Handle chain changes
  const handleChainChanged = (chainId) => {
    // Konversi chainId hex ke decimal
    const chain = parseInt(chainId, 16);
    setChainId(chain);
    setNetworkName(getNetworkName(chain));
    // Refresh page untuk memastikan semuanya diperbarui dengan benar
    window.location.reload();
  };

  // Dapatkan nama network dari chainId
  const getNetworkName = (chainId) => {
    switch (chainId) {
      case 1:
        return 'Ethereum Mainnet';
      case 3:
        return 'Ropsten Testnet';
      case 4:
        return 'Rinkeby Testnet';
      case 5:
        return 'Goerli Testnet';
      case 42:
        return 'Kovan Testnet';
      case 11155111:
        return 'Sepolia Testnet';
      default:
        return 'Unknown Network';
    }
  };

  // Initialize web3 on component mount
  useEffect(() => {
    initializeWeb3();
    // Cleanup function untuk menghapus event listeners
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [initializeWeb3]);

  // Nilai context yang akan disediakan
  const contextValue = {
    web3,
    accounts,
    contract,
    loading,
    connected,
    chainId,
    networkName,
    connectWallet,
  };

  return (
    <Web3Context.Provider value={contextValue}>
      {children}
    </Web3Context.Provider>
  );
};