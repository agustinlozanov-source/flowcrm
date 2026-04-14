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
  ChevronDown, ChevronUp, AlertTriangle,
  CheckCircle2, MessageSquare, User, Save
} from 'lucide-react'

// ─── TABS ────────────────────────────────────────────────────────
const TABS = [
  { id: 'identity',  icon: Bot,       label: 'Identidad'    },
  { id: 'knowledge', icon: Brain,     label: 'Conocimiento' },
  { id: 'products',  icon: Package,   label: 'Productos'    },
  { id: 'scoring',   icon: BarChart2, label: 'Scoring'      },
  { id: 'test',      icon: Zap,       label: 'Probar'       },
]

// ─── SCORING CATALOGS BY PURPOSE ─────────────────────────────────

// Pipeline 1 — ADQUISICIÓN (Venta)
const CATALOG_ADQUISICION = {
  necesidad: {
    label: 'Necesidad',
    desc: '¿Tiene un problema real que resolver?',
    color: '#0066ff',
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
          { id: 'n_c_3', text: 'Confunde síntomas con el problema real', type: 'down' },
        ]
      },
      historial: {
        label: 'Historial',
        signals: [
          { id: 'n_h_1', text: 'Ya intentó resolver esto antes y sabe por qué falló', type: 'up' },
          { id: 'n_h_2', text: 'El problema le ha costado algo concreto', type: 'up' },
          { id: 'n_h_3', text: 'Nunca ha intentado resolverlo — problema nuevo sin historial', type: 'down' },
        ]
      }
    }
  },
  capacidad: {
    label: 'Capacidad',
    desc: '¿Puede comprar? — El filtro más duro.',
    color: '#00875a',
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
          { id: 'c_a_2', text: 'Necesita consultar con alguien — proceso más largo', type: 'down' },
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
    subcategories: {
      horizonte: {
        label: 'Horizonte de compra',
        signals: [
          { id: 'i_h_1', text: 'Quiere resolver esto esta semana o este mes', type: 'up' },
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
    desc: '¿Confía en ti y en el producto?',
    color: '#5b21b6',
    subcategories: {
      apertura: {
        label: 'Apertura',
        signals: [
          { id: 'co_a_1', text: 'Comparte información personal sin que le pregunten', type: 'up' },
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

// Pipeline 2 — RETENCIÓN (Recompra)
const CATALOG_RETENCION = {
  satisfaccion: {
    label: 'Satisfacción',
    desc: '¿Le funcionó el producto? — La base de la recompra.',
    color: '#0066ff',
    subcategories: {
      resultado: {
        label: 'Resultado percibido',
        signals: [
          { id: 'r_s_1', text: 'Mencionó resultados concretos o mejoras que notó', type: 'up' },
          { id: 'r_s_2', text: 'Comparó positivamente con lo que tenía antes', type: 'up' },
          { id: 'r_s_3', text: 'Recomendó el producto a alguien más', type: 'up' },
          { id: 'r_s_4', text: 'No notó diferencia o no está seguro de los resultados', type: 'down' },
          { id: 'r_s_5', text: 'Tuvo una experiencia negativa o un problema con el producto', type: 'down' },
        ]
      },
      experiencia: {
        label: 'Experiencia de compra',
        signals: [
          { id: 'r_e_1', text: 'Habla bien del proceso de compra anterior', type: 'up' },
          { id: 'r_e_2', text: 'Tuvo un problema en la compra anterior que fue resuelto', type: 'up' },
          { id: 'r_e_3', text: 'Tuvo un problema que NO fue resuelto', type: 'down' },
        ]
      }
    }
  },
  engagement: {
    label: 'Engagement',
    desc: '¿Sigue activo y conectado? — Predice la lealtad.',
    color: '#00875a',
    subcategories: {
      actividad: {
        label: 'Actividad reciente',
        signals: [
          { id: 'en_a_1', text: 'Respondió rápido al mensaje de recompra', type: 'up' },
          { id: 'en_a_2', text: 'Ha iniciado conversación por su cuenta recientemente', type: 'up' },
          { id: 'en_a_3', text: 'Tardó más de 48h en responder o no respondió al primer mensaje', type: 'down' },
          { id: 'en_a_4', text: 'Lleva semanas sin señales de vida', type: 'down' },
        ]
      },
      relacion: {
        label: 'Relación con la marca',
        signals: [
          { id: 'en_r_1', text: 'Recuerda detalles de conversaciones anteriores', type: 'up' },
          { id: 'en_r_2', text: 'Usa el nombre del vendedor o hace referencia personal', type: 'up' },
          { id: 'en_r_3', text: 'Tono frío o distante como si fuera un desconocido', type: 'down' },
        ]
      }
    }
  },
  riesgo: {
    label: 'Riesgo de abandono',
    desc: 'Señales de que podría no renovar — las negativas pesan más.',
    color: '#dc2626',
    subcategories: {
      senales_negativas: {
        label: 'Señales de abandono',
        signals: [
          { id: 'ri_n_1', text: 'Mencionó que está evaluando otras opciones', type: 'down' },
          { id: 'ri_n_2', text: 'Preguntó por cancelación o devolución', type: 'down' },
          { id: 'ri_n_3', text: 'Expresó dudas sobre si el producto sigue siendo necesario', type: 'down' },
          { id: 'ri_n_4', text: 'Mencionó problemas económicos o recorte de gastos', type: 'down' },
          { id: 'ri_n_5', text: 'No ha usado el producto o no recuerda cómo usarlo', type: 'down' },
        ]
      },
      estabilidad: {
        label: 'Estabilidad del cliente',
        signals: [
          { id: 'ri_e_1', text: 'Su situación mejoró desde la primera compra', type: 'up' },
          { id: 'ri_e_2', text: 'Tiene continuidad en su rutina — el producto encaja bien', type: 'up' },
          { id: 'ri_e_3', text: 'Su situación cambió significativamente para mal', type: 'down' },
        ]
      }
    }
  },
  intencion_renovar: {
    label: 'Intención de renovar',
    desc: '¿Quiere continuar? — La señal más directa.',
    color: '#b45309',
    subcategories: {
      interes: {
        label: 'Interés explícito',
        signals: [
          { id: 'ir_i_1', text: 'Preguntó cuándo termina su producto actual', type: 'up' },
          { id: 'ir_i_2', text: 'Preguntó por nuevos productos o complementos', type: 'up' },
          { id: 'ir_i_3', text: 'Mencionó que quiere continuar o que no puede quedarse sin el producto', type: 'up' },
          { id: 'ir_i_4', text: 'Dijo que va a pensarlo — señal débil de intención', type: 'down' },
        ]
      },
      friccion: {
        label: 'Fricción para renovar',
        signals: [
          { id: 'ir_f_1', text: 'El proceso de renovación es sencillo para él', type: 'up' },
          { id: 'ir_f_2', text: 'Tiene el mismo método de pago disponible', type: 'up' },
          { id: 'ir_f_3', text: 'Mencionó que renovar es complicado o que tiene que hacer algo primero', type: 'down' },
        ]
      }
    }
  }
}

// Pipeline 3 — DISTRIBUCIÓN
const CATALOG_DISTRIBUCION = {
  perfil_emprendedor: {
    label: 'Perfil emprendedor',
    desc: '¿Tiene la mentalidad correcta? — El filtro más importante.',
    color: '#0066ff',
    subcategories: {
      mentalidad: {
        label: 'Mentalidad',
        signals: [
          { id: 'd_m_1', text: 'Habla de ingresos adicionales o independencia económica como meta', type: 'up' },
          { id: 'd_m_2', text: 'Ha tenido un negocio propio o ha vendido algo antes', type: 'up' },
          { id: 'd_m_3', text: 'Mostró iniciativa — preguntó sin que le preguntaran', type: 'up' },
          { id: 'd_m_4', text: 'Busca solo un ingreso fijo — no le interesa el modelo variable', type: 'down' },
          { id: 'd_m_5', text: 'Tiene miedo al rechazo o le incomoda la idea de vender', type: 'down' },
        ]
      },
      historial: {
        label: 'Historial comercial',
        signals: [
          { id: 'd_h_1', text: 'Ha participado en otro multinivel o negocio de referidos', type: 'up' },
          { id: 'd_h_2', text: 'Tiene experiencia en ventas — cualquier tipo', type: 'up' },
          { id: 'd_h_3', text: 'Nunca ha vendido nada ni tiene experiencia comercial', type: 'down' },
        ]
      }
    }
  },
  red: {
    label: 'Red de contactos',
    desc: '¿Tiene a quién venderle? — Sin red no hay negocio.',
    color: '#00875a',
    subcategories: {
      alcance: {
        label: 'Alcance',
        signals: [
          { id: 'd_r_1', text: 'Mencionó comunidades, grupos o círculos sociales activos', type: 'up' },
          { id: 'd_r_2', text: 'Tiene presencia en redes sociales con seguidores reales', type: 'up' },
          { id: 'd_r_3', text: 'Trabaja o trabajó en un entorno con muchos contactos', type: 'up' },
          { id: 'd_r_4', text: 'Menciona que no conoce a muchas personas o que es introvertido', type: 'down' },
        ]
      },
      calidad: {
        label: 'Calidad de la red',
        signals: [
          { id: 'd_q_1', text: 'Su red tiene personas con el perfil del cliente ideal', type: 'up' },
          { id: 'd_q_2', text: 'Mencionó personas específicas que podrían interesarse', type: 'up' },
          { id: 'd_q_3', text: 'Su red es muy diferente al perfil del producto', type: 'down' },
        ]
      }
    }
  },
  disponibilidad: {
    label: 'Disponibilidad',
    desc: '¿Tiene tiempo y energía para trabajar el negocio?',
    color: '#b45309',
    subcategories: {
      tiempo: {
        label: 'Tiempo disponible',
        signals: [
          { id: 'd_t_1', text: 'Tiene tiempo libre que quiere aprovechar productivamente', type: 'up' },
          { id: 'd_t_2', text: 'Trabaja medio tiempo o está en transición laboral', type: 'up' },
          { id: 'd_t_3', text: 'Mencionó que tiene poco tiempo pero quiere intentarlo', type: 'up' },
          { id: 'd_t_4', text: 'Tiene una agenda completamente saturada sin margen', type: 'down' },
        ]
      },
      compromiso: {
        label: 'Nivel de compromiso',
        signals: [
          { id: 'd_c_1', text: 'Preguntó qué necesita hacer para empezar', type: 'up' },
          { id: 'd_c_2', text: 'Está dispuesto a invertir en su kit de inicio o membresía', type: 'up' },
          { id: 'd_c_3', text: 'Quiere probar "sin comprometerse" — señal débil', type: 'down' },
          { id: 'd_c_4', text: 'Pone condiciones antes de empezar — muchos "peros"', type: 'down' },
        ]
      }
    }
  },
  comprension_modelo: {
    label: 'Comprensión del modelo',
    desc: '¿Entiende cómo funciona el multinivel?',
    color: '#5b21b6',
    subcategories: {
      claridad: {
        label: 'Claridad del modelo',
        signals: [
          { id: 'd_cm_1', text: 'Entiende que los ingresos dependen de su trabajo y su red', type: 'up' },
          { id: 'd_cm_2', text: 'Hizo preguntas inteligentes sobre comisiones o estructura', type: 'up' },
          { id: 'd_cm_3', text: 'Confunde el modelo con una pirámide — tiene resistencia ideológica', type: 'down' },
          { id: 'd_cm_4', text: 'Cree que es dinero fácil sin esfuerzo — expectativa irreal', type: 'down' },
        ]
      },
      alineacion: {
        label: 'Alineación con el producto',
        signals: [
          { id: 'd_al_1', text: 'Ya usa el producto y le funciona — lo vende con convicción propia', type: 'up' },
          { id: 'd_al_2', text: 'Cree genuinamente en los beneficios del producto', type: 'up' },
          { id: 'd_al_3', text: 'No usa el producto ni tiene interés en él — solo quiere el dinero', type: 'down' },
        ]
      }
    }
  }
}

// ─── CATALOG MAP BY PURPOSE ───────────────────────────────────────
const CATALOG_BY_PURPOSE = {
  adquisicion: CATALOG_ADQUISICION,
  retencion:   CATALOG_RETENCION,
  distribucion: CATALOG_DISTRIBUCION,
}

const PURPOSE_LABELS = {
  adquisicion:  'Adquisición',
  retencion:    'Retención',
  distribucion: 'Distribución',
}

// Build default scoring config from a catalog
function buildDefaultScoring(catalog) {
  return Object.fromEntries(
    Object.entries(catalog).map(([catId, cat]) => [
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
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
]

// ─── SECTION ─────────────────────────────────────────────────────
function Section({ title, desc, children }) {
  return (
    <div className="card p-5 flex flex-col gap-4">
      <div>
        <h3 className="font-display font-bold text-sm text-primary">{title}</h3>
        {desc && <p className="text-xs text-secondary mt-0.5">{desc}</p>}
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
        <input value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') sendMessage() }}
          placeholder="Escribe como si fueras el lead..."
          className="flex-1 input text-sm py-2" />
        <button onClick={sendMessage} disabled={!text.trim() || loading}
          className="btn-primary px-4 py-2 text-sm disabled:opacity-40">Enviar</button>
        <button onClick={clearConversation} disabled={clearing}
          className="btn-secondary px-3 py-2 text-sm disabled:opacity-40">
          {clearing ? '...' : 'Nueva'}
        </button>
      </div>
    </div>
  )
}

// ─── SCORING TAB ─────────────────────────────────────────────────
function ScoringTab({ pipelines, pipelineStages, scoring, onChange, distribuidorConfig }) {
  const [activePipelineTab, setActivePipelineTab] = useState(pipelines[0]?.id || null)
  const [newSignalText, setNewSignalText] = useState({})
  const [newSignalType, setNewSignalType] = useState({})

  const activePipeline = pipelines.find(p => p.id === activePipelineTab)
  const isFlowHubPipeline = activePipeline?.isFlowHubPipeline === true

  const activeStages = (pipelineStages || [])
    .filter(s => s.pipelineId === activePipelineTab)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  const pipelineScoring = scoring[activePipelineTab] || {}

  const getStageConfig = (stage) => pipelineScoring[stage.id] || {
    stageName: stage.name,
    stageColor: stage.color,
    scoreMin: stage.scoreMin,
    scoreMax: stage.scoreMax,
    signals: [],
  }

  const updateStageConfig = (stageId, newConfig) => {
    onChange({ ...scoring, [activePipelineTab]: { ...pipelineScoring, [stageId]: newConfig } })
  }

  const addSignal = (stage) => {
    const text = (newSignalText[stage.id] || '').trim()
    if (!text) return
    const type = newSignalType[stage.id] || 'up'
    const config = getStageConfig(stage)
    const newSig = { id: `sig_${Date.now()}`, text, type, pts: type === 'up' ? 10 : -5, enabled: true }
    updateStageConfig(stage.id, { ...config, signals: [...(config.signals || []), newSig] })
    setNewSignalText(s => ({ ...s, [stage.id]: '' }))
  }

  const removeSignal = (stage, sigIdx) => {
    const config = getStageConfig(stage)
    updateStageConfig(stage.id, { ...config, signals: config.signals.filter((_, i) => i !== sigIdx) })
  }

  const toggleSignal = (stage, sigIdx) => {
    const config = getStageConfig(stage)
    updateStageConfig(stage.id, {
      ...config,
      signals: config.signals.map((s, i) => i === sigIdx ? { ...s, enabled: s.enabled === false } : s),
    })
  }

  const updateSignalPts = (stage, sigIdx, rawVal, sigType) => {
    const config = getStageConfig(stage)
    const pts = sigType === 'up' ? Math.abs(Number(rawVal)) : -Math.abs(Number(rawVal))
    updateStageConfig(stage.id, {
      ...config,
      signals: config.signals.map((s, i) => i === sigIdx ? { ...s, pts } : s),
    })
  }

  if (pipelines.length === 0) {
    return (
      <div className="card p-8 text-center">
        <BarChart2 size={32} className="text-tertiary mx-auto mb-3" strokeWidth={1.5} />
        <p className="font-semibold text-sm text-primary mb-1">Sin pipelines configurados</p>
        <p className="text-xs text-secondary">Crea un pipeline primero para configurar su scoring.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Pipeline tabs */}
      <div className="card p-1 flex gap-1">
        {pipelines.map(p => (
          <button key={p.id} onClick={() => setActivePipelineTab(p.id)}
            className={clsx(
              'flex-1 px-3 py-2 rounded-[8px] text-[12.5px] font-semibold transition-all text-center',
              activePipelineTab === p.id
                ? 'bg-primary text-white'
                : 'text-secondary hover:bg-surface-2 hover:text-primary'
            )}>
            <div>{p.name}</div>
            <div className={clsx('text-[10px] font-normal mt-0.5',
              activePipelineTab === p.id ? 'text-white/70' : 'text-tertiary')}>
              {PURPOSE_LABELS[p.purpose] || p.purpose || 'Pipeline'}
            </div>
          </button>
        ))}
      </div>

      {/* FlowHub pipeline → read-only global distribuidor scoring */}
      {isFlowHubPipeline && distribuidorConfig?.scoringSignals?.length > 0 && (
        <DistribuidorScoringReadOnly signals={distribuidorConfig.scoringSignals} />
      )}
      {isFlowHubPipeline && !distribuidorConfig?.scoringSignals?.length && (
        <div className="card p-8 text-center">
          <BarChart2 size={32} className="text-tertiary mx-auto mb-3" strokeWidth={1.5} />
          <p className="font-semibold text-sm text-primary mb-1">Sin señales configuradas</p>
          <p className="text-xs text-secondary">El Superadmin no ha configurado señales de scoring para distribuidores todavía.</p>
        </div>
      )}

      {/* Regular pipeline → stage-based scoring */}
      {!isFlowHubPipeline && (
        activeStages.length === 0 ? (
          <div className="card p-8 text-center">
            <BarChart2 size={32} className="text-tertiary mx-auto mb-3" strokeWidth={1.5} />
            <p className="font-semibold text-sm text-primary mb-1">Sin etapas en este pipeline</p>
            <p className="text-xs text-secondary">Agrega etapas al pipeline para configurar el scoring del agente.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-[12px]">
              <BarChart2 size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[12.5px] text-blue-800 font-semibold mb-0.5">Señales por etapa del pipeline</p>
                <p className="text-[11.5px] text-blue-700 leading-relaxed">
                  Configura qué frases o comportamientos del lead indican que está avanzando hacia cada etapa. El agente los evalúa silenciosamente en cada mensaje.
                </p>
              </div>
            </div>

            {activeStages.map(stage => {
              const stageConfig = getStageConfig(stage)
              const activeSignals = (stageConfig.signals || []).filter(s => s.enabled !== false).length
              return (
                <div key={stage.id} className="card overflow-hidden">
                  {/* Stage header */}
                  <div className="flex items-center gap-3 px-5 py-3.5"
                    style={{ borderBottom: `2px solid ${stage.color || '#8e8e93'}22`, background: (stage.color || '#8e8e93') + '08' }}>
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: stage.color || '#8e8e93' }} />
                    <div className="flex-1">
                      <p className="font-display font-bold text-sm text-primary">{stage.name}</p>
                      <p className="text-[10px] text-secondary mt-0.5">Score {stage.scoreMin ?? 0}–{stage.scoreMax ?? 100} pts</p>
                    </div>
                    <span className="text-[10px] font-medium text-secondary">
                      {activeSignals} señal{activeSignals !== 1 ? 'es' : ''} activa{activeSignals !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Signals list + add form */}
                  <div className="px-5 py-4 flex flex-col gap-2">
                    {(stageConfig.signals || []).length === 0 && (
                      <p className="text-[11.5px] text-tertiary text-center py-2 italic">
                        Sin señales — agrega señales para que el agente evalúe esta etapa
                      </p>
                    )}
                    {(stageConfig.signals || []).map((sig, idx) => (
                      <div key={sig.id || idx} className={clsx(
                        'flex items-center gap-3 px-3 py-2 rounded-[8px] border transition-all',
                        sig.enabled !== false ? 'bg-surface border-black/[0.08]' : 'bg-surface-2 border-black/[0.04] opacity-50'
                      )}>
                        <div onClick={() => toggleSignal(stage, idx)}
                          className={clsx('w-8 h-4 rounded-full cursor-pointer transition-all relative flex-shrink-0',
                            sig.enabled !== false ? 'bg-accent-blue' : 'bg-black/20')}>
                          <div className={clsx('absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all',
                            sig.enabled !== false ? 'left-4' : 'left-0.5')} />
                        </div>
                        <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0',
                          sig.type === 'up' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600')}>
                          {sig.type === 'up' ? '▲' : '▼'}
                        </span>
                        <span className="text-[12px] text-primary flex-1 leading-snug">{sig.text}</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <input type="number" min={1} max={50} value={Math.abs(sig.pts ?? 10)}
                            onChange={e => updateSignalPts(stage, idx, e.target.value, sig.type)}
                            disabled={sig.enabled === false}
                            className="w-10 text-center input text-xs py-0.5 disabled:opacity-40" />
                          <span className="text-[10px] text-tertiary">pts</span>
                        </div>
                        <button onClick={() => removeSignal(stage, idx)}
                          className="text-tertiary hover:text-red-500 transition-colors flex-shrink-0">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    {/* Add signal */}
                    <div className="flex gap-2 mt-1">
                      <select value={newSignalType[stage.id] || 'up'}
                        onChange={e => setNewSignalType(s => ({ ...s, [stage.id]: e.target.value }))}
                        className="input text-xs py-1.5 w-24 flex-shrink-0">
                        <option value="up">▲ Sube</option>
                        <option value="down">▼ Baja</option>
                      </select>
                      <input value={newSignalText[stage.id] || ''}
                        onChange={e => setNewSignalText(s => ({ ...s, [stage.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') addSignal(stage) }}
                        placeholder={`Señal para "${stage.name}"...`}
                        className="input text-xs py-1.5 flex-1" />
                      <button onClick={() => addSignal(stage)}
                        className="btn-secondary text-xs py-1.5 px-3 flex-shrink-0 flex items-center gap-1">
                        <Plus size={11} /> Agregar
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}
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
        <Package size={16} className="text-purple-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[12.5px] text-purple-800 font-semibold mb-0.5">Productos habilitados para este agente</p>
          <p className="text-[11.5px] text-purple-700 leading-relaxed">
            El agente asocia leads a estos productos durante la conversación, basándose en los problemas que cada producto resuelve.
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
            <div key={product.id} onClick={() => toggle(product.id)}
              className={clsx('card p-4 cursor-pointer transition-all border-2',
                isEnabled ? 'border-accent-blue bg-blue-50/50' : 'border-transparent hover:border-black/[0.1]')}>
              <div className="flex items-start gap-3">
                <div className={clsx('w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all',
                  isEnabled ? 'border-accent-blue bg-accent-blue' : 'border-black/20')}>
                  {isEnabled && <CheckCircle2 size={12} className="text-white" strokeWidth={3} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[13px] text-primary">{product.name}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: badge.color + '18', color: badge.color }}>{badge.label}</span>
                    {product.durationDays > 0 && (
                      <span className="text-[10px] text-secondary flex items-center gap-0.5">
                        <Clock size={10} /> {product.durationDays} días
                      </span>
                    )}
                  </div>
                  {product.description && (
                    <p className="text-[11.5px] text-secondary mt-0.5 line-clamp-1">{product.description}</p>
                  )}
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

// ─── DELETE FILE MODAL ────────────────────────────────────────────
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
          Vas a eliminar <strong className="text-primary">"{file.name}"</strong> de la base de conocimiento. Esta acción no se puede deshacer.
        </p>
        <p className="text-[12px] text-red-600 mb-3">Escribe <strong>ELIMINAR</strong> para confirmar.</p>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="ELIMINAR"
          className="input text-sm mb-4 font-mono tracking-widest" autoFocus />
        <div className="flex gap-2">
          <button onClick={onCancel} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={onConfirm} disabled={!confirmed}
            className="flex-1 py-2 px-4 rounded-[10px] bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-semibold transition-colors">
            Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── DISTRIBUIDOR SCORING READ-ONLY VIEW ─────────────────────────
function DistribuidorScoringReadOnly({ signals }) {
  const total = signals.reduce((s, c) => s + (c.tope || 0), 0)
  return (
    <div>
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-[12px] mb-4">
        <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[12.5px] text-amber-800 font-semibold mb-0.5">Señales administradas globalmente</p>
          <p className="text-[11.5px] text-amber-700 leading-relaxed">
            Estas señales de scoring son configuradas por Flow Hub para todos los distribuidores. El agente IA las usa automáticamente en cada conversación.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className="font-display font-bold text-sm">Señales de Scoring del Agente IA</span>
        <span className={clsx(
          'text-[11px] font-bold px-2.5 py-1 rounded-full',
          total === 100
            ? 'bg-green-100 text-green-700 border border-green-200'
            : 'bg-red-100 text-red-600 border border-red-200'
        )}>
          {total} / 100 pts {total === 100 ? '✓' : '⚠'}
        </span>
      </div>

      <div className="space-y-3">
        {signals.map((cat, ci) => (
          <div key={cat.id || ci} className="border border-black/[0.08] rounded-[12px] overflow-hidden bg-white">
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-black/[0.06]">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color || '#8e8e93' }} />
              <span className="font-semibold text-[13px] text-primary flex-1">{cat.label}</span>
              <span className="text-[11px] text-secondary font-medium">Tope: {cat.tope} pts</span>
            </div>
            {(cat.subcategories || []).map((sub, si) => (
              <div key={sub.id || si} className="px-4 py-3 border-b border-black/[0.04] last:border-0">
                <p className="text-[12px] font-semibold text-secondary mb-2">{sub.label} <span className="font-normal text-tertiary">({sub.tope} pts)</span></p>
                <div className="space-y-1.5">
                  {(sub.signals || []).map((sig, sgi) => (
                    <div key={sig.id || sgi} className="flex items-start gap-2">
                      <span className={clsx(
                        'flex-shrink-0 text-[10px] font-bold mt-0.5 px-1.5 py-0.5 rounded',
                        sig.type === 'down' || sig.weight < 0
                          ? 'bg-red-100 text-red-600'
                          : 'bg-green-100 text-green-700'
                      )}>
                        {sig.weight >= 0 ? `+${sig.weight}` : sig.weight}
                      </span>
                      <span className="text-[12px] text-primary leading-snug">{sig.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
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
  const [pipelines, setPipelines] = useState([])
  const [uploadingFile, setUploadingFile] = useState(false)
  const [deleteModal, setDeleteModal] = useState(null)
  const [distribuidorConfig, setDistribuidorConfig] = useState(null)
  const [pipelineStages, setPipelineStages] = useState([])
  const fileInputRef = useRef()

  const [config, setConfig] = useState({
    agentName: 'Sofía',
    responseDelay: 3,
    customInstructions: '',
    enabledProductIds: [],
    scoring: {},
  })

  const set = (k, v) => setConfig(c => ({ ...c, [k]: v }))

  // Load pipelines from Firestore
  useEffect(() => {
    if (!org?.id) return
    const unsub = onSnapshot(
      query(collection(db, 'organizations', org.id, 'pipelines'), orderBy('createdAt', 'asc')),
      snap => setPipelines(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    return unsub
  }, [org?.id])

  // Load agent config from Firestore
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
    return unsub
  }, [org?.id])

  // Load files
  useEffect(() => {
    if (!org?.id) return
    const q = query(collection(db, 'organizations', org.id, 'agent_files'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setFiles(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [org?.id])

  // Load pipeline stages (for stage-based scoring)
  useEffect(() => {
    if (!org?.id) return
    const unsub = onSnapshot(
      collection(db, 'organizations', org.id, 'pipeline_stages'),
      snap => setPipelineStages(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    return unsub
  }, [org?.id])

  // Load global distribuidor config (prompt + scoring signals set by Superadmin)
  useEffect(() => {
    if (!org?.isDistribuidor) return
    const unsub = onSnapshot(doc(db, 'flowhub_config', 'distribuidor_niveles'), snap => {
      setDistribuidorConfig(snap.exists() ? snap.data() : null)
    })
    return unsub
  }, [org?.isDistribuidor])

  const handleSave = async () => {
    setSaving(true)
    try {
      // Firestore rechaza undefined — filtrar antes de guardar
      const cleanConfig = Object.fromEntries(
        Object.entries({ ...config, updatedAt: serverTimestamp() })
          .filter(([, v]) => v !== undefined)
      )
      await setDoc(
        doc(db, 'organizations', org.id, 'settings', 'agent'),
        cleanConfig,
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
        toast.success('Archivo subido ✓')
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
          <button onClick={handleSave} disabled={saving}
            className="btn-primary text-[12.5px] py-1.5 px-4 flex items-center gap-1.5">
            {saving
              ? <><div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />Guardando...</>
              : <><Save size={14} /> Guardar y sincronizar</>}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* SIDEBAR */}
        <div className="w-[180px] min-w-[180px] border-r border-black/[0.08] flex flex-col py-2 bg-surface flex-shrink-0">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-2.5 px-4 py-2.5 text-[12.5px] font-semibold transition-all text-left group',
                activeTab === tab.id
                  ? 'bg-primary/[0.06] text-primary border-r-2 border-primary'
                  : 'text-secondary hover:bg-surface-2 hover:text-primary'
              )}>
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
                <Section title="Nombre del agente" desc="Cómo se presenta ante los leads">
                  <input value={config.agentName} onChange={e => set('agentName', e.target.value)}
                    placeholder="Sofía, Carlos, Alex..." className="input text-sm" />
                </Section>

                <Section title="Delay de respuesta"
                  desc={`El agente espera ${config.responseDelay}s antes de responder — simula conversación humana`}>
                  <input type="range" min={0} max={30} value={config.responseDelay}
                    onChange={e => set('responseDelay', Number(e.target.value))}
                    className="w-full accent-accent-blue" />
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
                  <Brain size={16} className="text-purple-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[12.5px] text-purple-800 font-semibold mb-0.5">Base de conocimiento RAG</p>
                    <p className="text-[11.5px] text-purple-700 leading-relaxed">
                      Los archivos y el texto manual se combinan como fuente de verdad del agente. Todo lo que subas aquí es lo que el agente sabe.
                    </p>
                  </div>
                </div>

                <Section title="Documentos" desc="PDFs, Word o TXT — el agente los procesa como conocimiento">
                  <div onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-black/[0.14] rounded-[14px] p-8 text-center cursor-pointer hover:border-accent-purple hover:bg-purple-50/50 transition-all">
                    {uploadingFile
                      ? <Zap size={28} className="text-accent-purple mx-auto mb-2 animate-bounce" />
                      : <FileText size={28} className="text-tertiary mx-auto mb-2" />}
                    <p className="font-semibold text-sm text-primary mb-1">
                      {uploadingFile ? 'Subiendo archivo...' : 'Sube documentos al agente'}
                    </p>
                    <p className="text-xs text-secondary">PDF, Word, TXT · Máximo 10MB por archivo</p>
                    <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden"
                      onChange={e => e.target.files[0] && handleFileUpload(e.target.files[0])} />
                  </div>

                  {files.length > 0 && (
                    <div className="card overflow-hidden mt-1">
                      <div className="px-5 py-3 border-b border-black/[0.06]">
                        <span className="font-display font-bold text-sm">Documentos ({files.length})</span>
                      </div>
                      <div className="divide-y divide-black/[0.04]">
                        {files.map(f => (
                          <div key={f.id} className="flex items-center gap-3 px-5 py-3">
                            <FileText size={18} className={clsx('flex-shrink-0',
                              f.mimeType === 'application/pdf' ? 'text-red-400' : 'text-blue-400')} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-semibold text-primary truncate">{f.name}</p>
                              <p className="text-[10px] text-tertiary">
                                {(f.size / 1024).toFixed(0)} KB · {f.status === 'processing' ? '⏳ Procesando...' : '✓ Listo'}
                              </p>
                            </div>
                            <button onClick={() => setDeleteModal(f)}
                              className="text-tertiary hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Section>

                <Section title="Conocimiento manual"
                  desc={org?.isDistribuidor ? 'Prompt global administrado por Flow Hub — solo lectura' : 'Complementa los documentos con información que no está en archivos'}>
                  {org?.isDistribuidor && distribuidorConfig?.agentPrompt ? (
                    <>
                      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-[12px] mb-3">
                        <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-[12px] text-amber-800 leading-relaxed">
                          El prompt de tu agente IA es administrado globalmente por Flow Hub. No puedes modificarlo desde aquí — los cambios se aplican desde la Configuración Global.
                        </p>
                      </div>
                      <div className="text-[12px] text-primary bg-gray-50 border border-black/[0.08] rounded-[10px] p-4 max-h-52 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed">
                        {distribuidorConfig.agentPrompt}
                      </div>
                    </>
                  ) : (
                    <>
                      <textarea value={config.customInstructions} onChange={e => set('customInstructions', e.target.value)}
                        rows={8} className="input text-sm resize-none"
                        placeholder={`Escribe aquí lo que el agente debe saber y no está en los documentos:\n\n• Casos de éxito o testimoniales clave\n• Preguntas frecuentes y sus respuestas\n• Políticas especiales o excepciones\n• Instrucciones específicas de comportamiento`} />
                      <p className="text-[10px] text-tertiary">
                        Este texto se combina con los documentos subidos. Juntos forman el 100% del conocimiento del agente.
                      </p>
                    </>
                  )}
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
                pipelines={pipelines}
                pipelineStages={pipelineStages}
                scoring={config.scoring}
                onChange={v => set('scoring', v)}
                distribuidorConfig={distribuidorConfig}
              />
            )}

            {/* ── PROBAR ── */}
            {activeTab === 'test' && (
              <>
                <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-[12px] mb-1">
                  <Zap size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
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

      {deleteModal && (
        <DeleteFileModal file={deleteModal} onConfirm={handleDeleteFile} onCancel={() => setDeleteModal(null)} />
      )}
    </div>
  )
}
