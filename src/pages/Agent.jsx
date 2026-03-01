import { useState, useEffect } from 'react'
import { doc, getDoc, setDoc, serverTimestamp, collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { Bot, X, Plus, Zap, Bell, Hourglass, MessageCircle, FileText } from 'lucide-react'

const DEFAULT_CONFIG = {
  name: 'Asistente FlowCRM',
  personality: 'profesional',
  greeting: 'Hola {nombre}, gracias por tu interés. Soy el asistente de {empresa}. ¿En qué puedo ayudarte hoy?',
  qualifyingQuestions: [
    '¿Cuál es el principal reto que quieres resolver?',
    '¿Cuántas personas hay en tu equipo de ventas?',
    '¿Cuándo necesitas implementar una solución?',
    '¿Cuál es tu presupuesto aproximado?',
  ],
  autoRespond: true,
  responseDelay: 1,
  workingHours: { enabled: false, start: '09:00', end: '18:00' },
  scoreThreshold: 80,
}

const PERSONALITIES = [
  { value: 'profesional', label: 'Profesional', desc: 'Formal, directo y enfocado en resultados' },
  { value: 'amigable', label: 'Amigable', desc: 'Cálido, cercano y conversacional' },
  { value: 'consultivo', label: 'Consultivo', desc: 'Hace preguntas, escucha y aconseja' },
]

const TABS = ['Configuración', 'Preguntas', 'Actividad']

export default function Agent() {
  const { org } = useAuthStore()
  const [tab, setTab] = useState(0)
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activity, setActivity] = useState([])
  const [testing, setTesting] = useState(false)
  const [testName, setTestName] = useState('')
  const [testResult, setTestResult] = useState(null)

  // Load agent config from Firestore
  useEffect(() => {
    if (!org?.id) return
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'organizations', org.id, 'settings', 'agent'))
        if (snap.exists()) setConfig({ ...DEFAULT_CONFIG, ...snap.data() })
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [org?.id])

  // Real-time activity feed
  useEffect(() => {
    if (!org?.id) return
    const q = query(
      collection(db, 'organizations', org.id, 'agent_activity'),
      orderBy('createdAt', 'desc'),
      limit(20)
    )
    const unsub = onSnapshot(q, snap => {
      setActivity(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [org?.id])

  const handleSave = async () => {
    if (!org?.id) return
    setSaving(true)
    try {
      await setDoc(
        doc(db, 'organizations', org.id, 'settings', 'agent'),
        { ...config, updatedAt: serverTimestamp() }
      )
      toast.success('Configuración guardada')
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleTestQualify = async () => {
    if (!testName.trim()) { toast.error('Escribe un nombre de lead'); return }
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/.netlify/functions/qualify-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead: { name: testName, source: 'manual' },
          agentConfig: config,
          orgName: org.name,
        }),
      })
      const data = await res.json()
      setTestResult(data)
    } catch (err) {
      toast.error('Error al conectar con el agente')
      console.error(err)
    } finally {
      setTesting(false)
    }
  }

  const setQ = (i, val) => {
    const qs = [...config.qualifyingQuestions]
    qs[i] = val
    setConfig(c => ({ ...c, qualifyingQuestions: qs }))
  }

  const addQ = () => {
    if (config.qualifyingQuestions.length >= 6) { toast.error('Máximo 6 preguntas'); return }
    setConfig(c => ({ ...c, qualifyingQuestions: [...c.qualifyingQuestions, ''] }))
  }

  const removeQ = (i) => {
    setConfig(c => ({ ...c, qualifyingQuestions: c.qualifyingQuestions.filter((_, idx) => idx !== i) }))
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-black/10 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* TOPBAR */}
      <div className="bg-surface border-b border-black/[0.08] px-5 h-[68px] flex items-center gap-3 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-accent-purple/10 flex items-center justify-center text-accent-purple">
            <Bot size={16} strokeWidth={2} />
          </div>
          <h1 className="font-display font-bold text-[15px] tracking-tight">Agente IA</h1>
        </div>

        {/* Status */}
        <div className={clsx(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border',
          config.autoRespond
            ? 'bg-green-50 text-green-600 border-green-200'
            : 'bg-surface-2 text-secondary border-black/[0.1]'
        )}>
          <div className={clsx(
            'w-1.5 h-1.5 rounded-full',
            config.autoRespond ? 'bg-green-500 animate-pulse' : 'bg-tertiary'
          )} />
          {config.autoRespond ? 'Activo' : 'Pausado'}
        </div>

        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setConfig(c => ({ ...c, autoRespond: !c.autoRespond }))}
            className="btn-secondary text-xs py-1.5 px-3"
          >
            {config.autoRespond ? 'Pausar agente' : 'Activar agente'}
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5">
            {saving
              ? <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
              : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {/* TABS */}
      <div className="bg-surface border-b border-black/[0.08] px-5 flex gap-0 flex-shrink-0">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={clsx(
              'px-4 py-3 text-[13px] font-semibold border-b-2 transition-all',
              tab === i
                ? 'border-primary text-primary'
                : 'border-transparent text-secondary hover:text-primary'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* ── TAB 0: CONFIGURACIÓN ── */}
        {tab === 0 && (
          <div className="max-w-2xl flex flex-col gap-6">

            {/* Nombre del agente */}
            <div className="card p-5">
              <h3 className="font-display font-bold text-sm mb-4">Identidad del agente</h3>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">
                    Nombre del agente
                  </label>
                  <input
                    value={config.name}
                    onChange={e => setConfig(c => ({ ...c, name: e.target.value }))}
                    className="input"
                    placeholder="Asistente FlowCRM"
                  />
                </div>

                {/* Personality */}
                <div>
                  <label className="text-[11px] font-semibold text-secondary uppercase tracking-wide block mb-2">
                    Personalidad
                  </label>
                  <div className="flex flex-col gap-2">
                    {PERSONALITIES.map(p => (
                      <div
                        key={p.value}
                        onClick={() => setConfig(c => ({ ...c, personality: p.value }))}
                        className={clsx(
                          'flex items-center gap-3 p-3 rounded-[10px] border cursor-pointer transition-all',
                          config.personality === p.value
                            ? 'border-primary bg-primary/[0.03]'
                            : 'border-black/[0.08] hover:border-black/[0.16]'
                        )}
                      >
                        <div className={clsx(
                          'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                          config.personality === p.value ? 'border-primary' : 'border-black/20'
                        )}>
                          {config.personality === p.value && (
                            <div className="w-2 h-2 rounded-full bg-primary" />
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-primary">{p.label}</div>
                          <div className="text-xs text-secondary">{p.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Mensaje de bienvenida */}
            <div className="card p-5">
              <h3 className="font-display font-bold text-sm mb-1">Mensaje de bienvenida</h3>
              <p className="text-xs text-secondary mb-3">Usa <code className="bg-surface-2 px-1 rounded">{'{nombre}'}</code> y <code className="bg-surface-2 px-1 rounded">{'{empresa}'}</code> como variables.</p>
              <textarea
                value={config.greeting}
                onChange={e => setConfig(c => ({ ...c, greeting: e.target.value }))}
                rows={3}
                className="input resize-none text-sm leading-relaxed"
              />
            </div>

            {/* Comportamiento */}
            <div className="card p-5">
              <h3 className="font-display font-bold text-sm mb-4">Comportamiento</h3>
              <div className="flex flex-col gap-4">

                {/* Auto respond toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-primary">Respuesta automática</div>
                    <div className="text-xs text-secondary">El agente responde sin intervención humana</div>
                  </div>
                  <button
                    onClick={() => setConfig(c => ({ ...c, autoRespond: !c.autoRespond }))}
                    className={clsx(
                      'w-10 h-6 rounded-full transition-all duration-200 relative',
                      config.autoRespond ? 'bg-primary' : 'bg-black/20'
                    )}
                  >
                    <div className={clsx(
                      'w-4 h-4 bg-white rounded-full absolute top-1 transition-all duration-200 shadow-sm',
                      config.autoRespond ? 'left-5' : 'left-1'
                    )} />
                  </button>
                </div>

                {/* Response delay */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-primary">Demora de respuesta</div>
                    <div className="text-xs text-secondary">Segundos antes de responder (más natural)</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setConfig(c => ({ ...c, responseDelay: Math.max(0, c.responseDelay - 1) }))}
                      className="w-7 h-7 rounded-lg border border-black/[0.1] flex items-center justify-center text-secondary hover:border-black/[0.2] text-lg leading-none"
                    >−</button>
                    <span className="font-display font-bold text-sm w-8 text-center">{config.responseDelay}s</span>
                    <button
                      onClick={() => setConfig(c => ({ ...c, responseDelay: Math.min(30, c.responseDelay + 1) }))}
                      className="w-7 h-7 rounded-lg border border-black/[0.1] flex items-center justify-center text-secondary hover:border-black/[0.2] text-lg leading-none"
                    >+</button>
                  </div>
                </div>

                {/* Score threshold */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-primary">Score para escalar</div>
                    <div className="text-xs text-secondary">El agente alerta al vendedor cuando el lead supera este score</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setConfig(c => ({ ...c, scoreThreshold: Math.max(10, c.scoreThreshold - 5) }))}
                      className="w-7 h-7 rounded-lg border border-black/[0.1] flex items-center justify-center text-secondary hover:border-black/[0.2] text-lg leading-none"
                    >−</button>
                    <span className="font-display font-bold text-sm w-10 text-center text-green-600">{config.scoreThreshold}</span>
                    <button
                      onClick={() => setConfig(c => ({ ...c, scoreThreshold: Math.min(100, c.scoreThreshold + 5) }))}
                      className="w-7 h-7 rounded-lg border border-black/[0.1] flex items-center justify-center text-secondary hover:border-black/[0.2] text-lg leading-none"
                    >+</button>
                  </div>
                </div>

              </div>
            </div>

            {/* TEST AGENTE */}
            <div className="card p-5 border-accent-purple/20" style={{ borderColor: 'rgba(124,58,237,0.15)', background: 'rgba(124,58,237,0.02)' }}>
              <h3 className="font-display font-bold text-sm mb-1">Probar calificación IA</h3>
              <p className="text-xs text-secondary mb-3">Simula cómo el agente calificaría un lead nuevo.</p>
              <div className="flex gap-2">
                <input
                  value={testName}
                  onChange={e => setTestName(e.target.value)}
                  placeholder="Nombre del lead de prueba"
                  className="input flex-1"
                />
                <button
                  onClick={handleTestQualify}
                  disabled={testing}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-btn bg-accent-purple text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 border-none cursor-pointer"
                >
                  {testing
                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <><Zap size={14} /> Probar</>}
                </button>
              </div>

              {testResult && (
                <div className="mt-4 p-4 bg-surface rounded-[10px] border border-black/[0.08]">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="text-2xl font-display font-bold" style={{ color: testResult.score >= 80 ? '#00c853' : testResult.score >= 50 ? '#f59e0b' : '#6e6e73' }}>
                      {testResult.score}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-secondary uppercase tracking-wide">Score generado</div>
                      <div className="text-xs text-tertiary flex items-center gap-1">{testResult.score >= config.scoreThreshold ? <><Bell size={12} /> Escalaría al vendedor</> : <><Hourglass size={12} /> Continúa en nurturing</>}</div>
                    </div>
                  </div>
                  {testResult.analysis && (
                    <p className="text-xs text-secondary leading-relaxed border-t border-black/[0.06] pt-3">{testResult.analysis}</p>
                  )}
                  {testResult.suggestedMessage && (
                    <div className="mt-3 pt-3 border-t border-black/[0.06]">
                      <div className="text-[10px] font-bold text-tertiary uppercase tracking-wide mb-1">Mensaje sugerido</div>
                      <p className="text-xs text-primary leading-relaxed bg-surface-2 p-3 rounded-lg">{testResult.suggestedMessage}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ── TAB 1: PREGUNTAS ── */}
        {tab === 1 && (
          <div className="max-w-2xl">
            <div className="card p-5">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-display font-bold text-sm">Preguntas de calificación</h3>
                <span className="text-xs text-tertiary">{config.qualifyingQuestions.length}/6</span>
              </div>
              <p className="text-xs text-secondary mb-4">
                El agente hace estas preguntas para calificar al lead y generar su score. El orden importa.
              </p>

              <div className="flex flex-col gap-2 mb-4">
                {config.qualifyingQuestions.map((q, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-surface-2 border border-black/[0.08] flex items-center justify-center text-[11px] font-bold text-tertiary flex-shrink-0">
                      {i + 1}
                    </div>
                    <input
                      value={q}
                      onChange={e => setQ(i, e.target.value)}
                      className="input flex-1 text-sm"
                      placeholder={`Pregunta ${i + 1}`}
                    />
                    <button
                      onClick={() => removeQ(i)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-tertiary hover:bg-red-50 hover:text-red-500 transition-colors flex-shrink-0"
                    >
                      <X size={14} strokeWidth={2.5} />
                    </button>
                  </div>
                ))}
              </div>

              <button onClick={addQ} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
                <Plus size={14} strokeWidth={2.5} />
                Agregar pregunta
              </button>
            </div>
          </div>
        )}

        {/* ── TAB 2: ACTIVIDAD ── */}
        {tab === 2 && (
          <div className="max-w-2xl">
            <div className="card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-black/[0.06]">
                <span className="font-display font-bold text-sm">Actividad reciente</span>
              </div>
              {activity.length === 0 ? (
                <div className="text-center py-12 text-secondary text-sm">
                  Sin actividad todavía.<br />
                  <span className="text-tertiary text-xs">El agente registrará aquí cada acción que tome.</span>
                </div>
              ) : (
                activity.map(item => (
                  <div key={item.id} className="flex gap-3 px-5 py-3.5 border-b border-black/[0.04] last:border-0">
                    <div className="w-7 h-7 rounded-lg bg-surface-2 border border-black/[0.06] flex items-center justify-center text-sm flex-shrink-0 mt-0.5">
                      {item.type === 'qualify' ? <Zap size={14} /> : item.type === 'message' ? <MessageCircle size={14} /> : item.type === 'escalate' ? <Bell size={14} /> : <FileText size={14} />}
                    </div>
                    <div className="flex-1">
                      <p className="text-[13px] text-primary">{item.description}</p>
                      <p className="text-[11px] text-tertiary mt-0.5">
                        {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString('es-MX') : ''}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
