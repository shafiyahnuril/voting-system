import React, { useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import { Web3Context } from '../contexts/Web3Context.js';

const Navbar = () => {
  const context = useContext(Web3Context);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  
  // Provide fallback values jika context null
  const { 
    connected = false, 
    accounts = [], 
    loading = false,
    connectWallet = () => console.error("Web3Context not available"),
    disconnectWallet = () => console.error("Disconnect not available"), // 🆕
    networkName = '',
    isCorrectNetwork = false,
    hasMetaMask = false
  } = context || {};

  const handleConnectWallet = async () => {
    if (!hasMetaMask) {
      alert('MetaMask tidak terdeteksi! Silakan install MetaMask terlebih dahulu.');
      window.open('https://metamask.io/', '_blank');
      return;
    }
    
    try {
      await connectWallet();
    } catch (error) {
      console.error('Connection error in Navbar:', error);
    }
  };

  const handleDisconnectWallet = async () => {
    try {
      await disconnectWallet();
      setShowAccountMenu(false); // Close menu after disconnect
    } catch (error) {
      console.error('Disconnect error in Navbar:', error);
    }
  };

  const toggleAccountMenu = () => {
    setShowAccountMenu(!showAccountMenu);
  };

  const copyAddress = () => {
    if (accounts[0]) {
      navigator.clipboard.writeText(accounts[0]);
      alert('Address copied to clipboard!');
    }
  };

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
            
            {/* Connection Status */}
            <div className="flex items-center space-x-3">
              {!connected ? (
                <button 
                  onClick={handleConnectWallet}
                  disabled={loading}
                  className={`font-medium px-4 py-2 rounded-lg transition-colors ${
                    loading 
                      ? 'bg-gray-500 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {loading ? (
                    <div className="flex items-center">
                      <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                      </svg>
                      Menghubungkan...
                    </div>
                  ) : (
                    <>
                      🔗 Hubungkan Wallet
                    </>
                  )}
                </button>
              ) : (
                <div className="flex items-center space-x-2">
                  {/* Network Status */}
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    isCorrectNetwork 
                      ? 'bg-green-100 text-green-800 border border-green-200' 
                      : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                  }`}>
                    {networkName}
                  </div>
                  
                  {/* Account Menu */}
                  <div className="relative">
                    <button
                      onClick={toggleAccountMenu}
                      className="bg-blue-700 hover:bg-blue-600 px-4 py-2 rounded-lg text-sm font-medium flex items-center transition-colors"
                    >
                      <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                      <span className="font-mono">
                        {accounts[0]?.substring(0, 6)}...{accounts[0]?.substring(accounts[0].length - 4)}
                      </span>
                      <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Dropdown Menu */}
                    {showAccountMenu && (
                      <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                        <div className="py-2">
                          {/* Account Info */}
                          <div className="px-4 py-2 border-b border-gray-100">
                            <p className="text-sm font-medium text-gray-900">Connected Account</p>
                            <p className="text-xs text-gray-500 font-mono break-all">
                              {accounts[0]}
                            </p>
                          </div>
                          
                          {/* Menu Items */}
                          <button
                            onClick={copyAddress}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                          >
                            <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copy Address
                          </button>
                          
                          <Link
                            to="/my-votes"
                            onClick={() => setShowAccountMenu(false)}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                          >
                            <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2m-5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v1h6z" />
                            </svg>
                            Riwayat Voting
                          </Link>
                          
                          <div className="border-t border-gray-100 mt-1">
                            <button
                              onClick={handleDisconnectWallet}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
                            >
                              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                              </svg>
                              Disconnect Wallet
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* MetaMask Status Indicator */}
              {!hasMetaMask && (
                <div className="text-red-300 text-sm">
                  ⚠️ MetaMask Required
                </div>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center space-x-2">
            {connected ? (
              <div className="flex items-center space-x-2">
                <div className="text-xs font-mono">
                  {accounts[0]?.substring(0, 6)}...
                </div>
                <button 
                  onClick={handleDisconnectWallet}
                  className="bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-xs"
                  title="Disconnect"
                >
                  ⏻
                </button>
              </div>
            ) : (
              <button 
                onClick={handleConnectWallet}
                className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm"
              >
                Connect
              </button>
            )}
            
            <button className="text-white hover:text-blue-200">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Warning banner for wrong network */}
        {connected && !isCorrectNetwork && (
          <div className="bg-yellow-600 px-4 py-2 text-sm">
            ⚠️ Silakan switch ke Ganache Local network (Chain ID: 5777) untuk development
          </div>
        )}
      </div>

      {/* Click outside to close menu */}
      {showAccountMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowAccountMenu(false)}
        ></div>
      )}
    </nav>
  );
};

export default Navbar;