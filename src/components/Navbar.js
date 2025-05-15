import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { Web3Context } from '../contexts/Web3Context.js';

const Navbar = () => {
  const { connected, connectWallet, accounts } = useContext(Web3Context);

  return (
    <nav className="bg-blue-800 text-white shadow-lg">
      <div className="container mx-auto px-4 py-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <Link to="/" className="text-xl font-bold">Sistem Voting</Link>
          </div>
          
          <div className="flex items-center space-x-4">
            <Link to="/elections" className="hover:text-blue-200">Pemilihan</Link>
            <Link to="/create-election" className="hover:text-blue-200">Buat Pemilihan</Link>
            <Link to="/my-votes" className="hover:text-blue-200">Suara Saya</Link>
            
            {!connected ? (
              <button 
                onClick={connectWallet}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
              >
                Hubungkan Wallet
              </button>
            ) : (
              <div className="text-sm bg-blue-700 px-3 py-1 rounded">
                {accounts[0].substring(0, 6)}...{accounts[0].substring(accounts[0].length - 4)}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;