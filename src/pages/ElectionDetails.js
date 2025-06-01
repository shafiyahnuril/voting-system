// src/pages/ElectionDetails.js - Fixed dengan voter status checking yang benar

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
  const [votingStatus, setVotingStatus] = useState(null);
  const [voterVerified, setVoterVerified] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [votingInProgress, setVotingInProgress] = useState(false);
  const [debugInfo, setDebugInfo] = useState({});
  
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
      console.log('🔄 Fetching election details for ID:', id);
      
      // Get election data
      const electionData = await contract.methods.elections(id).call();
      console.log('📊 Raw election data:', electionData);
      
      // Get election active status
      const isActive = await contract.methods.isElectionActive(id).call();
      console.log('📊 Election active status:', isActive);
      
      // Format election data
      const currentTime = Math.floor(Date.now() / 1000);
      const startTime = parseInt(electionData.startTime || electionData[3]);
      const endTime = parseInt(electionData.endTime || electionData[4]);
      
      const formattedElection = {
        id: electionData.id || electionData[0],
        name: electionData.name || electionData[1],
        description: electionData.description || electionData[2],
        startTime: new Date(startTime * 1000),
        endTime: new Date(endTime * 1000),
        isActive: isActive,
        totalVotes: electionData.totalVotes || electionData[6],
        status: determineStatus(currentTime, startTime, endTime, isActive)
      };
      
      setElection(formattedElection);
      console.log('✅ Formatted election:', formattedElection);
      
      // Get voter status with enhanced checking
      await checkVoterStatus();
      
      // Get candidates
      await fetchCandidates();
      
    } catch (error) {
      console.error("❌ Error fetching election details:", error);
      toast.error("Gagal memuat detail pemilihan: " + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const checkVoterStatus = async () => {
    try {
      console.log('🔄 Checking voter status...');
      
      let status = '0'; // Default: Not Registered
      let verified = false;
      
      // Try enhanced getVoterStatus method first
      try {
        const statusResult = await contract.methods.getVoterStatus(id, accounts[0]).call();
        status = statusResult[0] || statusResult;
        verified = statusResult[1] !== false; // Default to true if not explicitly false
        console.log('✅ getVoterStatus result:', { status, verified });
      } catch (error) {
        console.log('⚠️ getVoterStatus not available, trying fallback...');
        
        // Fallback to basic voterStatus method
        try {
          status = await contract.methods.voterStatus(id, accounts[0]).call();
          verified = status !== '0'; // If registered, assume verified in simplified contract
          console.log('✅ voterStatus fallback result:', { status, verified });
        } catch (error2) {
          console.warn('⚠️ Could not get voter status:', error2.message);
          status = '0';
          verified = false;
        }
      }
      
      // Convert status to meaningful state
      let votingState = null;
      switch (status) {
        case '0':
          votingState = 'not-registered';
          break;
        case '1':
          votingState = verified ? 'registered' : 'pending-verification';
          break;
        case '2':
          votingState = 'registered'; // In new contract, this is verified
          break;
        case '3':
          votingState = 'voted';
          break;
        default:
          votingState = 'unknown';
      }
      
      setVotingStatus(votingState);
      setVoterVerified(verified);
      
      // Store debug info
      setDebugInfo({
        rawStatus: status,
        verified: verified,
        votingState: votingState,
        account: accounts[0]
      });
      
      console.log('📋 Final voter status:', {
        rawStatus: status,
        votingState,
        verified,
        account: accounts[0]
      });
      
    } catch (error) {
      console.error('❌ Error checking voter status:', error);
      setVotingStatus('error');
      setVoterVerified(false);
    }
  };
  
  const fetchCandidates = async () => {
    try {
      console.log('🔄 Fetching candidates...');
      
      // Get candidate IDs
      const candidateIds = await contract.methods.getElectionCandidates(id).call();
      console.log('📊 Candidate IDs:', candidateIds);
      
      if (candidateIds.length === 0) {
        console.log('📭 No candidates found');
        setCandidates([]);
        return;
      }
      
      // Get candidate details
      const candidatePromises = candidateIds.map(async (candidateId) => {
        try {
          const candidateInfo = await contract.methods.getCandidateInfo(candidateId).call();
          return {
            id: candidateInfo[0],
            name: candidateInfo[1],
            details: candidateInfo[2],
            voteCount: candidateInfo[3]
          };
        } catch (error) {
          console.warn(`⚠️ Error getting candidate ${candidateId}:`, error.message);
          return null;
        }
      });
      
      const candidateResults = await Promise.all(candidatePromises);
      const validCandidates = candidateResults.filter(c => c !== null);
      
      setCandidates(validCandidates);
      console.log('✅ Candidates loaded:', validCandidates);
      
    } catch (error) {
      console.error('❌ Error fetching candidates:', error);
      setCandidates([]);
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
      console.log('🗳️ Attempting to cast vote...', {
        electionId: id,
        candidateId: selectedCandidate,
        voter: accounts[0],
        voterStatus: votingStatus,
        verified: voterVerified
      });
      
      // Pre-flight checks
      const currentTime = Math.floor(Date.now() / 1000);
      const startTime = Math.floor(election.startTime.getTime() / 1000);
      const endTime = Math.floor(election.endTime.getTime() / 1000);
      
      const checks = {
        withinTimeWindow: currentTime >= startTime && currentTime <= endTime,
        electionActive: election.isActive,
        voterRegistered: votingStatus === 'registered',
        voterVerified: voterVerified,
        hasNotVoted: votingStatus !== 'voted',
        validCandidate: candidates.some(c => c.id == selectedCandidate)
      };
      
      console.log('📋 Pre-flight checks:', checks);
      
      const failedChecks = Object.entries(checks).filter(([key, value]) => !value);
      if (failedChecks.length > 0) {
        const failures = failedChecks.map(([key]) => key).join(', ');
        throw new Error(`Vote validation failed: ${failures}`);
      }
      
      // Estimate gas
      const gasEstimate = await contract.methods
        .castVote(id, selectedCandidate)
        .estimateGas({ from: accounts[0] });
      
      console.log('⛽ Gas estimate:', gasEstimate);
      
      // Send transaction
      const result = await contract.methods
        .castVote(id, selectedCandidate)
        .send({ 
          from: accounts[0],
          gas: Math.floor(gasEstimate * 1.5) // 50% buffer
        });
      
      console.log('✅ Vote cast successfully:', result);
      toast.success("Suara berhasil diberikan!");
      
      // Update status
      setVotingStatus('voted');
      
      // Refresh data
      await fetchElectionDetails();
      
    } catch (error) {
      console.error("❌ Error casting vote:", error);
      
      let errorMessage = "Gagal memberikan suara: ";
      
      if (error.message.includes('Not registered')) {
        errorMessage = "Anda belum terdaftar untuk pemilihan ini";
      } else if (error.message.includes('Not verified')) {
        errorMessage = "Identitas Anda belum terverifikasi";
      } else if (error.message.includes('Already voted')) {
        errorMessage = "Anda sudah memberikan suara";
      } else if (error.message.includes('Election not active')) {
        errorMessage = "Pemilihan tidak aktif";
      } else if (error.message.includes('Not started')) {
        errorMessage = "Pemilihan belum dimulai";
      } else if (error.message.includes('Ended')) {
        errorMessage = "Pemilihan sudah berakhir";
      } else if (error.message.includes('Invalid candidate')) {
        errorMessage = "Kandidat tidak valid";
      } else if (error.message.includes('User denied')) {
        errorMessage = "Transaksi dibatalkan";
      } else if (error.message.includes('validation failed')) {
        errorMessage = error.message;
      } else {
        errorMessage += error.message || "Terjadi kesalahan tidak dikenal";
      }
      
      toast.error(errorMessage);
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

  // Helper untuk mendapatkan status text yang user-friendly
  const getVoterStatusText = (status, verified) => {
    switch (status) {
      case 'not-registered':
        return { text: "Belum terdaftar", color: "text-red-600", bg: "bg-red-50" };
      case 'pending-verification':
        return { text: "Menunggu verifikasi", color: "text-yellow-600", bg: "bg-yellow-50" };
      case 'registered':
        return verified 
          ? { text: "Terdaftar & Terverifikasi", color: "text-green-600", bg: "bg-green-50" }
          : { text: "Terdaftar, menunggu verifikasi", color: "text-yellow-600", bg: "bg-yellow-50" };
      case 'voted':
        return { text: "Sudah memberikan suara", color: "text-purple-600", bg: "bg-purple-50" };
      case 'error':
        return { text: "Error mengecek status", color: "text-red-600", bg: "bg-red-50" };
      default:
        return { text: "Status tidak dikenal", color: "text-gray-600", bg: "bg-gray-50" };
    }
  };

  // Check if user can vote
  const canUserVote = () => {
    const currentTime = Math.floor(Date.now() / 1000);
    const startTime = election ? Math.floor(election.startTime.getTime() / 1000) : 0;
    const endTime = election ? Math.floor(election.endTime.getTime() / 1000) : 0;
    
    return (
      votingStatus === 'registered' &&
      voterVerified &&
      election?.status === 'active' &&
      currentTime >= startTime &&
      currentTime <= endTime &&
      candidates.length > 0
    );
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

  const voterStatusInfo = getVoterStatusText(votingStatus, voterVerified);
  const canVote = canUserVote();

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
        
        {/* Enhanced Voter Status */}
        <div className={`mt-4 p-4 rounded-lg ${voterStatusInfo.bg}`}>
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">Status Anda</h3>
              <p className={`font-medium ${voterStatusInfo.color}`}>
                {voterStatusInfo.text}
              </p>
              
              {/* Debug Info (only in development) */}
              {process.env.NODE_ENV === 'development' && (
                <details className="mt-2 text-sm text-gray-500">
                  <summary className="cursor-pointer">Debug Info</summary>
                  <pre className="mt-2 bg-gray-100 p-2 rounded text-xs">
                    {JSON.stringify(debugInfo, null, 2)}
                  </pre>
                </details>
              )}
            </div>
            
            {/* Action Buttons based on Status */}
            <div className="flex flex-col gap-2">
              {votingStatus === 'not-registered' && (
                <Link
                  to={`/register?election=${id}`}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition duration-300 text-center"
                >
                  Daftar Sekarang
                </Link>
              )}
              
              {votingStatus === 'voted' && election.status === 'ended' && (
                <Link
                  to={`/results/${id}`}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded transition duration-300 text-center"
                >
                  Lihat Hasil
                </Link>
              )}
            </div>
          </div>
          
          {/* Additional status messages */}
          {votingStatus === 'registered' && !canVote && (
            <div className="mt-3 text-sm text-gray-600">
              {election.status !== 'active' && (
                <p>Pemilihan sedang tidak aktif.</p>
              )}
              {election.status === 'active' && candidates.length === 0 && (
                <p>Menunggu kandidat ditambahkan.</p>
              )}
              {election.status === 'upcoming' && (
                <p>Pemilihan akan dimulai pada {formatDate(election.startTime)}.</p>
              )}
              {election.status === 'ended' && (
                <p>Pemilihan sudah berakhir pada {formatDate(election.endTime)}.</p>
              )}
            </div>
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
              canVote={canVote}
              hasVoted={votingStatus === 'voted'}
              showVoteCount={votingStatus === 'voted' || election.status === 'ended'}
            />
          ))}
        </div>
      )}
      
      {/* Voting Action */}
      {canVote && (
        <div className="mt-6 text-center bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Berikan Suara Anda</h3>
          
          {!selectedCandidate && (
            <p className="text-gray-600 mb-4">Silakan pilih kandidat terlebih dahulu</p>
          )}
          
          {selectedCandidate && (
            <div className="mb-4 p-3 bg-blue-50 rounded">
              <p className="text-blue-800">
                Anda akan memberikan suara untuk: 
                <span className="font-bold">
                  {candidates.find(c => c.id == selectedCandidate)?.name}
                </span>
              </p>
            </div>
          )}
          
          <button
            onClick={castVote}
            disabled={!selectedCandidate || votingInProgress}
            className={`py-3 px-8 rounded-lg font-bold text-white transition duration-300 ${
              !selectedCandidate || votingInProgress
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {votingInProgress ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Memproses...
              </div>
            ) : (
              'Berikan Suara'
            )}
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
      className={`bg-white rounded-lg shadow-md overflow-hidden border-2 transition-all duration-200 ${
        selected ? 'border-blue-500 shadow-lg' : 'border-transparent hover:border-gray-200'
      } ${canVote ? 'cursor-pointer' : ''}`}
      onClick={canVote ? onSelect : undefined}
    >
      <div className="p-5">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-xl font-bold text-gray-800">{candidate.name}</h3>
          
          {selected && canVote && (
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              Dipilih
            </span>
          )}
          
          {showVoteCount && (
            <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
              {candidate.voteCount} Suara
            </span>
          )}
        </div>
        
        <p className="text-gray-600 mb-4">{candidate.details}</p>
        
        {canVote && (
          <div className="flex items-center">
            <div className={`w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center transition-colors ${
              selected ? 'border-blue-500 bg-blue-500' : 'border-gray-300 hover:border-blue-400'
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
      </div>
    </div>
  );
};

export default ElectionDetails;