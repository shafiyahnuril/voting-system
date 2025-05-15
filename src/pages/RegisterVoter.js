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
  
  const { contract, accounts, connected, connectWallet } = useContext(Web3Context);
  
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
      
      // Hash NIK dan nama untuk verifikasi identitas (simulasi)
      // Dalam implementasi nyata, verifikasi identitas seharusnya dilakukan secara lebih aman
      const hashedId = web3.utils.soliditySha3(nik, fullName);
      
      // Panggil fungsi registerVoter pada smart contract
      await contract.methods.registerVoter(selectedElectionId, hashedId)
        .send({ from: accounts[0] });
      
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
    <div>
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
            </div>
          )}
          
          {/* Data Pemilih */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Data Pemilih</h2>
            
            <div className="mb-4">
              <label htmlFor="nik" className="block text-gray-700 font-medium mb-2">
                NIK (Nomor Induk Kependudukan)
              </label>
              <input
                type="text"
                id="nik"
                value={nik}
                onChange={(e) => setNik(e.target.value.replace(/\D/g, '').slice(0, 16))}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="16 digit NIK"
                maxLength="16"
                pattern="\d{16}"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                {nik.length}/16 digit
              </p>
            </div>
            
            <div className="mb-4">
              <label htmlFor="fullName" className="block text-gray-700 font-medium mb-2">
                Nama Lengkap
              </label>
              <input
                type="text"
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Sesuai dengan KTP"
                required
              />
            </div>
          </div>
          
          {/* Submit Button */}
          <div className="flex justify-center mt-8">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition duration-300"
              disabled={submitting}
            >
              {submitting ? 'Memproses...' : 'Daftar Sebagai Pemilih'}
            </button>
          </div>
        </form>
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-bold text-blue-800 mb-2">Informasi Penting</h3>
        <ul className="list-disc pl-5 text-blue-700">
          <li className="mb-1">Pendaftaran pemilih akan memerlukan transaksi blockchain dan biaya gas.</li>
          <li className="mb-1">Data identitas Anda akan di-hash dan disimpan dalam blockchain untuk verifikasi.</li>
          <li className="mb-1">Setiap alamat wallet hanya dapat mendaftar sekali untuk setiap pemilihan.</li>
          <li className="mb-1">Pastikan informasi yang dimasukkan sudah benar sebelum mendaftar.</li>
        </ul>
      </div>
    </div>
  );
};

export default RegisterVoter;