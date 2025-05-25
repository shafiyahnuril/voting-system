// src/pages/RegisterVoter.js - Halaman untuk mendaftar sebagai pemilih

import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Web3Context } from '../contexts/Web3Context.js';
import { toast } from 'react-toastify';
import LoadingSpinner from '../components/LoadingSpinner.js';

const RegisterVoter = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const electionId = searchParams.get('election');
  
  const { contract, accounts, connected, connectWallet, web3 } = useContext(Web3Context);
  
  const [elections, setElections] = useState([]);
  const [selectedElectionId, setSelectedElectionId] = useState(electionId || '');
  const [selectedElection, setSelectedElection] = useState(null);
  const [nik, setNik] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  useEffect(() => {
    if (contract && connected) {
      fetchElections();
    } else {
      setLoading(false);
    }
  }, [contract, connected]);
  
  useEffect(() => {
    if (selectedElectionId && elections.length > 0) {
      const election = elections.find(e => e.id === selectedElectionId);
      setSelectedElection(election);
    } else {
      setSelectedElection(null);
    }
  }, [selectedElectionId, elections]);
  
  const fetchElections = async () => {
    try {
      setLoading(true);
      const electionCount = await contract.methods.electionCount().call();
      
      const electionPromises = [];
      for (let i = 1; i <= electionCount; i++) {
        electionPromises.push(fetchElectionData(i));
      }
      
      const electionResults = await Promise.all(electionPromises);
      
      // Filter hanya pemilihan yang aktif atau akan datang dan voter belum terdaftar
      const availableElections = electionResults.filter(
        e => (e.status === 'active' || e.status === 'upcoming') && e.voterStatus === '0'
      );
      
      setElections(availableElections);
      
      // Jika ada electionId dari query params tapi tidak ditemukan di daftar yang tersedia
      if (electionId && !availableElections.some(e => e.id === electionId)) {
        // Periksa apakah pemilihan ada tapi voter sudah terdaftar
        const election = electionResults.find(e => e.id === electionId);
        
        if (election) {
          if (election.voterStatus === '1') {
            toast.info("Anda sudah terdaftar untuk pemilihan ini");
            navigate(`/elections/${electionId}`);
          } else if (election.voterStatus === '2') {
            toast.info("Anda sudah memberikan suara pada pemilihan ini");
            navigate(`/elections/${electionId}`);
          } else if (election.status === 'ended') {
            toast.info("Pemilihan ini sudah berakhir");
            navigate(`/elections/${electionId}`);
          }
        }
      }
      
      // Set default selected election jika ada dari query params
      if (electionId) {
        setSelectedElectionId(electionId);
      } else if (availableElections.length > 0) {
        setSelectedElectionId(availableElections[0].id);
      }
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
    
    // Dapatkan status pemilihan
    const isActive = await contract.methods.isElectionActive(id).call();
    
    // Dapatkan status voter
    const voterStatus = await contract.methods.voterStatus(id, accounts[0]).call();
    
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
      status: status,
      voterStatus: voterStatus // '0': NotRegistered, '1': Registered, '2': Voted
    };
  };
  
  const handleRegister = async (e) => {
    e.preventDefault();
    
    // Validasi input
    if (!selectedElectionId) {
      toast.error("Silakan pilih pemilihan");
      return;
    }
    
    if (!nik.trim() || nik.length !== 16) {
      toast.error("NIK harus 16 digit");
      return;
    }
    
    if (!fullName.trim()) {
      toast.error("Nama lengkap tidak boleh kosong");
      return;
    }
    
    try {
      setSubmitting(true);
      
      // Panggil fungsi registerVoter pada smart contract
      // Mengirim NIK dan nama langsung ke smart contract
      await contract.methods.registerVoter(
        selectedElectionId, 
        accounts[0], 
        fullName, 
        nik
      ).send({ from: accounts[0] });
      
      toast.success("Pendaftaran berhasil!");
      
      // Redirect ke halaman detail pemilihan
      navigate(`/elections/${selectedElectionId}`);
      
    } catch (error) {
      console.error("Error registering voter:", error);
      toast.error("Gagal mendaftar. Silakan coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };
  
  // Format tanggal
  const formatDate = (date) => {
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Render loading state
  if (loading) {
    return <LoadingSpinner message="Memuat data..." />;
  }
  
  // Render jika belum terhubung ke wallet
  if (!connected) {
    return (
      <div className="text-center py-10">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Pendaftaran Pemilih</h2>
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 p-4 rounded mb-6">
          <p className="mb-4">Silakan hubungkan wallet Ethereum Anda untuk mendaftar sebagai pemilih.</p>
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
  
  // Render jika tidak ada pemilihan yang tersedia
  if (elections.length === 0) {
    return (
      <div className="text-center py-10">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Pendaftaran Pemilih</h2>
        <div className="bg-gray-100 border border-gray-300 text-gray-700 p-4 rounded mb-6">
          <p>Tidak ada pemilihan yang tersedia untuk didaftar saat ini.</p>
          <p className="mt-2">Anda mungkin sudah terdaftar di semua pemilihan yang aktif.</p>
        </div>
        <Link to="/elections" className="text-blue-600 hover:underline">
          Lihat Daftar Pemilihan
        </Link>
      </div>
    );
  }
  
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Pendaftaran Pemilih</h1>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <form onSubmit={handleRegister}>
          {/* Pemilihan Pemilihan */}
          <div className="mb-6">
            <label htmlFor="election" className="block text-gray-700 font-medium mb-2">
              Pilih Pemilihan
            </label>
            <select
              id="election"
              value={selectedElectionId}
              onChange={(e) => setSelectedElectionId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">-- Pilih Pemilihan --</option>
              {elections.map(election => (
                <option key={election.id} value={election.id}>
                  {election.name}
                </option>
              ))}
            </select>
          </div>
          
          {/* Menampilkan detail pemilihan yang dipilih */}
          {selectedElection && (
            <div className="bg-gray-50 p-4 rounded-md mb-6">
              <h3 className="font-medium text-gray-800 mb-2">Detail Pemilihan</h3>
              <p className="text-gray-600 mb-2">{selectedElection.description}</p>
              <div className="grid md:grid-cols-2 gap-4 mt-3">
                <div>
                  <p className="text-sm text-gray-500">Waktu Mulai</p>
                  <p className="text-gray-800">{formatDate(selectedElection.startTime)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Waktu Berakhir</p>
                  <p className="text-gray-800">{formatDate(selectedElection.endTime)}</p>
                </div>
              </div>
              <div className="mt-3">
                <p className="text-sm text-gray-500">Status</p>
                <span className={`inline-block px-2 py-1 rounded text-sm font-medium ${
                  selectedElection.status === 'active' ? 'bg-green-100 text-green-800' :
                  selectedElection.status === 'upcoming' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {selectedElection.status === 'active' ? 'Aktif' :
                   selectedElection.status === 'upcoming' ? 'Akan Datang' :
                   'Berakhir'}
                </span>
              </div>
            </div>
          )}
          
          {/* Input NIK */}
          <div className="mb-6">
            <label htmlFor="nik" className="block text-gray-700 font-medium mb-2">
              NIK (Nomor Induk Kependudukan)
            </label>
            <input
              type="text"
              id="nik"
              value={nik}
              onChange={(e) => setNik(e.target.value.replace(/\D/g, '').slice(0, 16))}
              placeholder="Masukkan 16 digit NIK"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              maxLength="16"
            />
            <p className="text-sm text-gray-500 mt-1">
              NIK harus terdiri dari 16 digit angka
            </p>
          </div>
          
          {/* Input Nama Lengkap */}
          <div className="mb-6">
            <label htmlFor="fullName" className="block text-gray-700 font-medium mb-2">
              Nama Lengkap
            </label>
            <input
              type="text"
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Masukkan nama lengkap sesuai KTP"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          {/* Informasi Wallet */}
          <div className="bg-blue-50 p-4 rounded-md mb-6">
            <h3 className="font-medium text-blue-800 mb-2">Informasi Wallet</h3>
            <p className="text-sm text-blue-600">
              Alamat Wallet: {accounts[0]}
            </p>
            <p className="text-xs text-blue-500 mt-1">
              Alamat wallet ini akan digunakan sebagai identitas digital Anda dalam sistem voting.
            </p>
          </div>
          
          {/* Tombol Submit */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              type="submit"
              disabled={submitting || !selectedElectionId || !nik || !fullName}
              className={`flex-1 py-3 px-6 rounded-md font-medium transition duration-300 ${
                submitting || !selectedElectionId || !nik || !fullName
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {submitting ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Mendaftar...
                </div>
              ) : (
                'Daftar sebagai Pemilih'
              )}
            </button>
            
            <Link
              to="/elections"
              className="flex-1 py-3 px-6 text-center border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition duration-300"
            >
              Kembali ke Daftar Pemilihan
            </Link>
          </div>
        </form>
      </div>
      
      {/* Informasi Tambahan */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-medium text-yellow-800 mb-2">⚠️ Penting untuk Diketahui</h3>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• Pastikan NIK yang Anda masukkan valid dan benar</li>
          <li>• Nama lengkap harus sesuai dengan data KTP</li>
          <li>• Setelah terdaftar, Anda dapat memberikan suara pada waktu yang telah ditentukan</li>
          <li>• Satu wallet hanya dapat digunakan untuk satu pendaftaran per pemilihan</li>
          <li>• Proses pendaftaran akan dicatat dalam blockchain dan tidak dapat diubah</li>
        </ul>
      </div>
    </div>
  );
};

export default RegisterVoter;