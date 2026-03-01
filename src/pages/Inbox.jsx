import { useState, useEffect, useRef } from 'react'
import {
  collection, onSnapshot, query, orderBy,
  doc, updateDoc, serverTimestamp, limit
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { format, isToday, isYesterday } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { MessageCircle, Facebook, Instagram, MousePointerClick, Globe, MessageSquare, Zap, User } from 'lucide-react'

const CHANNEL_CONFIG = {
  whatsapp: { label: 'WhatsApp', icon: MessageCircle, color: '#25D366', bg: '#e8fdf0' },
  messenger: { label: 'Messenger', icon: Facebook, color: '#0084ff', bg: '#e8f4ff' },
  instagram: { label: 'Instagram', icon: Instagram, color: '#e1306c', bg: '#fdeef3' },
  facebook_leads: { label: 'Lead Ads', icon: MousePointerClick, color: '#1877f2', bg: '#eaf1ff' },
  web: { label: 'Web', icon: Globe, color: '#6366f1', bg: '#f0f0ff' },
}

const ROLE_CONFIG = {
  user: { label: 'Lead', align: 'left' },
  agent: { label: 'Tú', align: 'right' },
  bot: { label: 'IA', align: 'right' },
}

function formatMsgTime(ts) {
  if (!ts?.toDate) return ''
  const d = ts.toDate()
  if (isToday(d)) return format(d, 'HH:mm')
  if (isYesterday(d)) return 'Ayer'
  return format(d, 'd MMM', { locale: es })
}

function ChannelBadge({ channel, size = 'sm' }) {
  const cfg = CHANNEL_CONFIG[channel] || CHANNEL_CONFIG.web
  const Icon = cfg.icon
  return (
    <span className={clsx('font-bold rounded-full flex items-center gap-1', size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-[11px] px-2.5 py-1')}
      style={{ background: cfg.bg, color: cfg.color }}>
      <Icon size={size === 'sm' ? 10 : 12} /> {cfg.label}
    </span>
  )
}

// ── CONVERSATION VIEW ──
function ConversationView({ lead, orgId }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingAI, setLoadingAI] = useState(false)
  const bottomRef = useRef()
  const inputRef = useRef()

  const activeChannel = lead.lastMessageChannel || 'web'

  useEffect(() => {
    if (!lead?.id) return
    const q = query(
      collection(db, 'organizations', orgId, 'leads', lead.id, 'conversations'),
      orderBy('createdAt', 'asc'),
      limit(100)
    )
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })

    // Mark as read
    updateDoc(doc(db, 'organizations', orgId, 'leads', lead.id), { hasUnread: false })

    return () => unsub()
  }, [lead?.id, orgId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!text.trim() || sending) return
    setSending(true)
    const msg = text.trim()
    setText('')
    try {
      await fetch('/.netlify/functions/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, leadId: lead.id, text: msg, channel: activeChannel }),
      })
    } catch {
      toast.error('Error al enviar')
      setText(msg)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const handleAISuggest = async () => {
    if (messages.length === 0) return
    setLoadingAI(true)
    try {
      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.text || ''
      const res = await fetch('/.netlify/functions/gen-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          news: { title: `Responder a: ${lastUserMsg}`, summary: `Lead: ${lead.name}`, viralAngle: '' },
          networks: [],
          agentConfig: { personality: 'amigable' },
          mode: 'reply',
        }),
      })
    } catch { }

    // Simulated AI suggest for now
    const suggestions = [
      `Hola ${lead.name}, gracias por escribirnos. ¿En qué te podemos ayudar hoy?`,
      `${lead.name}, con gusto te ayudo. ¿Tienes unos minutos para una llamada rápida?`,
      `Entendido ${lead.name}. Te confirmo que podemos ayudarte con eso. ¿Cuándo sería buen momento para hablar?`,
    ]
    setText(suggestions[Math.floor(Math.random() * suggestions.length)])
    setLoadingAI(false)
    inputRef.current?.focus()
  }

  const groupedMessages = messages.reduce((groups, msg) => {
    const ts = msg.createdAt?.toDate?.()
    const dateKey = ts ? format(ts, 'yyyy-MM-dd') : 'unknown'
    if (!groups[dateKey]) groups[dateKey] = []
    groups[dateKey].push(msg)
    return groups
  }, {})

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Chat header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-black/[0.08] flex-shrink-0 bg-surface">
        <div className="w-9 h-9 rounded-full bg-surface-2 border border-black/[0.08] flex items-center justify-center font-display font-bold text-sm text-primary flex-shrink-0">
          {lead.name?.charAt(0)?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-[13.5px] text-primary truncate">{lead.name}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <ChannelBadge channel={activeChannel} />
            {lead.phone && <span className="text-[10px] text-tertiary">{lead.phone}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleAISuggest}
            disabled={loadingAI || messages.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border border-black/[0.1] text-secondary hover:border-accent-purple hover:text-accent-purple transition-all disabled:opacity-40"
          >
            {loadingAI ? <div className="w-3 h-3 border border-current/30 border-t-current rounded-full animate-spin" /> : <Zap size={13} />}
            Sugerir respuesta IA
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-1">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-black/[0.08] flex items-center justify-center text-secondary mb-2">
              {(() => { const Icon = CHANNEL_CONFIG[activeChannel]?.icon || Globe; return <Icon size={32} /> })()}
            </div>
            <p className="text-sm text-secondary">Sin mensajes aún</p>
            <p className="text-xs text-tertiary">Cuando el lead escriba, aparecerá aquí en tiempo real</p>
          </div>
        ) : (
          Object.entries(groupedMessages).map(([date, msgs]) => (
            <div key={date}>
              {/* Date separator */}
              <div className="flex items-center gap-3 my-3">
                <div className="flex-1 h-px bg-black/[0.06]" />
                <span className="text-[10px] font-semibold text-tertiary">
                  {isToday(new Date(date)) ? 'Hoy' : isYesterday(new Date(date)) ? 'Ayer' : format(new Date(date), 'd MMM yyyy', { locale: es })}
                </span>
                <div className="flex-1 h-px bg-black/[0.06]" />
              </div>

              {msgs.map((msg, i) => {
                const isOutbound = msg.role === 'agent' || msg.role === 'bot'
                const showLabel = i === 0 || msgs[i - 1]?.role !== msg.role

                return (
                  <div key={msg.id} className={clsx('flex flex-col mb-1', isOutbound ? 'items-end' : 'items-start')}>
                    {showLabel && (
                      <span className="flex items-center gap-1 text-[9px] font-bold text-tertiary uppercase tracking-wide mb-1 px-1">
                        {msg.role === 'bot' ? <><Zap size={10} className="text-accent-purple" /> Agente IA</> : msg.role === 'agent' ? <><User size={10} /> Tú</> : lead.name}
                      </span>
                    )}
                    <div className={clsx(
                      'max-w-[75%] px-4 py-2.5 rounded-2xl text-[13.5px] leading-relaxed',
                      isOutbound
                        ? 'rounded-tr-sm text-white'
                        : 'rounded-tl-sm bg-surface-2 border border-black/[0.08] text-primary'
                    )}
                      style={isOutbound ? { background: msg.role === 'bot' ? '#7c3aed' : '#0066ff' } : {}}
                    >
                      {msg.text}
                    </div>
                    <span className="text-[9px] text-tertiary mt-0.5 px-1">{formatMsgTime(msg.createdAt)}</span>
                  </div>
                )
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-black/[0.08] flex-shrink-0 bg-surface">
        <div className="flex items-end gap-2">
          <div className="flex-1 bg-surface-2 border border-black/[0.1] rounded-[14px] px-4 py-2.5 flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder={`Responder por ${CHANNEL_CONFIG[activeChannel]?.label}...`}
              rows={1}
              className="flex-1 bg-transparent outline-none text-[13.5px] text-primary resize-none max-h-24 leading-relaxed"
              style={{ minHeight: 22 }}
            />
            <ChannelBadge channel={activeChannel} />
          </div>
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            className="w-10 h-10 rounded-[12px] flex items-center justify-center transition-all disabled:opacity-30 flex-shrink-0"
            style={{ background: '#0066ff' }}
          >
            {sending
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M14 8L2 2l3 6-3 6 12-6z" fill="white" /></svg>
            }
          </button>
        </div>
        <p className="text-[10px] text-tertiary mt-1.5 px-1">Enter para enviar · Shift+Enter para nueva línea</p>
      </div>
    </div>
  )
}

// ── MAIN INBOX ──
export default function Inbox() {
  const { org } = useAuthStore()
  const [leads, setLeads] = useState([])
  const [selectedLead, setSelectedLead] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all | unread | whatsapp | messenger | instagram
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!org?.id) return
    const q = query(
      collection(db, 'organizations', org.id, 'leads'),
      orderBy('lastMessageAt', 'desc'),
      limit(100)
    )
    const unsub = onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      // Only leads that have had a conversation
      setLeads(all.filter(l => l.lastMessageAt))
      setLoading(false)
    })
    return () => unsub()
  }, [org?.id])

  const filteredLeads = leads.filter(lead => {
    if (search && !lead.name?.toLowerCase().includes(search.toLowerCase()) &&
      !lead.phone?.includes(search)) return false
    if (filter === 'unread') return lead.hasUnread
    if (filter !== 'all') return lead.lastMessageChannel === filter
    return true
  })

  const unreadCount = leads.filter(l => l.hasUnread).length

  return (
    <div className="h-full flex overflow-hidden">

      {/* LEFT — conversation list */}
      <div className="w-[300px] min-w-[300px] border-r border-black/[0.08] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-5 py-4 border-b border-black/[0.08] flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-display font-bold text-[15px] tracking-tight">Inbox</h1>
            {unreadCount > 0 && (
              <span className="text-[10px] font-bold bg-accent-blue text-white px-2 py-0.5 rounded-full">
                {unreadCount} nuevos
              </span>
            )}
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar conversación..."
            className="input text-sm py-2"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-0 px-3 py-2 border-b border-black/[0.06] overflow-x-auto flex-shrink-0">
          {[
            ['all', 'Todos'],
            ['unread', `No leídos${unreadCount > 0 ? ` (${unreadCount})` : ''}`],
            ['whatsapp', <MessageCircle size={14} key="wa" />],
            ['messenger', <Facebook size={14} key="ms" />],
            ['instagram', <Instagram size={14} key="ig" />],
          ].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={clsx('px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap',
                filter === v ? 'bg-primary text-white' : 'text-secondary hover:bg-surface-2'
              )}>{l}</button>
          ))}
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-black/10 border-t-primary rounded-full animate-spin" />
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-12 h-12 rounded-xl bg-surface-2 border border-black/[0.08] flex items-center justify-center text-secondary mx-auto mb-3"><MessageSquare size={24} /></div>
              <p className="text-sm text-secondary font-semibold">Sin conversaciones</p>
              <p className="text-xs text-tertiary mt-1">
                {filter !== 'all' ? 'Cambia el filtro' : 'Los mensajes de tus canales aparecerán aquí'}
              </p>
            </div>
          ) : (
            filteredLeads.map(lead => {
              const ch = CHANNEL_CONFIG[lead.lastMessageChannel] || CHANNEL_CONFIG.web
              const isSelected = selectedLead?.id === lead.id
              return (
                <div key={lead.id}
                  onClick={() => setSelectedLead(lead)}
                  className={clsx(
                    'flex items-start gap-3 px-4 py-3.5 cursor-pointer border-b border-black/[0.04] transition-colors',
                    isSelected ? 'bg-blue-50 border-l-2 border-l-accent-blue' : 'hover:bg-surface-2',
                    lead.hasUnread && !isSelected && 'bg-amber-50/50'
                  )}>

                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-surface-2 border border-black/[0.08] flex items-center justify-center font-display font-bold text-sm text-primary">
                      {lead.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full border-[1.5px] border-white flex items-center justify-center"
                      style={{ background: ch.bg }}>
                      {(() => { const Icon = ch.icon; return <Icon size={8} color={ch.color} strokeWidth={3} /> })()}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className={clsx('text-[13px] truncate', lead.hasUnread ? 'font-bold text-primary' : 'font-semibold text-primary')}>
                        {lead.name}
                      </span>
                      <span className="text-[10px] text-tertiary flex-shrink-0">
                        {formatMsgTime(lead.lastMessageAt)}
                      </span>
                    </div>
                    <p className={clsx('text-[11.5px] truncate', lead.hasUnread ? 'text-primary font-semibold' : 'text-secondary')}>
                      {lead.lastMessage || 'Sin mensajes'}
                    </p>
                    {lead.hasUnread && (
                      <div className="w-2 h-2 rounded-full bg-accent-blue mt-1" />
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* RIGHT — chat view */}
      <div className="flex-1 overflow-hidden">
        {selectedLead ? (
          <ConversationView lead={selectedLead} orgId={org?.id} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-black/[0.08] flex items-center justify-center text-secondary"><MessageSquare size={32} /></div>
            <div>
              <p className="font-display font-bold text-lg text-primary mb-1">Inbox unificado</p>
              <p className="text-sm text-secondary max-w-xs">Todos tus canales en un solo lugar. Selecciona una conversación para empezar.</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {Object.entries(CHANNEL_CONFIG).map(([key, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <span key={key} className="text-[11px] font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5" style={{ background: cfg.bg, color: cfg.color }}>
                    <Icon size={12} /> {cfg.label}
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
