import { useState, useRef, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'

const WELCOME_MESSAGE = {
  role: 'assistant',
  content: '¡Hola! 👋 Soy el asistente de soporte de **Flow Hub CRM**. ¿En qué puedo ayudarte? Puedo guiarte sobre cualquier módulo o funcionalidad de la plataforma.',
}

function MarkdownText({ text }) {
  // Render básico: **bold**, bullet lists, line breaks
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>
        }
        return <span key={i}>{part}</span>
      })}
    </span>
  )
}

function ChatMessage({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'} items-end`}>
      {!isUser && (
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 mb-0.5">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="4" r="2.5" fill="white" />
            <path d="M1 11c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </div>
      )}
      <div
        className={`max-w-[82%] px-3 py-2 rounded-2xl text-[12.5px] leading-relaxed whitespace-pre-wrap break-words ${
          isUser
            ? 'bg-indigo-600 text-white rounded-br-sm'
            : 'bg-[#f1f3f8] text-[#1a1a2e] rounded-bl-sm'
        }`}
      >
        <MarkdownText text={msg.content} />
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex gap-2 items-end">
      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <circle cx="6" cy="4" r="2.5" fill="white" />
          <path d="M1 11c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </div>
      <div className="bg-[#f1f3f8] px-3 py-2 rounded-2xl rounded-bl-sm flex items-center gap-1">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block"
            style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </div>
    </div>
  )
}

export default function SupportChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasUnread, setHasUnread] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const { user } = useAuthStore()

  useEffect(() => {
    if (open) {
      setHasUnread(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg = { role: 'user', content: text }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/.netlify/functions/tech-support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages
            .filter(m => m.role !== 'system')
            .map(m => ({ role: m.role, content: m.content })),
        }),
      })

      const data = await res.json()
      const reply = data.reply || 'Lo siento, ocurrió un error. Intenta de nuevo.'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
      if (!open) setHasUnread(true)
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Hubo un error de conexión. Por favor intenta de nuevo.',
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const QUICK_QUESTIONS = [
    '¿Cómo agrego un lead?',
    '¿Cómo invito a mi equipo?',
    '¿Cómo conecto WhatsApp?',
  ]

  return (
    <>
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes chat-in {
          from { opacity: 0; transform: scale(0.92) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .support-chat-window {
          animation: chat-in 0.22s cubic-bezier(0.34,1.56,0.64,1);
          transform-origin: bottom right;
        }
      `}</style>

      {/* Floating button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-5 right-5 z-50 w-13 h-13 rounded-full shadow-xl flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
        style={{
          width: 52,
          height: 52,
          background: open
            ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
            : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
          boxShadow: '0 4px 24px rgba(99,102,241,0.45)',
        }}
        title="Soporte técnico"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M5 5l10 10M15 5L5 15" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M11 2C6.03 2 2 5.86 2 10.6c0 2.42 1.04 4.6 2.72 6.17L4 20l3.47-1.1C8.57 19.28 9.76 19.5 11 19.5 15.97 19.5 20 15.64 20 10.6S15.97 2 11 2z" fill="white" opacity="0.9" />
            <circle cx="8" cy="10.5" r="1.1" fill="#4f46e5" />
            <circle cx="11" cy="10.5" r="1.1" fill="#4f46e5" />
            <circle cx="14" cy="10.5" r="1.1" fill="#4f46e5" />
          </svg>
        )}
        {hasUnread && !open && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
        )}
      </button>

      {/* Chat window */}
      {open && (
        <div
          className="support-chat-window fixed bottom-[72px] right-5 z-50 flex flex-col rounded-2xl overflow-hidden"
          style={{
            width: 340,
            height: 480,
            background: '#ffffff',
            boxShadow: '0 8px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
            border: '1px solid rgba(99,102,241,0.12)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
          >
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="5.5" r="3" fill="white" />
                <path d="M2 15c0-3.31 2.69-6 6-6s6 2.69 6 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-semibold text-[13px] leading-tight">Soporte Flow Hub</div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                <span className="text-white/70 text-[11px]">Asistente IA · En línea</span>
              </div>
            </div>
            <button
              onClick={() => {
                setMessages([WELCOME_MESSAGE])
                setInput('')
              }}
              className="text-white/60 hover:text-white/90 transition-colors text-[11px] px-2 py-1 rounded-lg hover:bg-white/10"
              title="Reiniciar chat"
            >
              Reiniciar
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2.5">
            {messages.map((msg, i) => (
              <ChatMessage key={i} msg={msg} />
            ))}
            {loading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick questions (only shown when just welcome message) */}
          {messages.length === 1 && !loading && (
            <div className="px-3 pb-2 flex flex-col gap-1.5 flex-shrink-0">
              <p className="text-[10.5px] text-gray-400 font-medium px-0.5">Preguntas frecuentes</p>
              {QUICK_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={async () => {
                    if (loading) return
                    const userMsg = { role: 'user', content: q }
                    const nextMessages = [...messages, userMsg]
                    setMessages(nextMessages)
                    setLoading(true)
                    try {
                      const res = await fetch('/.netlify/functions/tech-support', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
                        }),
                      })
                      const data = await res.json()
                      setMessages(prev => [...prev, { role: 'assistant', content: data.reply || 'Error al obtener respuesta.' }])
                    } catch {
                      setMessages(prev => [...prev, { role: 'assistant', content: 'Error de conexión. Intenta de nuevo.' }])
                    } finally {
                      setLoading(false)
                    }
                  }}
                  className="text-left text-[12px] text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition-colors font-medium"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex items-end gap-2 px-3 py-2.5 border-t border-gray-100 flex-shrink-0">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Escribe tu pregunta…"
              rows={1}
              disabled={loading}
              className="flex-1 resize-none text-[13px] text-gray-800 placeholder-gray-400 outline-none bg-[#f5f6fa] rounded-xl px-3 py-2 leading-relaxed max-h-20 overflow-y-auto"
              style={{ minHeight: 36 }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-150"
              style={{
                background: input.trim() && !loading
                  ? 'linear-gradient(135deg, #4f46e5, #7c3aed)'
                  : '#e5e7eb',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M12.5 7L2 2l2.5 5L2 12l10.5-5z" fill={input.trim() && !loading ? 'white' : '#9ca3af'} />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
