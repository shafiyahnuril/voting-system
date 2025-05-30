// src/pages/CreateElection.js - Fixed dengan timeout dan error handling yang lebih baik

import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Web3Context } from '../contexts/Web3Context.js';
import { toast } from 'react-toastify';
import LoadingSpinner from '../components/LoadingSpinner.js';

const CreateElection = () => {
  const navigate = useNavigate();
  const { contract, accounts, connected, connectWallet, web3 } = useContext(Web3Context);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    candidates: [
      { name: '', details: '' },
      { name: '', details: '' }
    ]
  });
  
  const [submitting, setSubmitting] = useState(false);
  const [transactionHash, setTransactionHash] = useState(null);
  const [currentStep, setCurrentStep] = useState('idle'); // idle, creating, adding-candidates, completed

  // Debug effect
  useEffect(() => {
    console.log('=== DEBUG CONTRACT INFO ===');
    console.log('Connected:', connected);
    console.log('Accounts:', accounts);
    console.log('Web3:', !!web3);
    console.log('Contract:', !!contract);
    
    if (contract) {
      console.log('Contract methods:', Object.keys(contract.methods || {}));
      console.log('Contract address:', contract.options?.address);
      console.log('createElection method exists:', typeof contract.methods?.createElection === 'function');
    }
  }, [contract, connected, accounts, web3]);

  // Handler perubahan form
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handler perubahan data kandidat
  const handleCandidateChange = (index, e) => {
    const { name, value } = e.target;
    const newCandidates = [...formData.candidates];
    newCandidates[index] = {
      ...newCandidates[index],
      [name]: value
    };
    
    setFormData(prev => ({
      ...prev,
      candidates: newCandidates
    }));
  };
  
  // Menambah kandidat baru
  const addCandidate = () => {
    setFormData(prev => ({
      ...prev,
      candidates: [...prev.candidates, { name: '', details: '' }]
    }));
  };
  
  // Menghapus kandidat
  const removeCandidate = (index) => {
    if (formData.candidates.length <= 2) {
      toast.warning("Minimal harus ada 2 kandidat");
      return;
    }
    
    const newCandidates = formData.candidates.filter((_, i) => i !== index);
    setFormData(prev => ({
      ...prev,
      candidates: newCandidates
    }));
  };

  // Function untuk reset state
  const resetSubmissionState = () => {
    setSubmitting(false);
    setTransactionHash(null);
    setCurrentStep('idle');
  };

  // Function untuk create election dengan timeout
  const createElectionWithTimeout = async (electionData) => {
    return new Promise(async (resolve, reject) => {
      let timeoutId;
      let resolved = false;

      // Set timeout 60 detik
      timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error('Transaction timeout after 60 seconds'));
        }
      }, 60000);

      try {
        console.log('🔄 Starting createElection transaction...');
        setCurrentStep('creating');

        // Estimate gas first
        const gasEstimate = await contract.methods
          .createElection(
            electionData.name,
            electionData.description,
            electionData.startTime,
            electionData.endTime
          )
          .estimateGas({ from: accounts[0] });

        console.log('⛽ Gas estimate:', gasEstimate);

        // Send transaction dengan event handlers
        contract.methods
          .createElection(
            electionData.name,
            electionData.description,
            electionData.startTime,
            electionData.endTime
          )
          .send({ 
            from: accounts[0],
            gas: Math.floor(gasEstimate * 1.5) // 50% buffer
          })
          .on('transactionHash', (hash) => {
            console.log('📤 Transaction sent:', hash);
            setTransactionHash(hash);
            toast.info(`Transaction sent: ${hash.substring(0, 10)}...`);
          })
          .on('receipt', (receipt) => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeoutId);
              console.log('✅ Transaction confirmed:', receipt);
              resolve(receipt);
            }
          })
          .on('error', (error) => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeoutId);
              console.error('❌ Transaction error:', error);
              reject(error);
            }
          });

      } catch (error) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          reject(error);
        }
      }
    });
  };

  // Function untuk add candidates dengan timeout
  const addCandidatesWithTimeout = async (electionId, candidates) => {
    setCurrentStep('adding-candidates');
    
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      console.log(`🔄 Adding candidate ${i + 1}/${candidates.length}:`, candidate.name);
      
      try {
        // Timeout per kandidat 30 detik
        const candidatePromise = new Promise(async (resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error(`Timeout adding candidate: ${candidate.name}`));
          }, 30000);

          try {
            const gasEstimate = await contract.methods
              .addCandidate(electionId, candidate.name, candidate.details)
              .estimateGas({ from: accounts[0] });

            const result = await contract.methods
              .addCandidate(electionId, candidate.name, candidate.details)
              .send({ 
                from: accounts[0],
                gas: Math.floor(gasEstimate * 1.2)
              });

            clearTimeout(timeoutId);
            resolve(result);
          } catch (error) {
            clearTimeout(timeoutId);
            reject(error);
          }
        });

        await candidatePromise;
        console.log(`✅ Candidate ${i + 1} added successfully`);
        
        // Update progress
        toast.info(`Kandidat ${i + 1}/${candidates.length} berhasil ditambahkan`);
        
      } catch (error) {
        console.error(`❌ Error adding candidate ${i + 1}:`, error);
        throw new Error(`Gagal menambahkan kandidat: ${candidate.name}`);
      }
    }
  };
  
  // Menangani submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validasi form
    if (!formData.name.trim()) {
      toast.error("Nama pemilihan tidak boleh kosong");
      return;
    }
    
    if (!formData.description.trim()) {
      toast.error("Deskripsi pemilihan tidak boleh kosong");
      return;
    }
    
    if (!formData.startDate || !formData.startTime || !formData.endDate || !formData.endTime) {
      toast.error("Waktu mulai dan berakhir harus diisi");
      return;
    }
    
    // Validasi kandidat
    for (const candidate of formData.candidates) {
      if (!candidate.name.trim() || !candidate.details.trim()) {
        toast.error("Data kandidat harus lengkap");
        return;
      }
    }
    
    // Validasi waktu pemilihan
    const startTimestamp = Math.floor(new Date(`${formData.startDate}T${formData.startTime}`).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(`${formData.endDate}T${formData.endTime}`).getTime() / 1000);
    const now = Math.floor(Date.now() / 1000);
    
    if (startTimestamp <= now) {
      toast.error("Waktu mulai harus di masa depan");
      return;
    }
    
    if (endTimestamp <= startTimestamp) {
      toast.error("Waktu berakhir harus setelah waktu mulai");
      return;
    }

    // Validate contract
    if (!contract || !contract.methods?.createElection) {
      toast.error("Contract tidak tersedia atau tidak valid. Silakan refresh halaman.");
      console.error('Contract validation failed:', {
        contract: !!contract,
        methods: !!contract?.methods,
        createElection: !!contract?.methods?.createElection
      });
      return;
    }
    
    try {
      setSubmitting(true);
      
      const electionData = {
        name: formData.name,
        description: formData.description,
        startTime: startTimestamp,
        endTime: endTimestamp
      };
      
      console.log('📋 Creating election with data:', electionData);
      
      // Step 1: Create election with timeout
      const createElectionTx = await createElectionWithTimeout(electionData);
      console.log('✅ Election created:', createElectionTx.transactionHash);
      
      // Get election ID dari event atau fallback
      let electionId = null;
      if (createElectionTx.events?.ElectionCreated) {
        electionId = createElectionTx.events.ElectionCreated.returnValues.electionId;
        console.log('📍 Election ID from event:', electionId);
      } else {
        // Fallback: get election count
        const electionCount = await contract.methods.electionCount().call();
        electionId = electionCount;
        console.log('📍 Election ID from count:', electionId);
      }
      
      if (!electionId) {
        throw new Error("Gagal mendapatkan ID pemilihan");
      }
      
      // Step 2: Add candidates with timeout
      await addCandidatesWithTimeout(electionId, formData.candidates);
      
      setCurrentStep('completed');
      toast.success("Pemilihan dan kandidat berhasil dibuat!");
      
      // Redirect ke halaman detail pemilihan
      setTimeout(() => {
        navigate(`/elections/${electionId}`);
      }, 2000);
      
    } catch (error) {
      console.error("❌ Error creating election:", error);
      resetSubmissionState();
      
      // Handle specific errors
      if (error.message.includes('timeout')) {
        toast.error("Transaksi timeout. Silakan coba lagi atau periksa koneksi Ganache.");
      } else if (error.message.includes('User denied')) {
        toast.error("Transaksi dibatalkan oleh pengguna");
      } else if (error.message.includes('revert')) {
        if (error.message.includes('Only creator')) {
          toast.error("Hanya pembuat pemilihan yang dapat menambah kandidat");
        } else if (error.message.includes('Invalid time')) {
          toast.error("Waktu pemilihan tidak valid");
        } else {
          toast.error("Transaksi ditolak oleh smart contract");
        }
      } else if (error.message.includes('gas')) {
        toast.error("Gas tidak cukup. Periksa balance atau tingkatkan gas limit.");
      } else {
        toast.error(error.message || "Gagal membuat pemilihan. Silakan coba lagi.");
      }
    }
  };

  // Function untuk cancel/reset
  const handleCancel = () => {
    if (submitting) {
      resetSubmissionState();
      toast.info("Proses pembuatan pemilihan dibatalkan");
    }
  };
  
  // Render jika belum terhubung ke wallet
  if (!connected) {
    return (
      <div className="text-center py-10">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Buat Pemilihan Baru</h2>
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 p-4 rounded mb-6">
          <p className="mb-4">Silakan hubungkan wallet Ethereum Anda untuk membuat pemilihan baru.</p>
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
  
  // Render loading state dengan detail progress
  if (submitting) {
    return (
      <div className="max-w-2xl mx-auto py-10">
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="mb-6">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            
            {currentStep === 'creating' && (
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Membuat Pemilihan...</h3>
                <p className="text-gray-600 mb-4">Sedang memproses transaksi di blockchain</p>
              </div>
            )}
            
            {currentStep === 'adding-candidates' && (
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Menambahkan Kandidat...</h3>
                <p className="text-gray-600 mb-4">Menambahkan {formData.candidates.length} kandidat ke pemilihan</p>
              </div>
            )}
            
            {currentStep === 'completed' && (
              <div>
                <h3 className="text-xl font-bold text-green-800 mb-2">Berhasil!</h3>
                <p className="text-gray-600 mb-4">Mengalihkan ke halaman pemilihan...</p>
              </div>
            )}
          </div>
          
          {transactionHash && (
            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <p className="text-sm text-blue-800">
                Transaction Hash: 
                <span className="font-mono text-xs block mt-1">
                  {transactionHash}
                </span>
              </p>
            </div>
          )}
          
          <div className="text-sm text-gray-500 mb-4">
            Proses ini mungkin membutuhkan waktu 1-2 menit...
          </div>
          
          <button
            onClick={handleCancel}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded transition duration-300"
          >
            Batalkan
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Buat Pemilihan Baru</h1>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <form onSubmit={handleSubmit}>
          {/* Informasi Dasar */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Informasi Dasar</h2>
            
            <div className="mb-4">
              <label htmlFor="name" className="block text-gray-700 font-medium mb-2">
                Nama Pemilihan
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Contoh: Pemilihan Ketua OSIS 2025"
                required
              />
            </div>
            
            <div className="mb-4">
              <label htmlFor="description" className="block text-gray-700 font-medium mb-2">
                Deskripsi Pemilihan
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="4"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Jelaskan tentang pemilihan ini..."
                required
              ></textarea>
            </div>
          </div>
          
          {/* Waktu Pemilihan */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Waktu Pemilihan</h2>
            
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div>
                <label htmlFor="startDate" className="block text-gray-700 font-medium mb-2">
                  Tanggal Mulai
                </label>
                <input
                  type="date"
                  id="startDate"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="startTime" className="block text-gray-700 font-medium mb-2">
                  Waktu Mulai
                </label>
                <input
                  type="time"
                  id="startTime"
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="endDate" className="block text-gray-700 font-medium mb-2">
                  Tanggal Berakhir
                </label>
                <input
                  type="date"
                  id="endDate"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="endTime" className="block text-gray-700 font-medium mb-2">
                  Waktu Berakhir
                </label>
                <input
                  type="time"
                  id="endTime"
                  name="endTime"
                  value={formData.endTime}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
          </div>
          
          {/* Kandidat */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">Kandidat</h2>
              <button
                type="button"
                onClick={addCandidate}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition duration-300"
              >
                + Tambah Kandidat
              </button>
            </div>
            
            {formData.candidates.map((candidate, index) => (
              <div key={index} className="bg-gray-50 p-4 rounded-md mb-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-medium text-gray-800">Kandidat #{index + 1}</h3>
                  <button
                    type="button"
                    onClick={() => removeCandidate(index)}
                    className="text-red-600 hover:text-red-800 text-sm"
                    disabled={formData.candidates.length <= 2}
                  >
                    Hapus
                  </button>
                </div>
                
                <div className="mb-3">
                  <label htmlFor={`candidate-name-${index}`} className="block text-gray-700 text-sm font-medium mb-1">
                    Nama Kandidat
                  </label>
                  <input
                    type="text"
                    id={`candidate-name-${index}`}
                    name="name"
                    value={candidate.name}
                    onChange={(e) => handleCandidateChange(index, e)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nama kandidat"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor={`candidate-details-${index}`} className="block text-gray-700 text-sm font-medium mb-1">
                    Detail Kandidat
                  </label>
                  <textarea
                    id={`candidate-details-${index}`}
                    name="details"
                    value={candidate.details}
                    onChange={(e) => handleCandidateChange(index, e)}
                    rows="2"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Deskripsi, visi misi, atau informasi tambahan tentang kandidat"
                    required
                  ></textarea>
                </div>
              </div>
            ))}
          </div>
          
          {/* Submit Button */}
          <div className="flex justify-center mt-8">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition duration-300"
              disabled={submitting}
            >
              {submitting ? 'Memproses...' : 'Buat Pemilihan'}
            </button>
          </div>
        </form>
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-bold text-blue-800 mb-2">Informasi Penting</h3>
        <ul className="list-disc pl-5 text-blue-700">
          <li className="mb-1">Pembuatan pemilihan memerlukan beberapa transaksi blockchain.</li>
          <li className="mb-1">Proses dapat memakan waktu 1-2 menit untuk selesai.</li>
          <li className="mb-1">Jangan tutup browser selama proses berlangsung.</li>
          <li className="mb-1">Pastikan MetaMask terhubung dan memiliki cukup ETH untuk gas.</li>
          <li className="mb-1">Setelah dibuat, detail dasar tidak dapat diubah.</li>
        </ul>
      </div>
    </div>
  );
};

export default CreateElection;