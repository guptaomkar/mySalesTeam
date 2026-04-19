import React, { useEffect, useState } from 'react'
import axios from 'axios'

const API = 'http://localhost:8000'

function getCountdown(scheduledAt) {
  if (!scheduledAt) return null
  const diff = new Date(scheduledAt) - new Date()
  if (diff <= 0) return 'Due now'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h > 24) return `in ${Math.floor(h / 24)}d ${h % 24}h`
  if (h > 0) return `in ${h}h ${m}m`
  return `in ${m}m`
}

const DAY_COLORS = ['', 'badge-indigo', 'badge-cyan', 'badge-amber', 'badge-amber', 'badge-red', 'badge-red', 'badge-gray']

export default function Followups() {
  const [followups, setFollowups] = useState([])
  const [loading, setLoading] = useState(true)
  const [sentFilter, setSentFilter] = useState('')
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState(null)
  const [starting, setStarting] = useState(false)
  
  // Action states
  const [closingId, setClosingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [saving, setSaving] = useState(false)

  // Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    _id: '',
    client_name: '',
    scheduled_at: '',
    followup_day: 1
  })

  const load = async () => {
    setLoading(true)
    try {
      const params = {}
      if (sentFilter !== '') params.sent = sentFilter === 'true'
      if (search)           params.client_name = search
      const res = await axios.get(`${API}/followups`, { params })
      setFollowups(res.data)
    } catch (e) {
      showMessage('error', 'Failed to load follow-ups.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [sentFilter, search])

  const showMessage = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  // Row Actions
  const markDealClosed = async (leadId, clientName) => {
    if (!window.confirm(`Mark deal won/closed for ${clientName}? This stops all future follow-ups.`)) return
    setClosingId(leadId)
    try {
      await axios.post(`${API}/mark-closed/${leadId}`)
      showMessage('success', `✅ Deal closed for ${clientName}! Follow-ups stopped.`)
      await load()
    } catch (e) {
      showMessage('error', `Failed: ${e.response?.data?.detail || e.message}`)
    } finally {
      setClosingId(null)
    }
  }

  const cancelFollowup = async (followupId, clientName) => {
    if (!window.confirm(`Delete this scheduled follow-up for ${clientName}?`)) return
    setDeletingId(followupId)
    try {
      await axios.delete(`${API}/followups/${followupId}`)
      showMessage('success', `🗑️ Follow-up for ${clientName} removed.`)
      // Optimistically remove from UI
      setFollowups(p => p.filter(f => f._id !== followupId))
    } catch (e) {
      showMessage('error', `Failed: ${e.response?.data?.detail || e.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  const startFollowups = async () => {
    setStarting(true)
    try {
      const res = await axios.post(`${API}/start-followups`)
      showMessage('success', `🚀 ${res.data.message}`)
      load()
    } catch (e) {
      showMessage('error', `❌ Failed to start follow-ups: ${e.response?.data?.detail || e.message}`)
    } finally {
      setTimeout(() => setStarting(false), 2000)
    }
  }

  // Edit Modal Actions
  const openEditModal = (f) => {
    let dtLocal = ''
    if (f.scheduled_at) {
      // Build local YYYY-MM-DDThh:mm string for datetime-local input
      const d = new Date(f.scheduled_at)
      const pad = n => n.toString().padStart(2, '0')
      dtLocal = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    }
    setFormData({
      _id: f._id,
      client_name: f.client_name,
      scheduled_at: dtLocal,
      followup_day: f.followup_day || 1
    })
    setIsModalOpen(true)
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      // Convert local datetime to UTC ISO
      const utcDate = new Date(formData.scheduled_at).toISOString()
      await axios.put(`${API}/followups/${formData._id}`, {
        scheduled_at: utcDate,
        followup_day: parseInt(formData.followup_day, 10)
      })
      showMessage('success', '✅ Schedule updated!')
      setIsModalOpen(false)
      load()
    } catch (e) {
      showMessage('error', `❌ Failed to update: ${e.response?.data?.detail || e.message}`)
    } finally {
      setSaving(false)
    }
  }

  const pending   = followups.filter(f => !f.sent && !f.is_closed)
  const sent      = followups.filter(f =>  f.sent)
  const closed    = followups.filter(f =>  f.is_closed && !f.sent)

  // Stats bar
  const totalFollowups = followups.length

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Follow-ups</h1>
          <p className="page-subtitle">All scheduled follow-up emails from MongoDB — daily escalation until deal closes</p>
        </div>
        <button 
          className="btn btn-primary" 
          onClick={startFollowups}
          disabled={starting}
          style={{ background: 'var(--gradient-success)', border: 'none', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}
        >
          {starting ? <><span className="spinner"></span> Starting...</> : '🚀 Start Follow-ups Manually'}
        </button>
      </div>

      {/* Mini stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Follow-ups', value: totalFollowups, color: 'badge-purple' },
          { label: 'Pending',          value: pending.length,  color: 'badge-amber' },
          { label: 'Sent',             value: sent.length,     color: 'badge-green' },
          { label: 'Stopped (Closed)', value: closed.length,   color: 'badge-gray' },
        ].map(item => (
          <div key={item.label} style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            minWidth: 140,
            flex: 1
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
              {item.label}
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="table-toolbar">
        <div className="toolbar-left">
          <input
            className="search-bar"
            placeholder="🔍 Search by client..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="form-select" value={sentFilter} onChange={e => setSentFilter(e.target.value)} style={{ maxWidth: 160 }}>
            <option value="">All Follow-ups</option>
            <option value="false">Pending Only</option>
            <option value="true">Sent Only</option>
          </select>
        </div>
        <div className="toolbar-right">
          <span className="text-sm text-muted">{followups.length} records</span>
          <button className="btn btn-secondary btn-sm" onClick={load}>↻ Refresh</button>
        </div>
      </div>

      {message && <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'} mb-4`}>{message.text}</div>}

      {loading ? (
        <div className="loading-container"><div className="spinner" style={{ width: 36, height: 36 }}></div><span>Loading follow-ups...</span></div>
      ) : followups.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔄</div>
          <h3>No follow-ups scheduled yet</h3>
          <p>Follow-up Day 1 is automatically scheduled after each initial email is sent.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Email</th>
                <th>Type</th>
                <th className="w-tight">Day #</th>
                <th>Scheduled At</th>
                <th>Next Send</th>
                <th>Status</th>
                <th>Sent At</th>
                <th className="w-tight">Actions</th>
              </tr>
            </thead>
            <tbody>
              {followups.map((f) => {
                const dayColor = DAY_COLORS[Math.min(f.followup_day, 7)] || 'badge-gray'
                const isClosed = f.is_closed
                const isSent = f.sent
                const countdown = !isSent && !isClosed ? getCountdown(f.scheduled_at) : null
                const isPending = !isSent && !isClosed

                return (
                  <tr key={f._id} style={isClosed ? { opacity: 0.5 } : {}}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{f.client_name}</div>
                      <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                        {f.client_type?.replace('_', ' ')}
                      </div>
                    </td>
                    <td className="text-sm truncate" style={{ maxWidth: 160 }} title={f.email}>{f.email}</td>
                    <td>
                      <span className={`badge ${dayColor}`}>
                        🔄 Follow-up
                      </span>
                    </td>
                    <td className="w-tight">
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 28, height: 28,
                        borderRadius: '50%',
                        background: `var(--accent-primary)`,
                        opacity: isClosed ? 0.4 : 1,
                        fontSize: 12, fontWeight: 800, color: 'white'
                      }}>
                        {f.followup_day}
                      </span>
                    </td>
                    <td className="text-sm text-muted">
                      {f.scheduled_at ? new Date(f.scheduled_at).toLocaleString() : '—'}
                    </td>
                    <td>
                      {isClosed ? (
                        <span className="badge badge-gray">Stopped</span>
                      ) : isSent ? (
                        <span className="text-sm text-muted">—</span>
                      ) : countdown ? (
                        <span style={{ fontSize: 12, color: 'var(--accent-warning)', fontWeight: 600 }}>
                          ⏰ {countdown}
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      {isClosed ? (
                        <span className="badge badge-gray">🔒 Closed</span>
                      ) : isSent ? (
                        <span className="badge badge-green">✅ Sent</span>
                      ) : (
                        <span className="badge badge-amber">⏳ Pending</span>
                      )}
                    </td>
                    <td className="text-xs text-muted">
                      {f.sent_at ? new Date(f.sent_at).toLocaleString() : '—'}
                    </td>
                    <td className="w-tight">
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap' }}>
                        {/* Only show actions on pending follow-ups */}
                        {isPending && (
                          <>
                            <button
                              className="btn btn-secondary btn-sm"
                              title="Edit Schedule"
                              style={{ padding: '6px 8px', fontSize: 13 }}
                              onClick={() => openEditModal(f)}
                            >
                              ✏️
                            </button>

                            <button
                              className="btn btn-sm"
                              title="Close Deal"
                              style={{
                                padding: '6px 8px', fontSize: 13,
                                background: 'rgba(16,185,129,0.1)',
                                border: '1px solid rgba(16,185,129,0.3)',
                                color: '#34d399'
                              }}
                              onClick={() => markDealClosed(f.lead_id, f.client_name)}
                              disabled={closingId === f.lead_id}
                            >
                              ✅
                            </button>
                            
                            <button
                              className="btn btn-sm"
                              title="Delete Follow-up"
                              style={{ 
                                padding: '6px 8px', fontSize: 13, 
                                background: 'rgba(239,68,68,0.1)', 
                                border: '1px solid rgba(239,68,68,0.3)', 
                                color: '#f87171' 
                              }}
                              onClick={() => cancelFollowup(f._id, f.client_name)}
                              disabled={deletingId === f._id}
                            >
                              🗑️
                            </button>
                          </>
                        )}
                        {!isPending && (
                          <span className="text-muted text-xs">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* EDIT MODAL */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, animation: 'fadeIn 0.2s ease', padding: 16
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 400, padding: 24, position: 'relative' }}>
            <button 
              onClick={() => setIsModalOpen(false)}
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}
            >✕</button>
            
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>
              Edit Follow-up ({formData.client_name})
            </h2>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="text-sm text-muted block mb-1">Target Send Time (Local Time)</label>
                <input 
                  required 
                  type="datetime-local" 
                  className="search-bar w-full" 
                  value={formData.scheduled_at} 
                  onChange={e => setFormData({...formData, scheduled_at: e.target.value})} 
                />
              </div>
              <div>
                <label className="text-sm text-muted block mb-1">Follow-up Day Number</label>
                <input 
                  required 
                  type="number" 
                  min="1" max="100"
                  className="search-bar w-full" 
                  value={formData.followup_day} 
                  onChange={e => setFormData({...formData, followup_day: e.target.value})} 
                />
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 12 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
