// src/pages/ElectionDetails.js - Halaman untuk melihat detail pemilihan dan memberikan suara

import React, { useState, useEffect, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Web3Context } from '../contexts/Web3Context.js';
import { toast } from 'react-toastify';
import LoadingSpinner from '../components/LoadingSpinner.js';

const ElectionDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { contract, accounts, connected } = useContext(Web3Context);
  
  const [election, setElection] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [votingStatus, setVotingStatus] = useState(null); // null, 'not-registered', 'registered', 'voted'
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [votingInProgress, setVotingInProgress] = useState(false);
  
  useEffect(() => {
    if (contract && connected) {
      fetchElectionDetails();
    } else {
      setLoading(false);
    }
  }, [contract, connected, id]);
  
  const fetchElectionDetails = async () => {
    try {
      setLoading(true);
      // Dapatkan detail pemilihan
      const electionData = await contract.methods.elections(id).call();
      
      // Dapatkan status pemilihan aktif atau tidak
      const isActive = await contract.methods.isElectionActive(id).call();
      
      // Format data pemilihan
      const currentTime = Math.floor(Date.now() / 1000);
      const formattedElection = {
        id: electionData.id,
        name: electionData.name,
        description: electionData.description,
        startTime: new Date(parseInt(electionData.startTime) * 1000),
        endTime: new Date(parseInt(electionData.endTime) * 1000),
        isActive: isActive,
        totalVotes: electionData.totalVotes,
        status: determineStatus(currentTime, electionData.startTime, electionData.endTime, isActive)
      };
      
      setElection(formattedElection);
      
      // Dapatkan status voter
      const voterStatus = await contract.methods.voterStatus(id, accounts[0]).call();
      
      // VoterStatus enum: NotRegistered = 0, Registered = 1, Voted = 2
      if (voterStatus === '0') {
        setVotingStatus('not-registered');
      } else if (voterStatus === '1') {
        setVotingStatus('registered');
      } else if (voterStatus === '2') {
        setVotingStatus('voted');
      }
      
      // Dapatkan daftar kandidat
      const candidateIds = await contract.methods.getElectionCandidates(id).call();
      
      const candidatePromises = candidateIds.map(async (candidateId) => {
        const candidateInfo = await contract.methods.getCandidateInfo(candidateId).call();
        return {
          id: candidateInfo[0],
          name: candidateInfo[1],
          details: candidateInfo[2],
          voteCount: candidateInfo[3]
        };
      });
      
      const candidateResults = await Promise.all(candidatePromises);
      setCandidates(candidateResults);
      
    } catch (error) {
      console.error("Error fetching election details:", error);
      toast.error("Gagal memuat detail pemilihan");
    } finally {
      setLoading(false);
    }
  };
  
  const determineStatus = (currentTime, startTime, endTime, isActive) => {
    if (currentTime < startTime) {
      return 'upcoming';
    } else if (currentTime > endTime) {
      return 'ended';
    } else if (isActive) {
      return 'active';
    } else {
      return 'paused';
    }
  };
  
  const castVote = async () => {
    if (!selectedCandidate) {
      toast.warning("Silakan pilih kandidat terlebih dahulu");
      return;
    }
    
    try {
      setVotingInProgress(true);
      
      // Memanggil fungsi castVote pada smart contract
      await contract.methods.castVote(id, selectedCandidate)
        .send({ from: accounts[0] });
      
      toast.success("Suara berhasil diberikan!");
      setVotingStatus('voted');
      
      // Refresh data
      await fetchElectionDetails();
      
    } catch (error) {
      console.error("Error casting vote:", error);
      toast.error("Gagal memberikan suara. Silakan coba lagi.");
    } finally {
      setVotingInProgress(false);
    }
  };
  
  // Format tanggal ke lokal Indonesia
  const formatDate = (date) => {
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
      case 'paused':
        return <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">Dijeda</span>;
      default:
        return null;
    }
  };

  // Render loading state
  if (loading) {
    return <LoadingSpinner message="Memuat detail pemilihan..." />;
  }

  // Render jika belum terhubung ke wallet
  if (!connected) {
    return (
      <div className="text-center py-10">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Detail Pemilihan</h2>
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 p-4 rounded mb-6">
          <p>Silakan hubungkan wallet Ethereum Anda untuk melihat detail pemilihan.</p>
        </div>
      </div>
    );
  }

  // Render jika data pemilihan tidak ditemukan
  if (!election) {
    return (
      <div className="text-center py-10">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Detail Pemilihan</h2>
        <div className="bg-red-100 border border-red-400 text-red-700 p-4 rounded mb-6">
          <p>Pemilihan tidak ditemukan atau terjadi kesalahan.</p>
        </div>
        <Link to="/elections" className="text-blue-600 hover:underline">
          Kembali ke Daftar Pemilihan
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header Section */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <Link to="/elections" className="text-blue-600 hover:underline mb-2 inline-block">
            &larr; Kembali ke Daftar Pemilihan
          </Link>
          <h1 className="text-3xl font-bold text-gray-800">{election.name}</h1>
        </div>
        {getStatusBadge(election.status)}
      </div>
      
      {/* Info Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <p className="text-gray-700 mb-4">{election.description}</p>
        
        <div className="grid md:grid-cols-3 gap-6 my-4">
          <div>
            <p className="text-sm text-gray-500">Tanggal Mulai</p>
            <p className="text-gray-800 font-medium">{formatDate(election.startTime)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Tanggal Berakhir</p>
            <p className="text-gray-800 font-medium">{formatDate(election.endTime)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Suara</p>
            <p className="text-gray-800 font-medium">{election.totalVotes}</p>
          </div>
        </div>
        
        {/* Voter Status */}
        <div className="mt-4 p-4 rounded-lg bg-gray-50">
          <h3 className="text-lg font-bold text-gray-800 mb-2">Status Anda</h3>
          
          {votingStatus === 'not-registered' && (
            <div className="flex items-center justify-between">
              <p className="text-gray-700">
                Anda belum terdaftar untuk pemilihan ini.
              </p>
              <Link
                to={`/register?election=${id}`}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition duration-300"
              >
                Daftar Sekarang
              </Link>
            </div>
          )}
          
          {votingStatus === 'registered' && election.status === 'active' && (
            <p className="text-green-700">
              Anda terdaftar dan dapat memberikan suara pada pemilihan ini.
            </p>
          )}
          
          {votingStatus === 'registered' && election.status !== 'active' && (
            <p className="text-yellow-700">
              Anda terdaftar untuk pemilihan ini, tetapi pemilihan {
                election.status === 'upcoming' ? 'belum dimulai' : 
                election.status === 'ended' ? 'sudah berakhir' : 'sedang dijeda'
              }.
            </p>
          )}
          
          {votingStatus === 'voted' && (
            <p className="text-purple-700">
              Anda telah memberikan suara pada pemilihan ini.
            </p>
          )}
        </div>
      </div>
      
      {/* Candidates Section */}
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Kandidat</h2>
      
      {candidates.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <p className="text-gray-600">Belum ada kandidat untuk pemilihan ini.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {candidates.map(candidate => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              selected={selectedCandidate === candidate.id}
              onSelect={() => setSelectedCandidate(candidate.id)}
              canVote={votingStatus === 'registered' && election.status === 'active'}
              hasVoted={votingStatus === 'voted'}
              showVoteCount={votingStatus === 'voted' || election.status === 'ended'}
            />
          ))}
        </div>
      )}
      
      {/* Voting Action */}
      {votingStatus === 'registered' && election.status === 'active' && (
        <div className="mt-6 text-center">
          <button
            onClick={castVote}
            disabled={!selectedCandidate || votingInProgress}
            className={`py-3 px-8 rounded-lg font-bold text-white transition duration-300 ${
              !selectedCandidate || votingInProgress
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {votingInProgress ? 'Memproses...' : 'Berikan Suara'}
          </button>
          <p className="text-sm text-gray-500 mt-2">
            Pastikan pilihan Anda sudah benar. Suara tidak dapat dibatalkan atau diubah.
          </p>
        </div>
      )}
      
      {/* Election Results Link */}
      {election.status === 'ended' && (
        <div className="mt-6 text-center">
          <Link
            to={`/results/${id}`}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-lg transition duration-300"
          >
            Lihat Hasil Lengkap
          </Link>
        </div>
      )}
    </div>
  );
};

// Komponen Card untuk kandidat
const CandidateCard = ({ candidate, selected, onSelect, canVote, hasVoted, showVoteCount }) => {
  return (
    <div 
      className={`bg-white rounded-lg shadow-md overflow-hidden border-2 ${
        selected ? 'border-blue-500' : 'border-transparent'
      } transition-all duration-200`}
      onClick={canVote ? onSelect : undefined}
    >
      <div className={`p-5 ${canVote ? 'cursor-pointer' : ''}`}>
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-xl font-bold text-gray-800">{candidate.name}</h3>
          {selected && canVote && (
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              Dipilih
            </span>
          )}
          {hasVoted && showVoteCount && (
            <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
              {candidate.voteCount} Suara
            </span>
          )}
        </div>
        
        <p className="text-gray-600">{candidate.details}</p>
        
        {canVote && (
          <div className="mt-4 flex items-center">
            <div className={`w-5 h-5 rounded-full border-2 mr-2 flex items-center justify-center ${
              selected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
            }`}>
              {selected && (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <span className="text-sm text-gray-600">
              {selected ? 'Kandidat dipilih' : 'Pilih kandidat ini'}
            </span>
          </div>
        )}
        
        {showVoteCount && !hasVoted && (
          <div className="mt-4">
            <span className="text-purple-800 font-medium">{candidate.voteCount} Suara</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ElectionDetails;