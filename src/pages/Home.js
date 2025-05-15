// src/pages/Home.js - Halaman beranda sistem voting

import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { Web3Context } from '../contexts/Web3Context.js';

const Home = () => {
  const { connected, connectWallet, accounts, networkName } = useContext(Web3Context);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-blue-800 mb-4">
          Sistem Voting Blockchain
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Platform voting terdesentralisasi yang aman, transparan, dan terverifikasi
        </p>

        {!connected ? (
          <button
            onClick={connectWallet}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition duration-300"
          >
            Hubungkan Wallet
          </button>
        ) : (
          <div className="bg-green-100 border border-green-300 rounded-lg p-4 inline-block">
            <p className="text-green-700">
              <span className="font-medium">Status: </span>Terhubung ke {networkName}
            </p>
            <p className="text-green-700 text-sm truncate">
              <span className="font-medium">Alamat: </span>
              {accounts[0]}
            </p>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-12">
        <FeatureCard
          title="Transparan & Terverifikasi"
          description="Semua suara dicatat di blockchain dan dapat diverifikasi oleh siapa saja, memastikan integritas pemilihan."
          icon="🔍"
        />
        <FeatureCard
          title="Satu Orang, Satu Suara"
          description="Sistem verifikasi identity memastikan setiap orang hanya dapat memberikan satu suara, mencegah kecurangan."
          icon="👤"
        />
        <FeatureCard
          title="Terdesentralisasi"
          description="Tidak ada otoritas tunggal yang mengontrol sistem, mengurangi risiko manipulasi atau penyensoran."
          icon="🌐"
        />
        <FeatureCard
          title="Aman & Pribadi"
          description="Keamanan kriptografi memastikan keamanan suara Anda, sementara identitas tetap terverifikasi namun terlindungi."
          icon="🔒"
        />
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-12">
        <ActionCard
          title="Lihat Pemilihan"
          description="Jelajahi pemilihan yang sedang berlangsung dan yang akan datang."
          buttonText="Daftar Pemilihan"
          link="/elections"
          color="blue"
        />
        <ActionCard
          title="Daftar untuk Memilih"
          description="Verifikasi identitas Anda untuk berpartisipasi dalam pemilihan."
          buttonText="Daftar Sekarang"
          link="/register"
          color="green"
        />
        <ActionCard
          title="Lihat Hasil"
          description="Lihat hasil pemilihan yang telah selesai dengan transparansi penuh."
          buttonText="Lihat Hasil"
          link="/elections"
          color="purple"
        />
      </div>

      <div className="bg-gray-100 rounded-lg p-6 shadow-md">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Bagaimana Cara Kerjanya?</h2>
        <ol className="list-decimal pl-6 space-y-3">
          <li className="text-gray-700">
            <span className="font-medium">Hubungkan Wallet:</span> Pertama, hubungkan MetaMask atau wallet Ethereum lainnya.
          </li>
          <li className="text-gray-700">
            <span className="font-medium">Verifikasi Identitas:</span> Daftarkan dan verifikasi identitas Anda melalui oracle keamanan kami.
          </li>
          <li className="text-gray-700">
            <span className="font-medium">Mendaftar untuk Pemilihan:</span> Pilih pemilihan yang ingin Anda ikuti dan daftar.
          </li>
          <li className="text-gray-700">
            <span className="font-medium">Berikan Suara:</span> Pilih kandidat dan konfirmasi suara Anda melalui blockchain.
          </li>
          <li className="text-gray-700">
            <span className="font-medium">Verifikasi Hasil:</span> Semua suara dapat diverifikasi pada blockchain, memastikan transparansi.
          </li>
        </ol>
      </div>
    </div>
  );
};

// Komponen kartu fitur
const FeatureCard = ({ title, description, icon }) => (
  <div className="bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition duration-300">
    <div className="text-4xl mb-4">{icon}</div>
    <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
    <p className="text-gray-600">{description}</p>
  </div>
);

// Komponen kartu aksi
const ActionCard = ({ title, description, buttonText, link, color }) => {
  const colorClasses = {
    blue: "bg-blue-600 hover:bg-blue-700",
    green: "bg-green-600 hover:bg-green-700",
    purple: "bg-purple-600 hover:bg-purple-700",
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow-md flex flex-col">
      <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
      <p className="text-gray-600 mb-4 flex-grow">{description}</p>
      <Link
        to={link}
        className={`${colorClasses[color]} text-white font-bold py-2 px-4 rounded text-center transition duration-300`}
      >
        {buttonText}
      </Link>
    </div>
  );
};

export default Home;