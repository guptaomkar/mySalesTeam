import React, { useEffect, useState } from 'react'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const TYPE_BADGE = {
  real_estate: ['badge-amber',  '🏠 Real Estate'],
  restaurant:  ['badge-red',    '🍴 Restaurant'],
  ecommerce:   ['badge-cyan',   '🛒 Ecommerce'],
  saas:        ['badge-purple', '💻 SaaS'],
  agency:      ['badge-indigo', '🎨 Agency'],
  portfolio:   ['badge-green',  '🗂️ Portfolio'],
  generic:     ['badge-gray',   '🌐 Generic'],
}

const STATUS_BADGE = {
  pending:     ['badge-gray',   '⏳ Pending'],
  in_progress: ['badge-cyan',   '⚙️ Running'],
  contacted:   ['badge-indigo', '📧 Contacted'],
  closed:      ['badge-green',  '✅ Closed'],
  failed:      ['badge-red',    '❌ Failed'],
  exhausted:   ['badge-amber',  '🏁 Exhausted'],
}

const PRIORITY_BADGE = {
  HIGH:   ['badge-red',    '🔴 HIGH'],
  MEDIUM: ['badge-amber',  '🟡 MEDIUM'],
  LOW:    ['badge-green',  '🟢 LOW'],
}

function Badge({ map, value }) {
  if (!value) return <span className="badge badge-gray">—</span>
  const [cls, text] = map[value] || ['badge-gray', value]
  return <span className={`badge ${cls}`}>{text}</span>
}

