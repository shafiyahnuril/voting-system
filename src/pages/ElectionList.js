// src/pages/ElectionList.js - Fixed dengan safe contract reading

import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { Web3Context } from '../contexts/Web3Context.js';
import { toast } from 'react-toastify';
import LoadingSpinner from '../components/LoadingSpinner.js';
import { ContractHelper } from '../utils/contractHelper.js';

const ElectionsList = () => {
  const { contract, accounts, connected, connectWallet, web3 } = useContext(Web3Context);
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [contractHelper, setContractHelper] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  
  useEffect(() => {
    if (web3 && connected) {
      initializeContractHelper();
    } else {
      setLoading(false);
    }
  }, [web3, connected]);

  const initializeContractHelper = async () => {
    try {
      console.log('🔄 Initializing contract helper...');
      const helper = new ContractHelper(web3, process.env.REACT_APP_VOTING_CONTRACT_ADDRESS);
      await helper.detectContractAddress();
      setContractHelper(helper);
      fetchElections(helper);
    } catch (error) {
      console.error('❌ Contract helper initialization failed:', error);
      toast.error('Failed to initialize contract. Please check deployment.');
      setLoading(false);
    }
  };
  
  const fetchElections = async (helper = contractHelper) => {
    try {
      setLoading(true);
      console.log('📊 Fetching elections...');

      if (!helper) {
        throw new Error('Contract helper not initialized');
      }

      // Method 1: Use contract helper (safer)
      const electionsData = await helper.getAllElectionsSafely();
      console.log('✅ Elections fetched via helper:', electionsData);

      if (electionsData.length === 0) {
        console.log('📭 No elections found');
        setElections([]);
        setLoading(false);
        return;
      }

      // Process elections dengan voter status
      const processedElections = await Promise.all(
        electionsData.map(async (electionData) => {
          try {
            return await processElectionData(electionData, helper);
          } catch (error) {
            console.warn(`⚠️ Error processing election ${electionData.id}:`, error);
            return null;
          }
        })
      );

      // Filter out null results
      const validElections = processedElections.filter(e => e !== null);
      console.log('✅ Processed elections:', validElections);
      
      setElections(validElections);
      
    } catch (error) {
      console.error("❌ Error fetching elections:", error);
      
      // Retry logic
      if (retryCount < 2) {
        console.log(`🔄 Retrying... (${retryCount + 1}/3)`);
        setRetryCount(prev => prev + 1);
        setTimeout(() => {
          if (helper) {
            helper.refreshContract().then(() => fetchElections(helper));
          }
        }, 2000);
        return;
      }
      
      toast.error("Failed to load elections. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };
  
  const processElectionData = async (electionData, helper) => {
    try {
      // Basic election info
      const currentTime = Math.floor(Date.now() / 1000);
      const startTime = parseInt(electionData.startTime);
      const endTime = parseInt(electionData.endTime);
      
      let status;
      if (currentTime < startTime) {
        status = 'upcoming';
      } else if (currentTime > endTime) {
        status = 'ended';
      } else if (electionData.active) {
        status = 'active';
      } else {
        status = 'paused';
      }

      // Get voter status (dengan fallback)
      let voterStatus = '0'; // Default: NotRegistered
      if (connected && accounts[0] && helper.contract) {
        try {
          // Try to get voter status
          if (helper.contract.methods.voterStatus) {
            voterStatus = await helper.contract.methods.voterStatus(electionData.id, accounts[0]).call();
          }
        } catch (error) {
          console.warn(`⚠️ Could not get voter status for election ${electionData.id}:`, error.message);
          voterStatus = '0'; // Default fallback
        }
      }
      
      return {
        id: electionData.id,
        name: electionData.name,
        description: electionData.description,
        startTime: new Date(startTime * 1000),
        endTime: new Date(endTime * 1000),
        isActive: electionData.active,
        totalVotes: electionData.totalVotes,
        status: status,
        voterStatus: voterStatus,
        creator: electionData.creator || 'Unknown'
      };
    } catch (error) {
      console.error('❌ Error processing election data:', error);
      throw error;
    }
  };

  // Manual refresh function
  const handleRefresh = async () => {
    console.log('🔄 Manual refresh triggered');
    setRetryCount(0);
    if (contractHelper) {
      await contractHelper.refreshContract();
      await fetchElections(contractHelper);
    } else {
      await initializeContractHelper();
    }
  };
  
  // Helper untuk mendapatkan badge status
  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">Aktif</span>;
      case 'upcoming':
        return <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">Akan Datang</span>;
      case 'ended':
        return <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm font-medium">Selesai</span>;
      case 'paused':
        return <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">Dijeda</span>;
      default:
        return null;
    }
  };
  
  // Helper untuk format tanggal
  const formatDate = (date) => {
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Filter pemilihan berdasarkan status
  const filteredElections = elections.filter(election => {
    if (filter === 'all') return true;
    return election.status === filter;
  });
  
  // Render loading state
  if (loading) {
    return (
      <div>
        <LoadingSpinner message="Memuat daftar pemilihan..." />
        <div className="text-center mt-4">
          <button
            onClick={handleRefresh}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
          >
            Refresh Manual
          </button>
        </div>
      </div>
    );
  }
  
  // Render jika belum terhubung ke wallet
  if (!connected) {
    return (
      <div className="text-center py-10">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Daftar Pemilihan</h2>
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 p-4 rounded mb-6">
          <p className="mb-4">Silakan hubungkan wallet Ethereum Anda untuk melihat daftar pemilihan.</p>
          <button
            onClick={connectWallet}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition duration-300"
          >
            Hubungkan Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Daftar Pemilihan</h1>
        <button
          onClick={handleRefresh}
          className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm transition duration-300"
        >
          🔄 Refresh
        </button>
      </div>
      
      {/* Filter Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          className={`py-2 px-4 font-medium ${
            filter === 'all' 
              ? 'border-b-2 border-blue-500 text-blue-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setFilter('all')}
        >
          Semua ({elections.length})
        </button>
        <button
          className={`py-2 px-4 font-medium ${
            filter === 'active' 
              ? 'border-b-2 border-blue-500 text-blue-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setFilter('active')}
        >
          Aktif ({elections.filter(e => e.status === 'active').length})
        </button>
        <button
          className={`py-2 px-4 font-medium ${
            filter === 'upcoming' 
              ? 'border-b-2 border-blue-500 text-blue-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setFilter('upcoming')}
        >
          Akan Datang ({elections.filter(e => e.status === 'upcoming').length})
        </button>
        <button
          className={`py-2 px-4 font-medium ${
            filter === 'ended' 
              ? 'border-b-2 border-blue-500 text-blue-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setFilter('ended')}
        >
          Selesai ({elections.filter(e => e.status === 'ended').length})
        </button>
      </div>
      
      {/* No Elections */}
      {filteredElections.length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <p className="text-gray-600 mb-4">
            {filter === 'all' 
              ? 'Belum ada pemilihan yang tersedia.'
              : `Tidak ada pemilihan dengan status "${filter}".`}
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              to="/create-election"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition duration-300"
            >
              Buat Pemilihan Baru
            </Link>
            <button
              onClick={handleRefresh}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition duration-300"
            >
              Refresh Data
            </button>
          </div>
        </div>
      )}
      
      {/* Elections List */}
      <div className="grid md:grid-cols-2 gap-6">
        {filteredElections.map(election => (
          <div key={election.id} className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-5">
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-xl font-bold text-gray-800">{election.name}</h3>
                {getStatusBadge(election.status)}
              </div>
              
              <p className="text-gray-600 mb-4 line-clamp-2">
                {election.description}
              </p>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-500">Tanggal Mulai</p>
                  <p className="text-gray-800 text-sm">{formatDate(election.startTime)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Tanggal Berakhir</p>
                  <p className="text-gray-800 text-sm">{formatDate(election.endTime)}</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm">
                  {election.voterStatus === '0' && (
                    <span className="text-yellow-600">
                      Belum terdaftar
                    </span>
                  )}
                  {election.voterStatus === '1' && (
                    <span className="text-green-600">
                      Terdaftar
                    </span>
                  )}
                  {election.voterStatus === '2' && (
                    <span className="text-purple-600">
                      Sudah memilih
                    </span>
                  )}
                  <div className="text-gray-500 text-xs mt-1">
                    Total suara: {election.totalVotes}
                  </div>
                </div>
                
                <Link 
                  to={`/elections/${election.id}`}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium transition duration-300"
                >
                  Lihat Detail
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ElectionsList;