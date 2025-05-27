import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-gray-800 text-white py-8 w-full mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Brand Section */}
          <div>
            <h3 className="text-xl font-bold mb-4">🗳️ Sistem Voting Blockchain</h3>
            <p className="text-gray-400 mb-4">
              Platform voting terdesentralisasi yang aman, transparan, dan terverifikasi menggunakan teknologi blockchain.
            </p>
          </div>
          
          {/* Links Section */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Navigasi</h4>
            <ul className="space-y-2">
              <li>
                <a href="/elections" className="text-gray-400 hover:text-white transition-colors">
                  Daftar Pemilihan
                </a>
              </li>
              <li>
                <a href="/create-election" className="text-gray-400 hover:text-white transition-colors">
                  Buat Pemilihan
                </a>
              </li>
              <li>
                <a href="/register" className="text-gray-400 hover:text-white transition-colors">
                  Daftar Pemilih
                </a>
              </li>
              <li>
                <a href="/my-votes" className="text-gray-400 hover:text-white transition-colors">
                  Riwayat Suara
                </a>
              </li>
            </ul>
          </div>
          
          {/* Info Section */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Teknologi</h4>
            <ul className="space-y-2 text-gray-400">
              <li>⚡ React.js Frontend</li>
              <li>🔗 Ethereum Blockchain</li>
              <li>🛡️ Smart Contracts</li>
              <li>🎨 Tailwind CSS</li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-gray-700 mt-8 pt-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">
              © {new Date().getFullYear()} Blockchain Voting System. Dibangun dengan teknologi Web3.
            </p>
            <div className="flex space-x-4 mt-4 md:mt-0">
              <span className="text-gray-400 text-sm">
                🌐 Terdesentralisasi & Open Source
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;