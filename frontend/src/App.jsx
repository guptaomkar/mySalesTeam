import React, { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import UploadLeads from './pages/UploadLeads'
import CampaignConfig from './pages/CampaignConfig'
import ClientsList from './pages/ClientsList'
import LiveCampaign from './pages/LiveCampaign'
import EmailLogs from './pages/EmailLogs'
import Followups from './pages/Followups'

export default function App() {
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  return (
    <BrowserRouter>
      <div className="app-layout">
        
        {/* Mobile Top Header */}
        <div className="mobile-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--gradient-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🤖</div>
            <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.3px' }}>mySalesTeam</div>
          </div>
          <button 
            onClick={() => setIsMobileOpen(true)}
            style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 24, cursor: 'pointer' }}
          >
            ☰
          </button>
        </div>

        {/* Mobile Overlay */}
        <div 
          className={`mobile-overlay ${isMobileOpen ? 'visible' : ''}`} 
          onClick={() => setIsMobileOpen(false)} 
        />

        <Sidebar isMobileOpen={isMobileOpen} closeMobileMenu={() => setIsMobileOpen(false)} />
        
        <div className="main-content">
          <div className="page-wrapper">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/upload" element={<UploadLeads />} />
              <Route path="/campaign" element={<CampaignConfig />} />
              <Route path="/clients" element={<ClientsList />} />
              <Route path="/live" element={<LiveCampaign />} />
              <Route path="/logs" element={<EmailLogs />} />
              <Route path="/followups" element={<Followups />} />
            </Routes>
          </div>
        </div>
      </div>
    </BrowserRouter>
  )
}
