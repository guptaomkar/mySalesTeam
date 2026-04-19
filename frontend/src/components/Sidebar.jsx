import React from 'react'
import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', icon: '📊', label: 'Dashboard', end: true },
  { to: '/upload', icon: '📁', label: 'Upload Leads' },
  { to: '/campaign', icon: '⚙️', label: 'Campaign Config' },
  { to: '/clients', icon: '👥', label: 'Clients' },
  { to: '/live', icon: '🚀', label: 'Live Campaign' },
  { to: '/logs', icon: '📧', label: 'Email Logs' },
  { to: '/followups', icon: '🔄', label: 'Follow-ups' },
]

export default function Sidebar({ isMobileOpen, closeMobileMenu }) {
  return (
    <aside className={`sidebar ${isMobileOpen ? 'mobile-open' : ''}`}>
      {/* Logo */}
      <div style={{
        padding: '24px 20px 20px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{
            width: 36, height: 36,
            borderRadius: 10,
            background: 'var(--gradient-main)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
            boxShadow: 'var(--shadow-glow-sm)',
          }}>🤖</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.3px' }}>mySalesTeam</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>AI Outreach v2.0</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '16px 12px' }}>
        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', padding: '0 8px', marginBottom: 8 }}>
          Navigation
        </div>
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={closeMobileMenu}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: isActive ? 'rgba(139,92,246,0.12)' : 'transparent',
              border: isActive ? '1px solid rgba(139,92,246,0.2)' : '1px solid transparent',
              marginBottom: 2,
              transition: 'var(--transition)',
            })}
          >
            <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid var(--border)',
        fontSize: 11,
        color: 'var(--text-muted)',
        lineHeight: 1.5,
      }}>
        <div>Powered by GPT-4.1</div>
        <div>dataenrichr.com</div>
      </div>
    </aside>
  )
}
