// src/App.js - Komponen utama aplikasi

import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Import komponen halaman
import Navbar from './components/Navbar.js';
import Home from './pages/Home.js';
import ElectionList from './pages/ElectionList.js';
import ElectionDetails from './pages/ElectionDetails.js';
import CreateElection from './pages/CreateElection.js';
import RegisterVoter from './pages/RegisterVoter.js';
import MyVotes from './pages/MyVotes.js';
import ElectionResults from './pages/ElectionResults.js';
import Footer from './components/Footer.js';

function App() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/elections" element={<ElectionList />} />
          <Route path="/elections/:id" element={<ElectionDetails />} />
          <Route path="/create-election" element={<CreateElection />} />
          <Route path="/register" element={<RegisterVoter />} />
          <Route path="/my-votes" element={<MyVotes />} />
          <Route path="/results/:id" element={<ElectionResults />} />
        </Routes>
      </main>
      <Footer />
      <ToastContainer position="bottom-right" />
    </div>
  );
}

export default App;