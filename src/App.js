import React, { useState } from 'react'
import AnalisisPage from './pages/AnalisisPage'
import RiwayatPage from './pages/RiwayatPage'
import './App.css'

export default function App() {
  const [halaman, setHalaman] = useState('analisis')

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon"></span>
            <span className="logo-text">Kambing Vision</span>
          </div>
          <nav className="nav">
            <button
              className={`nav-btn ${halaman === 'analisis' ? 'active' : ''}`}
              onClick={() => setHalaman('analisis')}
            >
              Analisis
            </button>
            <button
              className={`nav-btn ${halaman === 'riwayat' ? 'active' : ''}`}
              onClick={() => setHalaman('riwayat')}
            >
              Riwayat
            </button>
          </nav>
        </div>
      </header>

      <main className="main">
        {halaman === 'analisis' ? <AnalisisPage /> : <RiwayatPage />}
      </main>

      <footer className="footer">
        <p>Kambing Vision Powered by Hammam 2026</p>
      </footer>
    </div>
  )
}
