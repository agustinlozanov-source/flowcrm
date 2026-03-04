import { useState, useEffect, useRef } from 'react'
import {
  collection, onSnapshot, query, orderBy, doc,
  updateDoc, serverTimestamp, arrayUnion
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const css = `
  .st-root * { box-sizing: border-box; }
  .st-root { font-family: 'Inter', sans-serif; }

  .st-layout { display: grid; grid-template-columns: 340px 1fr; gap: 16px; height: calc(100vh - 120px); }

  .st-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 14px; overflow: hidden;
    display: flex; flex-direction: column;
  }

  .st-card-header {
    padding: 14px 18px; flex-shrink: 0;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    display: flex; align-items: center; gap: 10px;
  }

  .st-card-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; font-weight: 800; flex: 1; }

  /* FILTERS */
  .st-filters { display: flex; gap: 5px; padding: 10px 14px; flex-shrink: 0; border-bottom: 1px solid rgba(255,255,255,0.05); flex-wrap: wrap; }

  .st-filter {
    padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700;
    cursor: pointer; border: 1px solid rgba(255,255,255,0.08); background: transparent;
    color: #8e8e93; font-family: 'Inter', sans-serif; transition: all 0.15s;
  }
  .st-filter:hover { color: white; border-color: rgba(255,255,255,0.18); }
  .st-filter.active { background: rgba(255,255,255,0.08); color: white; border-color: rgba(255,255,255,0.15); }

  /* TICKET LIST */
  .st-ticket-list { flex: 1; overflow-y: auto; }

  .st-ticket-item {
    padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.04);
    cursor: pointer; transition: background 0.15s;
    display: flex; flex-direction: column; gap: 4px;
  }
  .st-ticket-item:hover { background: rgba(255,255,255,0.03); }
  .st-ticket-item.active { background: rgba(0,102,255,0.08); border-left: 2px solid #0066ff; }

  .st-ticket-top { display: flex; align-items: center; gap: 7px; }
  .st-ticket-id { font-size: 10px; font-weight: 800; color: #3a3a3c; font-family: 'Plus Jakarta Sans', sans-serif; }
  .st-ticket-subject { font-size: 12.5px; font-weight: 600; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .st-ticket-client { font-size: 11px; color: #8e8e93; }
  .st-ticket-time { font-size: 10.5px; color: #3a3a3c; flex-shrink: 0; }

  /* BADGES */
  .st-badge {
    font-size: 9.5px; font-weight: 700; padding: 2px 7px; border-radius: 5px;
    display: inline-flex; align-items: center; gap: 3px;
  }
  .st-badge-open { background: rgba(0,102,255,0.1); color: #4d9fff; border: 1px solid rgba(0,102,255,0.2); }
  .st-badge-pending { background: rgba(255,149,0,0.1); color: #ff9500; border: 1px solid rgba(255,149,0,0.2); }
  .st-badge-resolved { background: rgba(0,200,83,0.1); color: #00c853; border: 1px solid rgba(0,200,83,0.2); }
  .st-badge-high { background: rgba(255,59,48,0.1); color: #ff6b6b; border: 1px solid rgba(255,59,48,0.2); }
  .st-badge-normal { background: rgba(255,255,255,0.05); color: #8e8e93; border: 1px solid rgba(255,255,255,0.1); }

  /* DETAIL */
  .st-detail { display: flex; flex-direction: column; height: 100%; }

  .st-detail-header { padding: 16px 20px; flex-shrink: 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
  .st-detail-subject { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 15px; font-weight: 800; margin-bottom: 6px; }
  .st-detail-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

  /* MESSAGES */
  .st-messages { flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 10px; }

  .st-msg { display: flex; gap: 8px; }
  .st-msg.qubit { flex-direction: row-reverse; }

  .st-msg-avatar {
    width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800;
  }

  .st-msg-bubble {
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 4px 12px 12px 12px; padding: 9px 13px;
    font-size: 12.5px; line-height: 1.55; max-width: 76%;
  }
  .st-msg.qubit .st-msg-bubble {
    background: rgba(0,102,255,0.12); border-color: rgba(0,102,255,0.22);
    border-radius: 12px 4px 12px 12px;
  }

  .st-msg-author { font-size: 10px; font-weight: 700; color: #8e8e93; margin-bottom: 2px; }
  .st-msg-time { font-size: 10px; color: #3a3a3c; margin-top: 3px; }

  .st-msg-ai {
    background: rgba(124,58,237,0.08); border: 1px solid rgba(124,58,237,0.2);
    border-radius: 10px; padding: 9px 13px; font-size: 12px; line-height: 1.6; color: #c4b5fd;
    display: flex; gap: 8px; align-items: flex-start;
  }

  /* REPLY */
  .st-reply { padding: 12px 20px 16px; flex-shrink: 0; border-top: 1px solid rgba(255,255,255,0.06); }
  .st-reply-row { display: flex; gap: 8px; }

  .st-input {
    flex: 1; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 9px; padding: 10px 13px; font-size: 12.5px; color: white;
    font-family: 'Inter', sans-serif; outline: none; resize: none;
    transition: border-color 0.15s; min-height: 44px; max-height: 120px;
  }
  .st-input:focus { border-color: #0066ff; }
  .st-input::placeholder { color: #3a3a3c; }

  .st-btn {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 8px 14px; border-radius: 8px;
    font-size: 12px; font-weight: 700; cursor: pointer; border: none;
    font-family: 'Inter', sans-serif; transition: all 0.15s; flex-shrink: 0;
  }
  .st-btn-white { background: white; color: #070708; }
  .st-btn-white:hover { background: #e8e8ed; }
  .st-btn-ghost { background: transparent; color: #8e8e93; border: 1px solid rgba(255,255,255,0.1); }
  .st-btn-ghost:hover { background: rgba(255,255,255,0.06); color: white; }
  .st-btn-green { background: rgba(0,200,83,0.12); color: #00c853; border: 1px solid rgba(0,200,83,0.2); }
  .st-btn-green:hover { background: rgba(0,200,83,0.2); }
  .st-btn-sm { padding: 5px 10px; font-size: 11px; border-radius: 6px; }
  .st-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  /* STATS */
  .st-stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 16px; }
  .st-stat { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 14px 16px; }
  .st-stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #8e8e93; font-weight: 700; margin-bottom: 5px; }
  .st-stat-value { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 24px; font-weight: 900; letter-spacing: -0.5px; }

  .st-empty { text-align: center; padding: 40px 20px; color: #3a3a3c; font-size: 13px; }
  .st-empty-icon { font-size: 28px; margin-bottom: 8px; opacity: 0.4; }

  /* SEARCH */
  .st-search {
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px; padding: 8px 12px; font-size: 12px; color: white;
    font-family: 'Inter', sans-serif; outline: none; width: 100%;
  }
  .st-search:focus { border-color: rgba(255,255,255,0.15); }
  .st-search::placeholder { color: #3a3a3c; }
`

const fmtTime = (ts) => {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return 'ahora'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

const fmtFull = (ts) => {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : ts?.seconds ? new Date(ts.seconds * 1000) : new Date(ts)
  return d.toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const shortId = (id) => id?.slice(-6).toUpperCase() || '??????'

export default function SupportTickets() {
  const [tickets, setTickets] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [filter, setFilter] = useState('open')
  const [search, setSearch] = useState('')
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    const q = query(collection(db, 'supportTickets'), orderBy('updatedAt', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selectedId, tickets])

  const selected = tickets.find(t => t.id === selectedId)

  const filtered = tickets.filter(t => {
    const matchFilter = filter === 'all' || t.status === filter || (filter === 'high' && t.priority === 'high')
    const matchSearch = !search || t.subject?.toLowerCase().includes(search.toLowerCase()) || t.clientName?.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const stats = {
    open: tickets.filter(t => t.status === 'open').length,
    pending: tickets.filter(t => t.status === 'pending').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    high: tickets.filter(t => t.priority === 'high' && t.status !== 'resolved').length,
  }

  const sendReply = async () => {
    if (!reply.trim() || !selected) return
    setSending(true)
    try {
      const msg = {
        role: 'qubit',
        text: reply.trim(),
        author: 'Qubit Corp.',
        ts: new Date().toISOString(),
      }

      // Update ticket in Firestore
      await updateDoc(doc(db, 'supportTickets', selected.id), {
        messages: arrayUnion(msg),
        status: 'pending',
        updatedAt: serverTimestamp(),
      })

      // Send via Telegram
      await fetch('/.netlify/functions/telegram-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: selected.telegramChatId,
          ticketId: shortId(selected.id),
          message: reply.trim(),
        }),
      })

      setReply('')
      toast.success('Respuesta enviada por Telegram')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSending(false)
    }
  }

  const updateStatus = async (status) => {
    if (!selected) return
    await updateDoc(doc(db, 'supportTickets', selected.id), {
      status, updatedAt: serverTimestamp()
    })
    toast.success(`Ticket ${status === 'resolved' ? 'resuelto' : 'actualizado'}`)
  }

  const FILTERS = [
    { id: 'open', label: `Abiertos (${stats.open})` },
    { id: 'pending', label: `Pendientes (${stats.pending})` },
    { id: 'resolved', label: 'Resueltos' },
    { id: 'high', label: `🔴 Urgentes (${stats.high})` },
    { id: 'all', label: 'Todos' },
  ]

  return (
    <div className="st-root sa-content" style={{ maxWidth: '100%' }}>
      <style>{css}</style>

      {/* Stats */}
      <div className="st-stats">
        <div className="st-stat">
          <div className="st-stat-label">Abiertos</div>
          <div className="st-stat-value" style={{ color: '#4d9fff' }}>{stats.open}</div>
        </div>
        <div className="st-stat">
          <div className="st-stat-label">Pendientes</div>
          <div className="st-stat-value" style={{ color: '#ff9500' }}>{stats.pending}</div>
        </div>
        <div className="st-stat">
          <div className="st-stat-label">Resueltos</div>
          <div className="st-stat-value" style={{ color: '#00c853' }}>{stats.resolved}</div>
        </div>
        <div className="st-stat">
          <div className="st-stat-label">Urgentes</div>
          <div className="st-stat-value" style={{ color: stats.high > 0 ? '#ff6b6b' : '#3a3a3c' }}>{stats.high}</div>
        </div>
      </div>

      <div className="st-layout">
        {/* Ticket list */}
        <div className="st-card">
          <div className="st-card-header">
            <div className="st-card-title">Tickets</div>
          </div>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <input className="st-search" placeholder="Buscar cliente o asunto..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="st-filters">
            {FILTERS.map(f => (
              <button key={f.id} className={clsx('st-filter', filter === f.id && 'active')} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="st-ticket-list">
            {filtered.length === 0 && (
              <div className="st-empty">
                <div className="st-empty-icon">🎫</div>
                Sin tickets {filter !== 'all' ? 'en esta categoría' : ''}
              </div>
            )}
            {filtered.map(ticket => (
              <div
                key={ticket.id}
                className={clsx('st-ticket-item', selectedId === ticket.id && 'active')}
                onClick={() => setSelectedId(ticket.id)}
              >
                <div className="st-ticket-top">
                  <span className="st-ticket-id">#{shortId(ticket.id)}</span>
                  {ticket.priority === 'high' && <span style={{ fontSize: 10 }}>🔴</span>}
                  <span className="st-ticket-subject">{ticket.subject}</span>
                  <span className="st-ticket-time">{fmtTime(ticket.updatedAt)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="st-ticket-client">
                    {ticket.clientName}{ticket.orgName ? ` · ${ticket.orgName}` : ''}
                  </span>
                  <span className={clsx('st-badge',
                    ticket.status === 'open' ? 'st-badge-open' :
                    ticket.status === 'pending' ? 'st-badge-pending' : 'st-badge-resolved'
                  )}>
                    {ticket.status === 'open' ? 'Abierto' : ticket.status === 'pending' ? 'Pendiente' : 'Resuelto'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detail */}
        <div className="st-card">
          {!selected ? (
            <div className="st-empty" style={{ paddingTop: 80 }}>
              <div className="st-empty-icon">🎫</div>
              Selecciona un ticket para ver el detalle
            </div>
          ) : (
            <div className="st-detail">
              {/* Header */}
              <div className="st-detail-header">
                <div className="st-detail-subject">{selected.subject}</div>
                <div className="st-detail-meta">
                  <span className="st-ticket-id">#{shortId(selected.id)}</span>
                  <span className={clsx('st-badge',
                    selected.status === 'open' ? 'st-badge-open' :
                    selected.status === 'pending' ? 'st-badge-pending' : 'st-badge-resolved'
                  )}>
                    {selected.status === 'open' ? 'Abierto' : selected.status === 'pending' ? 'Pendiente' : 'Resuelto'}
                  </span>
                  {selected.priority === 'high' && <span className="st-badge st-badge-high">🔴 Urgente</span>}
                  <span style={{ fontSize: 11, color: '#8e8e93' }}>
                    {selected.clientName}{selected.orgName ? ` · ${selected.orgName}` : ''}
                  </span>
                  <span style={{ fontSize: 11, color: '#3a3a3c', marginLeft: 'auto' }}>
                    {fmtFull(selected.createdAt)}
                  </span>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {selected.status !== 'resolved' && (
                      <button className="st-btn st-btn-green st-btn-sm" onClick={() => updateStatus('resolved')}>
                        ✓ Resolver
                      </button>
                    )}
                    {selected.status === 'resolved' && (
                      <button className="st-btn st-btn-ghost st-btn-sm" onClick={() => updateStatus('open')}>
                        ↺ Reabrir
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="st-messages">
                {(selected.messages || []).map((m, i) => {
                  if (m.role === 'system') return null

                  const isQubit = m.role === 'qubit'
                  const isAI = m.role === 'assistant'
                  const isUser = m.role === 'user'

                  if (isAI) {
                    return (
                      <div key={i} className="st-msg-ai">
                        <span style={{ fontSize: 14, flexShrink: 0 }}>🤖</span>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', marginBottom: 3 }}>Agente IA</div>
                          {m.text}
                          <div className="st-msg-time">{m.ts ? new Date(m.ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div key={i} className={clsx('st-msg', isQubit && 'qubit')}>
                      {!isQubit && (
                        <div className="st-msg-avatar" style={{ background: 'rgba(0,200,83,0.15)', color: '#00c853' }}>
                          {(m.author || selected.clientName)?.[0]?.toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="st-msg-bubble">
                          <div className="st-msg-author">{isQubit ? 'Qubit Corp.' : (m.author || selected.clientName)}</div>
                          {m.text}
                          <div className="st-msg-time">{m.ts ? new Date(m.ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                        </div>
                      </div>
                      {isQubit && (
                        <div className="st-msg-avatar" style={{ background: 'rgba(0,102,255,0.15)', color: '#4d9fff' }}>Q</div>
                      )}
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              {/* Reply */}
              {selected.status !== 'resolved' && (
                <div className="st-reply">
                  <div className="st-reply-row">
                    <textarea
                      className="st-input"
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      placeholder="Escribe tu respuesta — se enviará por Telegram al cliente..."
                      onKeyDown={e => {
                        if (e.key === 'Enter' && e.metaKey) sendReply()
                      }}
                      rows={2}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <button className="st-btn st-btn-white" onClick={sendReply} disabled={sending || !reply.trim()}>
                        {sending ? '...' : '📤 Enviar'}
                      </button>
                      <span style={{ fontSize: 9.5, color: '#3a3a3c', textAlign: 'center' }}>⌘↵</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
