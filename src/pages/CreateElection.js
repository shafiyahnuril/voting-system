// src/pages/CreateElection.js - Halaman untuk membuat pemilihan baru

import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Web3Context } from '../contexts/Web3Context.js';
import { toast } from 'react-toastify';
import LoadingSpinner from '../components/LoadingSpinner.js';

const CreateElection = () => {
  const navigate = useNavigate();
  const { contract, accounts, connected, connectWallet } = useContext(Web3Context);
  
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
    
    try {
      setSubmitting(true);
      
      // Membuat pemilihan baru
      const tx = await contract.methods.createElection(
        formData.name,
        formData.description,
        startTimestamp,
        endTimestamp,
        formData.candidates.map(c => c.name),
        formData.candidates.map(c => c.details)
      ).send({ from: accounts[0] });
      
      console.log("Election created:", tx);
      
      // Mendapatkan ID pemilihan yang baru dibuat dari event
      let electionId = null;
      if (tx.events && tx.events.ElectionCreated) {
        electionId = tx.events.ElectionCreated.returnValues.electionId;
      }
      
      toast.success("Pemilihan berhasil dibuat!");
      
      // Redirect ke halaman detail atau daftar pemilihan
      if (electionId) {
        navigate(`/elections/${electionId}`);
      } else {
        navigate("/elections");
      }
      
    } catch (error) {
      console.error("Error creating election:", error);
      toast.error("Gagal membuat pemilihan. Silakan coba lagi.");
    } finally {
      setSubmitting(false);
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
  
  // Render loading state saat transaksi sedang diproses
  if (submitting) {
    return <LoadingSpinner message="Membuat pemilihan baru..." />;
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
          <li className="mb-1">Pembuatan pemilihan akan memerlukan transaksi blockchain dan biaya gas.</li>
          <li className="mb-1">Setelah dibuat, detail dasar pemilihan tidak dapat diubah.</li>
          <li className="mb-1">Anda akan menjadi admin pemilihan dan dapat mengelola pemilihan tersebut.</li>
          <li className="mb-1">Pastikan informasi yang dimasukkan sudah benar sebelum membuat pemilihan.</li>
        </ul>
      </div>
    </div>
  );
};

export default CreateElection;