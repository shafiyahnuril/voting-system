// src/pages/ElectionResults.js - Halaman untuk melihat hasil pemilihan secara detail

import React, { useState, useEffect, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Web3Context } from '../contexts/Web3Context.js';
import { toast } from 'react-toastify';
import LoadingSpinner from '../components/LoadingSpinner.js';

const ElectionResults = () => {
  const { id } = useParams();
  const { contract, connected, connectWallet } = useContext(Web3Context);
  
  const [election, setElection] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState(null);
  const [totalVotes, setTotalVotes] = useState(0);
  
  useEffect(() => {
    if (contract && connected) {
      fetchElectionResults();
    } else {
      setLoading(false);
    }
  }, [contract, connected, id]);
  
  const fetchElectionResults = async () => {
    try {
      setLoading(true);
      
      // Dapatkan detail pemilihan
      const electionData = await contract.methods.elections(id).call();
      
      // Format data pemilihan
      const startTime = parseInt(electionData.startTime);
      const endTime = parseInt(electionData.endTime);
      
      const formattedElection = {
        id: electionData.id,
        name: electionData.name,
        description: electionData.description,
        startTime: new Date(startTime * 1000),
        endTime: new Date(endTime * 1000),
        totalVotes: electionData.totalVotes
      };
      
      setElection(formattedElection);
      setTotalVotes(parseInt(electionData.totalVotes));
      
      // Dapatkan daftar kandidat
      const candidateIds = await contract.methods.getElectionCandidates(id).call();
      
      const candidatePromises = candidateIds.map(async (candidateId) => {
        const candidateInfo = await contract.methods.getCandidateInfo(candidateId).call();
        return {
          id: candidateInfo[0],
          name: candidateInfo[1],
          details: candidateInfo[2],
          voteCount: parseInt(candidateInfo[3])
        };
      });
      
      const candidateResults = await Promise.all(candidatePromises);
      
      // Urutkan kandidat berdasarkan jumlah suara (tertinggi ke terendah)
      candidateResults.sort((a, b) => b.voteCount - a.voteCount);
      
      setCandidates(candidateResults);
      
      // Persiapkan data untuk chart
      prepareChartData(candidateResults, parseInt(electionData.totalVotes));
      
    } catch (error) {
      console.error("Error fetching election results:", error);
      toast.error("Gagal memuat hasil pemilihan");
    } finally {
      setLoading(false);
    }
  };
  
  const prepareChartData = (candidates, totalVotes) => {
    // Data untuk diagram batang
    const data = candidates.map(candidate => ({
      name: candidate.name,
      votes: candidate.voteCount,
      percentage: totalVotes > 0 ? ((candidate.voteCount / totalVotes) * 100).toFixed(1) : 0
    }));
    
    setChartData(data);
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
  
  // Helper untuk menentukan apakah kandidat adalah pemenang
  const isWinner = (candidate, allCandidates) => {
    if (allCandidates.length === 0) return false;
    
    const highestVotes = Math.max(...allCandidates.map(c => c.voteCount));
    const winners = allCandidates.filter(c => c.voteCount === highestVotes);
    
    // Jika terjadi seri
    if (winners.length > 1) {
      return candidate.voteCount === highestVotes;
    }
    
    return candidate.id === winners[0].id;
  };
  
  // Render loading state
  if (loading) {
    return <LoadingSpinner message="Memuat hasil pemilihan..." />;
  }
  
  // Render jika belum terhubung ke wallet
  if (!connected) {
    return (
      <div className="text-center py-10">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Hasil Pemilihan</h2>
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 p-4 rounded mb-6">
          <p className="mb-4">Silakan hubungkan wallet Ethereum Anda untuk melihat hasil pemilihan.</p>
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
  
  // Render jika data pemilihan tidak ditemukan
  if (!election) {
    return (
      <div className="text-center py-10">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Hasil Pemilihan</h2>
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
      <div className="mb-6">
        <Link to={`/elections/${id}`} className="text-blue-600 hover:underline mb-2 inline-block">
          &larr; Kembali ke Detail Pemilihan
        </Link>
        <h1 className="text-3xl font-bold text-gray-800">Hasil Pemilihan</h1>
        <h2 className="text-xl text-gray-600">{election.name}</h2>
      </div>
      
      {/* Info Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <p className="text-gray-700 mb-4">{election.description}</p>
        
        <div className="grid md:grid-cols-3 gap-6 my-4">
          <div>
            <p className="text-sm text-gray-500">Periode Pemilihan</p>
            <p className="text-gray-800 font-medium">
              {formatDate(election.startTime)} - {formatDate(election.endTime)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Suara</p>
            <p className="text-gray-800 font-medium">{election.totalVotes}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Jumlah Kandidat</p>
            <p className="text-gray-800 font-medium">{candidates.length}</p>
          </div>
        </div>
      </div>
      
      {/* Results Visualization */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Perolehan Suara</h2>
        
        {totalVotes === 0 ? (
          <div className="text-center py-4">
            <p className="text-gray-600">Belum ada suara yang diberikan pada pemilihan ini.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Bar Chart */}
            <div className="w-full">
              {chartData && chartData.map((item, index) => (
                <div key={index} className="mb-6">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-gray-800">
                      {item.name} {isWinner(candidates[index], candidates) && (
                        <span className="text-green-600 font-bold">(Pemenang)</span>
                      )}
                    </span>
                    <span className="text-gray-700">{item.votes} suara ({item.percentage}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${isWinner(candidates[index], candidates) ? 'bg-green-500' : 'bg-blue-500'}`}
                      style={{ width: `${item.percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Candidates Results Table */}
      <h2 className="text-xl font-bold text-gray-800 mb-4">Detail Hasil Per Kandidat</h2>
      
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Peringkat
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Kandidat
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Deskripsi
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Jumlah Suara
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Persentase
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {candidates.map((candidate, index) => (
              <tr key={candidate.id} className={isWinner(candidate, candidates) ? 'bg-green-50' : ''}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {index + 1}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {candidate.name}
                  {isWinner(candidate, candidates) && (
                    <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Pemenang
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {candidate.details}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                  {candidate.voteCount}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {totalVotes > 0 ? ((candidate.voteCount / totalVotes) * 100).toFixed(1) : 0}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Summary */}
      {totalVotes > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-3">Kesimpulan</h3>
          
          {candidates.filter(c => isWinner(c, candidates)).length === 1 ? (
            <p className="text-gray-700">
              Kandidat <span className="font-bold text-green-600">
                {candidates.find(c => isWinner(c, candidates))?.name}
              </span> memenangkan pemilihan dengan perolehan {candidates.find(c => isWinner(c, candidates))?.voteCount} suara (
                {totalVotes > 0 ? ((candidates.find(c => isWinner(c, candidates))?.voteCount / totalVotes) * 100).toFixed(1) : 0}%
              ).
            </p>
          ) : (
            <p className="text-gray-700">
              Terjadi hasil seri antara {candidates.filter(c => isWinner(c, candidates)).length} kandidat dengan perolehan masing-masing {candidates.find(c => isWinner(c, candidates))?.voteCount} suara.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ElectionResults;