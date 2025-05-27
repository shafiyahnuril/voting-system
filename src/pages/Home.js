// src/pages/Home.js - Halaman beranda sistem voting dengan layout full screen

import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { Web3Context } from '../contexts/Web3Context.js';

const Home = () => {
  const { connected, connectWallet, accounts, networkName } = useContext(Web3Context);

  return (
    <div className="w-full">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-blue-600 to-purple-700 text-white py-20 -mx-4 sm:-mx-6 lg:-mx-8 mb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            🗳️ Sistem Voting Blockchain
          </h1>
          <p className="text-xl md:text-2xl text-blue-100 mb-8 max-w-3xl mx-auto">
            Platform voting terdesentralisasi yang aman, transparan, dan terverifikasi dengan teknologi blockchain terdepan
          </p>

          {!connected ? (
            <button
              onClick={connectWallet}
              className="bg-white text-blue-600 hover:bg-blue-50 font-bold py-4 px-8 rounded-xl shadow-lg transition duration-300 text-lg"
            >
              🔗 Hubungkan Wallet untuk Memulai
            </button>
          ) : (
            <div className="bg-green-500 border border-green-400 rounded-xl p-6 inline-block max-w-md mx-auto">
              <p className="text-green-100 mb-2">
                <span className="font-medium">✅ Status: </span>Terhubung ke {networkName}
              </p>
              <p className="text-green-100 text-sm font-mono bg-green-600 px-3 py-1 rounded">
                {accounts[0]}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Features Section */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">
          Mengapa Memilih Sistem Voting Blockchain?
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <FeatureCard
            title="🔍 Transparan & Terverifikasi"
            description="Semua suara dicatat di blockchain dan dapat diverifikasi oleh siapa saja, memastikan integritas pemilihan tanpa kompromi."
            gradient="from-blue-500 to-cyan-500"
          />
          <FeatureCard
            title="👤 Satu Orang, Satu Suara"
            description="Sistem verifikasi identitas yang canggih memastikan setiap orang hanya dapat memberikan satu suara, mencegah kecurangan."
            gradient="from-green-500 to-emerald-500"
          />
          <FeatureCard
            title="🌐 Terdesentralisasi"
            description="Tidak ada otoritas tunggal yang mengontrol sistem, mengurangi risiko manipulasi atau penyensoran secara signifikan."
            gradient="from-purple-500 to-indigo-500"
          />
          <FeatureCard
            title="🔒 Aman & Pribadi"
            description="Keamanan kriptografi tingkat militer memastikan keamanan suara Anda, sementara identitas tetap terverifikasi namun terlindungi."
            gradient="from-red-500 to-pink-500"
          />
        </div>
      </div>

      {/* Action Cards Section */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">
          Mulai Berpartisipasi Sekarang
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <ActionCard
            title="📋 Lihat Pemilihan"
            description="Jelajahi pemilihan yang sedang berlangsung dan yang akan datang. Temukan pemilihan yang ingin Anda ikuti."
            buttonText="Daftar Pemilihan"
            link="/elections"
            gradient="from-blue-500 to-blue-600"
            icon="🗳️"
          />
          <ActionCard
            title="✅ Daftar untuk Memilih"
            description="Verifikasi identitas Anda untuk berpartisipasi dalam pemilihan. Proses cepat dan aman."
            buttonText="Daftar Sekarang"
            link="/register"
            gradient="from-green-500 to-green-600"
            icon="📝"
          />
          <ActionCard
            title="📊 Lihat Hasil"
            description="Lihat hasil pemilihan yang telah selesai dengan transparansi penuh dan data real-time."
            buttonText="Lihat Hasil"
            link="/elections"
            gradient="from-purple-500 to-purple-600"
            icon="📈"
          />
        </div>
      </div>

      {/* How it Works Section */}
      <div className="bg-gray-50 rounded-2xl p-8 lg:p-12 mb-16 -mx-4 sm:-mx-6 lg:-mx-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">
            Bagaimana Cara Kerjanya?
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
            <ProcessStep
              number="1"
              title="Hubungkan Wallet"
              description="Pertama, hubungkan MetaMask atau wallet Ethereum lainnya ke platform kami."
              icon="🔗"
            />
            <ProcessStep
              number="2"
              title="Verifikasi Identitas"
              description="Daftarkan dan verifikasi identitas Anda melalui oracle keamanan kami."
              icon="🆔"
            />
            <ProcessStep
              number="3"
              title="Pilih Pemilihan"
              description="Pilih pemilihan yang ingin Anda ikuti dan daftar sebagai pemilih."
              icon="🗳️"
            />
            <ProcessStep
              number="4"
              title="Berikan Suara"
              description="Pilih kandidat dan konfirmasi suara Anda melalui blockchain."
              icon="✅"
            />
            <ProcessStep
              number="5"
              title="Verifikasi Hasil"
              description="Semua suara dapat diverifikasi pada blockchain, memastikan transparansi."
              icon="📊"
            />
          </div>
        </div>
      </div>

      {/* Statistics Section */}
      <div className="text-center mb-16">
        <h2 className="text-3xl font-bold text-gray-800 mb-8">
          Platform Terpercaya
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard number="100%" label="Transparansi" />
          <StatCard number="0" label="Kecurangan" />
          <StatCard number="24/7" label="Tersedia" />
          <StatCard number="∞" label="Verifikasi" />
        </div>
      </div>
    </div>
  );
};

// Komponen kartu fitur yang lebih menarik
const FeatureCard = ({ title, description, gradient }) => (
  <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-2xl transition duration-300 transform hover:-translate-y-2">
    <div className={`bg-gradient-to-r ${gradient} w-12 h-12 rounded-lg mb-4 flex items-center justify-center text-white text-xl font-bold`}>
      {title.split(' ')[0]}
    </div>
    <h3 className="text-xl font-bold text-gray-800 mb-3">{title.substring(2)}</h3>
    <p className="text-gray-600 leading-relaxed">{description}</p>
  </div>
);

// Komponen kartu aksi yang lebih menarik
const ActionCard = ({ title, description, buttonText, link, gradient, icon }) => {
  return (
    <div className="bg-white rounded-xl p-8 shadow-lg hover:shadow-2xl transition duration-300 transform hover:-translate-y-2 flex flex-col h-full">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-2xl font-bold text-gray-800 mb-4">{title}</h3>
      <p className="text-gray-600 mb-6 flex-grow leading-relaxed">{description}</p>
      <Link
        to={link}
        className={`bg-gradient-to-r ${gradient} text-white font-bold py-3 px-6 rounded-lg text-center transition duration-300 hover:shadow-lg transform hover:scale-105`}
      >
        {buttonText}
      </Link>
    </div>
  );
};

// Komponen langkah proses
const ProcessStep = ({ number, title, description, icon }) => (
  <div className="text-center">
    <div className="bg-gradient-to-r from-blue-500 to-purple-600 w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold">
      {icon}
    </div>
    <div className="bg-gray-200 w-8 h-8 rounded-full mx-auto mb-3 flex items-center justify-center text-gray-600 font-bold text-sm">
      {number}
    </div>
    <h4 className="font-bold text-gray-800 mb-2">{title}</h4>
    <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
  </div>
);

// Komponen statistik
const StatCard = ({ number, label }) => (
  <div className="bg-white rounded-xl p-6 shadow-lg">
    <div className="text-3xl font-bold text-blue-600 mb-2">{number}</div>
    <div className="text-gray-600 font-medium">{label}</div>
  </div>
);

export default Home;