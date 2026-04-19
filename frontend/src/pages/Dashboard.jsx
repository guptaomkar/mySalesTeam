import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function StatCard({ icon, label, value, color = 'purple' }) {
  return (
    <div className={`stat-card ${color}`}>
      <span className="stat-icon">{icon}</span>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value ?? '—'}</div>
    </div>
  )
}

function statusBadge(status) {
  const map = {
    pending:    ['badge-gray',   '⏳ Pending'],
    in_progress:['badge-cyan',   '⚙️ Running'],
    contacted:  ['badge-indigo', '📧 Contacted'],
    closed:     ['badge-green',  '✅ Closed'],
    failed:     ['badge-red',    '❌ Failed'],
    exhausted:  ['badge-amber',  '🏁 Exhausted'],
  }
  const [cls, text] = map[status] || ['badge-gray', status]
  return <span className={`badge ${cls}`}>{text}</span>
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const res = await axios.get(`${API}/stats`)
      setStats(res.data)
    } catch (e) {
      setError('Failed to load stats. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t) }, [])

  if (loading) return (
    <div className="loading-container">
      <div className="spinner" style={{ width: 36, height: 36 }}></div>
      <span>Loading dashboard...</span>
    </div>
  )

  if (error) return (
    <div className="page-header">
      <div className="alert alert-error">{error}</div>
    </div>
  )

  const { leads, emails, followups, recent_activity } = stats

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Real-time overview of your AI outreach campaign</p>
      </div>

      {/* ⚠️ Empty state banner */}
      {leads.total === 0 && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(239,68,68,0.05))',
          border: '1px solid rgba(245,158,11,0.35)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 20px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#fbbf24', marginBottom: 4 }}>
              ⚠️ No leads in database
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Your MongoDB is empty. If you placed your CSV in{' '}
              <code style={{ color: '#fbbf24', background: 'rgba(245,158,11,0.15)', padding: '1px 5px', borderRadius: 3 }}>data/leads.csv</code>,
              click the button to import it now.
            </div>
          </div>
          <Link
            to="/upload"
            className="btn"
            style={{
              background: 'rgba(245,158,11,0.15)',
              border: '1px solid rgba(245,158,11,0.4)',
              color: '#fbbf24',
              flexShrink: 0,
            }}
          >
            📂 Import Leads →
          </Link>
        </div>
      )}

      {/* Leads stats */}
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10, fontWeight: 600 }}>Leads</div>
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <StatCard icon="👥" label="Total Leads"    value={leads.total}     color="purple" />
        <StatCard icon="⏳" label="Pending"         value={leads.pending}   color="amber"  />
        <StatCard icon="📧" label="Contacted"       value={leads.contacted} color="indigo" />
        <StatCard icon="✅" label="Deals Closed"    value={leads.closed}    color="green"  />
        <StatCard icon="❌" label="Failed"          value={leads.failed}    color="red"    />
        <StatCard icon="🏁" label="Exhausted"       value={leads.exhausted} color="cyan"   />
      </div>

      {/* Email & Follow-up stats */}
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10, fontWeight: 600 }}>Emails & Follow-Ups</div>
      <div className="stats-grid" style={{ marginBottom: 32 }}>
        <StatCard icon="✉️" label="Total Emails Sent"  value={emails.sent}       color="indigo" />
        <StatCard icon="💔" label="Emails Failed"      value={emails.failed}     color="red"    />
        <StatCard icon="🔄" label="Follow-Ups Pending" value={followups.pending} color="amber"  />
        <StatCard icon="📬" label="Follow-Ups Sent"    value={followups.sent}    color="green"  />
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Recent Activity</h2>
          <Link to="/logs" className="btn btn-secondary btn-sm">View All Logs →</Link>
        </div>
        {recent_activity && recent_activity.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recent_activity.map((item, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '10px 14px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
              }}>
                <span>{item.email_type === 'initial' ? '📤' : '🔄'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                    {item.client_name}
                    <span style={{ marginLeft: 8 }}>
                      <span className={`badge ${item.status === 'sent' ? 'badge-green' : 'badge-red'}`}>
                        {item.status === 'sent' ? '✓ Sent' : '✗ Failed'}
                      </span>
                    </span>
                  </div>
                  <div className="text-sm text-muted truncate">{item.subject || '(no subject)'}</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {item.sent_at ? new Date(item.sent_at).toLocaleString() : ''}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <h3>No activity yet</h3>
            <p>Import leads and start a campaign to see activity here.</p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link to="/upload" className="btn btn-primary">📁 Import Leads</Link>
        <Link to="/clients" className="btn btn-secondary">👥 View Clients</Link>
        <Link to="/live" className="btn btn-secondary">🚀 Live Campaign</Link>
      </div>
    </div>
  )
}
