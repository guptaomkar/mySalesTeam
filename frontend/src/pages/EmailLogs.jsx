import React, { useEffect, useState } from 'react'
import axios from 'axios'

const API = 'http://localhost:8000'

const TYPE_COLORS = {
  'initial':         ['badge-purple', '📤 Initial'],
  'followup_day_1':  ['badge-indigo', '🔄 Day 1'],
  'followup_day_2':  ['badge-cyan',   '🔄 Day 2'],
  'followup_day_3':  ['badge-amber',  '🔄 Day 3'],
  'followup_day_4':  ['badge-amber',  '🔄 Day 4'],
  'followup_day_5':  ['badge-red',    '🔄 Day 5'],
  'followup_day_6':  ['badge-red',    '🔄 Day 6'],
  'followup_day_7':  ['badge-gray',   '🔄 Day 7'],
}

export default function EmailLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [expanded, setExpanded] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const params = { limit: 200 }
      if (typeFilter) params.email_type = typeFilter
      if (search)     params.client_name = search
      const res = await axios.get(`${API}/email-logs`, { params })
      setLogs(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [typeFilter, search])

  const filtered = statusFilter ? logs.filter(l => l.status === statusFilter) : logs

  const toggleExpand = (id) => setExpanded(p => p === id ? null : id)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Email Logs</h1>
        <p className="page-subtitle">Every email sent to every client — initial outreach and all follow-ups</p>
      </div>

      <div className="table-toolbar">
        <div className="toolbar-left">
          <input
            className="search-bar"
            placeholder="🔍 Search by client name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="form-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ maxWidth: 180 }}>
            <option value="">All Types</option>
            <option value="initial">Initial</option>
            <option value="followup_day_1">Follow-up Day 1</option>
            <option value="followup_day_2">Follow-up Day 2</option>
            <option value="followup_day_3">Follow-up Day 3</option>
            <option value="followup_day_4">Follow-up Day 4</option>
            <option value="followup_day_5">Follow-up Day 5</option>
            <option value="followup_day_6">Follow-up Day 6</option>
            <option value="followup_day_7">Follow-up Day 7</option>
          </select>
          <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ maxWidth: 140 }}>
            <option value="">All Statuses</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <div className="toolbar-right">
          <span className="text-sm text-muted">{filtered.length} emails</span>
          <button className="btn btn-secondary btn-sm" onClick={load}>↻ Refresh</button>
        </div>
      </div>

      {loading ? (
        <div className="loading-container"><div className="spinner" style={{ width: 36, height: 36 }}></div><span>Loading logs...</span></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <h3>No emails found</h3>
          <p>Run a campaign to see email logs here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((log) => {
            const [cls, typeTxt] = TYPE_COLORS[log.email_type] || ['badge-gray', log.email_type]
            const isOpen = expanded === log._id

            return (
              <div key={log._id} style={{
                border: `1px solid ${isOpen ? 'var(--border-hover)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-lg)',
                background: isOpen ? 'rgba(139,92,246,0.04)' : 'var(--bg-card)',
                overflow: 'hidden',
                transition: 'var(--transition)',
              }}>
                {/* Header row */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 180px 120px 100px 160px 40px',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 18px',
                    cursor: 'pointer',
                  }}
                  onClick={() => toggleExpand(log._id)}
                >
                  {/* Client + Subject */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
                      {log.client_name}
                    </div>
                    <div className="text-sm text-muted truncate">
                      {log.subject || '(no subject)'}
                    </div>
                  </div>

                  {/* Email address */}
                  <div className="text-sm text-muted truncate">{log.email}</div>

                  {/* Type badge */}
                  <div><span className={`badge ${cls}`}>{typeTxt}</span></div>

                  {/* Status */}
                  <div>
                    <span className={`badge ${log.status === 'sent' ? 'badge-green' : 'badge-red'}`}>
                      {log.status === 'sent' ? '✓ Sent' : '✗ Failed'}
                    </span>
                  </div>

                  {/* Timestamp */}
                  <div className="text-xs text-muted">
                    {log.sent_at ? new Date(log.sent_at).toLocaleString() : '—'}
                  </div>

                  {/* Toggle */}
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                    {isOpen ? '▲' : '▼'}
                  </div>
                </div>

                {/* Expanded body */}
                {isOpen && (
                  <div style={{
                    borderTop: '1px solid var(--border)',
                    padding: '16px 18px',
                    animation: 'fadeIn 0.15s ease',
                  }}>
                    {log.error && (
                      <div className="alert alert-error" style={{ marginBottom: 12 }}>
                        Error: {log.error}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Email Body
                    </div>
                    <div style={{
                      whiteSpace: 'pre-wrap',
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 13,
                      lineHeight: 1.8,
                      color: 'var(--text-primary)',
                      background: 'rgba(0,0,0,0.2)',
                      borderRadius: 8,
                      padding: '14px 16px',
                      border: '1px solid var(--border)',
                    }}>
                      {log.body || '(no body content saved)'}
                    </div>
                    {log.lead_id && (
                      <div className="text-xs text-muted mt-2">Lead ID: {log.lead_id}</div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
