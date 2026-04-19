import React, { useState, useEffect, useCallback } from 'react'
import axios from 'axios'

const API = 'http://localhost:8000'

const CAMPAIGN_TYPES = [
  { value: 'generic', label: 'Generic / Other', icon: '🌐' },
  { value: 'real_estate', label: 'Real Estate', icon: '🏠' },
  { value: 'ecommerce', label: 'E-Commerce', icon: '🛒' },
  { value: 'restaurant', label: 'Restaurant / Food', icon: '🍽️' },
  { value: 'saas', label: 'SaaS / Software', icon: '💻' },
  { value: 'agency', label: 'Agency / Marketing', icon: '🎯' },
  { value: 'portfolio', label: 'Portfolio / Freelance', icon: '🎨' },
]

const emptyConfig = {
  name: '',
  campaign_type: 'generic',
  company_name: '',
  company_desc: '',
  company_website: '',
  demo_link: '',
  pitch_message: '',
  sender_name: '',
  attachments: [],
  is_active: false,
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function CampaignConfig() {
  const [configs, setConfigs] = useState([])
  const [form, setForm] = useState({ ...emptyConfig })
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [uploadingAtt, setUploadingAtt] = useState(false)
  const [showForm, setShowForm] = useState(false)

  // Load all configs
  const loadConfigs = async () => {
    try {
      const res = await axios.get(`${API}/campaign-configs`)
      setConfigs(res.data || [])
    } catch (e) {
      console.error('Failed to load configs', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConfigs()
  }, [])

  const showMsg = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  // Create or update config
  const saveConfig = async () => {
    if (!form.name.trim()) {
      showMsg('error', '❌ Please enter a campaign name.')
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        await axios.put(`${API}/campaign-configs/${editingId}`, form)
        showMsg('success', '✅ Campaign config updated successfully!')
      } else {
        await axios.post(`${API}/campaign-configs`, form)
        showMsg('success', '✅ Campaign config created successfully!')
      }
      setForm({ ...emptyConfig })
      setEditingId(null)
      setShowForm(false)
      await loadConfigs()
    } catch (e) {
      showMsg('error', `❌ ${e.response?.data?.detail || e.message}`)
    } finally {
      setSaving(false)
    }
  }

  // Activate a config
  const activateConfig = async (id) => {
    try {
      await axios.post(`${API}/campaign-configs/${id}/activate`)
      showMsg('success', '✅ Campaign activated!')
      await loadConfigs()
    } catch (e) {
      showMsg('error', `❌ ${e.response?.data?.detail || e.message}`)
    }
  }

  // Delete a config
  const deleteConfig = async (id) => {
    if (!confirm('Delete this campaign config?')) return
    try {
      await axios.delete(`${API}/campaign-configs/${id}`)
      showMsg('success', '✅ Config deleted.')
      await loadConfigs()
    } catch (e) {
      showMsg('error', `❌ ${e.response?.data?.detail || e.message}`)
    }
  }

  // Edit existing config
  const startEdit = (config) => {
    setForm({
      name: config.name || '',
      campaign_type: config.campaign_type || 'generic',
      company_name: config.company_name || '',
      company_desc: config.company_desc || '',
      company_website: config.company_website || '',
      demo_link: config.demo_link || '',
      pitch_message: config.pitch_message || '',
      sender_name: config.sender_name || '',
      attachments: config.attachments || [],
      is_active: config.is_active || false,
    })
    setEditingId(config._id)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Upload attachment
  const handleAttachmentUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (form.attachments.length >= 3) {
      showMsg('error', '❌ Maximum 3 attachments allowed.')
      return
    }

    setUploadingAtt(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await axios.post(`${API}/upload-attachment`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setForm(prev => ({
        ...prev,
        attachments: [...prev.attachments, res.data.filename]
      }))
      showMsg('success', `📎 "${file.name}" uploaded!`)
    } catch (e) {
      showMsg('error', `❌ ${e.response?.data?.detail || e.message}`)
    } finally {
      setUploadingAtt(false)
      e.target.value = ''
    }
  }

  // Remove attachment from form list
  const removeAttachment = async (filename) => {
    try {
      await axios.delete(`${API}/delete-attachment/${filename}`)
    } catch {}
    setForm(prev => ({
      ...prev,
      attachments: prev.attachments.filter(f => f !== filename)
    }))
  }

  const startNew = () => {
    setForm({ ...emptyConfig })
    setEditingId(null)
    setShowForm(true)
  }

  const cancelForm = () => {
    setForm({ ...emptyConfig })
    setEditingId(null)
    setShowForm(false)
  }

  const activeConfig = configs.find(c => c.is_active)

  if (loading) return (
    <div className="loading-container">
      <div className="spinner" style={{ width: 36, height: 36 }}></div>
      <span>Loading campaign configs...</span>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Campaign Config</h1>
        <p className="page-subtitle">Define your outreach strategy — industry, company details, demo links & attachments</p>
      </div>

      {message && (
        <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 20 }}>
          {message.text}
        </div>
      )}

      {/* Active Config Banner */}
      {activeConfig && !showForm && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(6,182,212,0.06))',
          border: '1px solid rgba(16,185,129,0.35)',
          borderRadius: 'var(--radius-lg)',
          padding: '18px 24px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="dot dot-green animate-pulse"></span>
              <span style={{ fontWeight: 700, fontSize: 14, color: '#34d399' }}>Active Campaign</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{activeConfig.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              {CAMPAIGN_TYPES.find(t => t.value === activeConfig.campaign_type)?.icon}{' '}
              {CAMPAIGN_TYPES.find(t => t.value === activeConfig.campaign_type)?.label || activeConfig.campaign_type}
              {activeConfig.company_name && ` · ${activeConfig.company_name}`}
              {activeConfig.demo_link && ' · 🔗 Demo Link'}
              {activeConfig.attachments?.length > 0 && ` · 📎 ${activeConfig.attachments.length} file(s)`}
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => startEdit(activeConfig)}>✏️ Edit</button>
        </div>
      )}

      {/* Create / Edit Form */}
      {showForm ? (
        <div style={{ marginBottom: 32 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>
              {editingId ? '✏️ Edit Campaign Config' : '➕ New Campaign Config'}
            </h2>
            <button className="btn btn-secondary btn-sm" onClick={cancelForm}>✕ Cancel</button>
          </div>

          {/* Campaign Name & Type */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 14, fontWeight: 600 }}>
              🏷️ Campaign Identity
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Campaign Name *</label>
                <input
                  className="form-input"
                  placeholder="e.g. Real Estate Q2 Outreach"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Industry / Campaign Type</label>
                <select
                  className="form-select"
                  value={form.campaign_type}
                  onChange={e => setForm(p => ({ ...p, campaign_type: e.target.value }))}
                >
                  {CAMPAIGN_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Type preview cards */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {CAMPAIGN_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setForm(p => ({ ...p, campaign_type: t.value }))}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '100px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: form.campaign_type === t.value
                      ? '1px solid rgba(139,92,246,0.5)'
                      : '1px solid var(--border)',
                    background: form.campaign_type === t.value
                      ? 'rgba(139,92,246,0.15)'
                      : 'var(--bg-card)',
                    color: form.campaign_type === t.value
                      ? '#a78bfa'
                      : 'var(--text-secondary)',
                    transition: 'var(--transition)',
                    fontFamily: 'inherit',
                  }}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Company Details */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 14, fontWeight: 600 }}>
              🏢 Company & Sender Details
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Company Name</label>
                <input
                  className="form-input"
                  placeholder="e.g. Korevyn"
                  value={form.company_name}
                  onChange={e => setForm(p => ({ ...p, company_name: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Sender Display Name</label>
                <input
                  className="form-input"
                  placeholder="e.g. Omkar at Korevyn"
                  value={form.sender_name}
                  onChange={e => setForm(p => ({ ...p, sender_name: e.target.value }))}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Company Description</label>
              <textarea
                className="form-input"
                rows={3}
                placeholder="Brief description of your company and what you offer..."
                value={form.company_desc}
                onChange={e => setForm(p => ({ ...p, company_desc: e.target.value }))}
                style={{ resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Company Website</label>
                <input
                  className="form-input"
                  placeholder="https://yourcompany.com"
                  value={form.company_website}
                  onChange={e => setForm(p => ({ ...p, company_website: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Demo / App Link</label>
                <input
                  className="form-input"
                  placeholder="https://demo.yourcompany.com"
                  value={form.demo_link}
                  onChange={e => setForm(p => ({ ...p, demo_link: e.target.value }))}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  This link will be naturally woven into AI-generated emails
                </span>
              </div>
            </div>
          </div>

          {/* Custom Pitch */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 14, fontWeight: 600 }}>
              ✍️ Custom Pitch Message
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Key message to include in outreach emails</label>
              <textarea
                className="form-input"
                rows={4}
                placeholder={"e.g. We specialize in building high-converting landing pages for real estate agencies. Our clients typically see a 3x increase in inquiry leads within 60 days of launching their new website."}
                value={form.pitch_message}
                onChange={e => setForm(p => ({ ...p, pitch_message: e.target.value }))}
                style={{ resize: 'vertical' }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                The AI will incorporate this naturally — it won't be copy-pasted verbatim
              </span>
            </div>
          </div>

          {/* Attachments */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 14, fontWeight: 600 }}>
              📎 File Attachments
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
              Attach PDFs, images, or documents to send with every outreach email. Max 3 files, 5MB each.
            </p>

            {/* Uploaded files list */}
            {form.attachments.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {form.attachments.map((filename, i) => {
                  const displayName = filename.includes('_') ? filename.split('_').slice(1).join('_') : filename
                  return (
                    <div key={i} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)',
                    }}>
                      <span style={{ fontSize: 18 }}>
                        {filename.endsWith('.pdf') ? '📄' : filename.match(/\.(png|jpg|jpeg|gif)$/i) ? '🖼️' : '📁'}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }} className="truncate">{displayName}</div>
                      </div>
                      <button
                        className="btn btn-sm"
                        onClick={() => removeAttachment(filename)}
                        style={{
                          background: 'rgba(239,68,68,0.1)',
                          border: '1px solid rgba(239,68,68,0.3)',
                          color: '#f87171',
                          padding: '4px 10px',
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Upload button */}
            {form.attachments.length < 3 && (
              <label style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 20px',
                borderRadius: 'var(--radius-md)',
                border: '2px dashed var(--border)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                transition: 'var(--transition)',
              }}>
                {uploadingAtt ? (
                  <><span className="spinner"></span> Uploading...</>
                ) : (
                  <>📎 Add Attachment</>
                )}
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.gif,.docx,.doc,.xlsx,.pptx"
                  style={{ display: 'none' }}
                  onChange={handleAttachmentUpload}
                  disabled={uploadingAtt}
                />
              </label>
            )}
          </div>

          {/* Active Toggle + Save */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 16px',
              background: form.is_active ? 'rgba(16,185,129,0.1)' : 'var(--bg-card)',
              border: form.is_active ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              transition: 'var(--transition)',
              color: form.is_active ? '#34d399' : 'var(--text-secondary)',
            }}>
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
                style={{ accentColor: '#10b981' }}
              />
              Set as Active Campaign
            </label>

            <button className="btn btn-primary" onClick={saveConfig} disabled={saving}>
              {saving
                ? <><span className="spinner"></span> Saving...</>
                : editingId
                  ? '💾 Update Config'
                  : '✅ Save Campaign Config'}
            </button>

            <button className="btn btn-secondary" onClick={cancelForm}>Cancel</button>
          </div>
        </div>
      ) : (
        /* New Config Button */
        <div style={{ marginBottom: 24 }}>
          <button className="btn btn-primary" onClick={startNew}>➕ Create New Campaign Config</button>
        </div>
      )}

      {/* Saved Configs List */}
      {!showForm && configs.length > 0 && (
        <div>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 14, fontWeight: 600 }}>
            📋 Saved Campaigns ({configs.length})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
            {configs.map(c => {
              const typeInfo = CAMPAIGN_TYPES.find(t => t.value === c.campaign_type) || CAMPAIGN_TYPES[0]
              return (
                <div
                  key={c._id}
                  style={{
                    background: c.is_active ? 'rgba(16,185,129,0.06)' : 'var(--bg-card)',
                    border: c.is_active ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '20px',
                    transition: 'var(--transition)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Active indicator bar */}
                  {c.is_active && (
                    <div style={{
                      position: 'absolute',
                      top: 0, left: 0,
                      width: '100%', height: 3,
                      background: 'var(--gradient-success)',
                    }} />
                  )}

                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 20 }}>{typeInfo.icon}</span>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {typeInfo.label}
                        {c.company_name && ` · ${c.company_name}`}
                      </div>
                    </div>
                    {c.is_active && (
                      <span className="badge badge-green" style={{ flexShrink: 0 }}>✓ Active</span>
                    )}
                  </div>

                  {/* Quick info pills */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                    {c.demo_link && (
                      <span className="badge badge-cyan">🔗 Demo Link</span>
                    )}
                    {c.pitch_message && (
                      <span className="badge badge-purple">✍️ Custom Pitch</span>
                    )}
                    {c.attachments?.length > 0 && (
                      <span className="badge badge-amber">📎 {c.attachments.length} file(s)</span>
                    )}
                    {c.sender_name && (
                      <span className="badge badge-indigo">👤 {c.sender_name}</span>
                    )}
                    {c.company_website && (
                      <span className="badge badge-gray">🌐 Website</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    {!c.is_active && (
                      <button
                        className="btn btn-sm"
                        onClick={() => activateConfig(c._id)}
                        style={{
                          background: 'rgba(16,185,129,0.1)',
                          border: '1px solid rgba(16,185,129,0.3)',
                          color: '#34d399',
                        }}
                      >
                        ⚡ Activate
                      </button>
                    )}
                    <button className="btn btn-secondary btn-sm" onClick={() => startEdit(c)}>
                      ✏️ Edit
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => deleteConfig(c._id)}
                      style={{
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        color: '#f87171',
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!showForm && configs.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">⚙️</div>
          <h3>No campaign configs yet</h3>
          <p>Create a campaign config to customize your outreach — industry type, company details, demo links, and file attachments.</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={startNew}>
            ➕ Create Your First Config
          </button>
        </div>
      )}
    </div>
  )
}
