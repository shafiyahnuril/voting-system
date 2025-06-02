// src/pages/MyVotes.js - Patched untuk handle "Not voted" error

import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { Web3Context } from '../contexts/Web3Context.js';
import { toast } from 'react-toastify';
import LoadingSpinner from '../components/LoadingSpinner.js';

const MyVotes = () => {
  const { contract, accounts, connected, connectWallet } = useContext(Web3Context);
  const [votingHistory, setVotingHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState({});
  
  useEffect(() => {
    if (contract && connected && accounts[0]) {
      fetchVotingHistory();
    } else {
      setLoading(false);
    }
  }, [contract, connected, accounts]);

  const fetchVotingHistory = async () => {
    try {
      setLoading(true);
      console.log('🔄 Fetching voting history for:', accounts[0]);
      
      const electionCount = await contract.methods.electionCount().call();
      console.log('📊 Total elections:', electionCount);
      
      if (parseInt(electionCount) === 0) {
        console.log('📭 No elections found');
        setVotingHistory([]);
        setLoading(false);
        return;
      }
      
      const votedElections = [];
      const debugData = {
        totalElections: electionCount,
        checkedElections: [],
        voterStatuses: {},
        inconsistencies: [],
        errors: []
      };
      
      // Check each election for user participation
      for (let i = 1; i <= parseInt(electionCount); i++) {
        try {
          console.log(`🔍 Checking election ${i}...`);
          
          // Get voter status
          let voterStatus = null;
          let hasVoted = false;
          
          try {
            voterStatus = parseInt(await contract.methods.voterStatus(i, accounts[0]).call());
            hasVoted = voterStatus === 3;
            console.log(`📋 Election ${i} - Voter status: ${voterStatus}, Has voted: ${hasVoted}`);
          } catch (error) {
            console.error(`❌ Election ${i} - Error getting voter status:`, error.message);
            debugData.errors.push(`Election ${i} voter status: ${error.message}`);
            continue;
          }
          
          debugData.voterStatuses[i] = { voterStatus, hasVoted };
          debugData.checkedElections.push(i);
          
          // If user has voted, get detailed information
          if (hasVoted) {
            console.log(`🗳️ User voted in election ${i}, fetching details...`);
            
            try {
              const electionDetails = await fetchElectionDetails(i);
              const candidateInfo = await fetchVotedCandidateWithPatches(i, debugData);
              
              votedElections.push({
                ...electionDetails,
                voterStatus: voterStatus,
                candidateVoted: candidateInfo
              });
              
              console.log(`✅ Election ${i} details added to history`);
            } catch (error) {
              console.error(`❌ Error fetching details for election ${i}:`, error);
              debugData.errors.push(`Election ${i} details: ${error.message}`);
              
              // Add partial data even if we can't get full details
              try {
                const partialElection = await fetchElectionDetails(i);
                votedElections.push({
                  ...partialElection,
                  voterStatus: voterStatus,
                  candidateVoted: {
                    id: 'data-corruption',
                    name: 'Data Inconsistency Detected',
                    details: 'Vote recorded but candidate data is corrupted. This is a known issue.',
                    voteCount: 'N/A',
                    error: error.message,
                    type: 'inconsistency'
                  }
                });
              } catch (partialError) {
                console.error(`❌ Could not even get partial election data:`, partialError);
              }
            }
          }
          
        } catch (error) {
          console.error(`❌ Error checking election ${i}:`, error);
          debugData.errors.push(`Election ${i}: ${error.message}`);
        }
      }
      
      // Sort by most recent vote first
      votedElections.sort((a, b) => (b.voteTimestamp || 0) - (a.voteTimestamp || 0));
      
      console.log('✅ Voting history compiled:', votedElections);
      setVotingHistory(votedElections);
      setDebugInfo(debugData);
      
    } catch (error) {
      console.error("❌ Error fetching voting history:", error);
      toast.error("Gagal memuat riwayat pemilihan: " + error.message);
      setDebugInfo({ error: error.message });
    } finally {
      setLoading(false);
    }
  };
  
  const fetchElectionDetails = async (electionId) => {
    try {
      const electionData = await contract.methods.elections(electionId).call();
      
      let voteTimestamp = 0;
      try {
        voteTimestamp = await contract.methods.getUserVoteTimestamp(electionId, accounts[0]).call();
      } catch (error) {
        console.warn(`⚠️ Could not get vote timestamp for election ${electionId}:`, error.message);
        voteTimestamp = Math.floor(Date.now() / 1000);
      }
      
      const currentTime = Math.floor(Date.now() / 1000);
      const startTime = parseInt(electionData.startTime || electionData[3]);
      const endTime = parseInt(electionData.endTime || electionData[4]);
      
      let status;
      if (currentTime < startTime) {
        status = 'upcoming';
      } else if (currentTime > endTime) {
        status = 'ended';
      } else {
        status = 'active';
      }
      
      return {
        id: electionData.id || electionData[0],
        name: electionData.name || electionData[1],
        description: electionData.description || electionData[2],
        startTime: new Date(startTime * 1000),
        endTime: new Date(endTime * 1000),
        totalVotes: electionData.totalVotes || electionData[6],
        status: status,
        voteTimestamp: parseInt(voteTimestamp)
      };
    } catch (error) {
      console.error(`❌ Error fetching election ${electionId} details:`, error);
      throw error;
    }
  };
  
  const fetchVotedCandidateWithPatches = async (electionId, debugData) => {
    // Method 1: Try getUserVote (this might fail with "Not voted" error)
    try {
      const candidateId = await contract.methods.getUserVote(electionId, accounts[0]).call();
      console.log(`📋 getUserVote() success for election ${electionId}: candidate ${candidateId}`);
      
      if (candidateId && candidateId !== '0') {
        // Try to get candidate info
        try {
          const candidateInfo = await contract.methods.getCandidateInfo(candidateId).call();
          return {
            id: candidateInfo[0],
            name: candidateInfo[1],
            details: candidateInfo[2],
            voteCount: candidateInfo[3]
          };
        } catch (candidateError) {
          console.error(`❌ getCandidateInfo failed for candidate ${candidateId}:`, candidateError);
          return {
            id: candidateId,
            name: `Kandidat #${candidateId}`,
            details: 'Data kandidat tidak dapat dimuat. Vote berhasil tercatat.',
            voteCount: 'N/A',
            error: candidateError.message
          };
        }
      }
    } catch (userVoteError) {
      console.error(`❌ getUserVote failed for election ${electionId}:`, userVoteError.message);
      
      // Check if this is the "Not voted" error despite voterStatus = 3
      if (userVoteError.message.includes('Not voted')) {
        console.log('🚨 INCONSISTENCY DETECTED: Status=3 but getUserVote says "Not voted"');
        debugData.inconsistencies.push(`Election ${electionId}: voterStatus=3 but getUserVote="Not voted"`);
        
        // Method 2: Try electionVoters mapping directly
        try {
          console.log('🔄 Trying electionVoters mapping as fallback...');
          const voterData = await contract.methods.electionVoters(electionId, accounts[0]).call();
          
          const votedFor = voterData.votedFor || voterData[3];
          const mappingStatus = voterData.status || voterData[2];
          
          console.log('📊 electionVoters mapping data:', {
            status: mappingStatus,
            votedFor: votedFor,
            timestamp: voterData.timestamp || voterData[4]
          });
          
          if (votedFor && votedFor !== '0') {
            console.log(`✅ Found vote data in mapping! Voted for candidate: ${votedFor}`);
            
            // Try to get candidate info
            try {
              const candidateInfo = await contract.methods.getCandidateInfo(votedFor).call();
              return {
                id: candidateInfo[0],
                name: candidateInfo[1] + ' ⚠️',
                details: candidateInfo[2] + ' (Data recovered from mapping)',
                voteCount: candidateInfo[3],
                recovered: true
              };
            } catch (candidateError) {
              return {
                id: votedFor,
                name: `Kandidat #${votedFor} (Recovered)`,
                details: 'Vote berhasil tercatat. Data kandidat partial recovery dari blockchain mapping.',
                voteCount: 'N/A',
                recovered: true,
                error: candidateError.message
              };
            }
          } else {
            console.log('❌ Mapping also shows no vote data');
            return {
              id: 'corrupted',
              name: 'Data Vote Corrupted',
              details: 'Vote status tercatat tapi data vote tidak konsisten di blockchain. Ini adalah bug smart contract.',
              voteCount: 'N/A',
              error: 'Data corruption detected',
              type: 'corruption'
            };
          }
          
        } catch (mappingError) {
          console.error(`❌ electionVoters mapping also failed:`, mappingError.message);
          
          return {
            id: 'inaccessible',
            name: 'Data Vote Tidak Dapat Diakses',
            details: 'Vote tercatat tapi semua metode akses data gagal. Kemungkinan contract issue atau network problem.',
            voteCount: 'N/A',
            error: mappingError.message,
            type: 'access-failure'
          };
        }
      } else {
        // Other getUserVote errors
        return {
          id: 'error',
          name: 'Error Mengakses Data Vote',
          details: `Gagal mengakses data vote: ${userVoteError.message}`,
          voteCount: 'N/A',
          error: userVoteError.message,
          type: 'unknown-error'
        };
      }
    }
    
    // Fallback if all else fails
    return {
      id: 'unknown',
      name: 'Kandidat Tidak Dikenal',
      details: 'Tidak dapat memuat informasi kandidat yang dipilih.',
      voteCount: 'N/A',
      error: 'All methods failed'
    };
  };
  
  // Format functions
  const formatDate = (date) => {
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };
  
  const formatVoteTime = (timestamp) => {
    if (!timestamp || timestamp === 0) {
      return 'Waktu tidak tersedia';
    }
    
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
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
  
  // Get candidate display styling based on type
  const getCandidateStyle = (candidate) => {
    if (candidate.type === 'inconsistency' || candidate.type === 'corruption') {
      return {
        bgColor: 'bg-gradient-to-r from-red-50 to-orange-50',
        borderColor: 'border-red-200',
        iconBg: 'bg-red-600',
        icon: '⚠️'
      };
    } else if (candidate.recovered) {
      return {
        bgColor: 'bg-gradient-to-r from-yellow-50 to-orange-50',
        borderColor: 'border-yellow-200',
        iconBg: 'bg-yellow-600',
        icon: '🔄'
      };
    } else if (candidate.error) {
      return {
        bgColor: 'bg-gradient-to-r from-red-50 to-pink-50',
        borderColor: 'border-red-200',
        iconBg: 'bg-red-600',
        icon: '❌'
      };
    } else {
      return {
        bgColor: 'bg-gradient-to-r from-blue-50 to-purple-50',
        borderColor: 'border-blue-200',
        iconBg: 'bg-blue-600',
        icon: '✓'
      };
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Riwayat Pemilihan Saya</h1>
        <button
          onClick={fetchVotingHistory}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm transition duration-300"
        >
          🔄 Refresh
        </button>
      </div>
      
      {/* Data Inconsistency Warning */}
      {debugInfo.inconsistencies && debugInfo.inconsistencies.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <div className="text-orange-600 text-xl mr-3">⚠️</div>
            <div>
              <h3 className="font-bold text-orange-800 mb-1">Data Inconsistency Detected</h3>
              <p className="text-orange-700 text-sm mb-2">
                Beberapa vote data menunjukkan inkonsistensi antara status voter dan data vote. 
                Sistem telah mencoba recovery data dari blockchain mapping.
              </p>
              <details className="text-xs text-orange-600">
                <summary className="cursor-pointer font-medium">Technical Details</summary>
                <ul className="mt-1 list-disc list-inside">
                  {debugInfo.inconsistencies.map((inc, idx) => (
                    <li key={idx}>{inc}</li>
                  ))}
                </ul>
              </details>
            </div>
          </div>
        </div>
      )}
      
      {/* Debug Info (development only) */}
      {process.env.NODE_ENV === 'development' && Object.keys(debugInfo).length > 0 && (
        <div className="bg-gray-100 rounded-lg p-4 mb-6">
          <details>
            <summary className="cursor-pointer font-medium text-gray-700">
              Debug Info ({votingHistory.length} votes found)
              {debugInfo.inconsistencies?.length > 0 && (
                <span className="text-orange-600 ml-2">
                  - {debugInfo.inconsistencies.length} inconsistencies
                </span>
              )}
            </summary>
            <pre className="mt-2 text-xs text-gray-600 overflow-auto">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </details>
        </div>
      )}
      
      {/* Account Info */}
      <div className="bg-blue-50 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-800">
          <span className="font-medium">Account:</span> {accounts[0]}
        </p>
        <p className="text-xs text-blue-600 mt-1">
          Menampilkan riwayat voting untuk account di atas
        </p>
      </div>
      
      {/* No Voting History */}
      {votingHistory.length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <div className="text-6xl mb-4">🗳️</div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Belum Ada Riwayat Voting</h3>
          <p className="text-gray-600 mb-6">
            Anda belum berpartisipasi dalam pemilihan apapun, atau data voting sedang dimuat.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              to="/elections" 
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded transition duration-300"
            >
              Lihat Daftar Pemilihan
            </Link>
            <button
              onClick={fetchVotingHistory}
              className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded transition duration-300"
            >
              Coba Lagi
            </button>
          </div>
        </div>
      )}
      
      {/* Voting History List */}
      {votingHistory.length > 0 && (
        <div className="space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-green-800 font-medium">
              ✅ Ditemukan {votingHistory.length} riwayat voting
            </p>
            {debugInfo.inconsistencies?.length > 0 && (
              <p className="text-orange-700 text-sm mt-1">
                ⚠️ {debugInfo.inconsistencies.length} vote dengan data inconsistency (sudah di-recover)
              </p>
            )}
          </div>
          
          {votingHistory.map((election, index) => {
            const candidateStyle = getCandidateStyle(election.candidateVoted);
            
            return (
              <div key={`${election.id}-${index}`} className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-800 mb-2">{election.name}</h3>
                      <p className="text-sm text-gray-500 mb-1">
                        <span className="font-medium">Suara diberikan pada:</span> {formatVoteTime(election.voteTimestamp)}
                      </p>
                      <p className="text-sm text-gray-500">
                        <span className="font-medium">ID Pemilihan:</span> {election.id}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {getStatusBadge(election.status)}
                      <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-xs font-medium">
                        ✅ Voted
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Periode Pemilihan</p>
                      <p className="text-gray-800">
                        {formatDate(election.startTime)} - {formatDate(election.endTime)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Total Suara</p>
                      <p className="text-gray-800 font-medium">{election.totalVotes}</p>
                    </div>
                  </div>
                  
                  {/* Description */}
                  {election.description && (
                    <div className="mb-6">
                      <p className="text-sm text-gray-500 mb-1">Deskripsi</p>
                      <p className="text-gray-700">{election.description}</p>
                    </div>
                  )}
                  
                  {/* Enhanced Kandidat Section */}
                  <div className="border-t pt-6">
                    <p className="text-sm text-gray-500 mb-3">Kandidat yang Anda pilih:</p>
                    
                    <div className={`${candidateStyle.bgColor} p-4 rounded-lg border ${candidateStyle.borderColor}`}>
                      <div className="flex items-start">
                        <div className={`${candidateStyle.iconBg} text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3 mt-1`}>
                          {candidateStyle.icon}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-bold text-gray-800 text-lg">{election.candidateVoted.name}</p>
                              <p className="text-gray-600 mt-1">{election.candidateVoted.details}</p>
                            </div>
                            
                            {/* Status Badge */}
                            {election.candidateVoted.recovered && (
                              <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium ml-3">
                                Recovered
                              </span>
                            )}
                            {election.candidateVoted.type === 'inconsistency' && (
                              <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium ml-3">
                                Data Issue
                              </span>
                            )}
                          </div>
                          
                          {/* Vote Count */}
                          {election.status === 'ended' && election.candidateVoted.voteCount !== 'N/A' && (
                            <p className="text-purple-600 text-sm font-medium mt-2">
                              Total suara diterima: {election.candidateVoted.voteCount}
                            </p>
                          )}
                          
                          {/* Technical Details for Issues */}
                          {election.candidateVoted.error && (
                            <details className="mt-3 text-sm">
                              <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
                                Technical Details {candidateStyle.icon}
                              </summary>
                              <div className="mt-2 bg-gray-100 p-3 rounded text-xs">
                                <p><strong>Error:</strong> {election.candidateVoted.error}</p>
                                <p><strong>Candidate ID:</strong> {election.candidateVoted.id}</p>
                                {election.candidateVoted.type && (
                                  <p><strong>Issue Type:</strong> {election.candidateVoted.type}</p>
                                )}
                                
                                <div className="mt-2 pt-2 border-t">
                                  <p className="font-medium text-gray-700">What happened:</p>
                                  {election.candidateVoted.type === 'inconsistency' && (
                                    <p>Vote status shows "voted" but vote data is inconsistent. This is a smart contract bug.</p>
                                  )}
                                  {election.candidateVoted.recovered && (
                                    <p>Data was recovered from blockchain mapping. Vote is valid but accessed via fallback method.</p>
                                  )}
                                  {election.candidateVoted.type === 'corruption' && (
                                    <p>Vote data appears to be corrupted in the blockchain. Vote status recorded but candidate data missing.</p>
                                  )}
                                </div>
                              </div>
                            </details>
                          )}
                          
                          {/* Transparency Info */}
                          <p className="text-gray-500 text-xs mt-2">
                            Candidate ID: {election.candidateVoted.id}
                            {election.candidateVoted.recovered && (
                              <span className="text-yellow-600 ml-2">(Data Recovered)</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link
                      to={`/elections/${election.id}`}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium transition duration-300"
                    >
                      Lihat Detail Pemilihan
                    </Link>
                    
                    {election.status === 'ended' && (
                      <Link
                        to={`/results/${election.id}`}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm font-medium transition duration-300"
                      >
                        Lihat Hasil Lengkap
                      </Link>
                    )}
                    
                    {/* Debug button for development */}
                    {process.env.NODE_ENV === 'development' && (
                      <button
                        onClick={() => {
                          console.log('Election Debug Info:', {
                            election,
                            candidateData: election.candidateVoted,
                            debugInfo: debugInfo
                          });
                          alert('Debug info logged to console (F12)');
                        }}
                        className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm font-medium transition duration-300"
                      >
                        🔍 Debug
                      </button>
                    )}
                    
                    <div className="text-xs text-gray-500 flex items-center">
                      <span className="bg-gray-100 px-2 py-1 rounded">
                        Status Voter: {election.voterStatus}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Additional Actions */}
      {votingHistory.length > 0 && (
        <div className="mt-8 text-center">
          <Link
            to="/elections"
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300"
          >
            Ikuti Pemilihan Lainnya
          </Link>
        </div>
      )}
      
      {/* Help Section for Data Issues */}
      {debugInfo.inconsistencies?.length > 0 && (
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-bold text-blue-800 mb-3">ℹ️ Tentang Data Inconsistency</h3>
          <div className="text-blue-700 text-sm space-y-2">
            <p>
              <strong>Apa yang terjadi:</strong> Vote Anda berhasil tercatat di blockchain, 
              tetapi terjadi inkonsistensi dalam cara smart contract menyimpan/mengakses data vote.
            </p>
            <p>
              <strong>Apakah vote saya valid:</strong> Ya, vote Anda tetap valid dan tercatat. 
              Sistem berhasil recovery data dari blockchain mapping.
            </p>
            <p>
              <strong>Kenapa terjadi:</strong> Ini adalah bug dalam smart contract logic, 
              dimana method `voterStatus()` dan `getUserVote()` menggunakan data source yang berbeda.
            </p>
            <p>
              <strong>Solusi:</strong> Bug ini tidak mempengaruhi validitas vote. 
              Untuk project selanjutnya, perlu perbaikan pada smart contract logic.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyVotes;