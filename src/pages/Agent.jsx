import { useState, useEffect, useRef } from 'react'
import { doc, onSnapshot, collection, query, orderBy, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { useProducts } from '@/hooks/useProducts'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import {
  Bot, Brain, Package, BarChart2, Zap,
  FileText, Trash2, Plus, X, Clock,
  ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle2, MessageSquare, User
} from 'lucide-react'

// ─── TABS ────────────────────────────────────────────────────────
const TABS = [
  { id: 'identity',  icon: Bot,       label: 'Identidad'     },
  { id: 'knowledge', icon: Brain,     label: 'Conocimiento'  },
  { id: 'products',  icon: Package,   label: 'Productos'     },
  { id: 'scoring',   icon: BarChart2, label: 'Scoring'       },
  { id: 'test',      icon: Zap,       label: 'Probar'        },
]

// ─── SCORING CATALOG ─────────────────────────────────────────────
const SCORING_CATALOG = {
  necesidad: {
    label: 'Necesidad',
    desc: '¿Tiene un problema real que resolver?',
    color: '#0066ff',
    bg: 'rgba(0,102,255,0.08)',
    border: 'rgba(0,102,255,0.2)',
    subcategories: {
      urgencia: {
        label: 'Urgencia',
        signals: [
          { id: 'n_u_1', text: 'Tiene fecha límite explícita o consecuencia de no actuar', type: 'up' },
          { id: 'n_u_2', text: 'El problema ya le está costando dinero o tiempo hoy', type: 'up' },
          { id: 'n_u_3', text: 'Lo describe con emoción o frustración — dolor activo', type: 'up' },
          { id: 'n_u_4', text: 'Es un deseo futuro sin presión de tiempo', type: 'down' },
        ]
      },
      claridad: {
        label: 'Claridad del problema',
        signals: [
          { id: 'n_c_1', text: 'Sabe exactamente qué necesita y lo describe con detalle', type: 'up' },
          { id: 'n_c_2', text: 'Lo que describe encaja directamente con lo que se vende', type: 'up' },
          { id: 'n_c_3', text: 'Está explorando sin claridad — confunde síntomas con problema', type: 'down' },
        ]
      },
      historial: {
        label: 'Historial',
        signals: [
          { id: 'n_h_1', text: 'Ya intentó resolver esto antes y sabe por qué falló', type: 'up' },
          { id: 'n_h_2', text: 'El problema le ha costado algo concreto — historial de impacto', type: 'up' },
          { id: 'n_h_3', text: 'Nunca ha intentado resolverlo — problema nuevo sin historial', type: 'down' },
        ]
      }
    }
  },
  capacidad: {
    label: 'Capacidad',
    desc: '¿Puede comprar? — El filtro más duro.',
    color: '#00875a',
    bg: 'rgba(0,135,90,0.08)',
    border: 'rgba(0,135,90,0.2)',
    subcategories: {
      presupuesto: {
        label: 'Presupuesto',
        signals: [
          { id: 'c_p_1', text: 'Mencionó presupuesto disponible o dio un rango espontáneamente', type: 'up' },
          { id: 'c_p_2', text: 'Está dispuesto a invertir más si percibe el valor', type: 'up' },
          { id: 'c_p_3', text: 'Preguntó por financiamiento — interés sin liquidez inmediata', type: 'up' },
          { id: 'c_p_4', text: 'Evadió la pregunta de presupuesto', type: 'down' },
          { id: 'c_p_5', text: 'Dijo que no tiene presupuesto asignado aún', type: 'down' },
        ]
      },
      autoridad: {
        label: 'Autoridad',
        signals: [
          { id: 'c_a_1', text: 'Confirmó que él decide solo sin consultar a nadie', type: 'up' },
          { id: 'c_a_2', text: 'Necesita consultar con una persona — proceso más largo pero viable', type: 'down' },
          { id: 'c_a_3', text: 'Habla en plural sin aclarar quién decide', type: 'down' },
        ]
      },
      proceso: {
        label: 'Proceso de compra',
        signals: [
          { id: 'c_pr_1', text: 'Puede comprar en una sola conversación', type: 'up' },
          { id: 'c_pr_2', text: 'La compra depende de que suceda algo primero', type: 'down' },
          { id: 'c_pr_3', text: 'Mencionó que siempre tarda mucho en decidir', type: 'down' },
        ]
      }
    }
  },
  intencion: {
    label: 'Intención',
    desc: '¿Quiere comprar ahora? — Define la velocidad del cierre.',
    color: '#b45309',
    bg: 'rgba(180,83,9,0.08)',
    border: 'rgba(180,83,9,0.2)',
    subcategories: {
      horizonte: {
        label: 'Horizonte de compra',
        signals: [
          { id: 'i_h_1', text: 'Quiere resolver esto esta semana o en el mes', type: 'up' },
          { id: 'i_h_2', text: 'Algo específico detonó que buscara solución ahora', type: 'up' },
          { id: 'i_h_3', text: 'Lleva tiempo pensándolo y finalmente actuó', type: 'up' },
          { id: 'i_h_4', text: 'No tiene ningún horizonte definido — curiosidad sin compromiso', type: 'down' },
        ]
      },
      evaluacion: {
        label: 'Nivel de evaluación',
        signals: [
          { id: 'i_e_1', text: 'Ya evaluó otras opciones y las descartó — listo para decidir', type: 'up' },
          { id: 'i_e_2', text: 'No está comparando, llegó directo', type: 'up' },
          { id: 'i_e_3', text: 'Pregunta por diferenciadores específicos', type: 'up' },
          { id: 'i_e_4', text: 'Solo pregunta por precio sin contexto — exploración superficial', type: 'down' },
        ]
      },
      avance: {
        label: 'Señales de avance',
        signals: [
          { id: 'i_a_1', text: 'Él propone los siguientes pasos de la conversación', type: 'up' },
          { id: 'i_a_2', text: 'Pregunta por formas de pago o garantías', type: 'up' },
          { id: 'i_a_3', text: 'Volvió a escribir por iniciativa propia después de silencio', type: 'up' },
          { id: 'i_a_4', text: 'Cumplió algo que prometió en la conversación', type: 'up' },
        ]
      }
    }
  },
  confianza: {
    label: 'Confianza',
    desc: '¿Confía en ti y en el producto? — Se construye con el tiempo.',
    color: '#5b21b6',
    bg: 'rgba(91,33,182,0.08)',
    border: 'rgba(91,33,182,0.2)',
    subcategories: {
      apertura: {
        label: 'Apertura',
        signals: [
          { id: 'co_a_1', text: 'Comparte información de su situación sin que le pregunten', type: 'up' },
          { id: 'co_a_2', text: 'Admite sus dudas o miedos abiertamente', type: 'up' },
          { id: 'co_a_3', text: 'El tono cambió de frío a cálido durante la conversación', type: 'up' },
          { id: 'co_a_4', text: 'Es reservado y evita dar información concreta', type: 'down' },
        ]
      },
      receptividad: {
        label: 'Receptividad',
        signals: [
          { id: 'co_r_1', text: 'Acepta la información y hace preguntas de seguimiento', type: 'up' },
          { id: 'co_r_2', text: 'Cuando resuelves una objeción avanza — señal muy positiva', type: 'up' },
          { id: 'co_r_3', text: 'Cuando resuelves una objeción aparece otra — desconfianza', type: 'down' },
        ]
      },
      consistencia: {
        label: 'Consistencia',
        signals: [
          { id: 'co_c_1', text: 'Sus respuestas son coherentes entre mensajes', type: 'up' },
          { id: 'co_c_2', text: 'Hace lo que dice que va a hacer', type: 'up' },
          { id: 'co_c_3', text: 'Contradijo algo que dijo antes', type: 'down' },
          { id: 'co_c_4', text: 'Nunca cumple lo que promete en la conversación', type: 'down' },
        ]
      }
    }
  }
}

const DEFAULT_SCORING = Object.fromEntries(
  Object.entries(SCORING_CATALOG).map(([catId, cat]) => [
    catId,
    {
      cap: 25,
      subcategories: Object.fromEntries(
        Object.entries(cat.subcategories).map(([subId, sub]) => [
          subId,
          {
            cap: 10,
            signals: Object.fromEntries(
              sub.signals.map(s => [s.id, { enabled: true, pts: s.type === 'up' ? 10 : 5 }])
            ),
            customSignals: []
          }
        ])
      )
    }
  ])
)

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
]

// ─── SECTION ─────────────────────────────────────────────────────
function Section({ title, desc, children, action }) {
  return (
    <div className="card p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-display font-bold text-sm text-primary">{title}</h3>
          {desc && <p className="text-xs text-secondary mt-0.5">{desc}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

// ─── TEST PANEL ──────────────────────────────────────────────────
function TestPanel({ orgId, config }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [clearing, setClearing] = useState(false)
  const bottomRef = useRef()

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendMessage = async () => {
    if (!text.trim() || loading) return
    const userMsg = text.trim()
    setText('')
    setMessages(m => [...m, { role: 'user', text: userMsg }])
    setLoading(true)
    try {
      const res = await fetch('/.netlify/functions/agent-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'chat', orgId, leadId: 'test', message: userMsg }),
      })
      const data = await res.json()
      setMessages(m => [...m, { role: 'agent', text: data.response || 'Sin respuesta' }])
    } catch {
      setMessages(m => [...m, { role: 'agent', text: 'Error al conectar con el agente.' }])
    } finally { setLoading(false) }
  }

  const clearConversation = async () => {
    setClearing(true)
    try {
      await fetch('/.netlify/functions/agent-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_thread', orgId, leadId: 'test' }),
      })
      setMessages([])
    } catch { setMessages([]) }
    finally { setClearing(false) }
  }

  return (
    <div className="card overflow-hidden flex flex-col" style={{ height: 480 }}>
      <div className="px-5 py-3.5 border-b border-black/[0.06] flex items-center gap-2 flex-shrink-0">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="font-display font-bold text-sm">Simulador de conversación</span>
        <span className="text-xs text-tertiary ml-auto">Simula cómo responde el agente</span>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-surface-2 border border-black/[0.08] flex items-center justify-center text-secondary mx-auto mb-3">
                <MessageSquare size={24} />
              </div>
              <p className="text-sm text-secondary">Escribe algo para probar al agente</p>
              <p className="text-xs text-tertiary mt-1">Ej: "Hola, me interesa saber más"</p>
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={clsx('flex flex-col', msg.role === 'user' ? 'items-end' : 'items-start')}>
            <span className="flex items-center gap-1 text-[9px] font-bold text-tertiary uppercase tracking-wide mb-1">
              {msg.role === 'user'
                ? <><User size={10} /> Tú (simulando lead)</>
                : <><Bot size={10} className="text-accent-purple" /> {config.agentName || 'Agente'}</>}
            </span>
            <div className={clsx(
              'max-w-[80%] px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed',
              msg.role === 'user'
                ? 'bg-surface-2 border border-black/[0.08] text-primary rounded-tr-sm'
                : 'text-white rounded-tl-sm'
            )} style={msg.role === 'agent' ? { background: '#7c3aed' } : {}}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-start">
            <div className="px-4 py-3 rounded-2xl rounded-tl-sm flex gap-1" style={{ background: '#7c3aed' }}>
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="px-4 py-3 border-t border-black/[0.06] flex gap-2 flex-shrink-0">
        <input
          value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') sendMessage() }}
          placeholder="Escribe como si fueras el lead..."
          className="flex-1 input text-sm py-2"
        />
        <button onClick={sendMessage} disabled={!text.trim() || loading}
          className="btn-primary px-4 py-2 text-sm disabled:opacity-40">Enviar</button>
        <button onClick={clearConversation} disabled={clearing}
          className="btn-secondary px-3 py-2 text-sm disabled:opacity-40">
          {clearing ? '...' : 'Nueva conversación'}
        </button>
      </div>
    </div>
  )
}

