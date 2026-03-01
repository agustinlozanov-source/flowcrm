import { useState, useEffect, useRef } from 'react'
import { doc, onSnapshot, collection, query, orderBy, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const TABS = [
  { id: 'identity',   icon: '🤖', label: 'Identidad' },
  { id: 'product',    icon: '📦', label: 'Producto' },
  { id: 'sales',      icon: '🎯', label: 'Ventas' },
  { id: 'objections', icon: '🛡️', label: 'Objeciones' },
  { id: 'knowledge',  icon: '🧠', label: 'Conocimiento' },
  { id: 'test',       icon: '⚡', label: 'Probar' },
]

const PERSONALITIES = [
  { value: 'amigable',    label: 'Amigable',     desc: 'Cálido, cercano, genera confianza' },
  { value: 'profesional', label: 'Profesional',  desc: 'Formal, directo, enfocado en datos' },
  { value: 'consultivo',  label: 'Consultivo',   desc: 'Analítico, hace preguntas poderosas' },
  { value: 'energico',    label: 'Enérgico',     desc: 'Entusiasta, crea urgencia natural' },
]

const OBJECTIVES = [
  { value: 'agendar_llamada', label: 'Agendar llamada',    icon: '📞', desc: 'Empuja hacia una reunión o llamada' },
  { value: 'calificar',       label: 'Calificar lead',     icon: '✅', desc: 'Determina si es un buen prospecto' },
  { value: 'cerrar_chat',     label: 'Cerrar por chat',    icon: '🤝', desc: 'Intenta cerrar la venta directo' },
  { value: 'nutrir',          label: 'Nutrir / Educar',    icon: '🌱', desc: 'Construye confianza sin presionar' },
]

const SALES_TECHNIQUES = [
  { value: 'aida',       label: 'AIDA',          desc: 'Atención → Interés → Deseo → Acción' },
  { value: 'spin',       label: 'SPIN Selling',  desc: 'Situación → Problema → Implicación → Necesidad' },
  { value: 'challenger', label: 'Challenger',    desc: 'Enseña, adapta y toma control' },
  { value: 'rapport',    label: 'Rapport first', desc: 'Construye relación antes de vender' },
]

const CLOSING_TECHNIQUES = [
  { value: 'valor_primero', label: 'Valor primero',  desc: 'Presenta beneficios antes del precio' },
  { value: 'urgencia',      label: 'Urgencia',       desc: 'Escasez real de tiempo o lugares' },
  { value: 'alternativas',  label: 'Alternativas',   desc: '"¿Prefieres plan A o plan B?"' },
  { value: 'directo',       label: 'Cierre directo', desc: '"¿Empezamos esta semana?"' },
]

const DEFAULT_OBJECTIONS = [
  { objection: 'Está muy caro', response: '' },
  { objection: 'Lo tengo que pensar', response: '' },
  { objection: 'No tengo tiempo', response: '' },
  { objection: 'Ya tengo un proveedor', response: '' },
]

const ACCEPTED_TYPES = ['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain']

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

function RadioCard({ option, selected, onSelect }) {
  return (
    <div onClick={() => onSelect(option.value)}
      className={clsx('flex items-start gap-3 p-3.5 rounded-[10px] border cursor-pointer transition-all',
        selected ? 'border-accent-blue bg-blue-50' : 'border-black/[0.08] hover:border-black/[0.16]'
      )}>
      <div className={clsx('w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all',
        selected ? 'border-accent-blue' : 'border-black/20'
      )}>
        {selected && <div className="w-2 h-2 rounded-full bg-accent-blue" />}
      </div>
      <div>
        <div className="flex items-center gap-2">
          {option.icon && <span>{option.icon}</span>}
          <span className="font-semibold text-[13px] text-primary">{option.label}</span>
        </div>
        <p className="text-[11px] text-secondary mt-0.5">{option.desc}</p>
      </div>
    </div>
  )
}

function TestPanel({ orgId, config }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
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
              <div className="text-3xl mb-2">💬</div>
              <p className="text-sm text-secondary">Escribe algo para probar al agente</p>
              <p className="text-xs text-tertiary mt-1">Ej: "Hola, me interesa saber más"</p>
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={clsx('flex flex-col', msg.role === 'user' ? 'items-end' : 'items-start')}>
            <span className="text-[9px] font-bold text-tertiary uppercase tracking-wide mb-1">
              {msg.role === 'user' ? '👤 Tú (simulando lead)' : `🤖 ${config.agentName || 'Agente'}`}
            </span>
            <div className={clsx('max-w-[80%] px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed',
              msg.role === 'user' ? 'bg-surface-2 border border-black/[0.08] text-primary rounded-tr-sm' : 'text-white rounded-tl-sm'
            )} style={msg.role === 'agent' ? { background: '#7c3aed' } : {}}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-start">
            <div className="px-4 py-3 rounded-2xl rounded-tl-sm flex gap-1" style={{ background: '#7c3aed' }}>
              {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="px-4 py-3 border-t border-black/[0.06] flex gap-2 flex-shrink-0">
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') sendMessage() }}
          placeholder="Escribe como si fueras el lead..." className="flex-1 input text-sm py-2" />
        <button onClick={sendMessage} disabled={!text.trim() || loading} className="btn-primary px-4 py-2 text-sm disabled:opacity-40">Enviar</button>
        <button onClick={() => setMessages([])} className="btn-secondary px-3 py-2 text-sm">Limpiar</button>
      </div>
    </div>
  )
}

export default function Agent() {
  const { org } = useAuthStore()
  const [activeTab, setActiveTab] = useState('identity')
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [files, setFiles] = useState([])
  const [uploadingFile, setUploadingFile] = useState(false)
  const fileInputRef = useRef()

  const [config, setConfig] = useState({
    agentName: 'Sofía',
    personality: 'amigable',
    greeting: 'Hola {nombre}, soy Sofía. Vi que te interesó nuestro servicio. ¿Tienes 2 minutos para contarme qué estás buscando?',
    mainObjective: 'agendar_llamada',
    salesTechnique: 'aida',
    closingTechnique: 'valor_primero',
    productDescription: '',
    prices: '',
    qualifyingQuestions: ['¿Cuál es tu mayor reto actualmente?', '¿Ya has probado otras soluciones?', '¿Cuándo te gustaría empezar?'],
    objections: DEFAULT_OBJECTIONS,
    limits: ['No mencionar a la competencia', 'No dar precio sin antes calificar al lead', 'Escalar a humano si preguntan por soporte técnico'],
    customInstructions: '',
    autoRespond: true,
    responseDelay: 3,
  })

  const set = (k, v) => setConfig(c => ({ ...c, [k]: v }))

  useEffect(() => {
    if (!org?.id) return
    const unsub = onSnapshot(doc(db, 'organizations', org.id, 'settings', 'agent'), snap => {
      if (snap.exists()) setConfig(c => ({ ...c, ...snap.data() }))
    })
    return () => unsub()
  }, [org?.id])

  useEffect(() => {
    if (!org?.id) return
    const q = query(collection(db, 'organizations', org.id, 'agent_files'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, snap => { setFiles(snap.docs.map(d => ({ id: d.id, ...d.data() }))) })
    return () => unsub()
  }, [org?.id])

  const handleSave = async () => {
    setSaving(true)
    try {
      await setDoc(doc(db, 'organizations', org.id, 'settings', 'agent'), { ...config, updatedAt: serverTimestamp() }, { merge: true })
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

  const handleDeleteFile = async (fileId) => {
    if (!confirm('¿Eliminar este archivo?')) return
    try {
      await fetch('/.netlify/functions/agent-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_file', orgId: org.id, fileDocId: fileId }),
      })
      toast.success('Archivo eliminado')
    } catch { toast.error('Error al eliminar') }
  }

  const updateObjection = (i, k, v) => { const o = [...config.objections]; o[i] = { ...o[i], [k]: v }; set('objections', o) }
  const updateQuestion = (i, v) => { const q = [...config.qualifyingQuestions]; q[i] = v; set('qualifyingQuestions', q) }
  const updateLimit = (i, v) => { const l = [...config.limits]; l[i] = v; set('limits', l) }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="bg-surface border-b border-black/[0.08] px-5 h-14 flex items-center gap-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center bg-purple-50">🤖</div>
          <h1 className="font-display font-bold text-[15px] tracking-tight">Agente IA</h1>
          {config.assistantId && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 border border-green-200 text-green-700">● Activo</span>}
        </div>
        <div className="ml-auto flex gap-2 items-center">
          {syncing && <div className="flex items-center gap-1.5 text-xs text-secondary"><div className="w-3 h-3 border border-black/20 border-t-accent-purple rounded-full animate-spin" />Sincronizando...</div>}
          <button onClick={handleSave} disabled={saving} className="btn-primary text-[12.5px] py-1.5 px-4 flex items-center gap-1.5">
            {saving ? <><div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />Guardando...</> : '💾 Guardar y sincronizar'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[180px] min-w-[180px] border-r border-black/[0.08] flex flex-col py-2 bg-surface flex-shrink-0">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={clsx('flex items-center gap-2.5 px-4 py-2.5 text-[12.5px] font-semibold transition-all text-left',
                activeTab === tab.id ? 'bg-primary/[0.06] text-primary border-r-2 border-primary' : 'text-secondary hover:bg-surface-2 hover:text-primary'
              )}>
              <span className="text-base">{tab.icon}</span>{tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="max-w-2xl mx-auto flex flex-col gap-4">

            {activeTab === 'identity' && (<>
              <Section title="Nombre e identidad" desc="Cómo se presenta el agente ante los leads">
                <div>
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-wide block mb-1.5">Nombre del agente</label>
                  <input value={config.agentName} onChange={e => set('agentName', e.target.value)} placeholder="Sofía, Carlos, Alex..." className="input text-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-wide block mb-2">Personalidad</label>
                  <div className="grid grid-cols-2 gap-2">
                    {PERSONALITIES.map(p => <RadioCard key={p.value} option={p} selected={config.personality === p.value} onSelect={v => set('personality', v)} />)}
                  </div>
                </div>
              </Section>
              <Section title="Mensaje de bienvenida" desc="Primer mensaje cuando llega un lead nuevo">
                <textarea value={config.greeting} onChange={e => set('greeting', e.target.value)} rows={3} className="input text-sm resize-none" placeholder="Hola {nombre}..." />
                <div className="flex flex-wrap gap-2">
                  {['{nombre}', '{empresa}', '{canal}'].map(v => (
                    <button key={v} onClick={() => set('greeting', config.greeting + v)}
                      className="text-[10px] font-bold px-2 py-1 rounded-lg bg-surface-2 border border-black/[0.1] text-secondary hover:border-black/[0.2]">{v}</button>
                  ))}
                </div>
              </Section>
              <Section title="Comportamiento">
                <div className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm font-semibold text-primary">Respuesta automática</p>
                    <p className="text-xs text-secondary">El agente responde sin intervención humana</p>
                  </div>
                  <div onClick={() => set('autoRespond', !config.autoRespond)}
                    className={clsx('w-11 h-6 rounded-full cursor-pointer transition-all relative', config.autoRespond ? 'bg-accent-blue' : 'bg-black/20')}>
                    <div className={clsx('absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all', config.autoRespond ? 'left-5' : 'left-0.5')} />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-wide block mb-1.5">Delay de respuesta — {config.responseDelay}s</label>
                  <input type="range" min={0} max={30} value={config.responseDelay} onChange={e => set('responseDelay', Number(e.target.value))} className="w-full accent-accent-blue" />
                </div>
              </Section>
            </>)}

            {activeTab === 'product' && (<>
              <Section title="Descripción del producto o servicio" desc="Cuéntale al agente qué vendes — entre más detalle, mejor vende">
                <textarea value={config.productDescription} onChange={e => set('productDescription', e.target.value)} rows={6} className="input text-sm resize-none" placeholder="Somos una agencia de marketing digital especializada en..." />
              </Section>
              <Section title="Precios y planes" desc="El agente usará esto para responder preguntas de precio">
                <textarea value={config.prices} onChange={e => set('prices', e.target.value)} rows={4} className="input text-sm resize-none" placeholder="- Plan Básico: $299/mes&#10;- Plan Pro: $599/mes" />
                <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">💡 Si prefieres que el agente no dé precios sin calificar, configúralo en las reglas de Ventas.</p>
              </Section>
              <Section title="Preguntas de calificación" desc="El agente las hace de forma natural">
                {config.qualifyingQuestions.map((q, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-xs font-bold text-tertiary w-5 pt-2.5 flex-shrink-0">{i+1}.</span>
                    <input value={q} onChange={e => updateQuestion(i, e.target.value)} className="input text-sm flex-1" placeholder="Pregunta de calificación..." />
                    <button onClick={() => set('qualifyingQuestions', config.qualifyingQuestions.filter((_,j) => j!==i))} className="text-tertiary hover:text-red-500 text-lg flex-shrink-0 pt-1">×</button>
                  </div>
                ))}
                <button onClick={() => set('qualifyingQuestions', [...config.qualifyingQuestions, ''])} className="btn-secondary text-xs py-1.5">+ Agregar pregunta</button>
              </Section>
            </>)}

            {activeTab === 'sales' && (<>
              <Section title="Objetivo principal" desc="El agente siempre empuja hacia este objetivo">
                <div className="grid grid-cols-2 gap-2">
                  {OBJECTIVES.map(o => <RadioCard key={o.value} option={o} selected={config.mainObjective === o.value} onSelect={v => set('mainObjective', v)} />)}
                </div>
              </Section>
              <Section title="Técnica de prospección" desc="Cómo estructura la conversación para vender">
                <div className="flex flex-col gap-2">
                  {SALES_TECHNIQUES.map(t => <RadioCard key={t.value} option={t} selected={config.salesTechnique === t.value} onSelect={v => set('salesTechnique', v)} />)}
                </div>
              </Section>
              <Section title="Técnica de cierre" desc="Cómo pide el compromiso final">
                <div className="grid grid-cols-2 gap-2">
                  {CLOSING_TECHNIQUES.map(t => <RadioCard key={t.value} option={t} selected={config.closingTechnique === t.value} onSelect={v => set('closingTechnique', v)} />)}
                </div>
              </Section>
              <Section title="Reglas de comportamiento" desc="Límites que el agente nunca debe violar">
                {config.limits.map((l, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-red-500 pt-2.5 flex-shrink-0">✕</span>
                    <input value={l} onChange={e => updateLimit(i, e.target.value)} className="input text-sm flex-1" placeholder="Ej: No mencionar a la competencia" />
                    <button onClick={() => set('limits', config.limits.filter((_,j) => j!==i))} className="text-tertiary hover:text-red-500 text-lg flex-shrink-0 pt-1">×</button>
                  </div>
                ))}
                <button onClick={() => set('limits', [...config.limits, ''])} className="btn-secondary text-xs py-1.5">+ Agregar regla</button>
              </Section>
            </>)}

            {activeTab === 'objections' && (<>
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-[12px]">
                <span className="text-xl flex-shrink-0">💡</span>
                <p className="text-[12.5px] text-amber-800 leading-relaxed">Entrena al agente con respuestas a las objeciones más comunes. Entre mejor estén escritas, más efectivo será en ventas.</p>
              </div>
              {config.objections.map((o, i) => (
                <div key={i} className="card p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-secondary uppercase tracking-wide">Objeción {i+1}</span>
                    <button onClick={() => set('objections', config.objections.filter((_,j) => j!==i))} className="text-xs text-tertiary hover:text-red-500">Eliminar</button>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-tertiary block mb-1">Cuando el lead dice...</label>
                    <input value={o.objection} onChange={e => updateObjection(i, 'objection', e.target.value)} className="input text-sm" placeholder='"Está muy caro"' />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-tertiary block mb-1">El agente responde...</label>
                    <textarea value={o.response} onChange={e => updateObjection(i, 'response', e.target.value)} rows={3} className="input text-sm resize-none" placeholder="Entiendo que el precio es importante. ¿Me permites preguntarte cuánto te está costando NO resolver este problema?..." />
                  </div>
                </div>
              ))}
              <button onClick={() => set('objections', [...config.objections, { objection: '', response: '' }])} className="btn-secondary py-2.5 flex items-center justify-center gap-2">+ Agregar objeción</button>
            </>)}

            {activeTab === 'knowledge' && (<>
              <div className="flex items-start gap-3 p-4 bg-purple-50 border border-purple-200 rounded-[12px]">
                <span className="text-xl flex-shrink-0">🧠</span>
                <div>
                  <p className="text-[12.5px] text-purple-800 font-semibold mb-1">Base de conocimiento RAG</p>
                  <p className="text-[11.5px] text-purple-700 leading-relaxed">Sube documentos y el agente los usa como fuente de verdad. PDFs, catálogos, FAQs, guiones — todo sirve.</p>
                </div>
              </div>
              <div onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-black/[0.14] rounded-[14px] p-8 text-center cursor-pointer hover:border-accent-purple hover:bg-purple-50/50 transition-all">
                <div className="text-3xl mb-2">{uploadingFile ? '⏳' : '📄'}</div>
                <p className="font-semibold text-sm text-primary mb-1">{uploadingFile ? 'Subiendo archivo...' : 'Sube documentos al agente'}</p>
                <p className="text-xs text-secondary">PDF, Word, TXT · Máximo 10MB por archivo</p>
                <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={e => e.target.files[0] && handleFileUpload(e.target.files[0])} />
              </div>
              {files.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="px-5 py-3 border-b border-black/[0.06]"><span className="font-display font-bold text-sm">Documentos ({files.length})</span></div>
                  <div className="divide-y divide-black/[0.04]">
                    {files.map(f => (
                      <div key={f.id} className="flex items-center gap-3 px-5 py-3">
                        <span className="text-xl flex-shrink-0">{f.mimeType === 'application/pdf' ? '📕' : f.mimeType === 'text/plain' ? '📝' : '📘'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-primary truncate">{f.name}</p>
                          <p className="text-[10px] text-tertiary">{(f.size/1024).toFixed(0)} KB · {f.status === 'processing' ? '⏳ Procesando...' : '✓ Listo'}</p>
                        </div>
                        <button onClick={() => handleDeleteFile(f.id)} className="text-tertiary hover:text-red-500 transition-colors p-1">
                          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1 1l11 11M12 1L1 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <Section title="Conocimiento manual" desc="Escribe directamente lo que quieres que el agente sepa">
                <textarea value={config.customInstructions} onChange={e => set('customInstructions', e.target.value)} rows={6} className="input text-sm resize-none"
                  placeholder="Casos de éxito, FAQs, políticas especiales, info del equipo..." />
              </Section>
            </>)}

            {activeTab === 'test' && (<>
              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-[12px] mb-1">
                <span className="text-xl flex-shrink-0">⚡</span>
                <p className="text-[12.5px] text-blue-800 leading-relaxed">Guarda los cambios primero, luego simula una conversación real con el agente.</p>
              </div>
              <TestPanel orgId={org?.id} config={config} />
            </>)}

          </div>
        </div>
      </div>
    </div>
  )
}
