import React, { useState, useRef, useEffect } from 'react'
import axios from 'axios'

const API = 'http://localhost:8000'
const WS_URL = 'ws://localhost:8000/ws/live-status'

const EVENT_ICONS = {
  started: '🚀',
  scraped: '🌐',
  analyzed: '🧠',
  email_generated: '✍️',
  email_sent: '📧',
  done: '✅',
  error: '❌',
}

const EVENT_COLORS = {
  started: 'var(--accent-primary)',
  scraped: 'var(--accent-tertiary)',
  analyzed: '#c084fc',
  email_generated: 'var(--accent-warning)',
  email_sent: 'var(--accent-success)',
  done: 'var(--accent-success)',
  error: 'var(--accent-danger)',
}

export default function LiveCampaign() {
  const [events, setEvents] = useState([])
  const [connected, setConnected] = useState(false)
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState(null)
  const wsRef = useRef(null)
  const logRef = useRef(null)

  // Group events by client
  const clientMap = {}
  events.forEach(ev => {
    if (ev.client) {
      if (!clientMap[ev.client]) clientMap[ev.client] = []
      clientMap[ev.client].push(ev)
    }
  })

  useEffect(() => {
    connect()
    return () => wsRef.current?.close()
  }, [])

  useEffect(() => {
    // Auto-scroll log to bottom
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [events])

  const connect = () => {
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => { setConnected(false); setTimeout(connect, 3000) }
    ws.onerror = () => setConnected(false)
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        setEvents(prev => [...prev.slice(-200), { ...data, ts: new Date().toLocaleTimeString() }])
      } catch {}
    }
  }

  const startCampaign = async () => {
    setRunning(true)
    setMessage(null)
    try {
      const res = await axios.post(`${API}/start-campaign`)
      setMessage({ type: 'success', text: `✅ ${res.data.message}` })
    } catch (e) {
      setMessage({ type: 'error', text: `❌ ${e.response?.data?.detail || e.message}` })
    } finally {
      setTimeout(() => setRunning(false), 2000)
    }
  }

  const clearLog = () => setEvents([])

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Live Campaign</h1>
        <p className="page-subtitle">Real-time per-client processing events via WebSocket</p>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
          fontSize: 13,
        }}>
          <span className={`dot ${connected ? 'dot-green animate-pulse' : 'dot-red'}`}></span>
          {connected ? 'WebSocket Connected' : 'Connecting...'}
        </div>

        <button className="btn btn-primary" onClick={startCampaign} disabled={running}>
          {running ? <><span className="spinner"></span> Starting...</> : '🚀 Start Campaign'}
        </button>

        <button className="btn btn-secondary" onClick={clearLog}>🗑️ Clear Log</button>
      </div>

      {message && (
        <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'} mb-4`}>
          {message.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
        {/* Live Log */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>📡 Live Event Stream</div>
            <span className="badge badge-gray">{events.length} events</span>
          </div>
          <div
            ref={logRef}
            style={{
              height: 500,
              overflowY: 'auto',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {events.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', fontSize: 14 }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📡</div>
                <div>Waiting for campaign events...</div>
                <div className="text-xs" style={{ marginTop: 6 }}>Start a campaign to see real-time progress</div>
              </div>
            ) : events.map((ev, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                background: ev.event === 'error' ? 'rgba(239,68,68,0.05)' : ev.event === 'done' ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.03)',
                fontSize: 13,
                animation: 'fadeIn 0.2s ease',
              }}>
                <span style={{ fontSize: 15, flexShrink: 0 }}>{EVENT_ICONS[ev.event] || '•'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, color: EVENT_COLORS[ev.event] || 'var(--text-primary)' }}>
                    {ev.client}
                  </span>
                  <span style={{ color: 'var(--text-secondary)', marginLeft: 6 }}>
                    {ev.event === 'analyzed' ? `→ Type: ${ev.type} | Priority: ${ev.priority}` :
                     ev.event === 'email_sent' ? `→ "${ev.subject}"` :
                     ev.event === 'error' ? `→ ${ev.error}` :
                     `→ ${ev.event.replace('_', ' ')}`}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{ev.ts}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Client Summary Panel */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            fontWeight: 700, fontSize: 14,
          }}>👥 Client Status</div>
          <div style={{ padding: '12px', maxHeight: 500, overflowY: 'auto' }}>
            {Object.keys(clientMap).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
                No clients processed yet
              </div>
            ) : Object.entries(clientMap).map(([client, evs]) => {
              const lastEv = evs[evs.length - 1]
              const isDone = lastEv.event === 'done'
              const isError = lastEv.event === 'error'
              return (
                <div key={client} style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${isDone ? 'rgba(16,185,129,0.2)' : isError ? 'rgba(239,68,68,0.2)' : 'var(--border)'}`,
                  background: isDone ? 'rgba(16,185,129,0.05)' : isError ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.02)',
                  marginBottom: 8,
                }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{client}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {['started', 'scraped', 'analyzed', 'email_generated', 'email_sent', 'done'].map(step => {
                      const done = evs.some(e => e.event === step)
                      return (
                        <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                          <span style={{ color: done ? 'var(--accent-success)' : 'var(--text-muted)' }}>
                            {done ? '✓' : '○'}
                          </span>
                          <span style={{ color: done ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {EVENT_ICONS[step]} {step.replace('_', ' ')}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