// ─── SCORING TAB ─────────────────────────────────────────────────
function ScoringTab({ scoring, onChange }) {
  const [openCats, setOpenCats] = useState({ necesidad: true, capacidad: false, intencion: false, confianza: false })
  const [openSubs, setOpenSubs] = useState({})
  const [newSignalText, setNewSignalText] = useState({})
  const [newSignalType, setNewSignalType] = useState({})

  const toggleCat = id => setOpenCats(s => ({ ...s, [id]: !s[id] }))
  const toggleSub = id => setOpenSubs(s => ({ ...s, [id]: !s[id] }))

  const updateCatCap = (catId, val) => {
    onChange({ ...scoring, [catId]: { ...scoring[catId], cap: Number(val) } })
  }

  const updateSubCap = (catId, subId, val) => {
    const cat = scoring[catId]
    onChange({
      ...scoring,
      [catId]: {
        ...cat,
        subcategories: {
          ...cat.subcategories,
          [subId]: { ...cat.subcategories[subId], cap: Number(val) }
        }
      }
    })
  }

  const toggleSignal = (catId, subId, sigId) => {
    const sub = scoring[catId].subcategories[subId]
    const sig = sub.signals[sigId]
    onChange({
      ...scoring,
      [catId]: {
        ...scoring[catId],
        subcategories: {
          ...scoring[catId].subcategories,
          [subId]: {
            ...sub,
            signals: { ...sub.signals, [sigId]: { ...sig, enabled: !sig.enabled } }
          }
        }
      }
    })
  }

  const updateSignalPts = (catId, subId, sigId, val) => {
    const sub = scoring[catId].subcategories[subId]
    const sig = sub.signals[sigId]
    onChange({
      ...scoring,
      [catId]: {
        ...scoring[catId],
        subcategories: {
          ...scoring[catId].subcategories,
          [subId]: {
            ...sub,
            signals: { ...sub.signals, [sigId]: { ...sig, pts: Number(val) } }
          }
        }
      }
    })
  }

  const addCustomSignal = (catId, subId) => {
    const key = `${catId}_${subId}`
    const text = (newSignalText[key] || '').trim()
    if (!text) return
    const type = newSignalType[key] || 'up'
    const sub = scoring[catId].subcategories[subId]
    const newSig = { id: `custom_${Date.now()}`, text, type, pts: 10, enabled: true }
    onChange({
      ...scoring,
      [catId]: {
        ...scoring[catId],
        subcategories: {
          ...scoring[catId].subcategories,
          [subId]: {
            ...sub,
            customSignals: [...(sub.customSignals || []), newSig]
          }
        }
      }
    })
    setNewSignalText(s => ({ ...s, [key]: '' }))
  }

  const removeCustomSignal = (catId, subId, sigIdx) => {
    const sub = scoring[catId].subcategories[subId]
    onChange({
      ...scoring,
      [catId]: {
        ...scoring[catId],
        subcategories: {
          ...scoring[catId].subcategories,
          [subId]: {
            ...sub,
            customSignals: sub.customSignals.filter((_, i) => i !== sigIdx)
          }
        }
      }
    })
  }

  const updateCustomSignalPts = (catId, subId, sigIdx, val) => {
    const sub = scoring[catId].subcategories[subId]
    const updated = sub.customSignals.map((s, i) => i === sigIdx ? { ...s, pts: Number(val) } : s)
    onChange({
      ...scoring,
      [catId]: {
        ...scoring[catId],
        subcategories: {
          ...scoring[catId].subcategories,
          [subId]: { ...sub, customSignals: updated }
        }
      }
    })
  }

  // Total score calculado
  const totalCap = Object.values(scoring).reduce((sum, cat) => sum + (cat.cap || 0), 0)

  return (
    <div className="flex flex-col gap-4">
      {/* Header info */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-[12px]">
        <BarChart2 size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[12.5px] text-blue-800 font-semibold mb-0.5">Sistema de scoring jerárquico</p>
          <p className="text-[11.5px] text-blue-700 leading-relaxed">
            Cada categoría tiene un tope máximo. Las señales suman dentro de su subcategoría,
            las subcategorías suman dentro de su categoría. El total máximo es la suma de los 4 topes.
          </p>
        </div>
      </div>

      {/* Score total indicator */}
      <div className="card p-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold text-secondary uppercase tracking-wide">Score máximo total</p>
          <p className="text-[11px] text-tertiary mt-0.5">Suma de los topes de las 4 categorías</p>
        </div>
        <div className="text-right">
          <span className="font-display font-bold text-2xl text-primary">{totalCap}</span>
          <span className="text-sm text-secondary ml-1">pts</span>
        </div>
      </div>

      {/* Categories */}
      {Object.entries(SCORING_CATALOG).map(([catId, catDef]) => {
        const catConfig = scoring[catId] || { cap: 25, subcategories: {} }
        const isOpen = openCats[catId]

        return (
          <div key={catId} className="card overflow-hidden">
            {/* Category header */}
            <div
              className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-black/[0.02] transition-colors"
              onClick={() => toggleCat(catId)}
            >
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: catDef.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-sm text-primary">{catDef.label}</span>
                  <span className="text-[10px] text-secondary">{catDef.desc}</span>
                </div>
              </div>
              {/* Cap input */}
              <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                <span className="text-[10px] font-bold text-secondary uppercase tracking-wide">Tope</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={catConfig.cap}
                  onChange={e => updateCatCap(catId, e.target.value)}
                  className="w-14 text-center input text-sm py-1 font-bold"
                  style={{ borderColor: catDef.color + '60' }}
                />
                <span className="text-[10px] text-secondary">pts</span>
              </div>
              {isOpen ? <ChevronUp size={14} className="text-tertiary flex-shrink-0" /> : <ChevronDown size={14} className="text-tertiary flex-shrink-0" />}
            </div>

            {/* Subcategories */}
            {isOpen && (
              <div className="border-t border-black/[0.06]">
                {Object.entries(catDef.subcategories).map(([subId, subDef]) => {
                  const subKey = `${catId}_${subId}`
                  const subConfig = catConfig.subcategories?.[subId] || { cap: 10, signals: {}, customSignals: [] }
                  const isSubOpen = openSubs[subKey]
                  const newKey = `${catId}_${subId}`

                  return (
                    <div key={subId} className="border-b border-black/[0.04] last:border-b-0">
                      {/* Subcategory header */}
                      <div
                        className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-black/[0.02] transition-colors"
                        style={{ paddingLeft: 28 }}
                        onClick={() => toggleSub(subKey)}
                      >
                        <span className="text-[12.5px] font-semibold text-primary flex-1">{subDef.label}</span>
                        <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                          <span className="text-[10px] text-tertiary">Tope</span>
                          <input
                            type="number"
                            min={1}
                            max={50}
                            value={subConfig.cap}
                            onChange={e => updateSubCap(catId, subId, e.target.value)}
                            className="w-12 text-center input text-xs py-0.5"
                          />
                          <span className="text-[10px] text-tertiary">pts</span>
                        </div>
                        {isSubOpen
                          ? <ChevronUp size={12} className="text-tertiary flex-shrink-0" />
                          : <ChevronDown size={12} className="text-tertiary flex-shrink-0" />}
                      </div>

                      {/* Signals */}
                      {isSubOpen && (
                        <div className="px-5 pb-4" style={{ paddingLeft: 36 }}>
                          {/* Catalog signals */}
                          <div className="flex flex-col gap-1.5 mb-3">
                            {subDef.signals.map(sig => {
                              const sigConfig = subConfig.signals?.[sig.id] || { enabled: true, pts: 10 }
                              return (
                                <div key={sig.id} className={clsx(
                                  'flex items-center gap-3 px-3 py-2 rounded-[8px] border transition-all',
                                  sigConfig.enabled
                                    ? 'bg-surface border-black/[0.08]'
                                    : 'bg-surface-2 border-black/[0.04] opacity-50'
                                )}>
                                  {/* Toggle */}
                                  <div
                                    onClick={() => toggleSignal(catId, subId, sig.id)}
                                    className={clsx(
                                      'w-8 h-4 rounded-full cursor-pointer transition-all relative flex-shrink-0',
                                      sigConfig.enabled ? 'bg-accent-blue' : 'bg-black/20'
                                    )}>
                                    <div className={clsx(
                                      'absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all',
                                      sigConfig.enabled ? 'left-4' : 'left-0.5'
                                    )} />
                                  </div>

                                  {/* Type badge */}
                                  <span className={clsx(
                                    'text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0',
                                    sig.type === 'up'
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-red-100 text-red-600'
                                  )}>
                                    {sig.type === 'up' ? '▲' : '▼'}
                                  </span>

                                  {/* Text */}
                                  <span className="text-[12px] text-primary flex-1 leading-snug">{sig.text}</span>

                                  {/* Points */}
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <input
                                      type="number"
                                      min={1}
                                      max={50}
                                      value={sigConfig.pts}
                                      onChange={e => updateSignalPts(catId, subId, sig.id, e.target.value)}
                                      disabled={!sigConfig.enabled}
                                      className="w-10 text-center input text-xs py-0.5 disabled:opacity-40"
                                    />
                                    <span className="text-[10px] text-tertiary">pts</span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>

                          {/* Custom signals */}
                          {(subConfig.customSignals || []).map((sig, idx) => (
                            <div key={sig.id} className="flex items-center gap-3 px-3 py-2 rounded-[8px] border border-dashed border-black/[0.12] bg-surface mb-1.5">
                              <span className={clsx(
                                'text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0',
                                sig.type === 'up' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                              )}>
                                {sig.type === 'up' ? '▲' : '▼'} Custom
                              </span>
                              <span className="text-[12px] text-primary flex-1">{sig.text}</span>
                              <input
                                type="number" min={1} max={50} value={sig.pts}
                                onChange={e => updateCustomSignalPts(catId, subId, idx, e.target.value)}
                                className="w-10 text-center input text-xs py-0.5"
                              />
                              <span className="text-[10px] text-tertiary">pts</span>
                              <button onClick={() => removeCustomSignal(catId, subId, idx)}
                                className="text-tertiary hover:text-red-500 transition-colors flex-shrink-0">
                                <X size={12} />
                              </button>
                            </div>
                          ))}

                          {/* Add custom signal */}
                          <div className="flex gap-2 mt-2">
                            <select
                              value={newSignalType[newKey] || 'up'}
                              onChange={e => setNewSignalType(s => ({ ...s, [newKey]: e.target.value }))}
                              className="input text-xs py-1.5 w-24 flex-shrink-0"
                            >
                              <option value="up">▲ Sube</option>
                              <option value="down">▼ Baja</option>
                            </select>
                            <input
                              value={newSignalText[newKey] || ''}
                              onChange={e => setNewSignalText(s => ({ ...s, [newKey]: e.target.value }))}
                              onKeyDown={e => { if (e.key === 'Enter') addCustomSignal(catId, subId) }}
                              placeholder="Agregar señal personalizada..."
                              className="input text-xs py-1.5 flex-1"
                            />
                            <button
                              onClick={() => addCustomSignal(catId, subId)}
                              className="btn-secondary text-xs py-1.5 px-3 flex-shrink-0 flex items-center gap-1"
                            >
                              <Plus size={11} /> Agregar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── PRODUCTS TAB ────────────────────────────────────────────────
function ProductsTab({ enabledProductIds, onChange }) {
  const { products, loading } = useProducts()
  const activeProducts = products.filter(p => (p.status || 'active') === 'active')

  const toggle = (id) => {
    if (enabledProductIds.includes(id)) {
      onChange(enabledProductIds.filter(pid => pid !== id))
    } else {
      onChange([...enabledProductIds, id])
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-5 h-5 border-2 border-black/10 border-t-accent-purple rounded-full animate-spin" />
    </div>
  )

  if (activeProducts.length === 0) return (
    <div className="card p-8 text-center">
      <Package size={32} className="text-tertiary mx-auto mb-3" />
      <p className="text-sm font-semibold text-primary mb-1">Sin productos en el catálogo</p>
      <p className="text-xs text-secondary">Crea productos en la sección Catálogo primero.</p>
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3 p-4 bg-purple-50 border border-purple-200 rounded-[12px]">
        <Package size={18} className="text-purple-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[12.5px] text-purple-800 font-semibold mb-0.5">Productos habilitados para este agente</p>
          <p className="text-[11.5px] text-purple-700 leading-relaxed">
            El agente asociará leads a estos productos durante la conversación,
            basándose en los problemas que cada producto resuelve.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {activeProducts.map(product => {
          const isEnabled = enabledProductIds.includes(product.id)
          const badge = {
            product: { label: 'Producto', color: '#0066ff' },
            service: { label: 'Servicio', color: '#7c3aed' },
            subscription_monthly: { label: 'Susc. mensual', color: '#00b8d9' },
            subscription_annual: { label: 'Susc. anual', color: '#00c853' },
          }[product.type] || { label: product.type, color: '#8e8e93' }

          return (
            <div
              key={product.id}
              onClick={() => toggle(product.id)}
              className={clsx(
                'card p-4 cursor-pointer transition-all border-2',
                isEnabled
                  ? 'border-accent-blue bg-blue-50/50'
                  : 'border-transparent hover:border-black/[0.1]'
              )}
            >
              <div className="flex items-start gap-3">
                {/* Toggle */}
                <div className={clsx(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all',
                  isEnabled ? 'border-accent-blue bg-accent-blue' : 'border-black/20'
                )}>
                  {isEnabled && <CheckCircle2 size={12} className="text-white" strokeWidth={3} />}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[13px] text-primary">{product.name}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: badge.color + '18', color: badge.color }}>
                      {badge.label}
                    </span>
                    {product.durationDays > 0 && (
                      <span className="text-[10px] text-secondary flex items-center gap-0.5">
                        <Clock size={10} /> {product.durationDays} días
                      </span>
                    )}
                  </div>

                  {product.description && (
                    <p className="text-[11.5px] text-secondary mt-0.5 line-clamp-1">{product.description}</p>
                  )}

                  {/* Problem tags */}
                  {product.problemTags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {product.problemTags.map((tag, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-surface-2 border border-black/[0.08] text-secondary">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Price */}
                <div className="text-right flex-shrink-0">
                  <span className="font-display font-bold text-sm text-primary">
                    {product.currency} {Number(product.price).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {enabledProductIds.length > 0 && (
        <div className="text-[11px] text-secondary text-center pt-1">
          {enabledProductIds.length} producto{enabledProductIds.length !== 1 ? 's' : ''} habilitado{enabledProductIds.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}

// ─── DELETE CONFIRM MODAL ────────────────────────────────────────
function DeleteFileModal({ file, onConfirm, onCancel }) {
  const [input, setInput] = useState('')
  const confirmed = input.trim().toUpperCase() === 'ELIMINAR'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-surface rounded-[18px] shadow-[0_24px_80px_rgba(0,0,0,0.18)] w-full max-w-sm border border-black/[0.08] p-6">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={18} className="text-red-500 flex-shrink-0" />
          <h3 className="font-display font-bold text-[15px]">¿Eliminar archivo?</h3>
        </div>
        <p className="text-[12.5px] text-secondary mb-1">
          Vas a eliminar <strong className="text-primary">"{file.name}"</strong> de la base de conocimiento del agente. Esta acción no se puede deshacer.
        </p>
        <p className="text-[12px] text-red-600 mb-3">
          Escribe <strong>ELIMINAR</strong> para confirmar.
        </p>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="ELIMINAR"
          className="input text-sm mb-4 font-mono tracking-widest"
          autoFocus
        />
        <div className="flex gap-2">
          <button onClick={onCancel} className="btn-secondary flex-1">Cancelar</button>
          <button
            onClick={onConfirm}
            disabled={!confirmed}
            className="flex-1 py-2 px-4 rounded-[10px] bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-semibold transition-colors"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────
export default function Agent() {
  const { org } = useAuthStore()
  const [activeTab, setActiveTab] = useState('identity')
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [files, setFiles] = useState([])
  const [uploadingFile, setUploadingFile] = useState(false)
  const [deleteModal, setDeleteModal] = useState(null)
  const fileInputRef = useRef()

  const [config, setConfig] = useState({
    agentName: 'Sofía',
    responseDelay: 3,
    customInstructions: '',
    enabledProductIds: [],
    scoring: DEFAULT_SCORING,
  })

  const set = (k, v) => setConfig(c => ({ ...c, [k]: v }))

  // Load config from Firestore
  useEffect(() => {
    if (!org?.id) return
    const unsub = onSnapshot(doc(db, 'organizations', org.id, 'settings', 'agent'), snap => {
      if (snap.exists()) {
        const data = snap.data()
        setConfig(c => ({
          ...c,
          agentName: data.agentName ?? c.agentName,
          responseDelay: data.responseDelay ?? c.responseDelay,
          customInstructions: data.customInstructions ?? c.customInstructions,
          enabledProductIds: data.enabledProductIds ?? c.enabledProductIds,
          scoring: data.scoring ?? c.scoring,
          assistantId: data.assistantId,
        }))
      }
    })
    return () => unsub()
  }, [org?.id])

  // Load files
  useEffect(() => {
    if (!org?.id) return
    const q = query(collection(db, 'organizations', org.id, 'agent_files'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setFiles(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [org?.id])

  const handleSave = async () => {
    setSaving(true)
    try {
      await setDoc(
        doc(db, 'organizations', org.id, 'settings', 'agent'),
        { ...config, updatedAt: serverTimestamp() },
        { merge: true }
      )
      setSyncing(true)
      const res = await fetch('/.netlify/functions/agent-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync', orgId: org.id, config }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast.success('Agente actualizado y sincronizado ✓')
    } catch (err) {
      toast.error('Error: ' + err.message)
    } finally { setSaving(false); setSyncing(false) }
  }

  const handleFileUpload = async (file) => {
    if (!ACCEPTED_TYPES.includes(file.type)) { toast.error('Solo PDF, Word o TXT'); return }
    if (file.size > 10 * 1024 * 1024) { toast.error('Máximo 10MB'); return }
    setUploadingFile(true)
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const base64 = e.target.result.split(',')[1]
        const res = await fetch('/.netlify/functions/agent-manager', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'upload', orgId: org.id, fileData: base64, fileName: file.name, mimeType: file.type }),
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        toast.success('Archivo subido — el agente lo procesará en segundos')
      } catch (err) { toast.error('Error: ' + err.message) }
      finally { setUploadingFile(false) }
    }
    reader.readAsDataURL(file)
  }

  const handleDeleteFile = async () => {
    if (!deleteModal) return
    try {
      await fetch('/.netlify/functions/agent-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_file', orgId: org.id, fileDocId: deleteModal.id }),
      })
      toast.success('Archivo eliminado')
      setDeleteModal(null)
    } catch { toast.error('Error al eliminar') }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* TOPBAR */}
      <div className="bg-surface border-b border-black/[0.08] px-5 h-14 flex items-center gap-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center bg-purple-50 text-accent-purple">
            <Bot size={14} />
          </div>
          <h1 className="font-display font-bold text-[15px] tracking-tight">Agente IA</h1>
          {config.assistantId && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 border border-green-200 text-green-700">
              ● Activo
            </span>
          )}
        </div>
        <div className="ml-auto flex gap-2 items-center">
          {syncing && (
            <div className="flex items-center gap-1.5 text-xs text-secondary">
              <div className="w-3 h-3 border border-black/20 border-t-accent-purple rounded-full animate-spin" />
              Sincronizando...
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary text-[12.5px] py-1.5 px-4 flex items-center gap-1.5"
          >
            {saving
              ? <><div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />Guardando...</>
              : '💾 Guardar y sincronizar'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* SIDEBAR */}
        <div className="w-[180px] min-w-[180px] border-r border-black/[0.08] flex flex-col py-2 bg-surface flex-shrink-0">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-2.5 px-4 py-2.5 text-[12.5px] font-semibold transition-all text-left group',
                activeTab === tab.id
                  ? 'bg-primary/[0.06] text-primary border-r-2 border-primary'
                  : 'text-secondary hover:bg-surface-2 hover:text-primary'
              )}
            >
              <tab.icon size={15} className="opacity-70 group-hover:opacity-100 transition-opacity" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="max-w-2xl mx-auto flex flex-col gap-4">

            {/* ── IDENTIDAD ── */}
            {activeTab === 'identity' && (
              <>
                <Section
                  title="Nombre del agente"
                  desc="Cómo se presenta ante los leads"
                >
                  <input
                    value={config.agentName}
                    onChange={e => set('agentName', e.target.value)}
                    placeholder="Sofía, Carlos, Alex..."
                    className="input text-sm"
                  />
                </Section>

                <Section
                  title="Delay de respuesta"
                  desc={`El agente espera ${config.responseDelay}s antes de responder — simula conversación humana`}
                >
                  <input
                    type="range"
                    min={0}
                    max={30}
                    value={config.responseDelay}
                    onChange={e => set('responseDelay', Number(e.target.value))}
                    className="w-full accent-accent-blue"
                  />
                  <div className="flex justify-between text-[10px] text-tertiary -mt-1">
                    <span>0s — inmediato</span>
                    <span className="font-bold text-primary">{config.responseDelay}s</span>
                    <span>30s — máximo</span>
                  </div>
                </Section>
              </>
            )}

            {/* ── CONOCIMIENTO ── */}
            {activeTab === 'knowledge' && (
              <>
                <div className="flex items-start gap-3 p-4 bg-purple-50 border border-purple-200 rounded-[12px]">
                  <Brain size={18} className="text-purple-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[12.5px] text-purple-800 font-semibold mb-0.5">Base de conocimiento RAG</p>
                    <p className="text-[11.5px] text-purple-700 leading-relaxed">
                      Los archivos y el texto manual se combinan como fuente de verdad del agente.
                      Todo lo que subas aquí es lo que el agente sabe.
                    </p>
                  </div>
                </div>

                {/* File upload */}
                <Section title="Documentos" desc="PDFs, Word o TXT — el agente los procesa como conocimiento">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-black/[0.14] rounded-[14px] p-8 text-center cursor-pointer hover:border-accent-purple hover:bg-purple-50/50 transition-all"
                  >
                    {uploadingFile
                      ? <Zap size={28} className="text-accent-purple mx-auto mb-2 animate-bounce" />
                      : <FileText size={28} className="text-tertiary mx-auto mb-2" />}
                    <p className="font-semibold text-sm text-primary mb-1">
                      {uploadingFile ? 'Subiendo archivo...' : 'Sube documentos al agente'}
                    </p>
                    <p className="text-xs text-secondary">PDF, Word, TXT · Máximo 10MB por archivo</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      className="hidden"
                      onChange={e => e.target.files[0] && handleFileUpload(e.target.files[0])}
                    />
                  </div>

                  {files.length > 0 && (
                    <div className="card overflow-hidden mt-1">
                      <div className="px-5 py-3 border-b border-black/[0.06]">
                        <span className="font-display font-bold text-sm">Documentos ({files.length})</span>
                      </div>
                      <div className="divide-y divide-black/[0.04]">
                        {files.map(f => (
                          <div key={f.id} className="flex items-center gap-3 px-5 py-3">
                            <FileText size={18} className={clsx('flex-shrink-0', f.mimeType === 'application/pdf' ? 'text-red-400' : 'text-blue-400')} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-semibold text-primary truncate">{f.name}</p>
                              <p className="text-[10px] text-tertiary">
                                {(f.size / 1024).toFixed(0)} KB · {f.status === 'processing' ? '⏳ Procesando...' : '✓ Listo'}
                              </p>
                            </div>
                            <button
                              onClick={() => setDeleteModal(f)}
                              className="text-tertiary hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Section>

                {/* Manual knowledge */}
                <Section
                  title="Conocimiento manual"
                  desc="Complementa los documentos con información que no está en archivos"
                >
                  <textarea
                    value={config.customInstructions}
                    onChange={e => set('customInstructions', e.target.value)}
                    rows={8}
                    className="input text-sm resize-none"
                    placeholder={`Escribe aquí lo que el agente debe saber y no está en los documentos:

• Casos de éxito o testimoniales clave
• Preguntas frecuentes y sus respuestas
• Políticas especiales o excepciones
• Información del equipo o proceso de venta
• Instrucciones específicas de comportamiento`}
                  />
                  <p className="text-[10px] text-tertiary">
                    Este texto se combina con los documentos subidos. Juntos forman el 100% del conocimiento del agente.
                  </p>
                </Section>
              </>
            )}

            {/* ── PRODUCTOS ── */}
            {activeTab === 'products' && (
              <ProductsTab
                enabledProductIds={config.enabledProductIds}
                onChange={v => set('enabledProductIds', v)}
              />
            )}

            {/* ── SCORING ── */}
            {activeTab === 'scoring' && (
              <ScoringTab
                scoring={config.scoring}
                onChange={v => set('scoring', v)}
              />
            )}

            {/* ── PROBAR ── */}
            {activeTab === 'test' && (
              <>
                <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-[12px] mb-1">
                  <Zap size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-[12.5px] text-blue-800 leading-relaxed">
                    Guarda los cambios primero, luego simula una conversación real con el agente.
                  </p>
                </div>
                <TestPanel orgId={org?.id} config={config} />
              </>
            )}

          </div>
        </div>
      </div>

      {/* DELETE FILE MODAL */}
      {deleteModal && (
        <DeleteFileModal
          file={deleteModal}
          onConfirm={handleDeleteFile}
          onCancel={() => setDeleteModal(null)}
        />
      )}
    </div>
  )
}
