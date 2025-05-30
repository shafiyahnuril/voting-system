// src/components/LogoutButton.js - Standalone logout component

import React, { useContext, useState } from 'react';
import { Web3Context } from '../contexts/Web3Context.js';

const LogoutButton = ({ 
  className = "bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors",
  children = "Disconnect Wallet",
  showConfirmation = true,
  onDisconnect = null
}) => {
  const { disconnectWallet, connected } = useContext(Web3Context);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    if (showConfirmation) {
      setShowModal(true);
    } else {
      await performLogout();
    }
  };

  const performLogout = async () => {
    try {
      setLoading(true);
      await disconnectWallet();
      
      // Call optional callback
      if (onDisconnect) {
        onDisconnect();
      }
      
      setShowModal(false);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Don't render if not connected
  if (!connected) {
    return null;
  }

  return (
    <>
      <button
        onClick={handleLogout}
        disabled={loading}
        className={`${className} ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {loading ? (
          <div className="flex items-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Disconnecting...
          </div>
        ) : (
          children
        )}
      </button>

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">
                  Disconnect Wallet?
                </h3>
              </div>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-500">
                Apakah Anda yakin ingin memutus koneksi wallet? Anda perlu menghubungkan kembali untuk menggunakan fitur voting.
              </p>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={performLogout}
                disabled={loading}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Disconnecting...' : 'Ya, Disconnect'}
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded text-sm font-medium transition-colors"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LogoutButton;