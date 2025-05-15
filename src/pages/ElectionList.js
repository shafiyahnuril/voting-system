// src/pages/ElectionsList.js - Halaman untuk menampilkan daftar pemilihan

import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { Web3Context } from '../contexts/Web3Context.js';
import { toast } from 'react-toastify';
import LoadingSpinner from '../components/LoadingSpinner.js';

const ElectionsList = () => {
  const { contract, accounts, connected, connectWallet } = useContext(Web3Context);
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'active', 'upcoming', 'ended'
  
  useEffect(() => {
    if (contract && connected) {
      fetchElections();
    } else {
      setLoading(false);
    }
  }, [contract, connected]);
  
  const fetchElections = async () => {
    try {
      setLoading(true);
      const electionCount = await contract.methods.electionCount().call();
      
      const electionPromises = [];
      for (let i = 1; i <= electionCount; i++) {
        electionPromises.push(fetchElectionData(i));
      }
      
      const electionResults = await Promise.all(electionPromises);
      setElections(electionResults);
    } catch (error) {
      console.error("Error fetching elections:", error);
      toast.error("Gagal memuat daftar pemilihan");
    } finally {
      setLoading(false);
    }
  };
  
  const fetchElectionData = async (id) => {
    // Dapatkan data pemilihan
    const electionData = await contract.methods.elections(id).call();
    
    // Dapatkan status pemilihan (aktif atau tidak)
    const isActive = await contract.methods.isElectionActive(id).call();
    
    // Dapatkan status voter jika sudah terhubung
    let voterStatus = '0'; // Default: NotRegistered
    if (connected) {
      voterStatus = await contract.methods.voterStatus(id, accounts[0]).call();
    }
    
    // Format data
    const currentTime = Math.floor(Date.now() / 1000);
    const startTime = parseInt(electionData.startTime);
    const endTime = parseInt(electionData.endTime);
    
    let status;
    if (currentTime < startTime) {
      status = 'upcoming';
    } else if (currentTime > endTime) {
      status = 'ended';
    } else if (isActive) {
      status = 'active';
    } else {
      status = 'paused';
    }
    
    return {
      id: electionData.id,
      name: electionData.name,
      description: electionData.description,
      startTime: new Date(startTime * 1000),
      endTime: new Date(endTime * 1000),
      isActive: isActive,
      totalVotes: electionData.totalVotes,
      status: status,
      voterStatus: voterStatus // '0': NotRegistered, '1': Registered, '2': Voted
    };
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
    return <LoadingSpinner message="Memuat daftar pemilihan..." />;
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
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Daftar Pemilihan</h1>
      
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
          Semua
        </button>
        <button
          className={`py-2 px-4 font-medium ${
            filter === 'active' 
              ? 'border-b-2 border-blue-500 text-blue-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setFilter('active')}
        >
          Aktif
        </button>
        <button
          className={`py-2 px-4 font-medium ${
            filter === 'upcoming' 
              ? 'border-b-2 border-blue-500 text-blue-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setFilter('upcoming')}
        >
          Akan Datang
        </button>
        <button
          className={`py-2 px-4 font-medium ${
            filter === 'ended' 
              ? 'border-b-2 border-blue-500 text-blue-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setFilter('ended')}
        >
          Selesai
        </button>
      </div>
      
      {/* No Elections */}
      {filteredElections.length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <p className="text-gray-600">
            {filter === 'all' 
              ? 'Belum ada pemilihan yang tersedia.'
              : `Tidak ada pemilihan dengan status "${filter}".`}
          </p>
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
                  <p className="text-gray-800">{formatDate(election.startTime)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Tanggal Berakhir</p>
                  <p className="text-gray-800">{formatDate(election.endTime)}</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-4">
                <div>
                  {election.voterStatus === '0' && (
                    <span className="text-yellow-600 text-sm">
                      Belum terdaftar
                    </span>
                  )}
                  {election.voterStatus === '1' && (
                    <span className="text-green-600 text-sm">
                      Terdaftar
                    </span>
                  )}
                  {election.voterStatus === '2' && (
                    <span className="text-purple-600 text-sm">
                      Sudah memilih
                    </span>
                  )}
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