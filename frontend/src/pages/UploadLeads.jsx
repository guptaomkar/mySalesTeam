import React, { useState, useCallback } from 'react'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function UploadLeads() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState([])
  const [headers, setHeaders] = useState([])
  const [uploading, setUploading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [campaignLoading, setCampaignLoading] = useState(false)
  const [fullSync, setFullSync] = useState(false)

  const showMsg = (type, text) => {
    setMessage({ type, text })
    // Don't auto-hide success so user can see count
  }

  const parseCSVPreview = (text) => {
    const lines = text.trim().split('\n').slice(0, 10)
    const hdrs = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
    const rows = lines.slice(1).map(line => line.split(',').map(c => c.trim().replace(/"/g, '')))
    setHeaders(hdrs)
    setPreview(rows)
  }

  const handleFile = (f) => {
    if (!f) return
    if (!f.name.endsWith('.csv')) {
      showMsg('error', '❌ Please select a valid .csv file.')
      return
    }
    setFile(f)
    setMessage(null)
    const reader = new FileReader()
    reader.onload = e => parseCSVPreview(e.target.result)
    reader.readAsText(f)
  }

  const onDrop = useCallback(e => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }, [])

  // Upload file via browser
  const uploadFile = async () => {
    if (!file) return
    setUploading(true)
    setMessage(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await axios.post(`${API}/upload-leads?full_sync=${fullSync}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      showMsg('success', `✅ ${res.data.message}`)
    } catch (e) {
      showMsg('error', `❌ Upload failed: ${e.response?.data?.detail || e.message}`)
    } finally {
      setUploading(false)
    }
  }

  // Import from server-side data/leads.csv
  const importFromServerFile = async () => {
    setImporting(true)
    setMessage(null)
    try {
      const res = await axios.post(`${API}/import-from-file?full_sync=${fullSync}`)
      showMsg('success', `✅ ${res.data.message}`)
    } catch (e) {
      showMsg('error', `❌ ${e.response?.data?.detail || e.message}`)
    } finally {
      setImporting(false)
    }
  }

  const startCampaign = async () => {
    setCampaignLoading(true)
    setMessage(null)
    try {
      const res = await axios.post(`${API}/start-campaign`)
      showMsg('success', `🚀 ${res.data.message}`)
    } catch (e) {
      showMsg('error', `❌ ${e.response?.data?.detail || e.message}`)
    } finally {
      setCampaignLoading(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Upload Leads</h1>
        <p className="page-subtitle">Import your CSV file and launch the AI outreach campaign</p>
      </div>

      {/* ⚡ QUICK IMPORT from data/leads.csv */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(99,102,241,0.05))',
        border: '1px solid rgba(139,92,246,0.3)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 24px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
            ⚡ Quick Import from <code style={{ color: 'var(--accent-primary)', background: 'rgba(139,92,246,0.15)', padding: '2px 6px', borderRadius: 4, fontSize: 13 }}>data/leads.csv</code>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Already placed your CSV in the <code>data/</code> folder? Click to import directly into MongoDB.
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={importFromServerFile}
          disabled={importing}
          style={{ flexShrink: 0 }}
        >
          {importing ? <><span className="spinner"></span> Importing...</> : '📂 Import from data/leads.csv'}
        </button>
      </div>

      {message && (
        <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 20 }}>
          {message.text}
        </div>
      )}

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, color: 'var(--text-muted)', fontSize: 12 }}>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }}></div>
        OR UPLOAD A NEW FILE
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }}></div>
      </div>

      {/* Format hint */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600 }}>
          📋 Required CSV Format
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 12, background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: 8, color: '#a78bfa' }}>
          Client, Website, Email<br/>
          Acme Corp, https://acme.com, hello@acme.com<br/>
          Startup Inc, https://startup.io, info@startup.io
        </div>
        <p className="text-sm text-muted mt-2">
          Optional column: <code style={{ color: 'var(--accent-primary)' }}>ClientType</code> (real_estate / restaurant / ecommerce / saas / agency / portfolio)
        </p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer', fontSize: 13, background: 'rgba(239,68,68,0.05)', padding: '10px 14px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)'}}>
          <input type="checkbox" checked={fullSync} onChange={e => setFullSync(e.target.checked)} style={{ accentColor: '#ef4444' }} />
          <span style={{ color: 'var(--text-primary)' }}>
            <strong>Full Sync Mode: </strong> Replace all database records (will DELETE any leads that are not in this CSV)
          </span>
        </label>
      </div>

      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        style={{
          border: `2px dashed ${dragging ? 'var(--accent-primary)' : file ? 'var(--accent-success)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-xl)',
          padding: '48px 32px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'var(--transition)',
          background: dragging ? 'rgba(139,92,246,0.05)' : file ? 'rgba(16,185,129,0.05)' : 'transparent',
          marginBottom: 20,
        }}
        onClick={() => document.getElementById('csv-input').click()}
      >
        <div style={{ fontSize: 48, marginBottom: 12 }}>{file ? '✅' : '📂'}</div>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
          {file ? file.name : 'Drag & Drop CSV Here'}
        </div>
        <div className="text-sm text-muted">
          {file
            ? `${(file.size / 1024).toFixed(1)} KB — click to replace`
            : 'or click to browse your computer'}
        </div>
        <input
          id="csv-input"
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files[0])}
        />
      </div>

      {/* Preview table */}
      {preview.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
            Preview ({preview.length} rows)
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>{headers.map(h => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => <td key={j}>{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* File upload actions */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          className="btn btn-primary"
          onClick={uploadFile}
          disabled={!file || uploading}
        >
          {uploading ? <><span className="spinner"></span> Uploading...</> : '📤 Import to Database'}
        </button>

        <div style={{ width: 1, height: 32, background: 'var(--border)' }}></div>

        <button
          className="btn"
          onClick={startCampaign}
          disabled={campaignLoading}
          style={{
            background: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.3)',
            color: '#34d399',
          }}
        >
          {campaignLoading ? <><span className="spinner"></span> Starting...</> : '🚀 Start Campaign (All Pending)'}
        </button>
      </div>
    </div>
  )
}
