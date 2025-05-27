import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { Web3Context } from '../contexts/Web3Context.js';

const Navbar = () => {
  // Gunakan nilai default jika context adalah null
  const context = useContext(Web3Context);
  
  // Jika context null, gunakan nilai default
  const { connected = false, accounts = [] } = context || {};
  
  // Fungsi connectWallet yang aman
  const connectWallet = context?.connectWallet || (() => {
    console.error("Web3Context tidak tersedia. Periksa Provider.");
    alert("Tidak dapat terhubung ke wallet. Silahkan muat ulang halaman.");
  });

  return (
    <nav className="bg-blue-800 text-white shadow-lg w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link to="/" className="text-xl font-bold hover:text-blue-200 transition-colors">
              🗳️ Sistem Voting Blockchain
            </Link>
          </div>
          
          <div className="hidden md:flex items-center space-x-6">
            <Link 
              to="/elections" 
              className="hover:text-blue-200 transition-colors font-medium"
            >
              Pemilihan
            </Link>
            <Link 
              to="/create-election" 
              className="hover:text-blue-200 transition-colors font-medium"
            >
              Buat Pemilihan
            </Link>
            <Link 
              to="/my-votes" 
              className="hover:text-blue-200 transition-colors font-medium"
            >
              Suara Saya
            </Link>
            
            {!connected ? (
              <button 
                onClick={connectWallet}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Hubungkan Wallet
              </button>
            ) : (
              <div className="bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium">
                <span className="text-blue-200">🔗</span>
                {accounts[0].substring(0, 6)}...{accounts[0].substring(accounts[0].length - 4)}
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button className="text-white hover:text-blue-200">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;