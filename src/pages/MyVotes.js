// src/pages/MyVotes.js - Halaman untuk melihat riwayat pemilihan yang telah diikuti user

import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { Web3Context } from '../contexts/Web3Context.js';
import { toast } from 'react-toastify';
import LoadingSpinner from '../components/LoadingSpinner.js';

const MyVotes = () => {
  const { contract, accounts, connected, connectWallet } = useContext(Web3Context);
  const [votingHistory, setVotingHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (contract && connected) {
      fetchVotingHistory();
    } else {
      setLoading(false);
    }
  }, [contract, connected]);

  const fetchVotingHistory = async () => {
    try {
      setLoading(true);
      
      // Dapatkan jumlah total pemilihan
      const electionCount = await contract.methods.electionCount().call();
      
      // Array untuk menyimpan pemilihan yang telah diikuti
      const votedElections = [];
      
      // Cek setiap pemilihan apakah user telah berpartisipasi
      for (let i = 1; i <= electionCount; i++) {
        const voterStatus = await contract.methods.voterStatus(i, accounts[0]).call();
        
        // Jika status adalah "Voted" (2), tambahkan ke daftar
        if (voterStatus === '2') {
          const electionData = await fetchElectionDetails(i);
          
          // Dapatkan informasi kandidat yang dipilih
          const userVote = await contract.methods.getUserVote(i, accounts[0]).call();
          const candidateInfo = await contract.methods.getCandidateInfo(userVote).call();
          
          votedElections.push({
            ...electionData,
            candidateVoted: {
              id: candidateInfo[0],
              name: candidateInfo[1],
              details: candidateInfo[2],
              voteCount: candidateInfo[3]
            }
          });
        }
      }
      
      // Urutkan berdasarkan waktu, yang terbaru di atas
      votedElections.sort((a, b) => b.timestamp - a.timestamp);
      
      setVotingHistory(votedElections);
    } catch (error) {
      console.error("Error fetching voting history:", error);
      toast.error("Gagal memuat riwayat pemilihan");
    } finally {
      setLoading(false);
    }
  };
  
  const fetchElectionDetails = async (id) => {
    // Dapatkan data pemilihan
    const electionData = await contract.methods.elections(id).call();
    
    // Dapatkan timestamp vote user (akan digunakan untuk sorting)
    const userVoteTimestamp = await contract.methods.getUserVoteTimestamp(id, accounts[0]).call();
    
    // Format data
    const currentTime = Math.floor(Date.now() / 1000);
    const startTime = parseInt(electionData.startTime);
    const endTime = parseInt(electionData.endTime);
    
    let status;
    if (currentTime < startTime) {
      status = 'upcoming';
    } else if (currentTime > endTime) {
      status = 'ended';
    } else {
      status = 'active';
    }
    
    return {
      id: electionData.id,
      name: electionData.name,
      description: electionData.description,
      startTime: new Date(startTime * 1000),
      endTime: new Date(endTime * 1000),
      totalVotes: electionData.totalVotes,
      status: status,
      timestamp: parseInt(userVoteTimestamp)
    };
  };
  
  // Helper untuk format tanggal
  const formatDate = (date) => {
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };
  
  // Helper untuk format waktu vote
  const formatVoteTime = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
      default:
        return null;
    }
  };
  
  // Render loading state
  if (loading) {
    return <LoadingSpinner message="Memuat riwayat pemilihan..." />;
  }

  // Render jika belum terhubung ke wallet
  if (!connected) {
    return (
      <div className="text-center py-10">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Riwayat Pemilihan Saya</h2>
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 p-4 rounded mb-6">
          <p className="mb-4">Silakan hubungkan wallet Ethereum Anda untuk melihat riwayat pemilihan.</p>
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
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Riwayat Pemilihan Saya</h1>
      
      {/* No Voting History */}
      {votingHistory.length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <p className="text-gray-600 mb-4">
            Anda belum berpartisipasi dalam pemilihan apapun.
          </p>
          <Link 
            to="/elections" 
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition duration-300"
          >
            Lihat Daftar Pemilihan
          </Link>
        </div>
      )}
      
      {/* Voting History List */}
      {votingHistory.length > 0 && (
        <div className="space-y-4">
          {votingHistory.map(election => (
            <div key={election.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">{election.name}</h3>
                    <p className="text-sm text-gray-500">
                      Suara diberikan pada: {formatVoteTime(election.timestamp)}
                    </p>
                  </div>
                  {getStatusBadge(election.status)}
                </div>
                
                <div className="grid md:grid-cols-2 gap-6 mb-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Periode Pemilihan</p>
                    <p className="text-gray-800">
                      {formatDate(election.startTime)} - {formatDate(election.endTime)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Total Suara</p>
                    <p className="text-gray-800">{election.totalVotes}</p>
                  </div>
                </div>
                
                {/* Kandidat yang dipilih */}
                <div className="mt-4 border-t pt-4">
                  <p className="text-sm text-gray-500 mb-2">Anda memilih:</p>
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="font-medium text-gray-800">{election.candidateVoted.name}</p>
                    <p className="text-gray-600 text-sm mt-1">{election.candidateVoted.details}</p>
                  </div>
                </div>
                
                <div className="mt-4 flex justify-between items-center">
                  {election.status === 'ended' && (
                    <Link
                      to={`/results/${election.id}`}
                      className="text-purple-600 hover:text-purple-800 font-medium text-sm"
                    >
                      Lihat Hasil Lengkap
                    </Link>
                  )}
                  
                  <Link
                    to={`/elections/${election.id}`}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium transition duration-300"
                  >
                    Detail Pemilihan
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyVotes;