import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-gray-800 text-white py-6">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <h3 className="text-lg font-bold">Sistem Voting Blockchain</h3>
            <p className="text-gray-400">Solusi voting yang aman dan transparan.</p>
          </div>
          
          <div className="flex flex-col text-center md:text-right">
            <p className="text-gray-400">© {new Date().getFullYear()} Blockchain Voting System</p>
            <p className="text-sm text-gray-500">Dibangun dengan React dan Ethereum</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;