export default function ClientsList() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [message, setMessage] = useState(null)
  
  // Action states
  const [runningId, setRunningId] = useState(null)
  const [closingId, setClosingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [saving, setSaving] = useState(false)

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('add') // 'add' or 'edit'
  const [formData, setFormData] = useState({
    _id: '',
    client_name: '',
    email: '',
    website: '',
    client_type: 'generic',
    status: 'pending',
    priority: ''
  })

  const load = async () => {
    try {
      const params = {}
      if (statusFilter) params.status = statusFilter
      const res = await axios.get(`${API}/leads`, { params })
      setLeads(res.data)
    } catch (e) {
      showMsg('error', 'Failed to load clients.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [statusFilter])

  const exportLeads = async () => {
    try {
      showMsg('success', 'Preparing export...');
      const response = await axios.get(`${API}/export-leads`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'leads_export.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      showMsg('success', '✅ Export downloaded');
    } catch (e) {
      showMsg('error', '❌ Failed to export leads');
    }
  }

  const showMsg = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  // Row Actions
  const runSingle = async (leadId, name) => {
    setRunningId(leadId)
    try {
      await axios.post(`${API}/start-campaign?lead_id=${leadId}`)
      showMsg('success', `🚀 Campaign started for ${name}`)
      setTimeout(load, 3000)
    } catch (e) {
      showMsg('error', `Failed: ${e.response?.data?.detail || e.message}`)
    } finally {
      setRunningId(null)
    }
  }

  const markClosed = async (leadId, isClosed, name) => {
    setClosingId(leadId)
    try {
      if (isClosed) {
        await axios.post(`${API}/mark-open/${leadId}`)
        showMsg('success', `↩️ ${name} reopened`)
      } else {
        await axios.post(`${API}/mark-closed/${leadId}`)
        showMsg('success', `✅ ${name} marked as closed`)
      }
      await load()
    } catch (e) {
      showMsg('error', `Failed: ${e.response?.data?.detail || e.message}`)
    } finally {
      setClosingId(null)
    }
  }

  const deleteLead = async (leadId, name) => {
    if (!window.confirm(`Delete ${name}? This also removes all email logs and follow-ups.`)) return
    setDeletingId(leadId)
    try {
      await axios.delete(`${API}/leads/${leadId}`)
      showMsg('success', `🗑️ ${name} deleted`)
      setLeads(p => p.filter(l => l._id !== leadId))
    } catch (e) {
      showMsg('error', `Failed: ${e.response?.data?.detail || e.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  // Modal handlers
  const openAddModal = () => {
    setModalMode('add')
    setFormData({ _id: '', client_name: '', email: '', website: '', client_type: 'generic', status: 'pending', priority: '' })
    setIsModalOpen(true)
  }

  const openEditModal = (lead) => {
    setModalMode('edit')
    setFormData({
      _id: lead._id,
      client_name: lead.client_name || '',
      email: lead.email || '',
      website: lead.website || '',
      client_type: lead.client_type || 'generic',
      status: lead.status || 'pending',
      priority: lead.priority || ''
    })
    setIsModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (modalMode === 'add') {
        await axios.post(`${API}/leads`, {
          client_name: formData.client_name,
          email: formData.email,
          website: formData.website,
          client_type: formData.client_type
        })
        showMsg('success', '✅ Client added successfully!')
      } else {
        await axios.put(`${API}/leads/${formData._id}`, {
          client_name: formData.client_name,
          email: formData.email,
          website: formData.website,
          client_type: formData.client_type,
          status: formData.status,
          priority: formData.priority || null
        })
        showMsg('success', '✅ Client updated successfully!')
      }
      setIsModalOpen(false)
      load()
    } catch (e) {
      showMsg('error', `❌ Failed: ${e.response?.data?.detail || e.message}`)
    } finally {
      setSaving(false)
    }
  }

  const filtered = leads.filter(l =>
    l.client_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">View and manage all leads — send campaigns, mark deals, delete records</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary" onClick={exportLeads} title="Export to Excel / CSV">
            📥 Export to Excel
          </button>
          <button className="btn btn-primary" onClick={openAddModal}>
            ➕ Add Client
          </button>
        </div>
      </div>

      {message && (
        <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'} mb-4`}>
          {message.text}
        </div>
      )}

      <div className="table-toolbar">
        <div className="toolbar-left">
          <input
            className="search-bar"
            placeholder="🔍 Search clients..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="form-select"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ maxWidth: 160 }}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="contacted">Contacted</option>
            <option value="closed">Closed</option>
            <option value="failed">Failed</option>
            <option value="exhausted">Exhausted</option>
          </select>
        </div>
        <div className="toolbar-right">
          <span className="text-sm text-muted">{filtered.length} clients</span>
          <button className="btn btn-secondary btn-sm" onClick={load}>↻ Refresh</button>
        </div>
      </div>

      {loading ? (
        <div className="loading-container"><div className="spinner" style={{ width: 36, height: 36 }}></div><span>Loading clients...</span></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">👥</div>
          <h3>No clients found</h3>
          <p>Click "Add Client" to make one, or upload a CSV.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th className="w-tight">#</th>
                <th>Client</th>
                <th>Email</th>
                <th>Website</th>
                <th>Type</th>
                <th>Priority</th>
                <th>Status</th>
                <th className="w-tight">Emails Sent</th>
                <th className="w-tight">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead, i) => (
                <tr key={lead._id}>
                  <td className="text-muted text-sm">{i + 1}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{lead.client_name}</div>
                    <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                      Added {lead.created_at ? new Date(lead.created_at).toLocaleDateString() : '—'}
                    </div>
                  </td>
                  <td className="text-sm truncate" style={{ maxWidth: 160 }} title={lead.email}>{lead.email}</td>
                  <td className="truncate" style={{ maxWidth: 160 }}>
                    {lead.website ? (
                      <a href={lead.website} target="_blank" rel="noopener noreferrer"
                        style={{ color: 'var(--accent-primary)', fontSize: 12, textDecoration: 'none' }} title={lead.website}>
                        🔗 {new URL(lead.website.startsWith('http') ? lead.website : 'https://' + lead.website).hostname}
                      </a>
                    ) : '—'}
                  </td>
                  <td><Badge map={TYPE_BADGE} value={lead.client_type} /></td>
                  <td><Badge map={PRIORITY_BADGE} value={lead.priority} /></td>
                  <td><Badge map={STATUS_BADGE} value={lead.status} /></td>
                  <td className="w-tight">
                    <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>
                      {lead.emails_sent || 0}
                    </span>
                  </td>
                  <td className="w-tight">
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap' }}>
                      {/* Run Campaign */}
                      {!lead.is_closed && lead.status !== 'in_progress' && (
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '6px 8px', fontSize: 13 }}
                          title={`Run campaign for ${lead.client_name}`}
                          onClick={() => runSingle(lead._id, lead.client_name)}
                          disabled={runningId === lead._id}
                        >
                          {runningId === lead._id ? <span className="spinner" style={{width: 12, height:12}}></span> : '🚀'}
                        </button>
                      )}
                      
                      {/* Edit */}
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '6px 8px', fontSize: 13 }}
                        title="Edit Client"
                        onClick={() => openEditModal(lead)}
                      >
                        ✏️
                      </button>

                      {/* Mark Closed/Open */}
                      <button
                        className="btn btn-sm"
                        title={lead.is_closed ? 'Reopen Deal' : 'Close Deal'}
                        style={{
                          padding: '6px 8px', fontSize: 13,
                          background: lead.is_closed ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)',
                          border: `1px solid ${lead.is_closed ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.3)'}`,
                          color: lead.is_closed ? '#34d399' : '#818cf8'
                        }}
                        onClick={() => markClosed(lead._id, lead.is_closed, lead.client_name)}
                        disabled={closingId === lead._id}
                      >
                        {lead.is_closed ? '↩️' : '✅'}
                      </button>

                      {/* Delete */}
                      <button
                        className="btn btn-sm"
                        title="Delete Client"
                        style={{ padding: '6px 8px', fontSize: 13, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
                        onClick={() => deleteLead(lead._id, lead.client_name)}
                        disabled={deletingId === lead._id}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE/EDIT MODAL */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
          animation: 'fadeIn 0.2s ease',
        }}>
          <div className="card" style={{
            width: '100%', maxWidth: 500, padding: 24, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            position: 'relative'
          }}>
            <button 
              onClick={() => setIsModalOpen(false)}
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}
            >
              ✕
            </button>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>
              {modalMode === 'add' ? 'Add New Client' : 'Edit Client'}
            </h2>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="text-sm text-muted block mb-1">Company / Client Name *</label>
                <input required className="search-bar w-full" value={formData.client_name} onChange={e => setFormData({...formData, client_name: e.target.value})} placeholder="Acme Corp" />
              </div>
              <div>
                <label className="text-sm text-muted block mb-1">Email Address *</label>
                <input required type="email" className="search-bar w-full" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="contact@acme.com" />
              </div>
              <div>
                <label className="text-sm text-muted block mb-1">Website URL</label>
                <input type="url" className="search-bar w-full" value={formData.website} onChange={e => setFormData({...formData, website: e.target.value})} placeholder="https://..." />
              </div>
              <div>
                <label className="text-sm text-muted block mb-1">Client Industry Type</label>
                <select className="form-select w-full" value={formData.client_type} onChange={e => setFormData({...formData, client_type: e.target.value})}>
                  <option value="generic">Generic (Fallback)</option>
                  <option value="real_estate">Real Estate</option>
                  <option value="restaurant">Restaurant</option>
                  <option value="ecommerce">Ecommerce</option>
                  <option value="saas">SaaS</option>
                  <option value="agency">Agency</option>
                  <option value="portfolio">Portfolio</option>
                </select>
              </div>

              {/* Edit-only fields */}
              {modalMode === 'edit' && (
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <label className="text-sm text-muted block mb-1">Status</label>
                    <select className="form-select w-full" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                      <option value="pending">Pending</option>
                      <option value="contacted">Contacted</option>
                      <option value="closed">Closed</option>
                      <option value="failed">Failed</option>
                      <option value="exhausted">Exhausted</option>
                      <option value="in_progress">In Progress</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="text-sm text-muted block mb-1">Priority</label>
                    <select className="form-select w-full" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}>
                      <option value="">Unassigned</option>
                      <option value="HIGH">High</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="LOW">Low</option>
                    </select>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 12 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
