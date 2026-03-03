import { useState, useEffect, useRef } from 'react'
import {
  collection, addDoc, onSnapshot, query,
  orderBy, updateDoc, doc, serverTimestamp, getDoc, setDoc
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { Smartphone, Camera, Youtube, Facebook, Tv, RotateCcw, Play, MapPin, Search, Rocket, PenTool, Fish, Clapperboard, Radio, Lightbulb, Flame, BarChart2, Zap, Settings } from 'lucide-react'

const NETWORKS = [
  { value: 'tiktok', label: 'TikTok', icon: <Smartphone size={14} /> },
  { value: 'instagram', label: 'Instagram Reels', icon: <Camera size={14} /> },
  { value: 'youtube', label: 'YouTube Shorts', icon: <Youtube size={14} /> },
  { value: 'facebook', label: 'Facebook', icon: <Facebook size={14} /> },
]

const STAGE_CONFIG = {
  idea: { label: 'Idea', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  scripting: { label: 'En guión', color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' },
  recording: { label: 'Grabando', color: '#0066ff', bg: 'rgba(0,102,255,0.1)' },
  editing: { label: 'Editando', color: '#00b8d9', bg: 'rgba(0,184,217,0.1)' },
  ready: { label: 'Listo', color: '#00c853', bg: 'rgba(0,200,83,0.1)' },
  published: { label: 'Publicado', color: '#6e6e73', bg: 'rgba(110,110,115,0.1)' },
}

// ── TELEPROMPTER ──
function Teleprompter({ script, onClose }) {
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [fontSize, setFontSize] = useState(26)
  const [elapsed, setElapsed] = useState(0)
  const scrollRef = useRef(null)
  const animRef = useRef(null)
  const startRef = useRef(null)

  const fullText = script ? [
    script.hooks?.[0]?.text,
    script.script?.context?.text,
    script.script?.development?.text,
    script.script?.cta?.text,
  ].filter(Boolean).join('\n\n') : ''

  useEffect(() => {
    if (playing) {
      startRef.current = Date.now() - elapsed * 1000
      const animate = () => {
        const el = scrollRef.current
        if (!el) return
        const secs = (Date.now() - startRef.current) / 1000
        setElapsed(secs)
        const totalScroll = el.scrollHeight - el.clientHeight
        const duration = 60 / speed
        el.scrollTop = (secs / duration) * totalScroll
        if (el.scrollTop < totalScroll) {
          animRef.current = requestAnimationFrame(animate)
        } else {
          setPlaying(false)
        }
      }
      animRef.current = requestAnimationFrame(animate)
    } else {
      cancelAnimationFrame(animRef.current)
    }
    return () => cancelAnimationFrame(animRef.current)
  }, [playing, speed])

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

  return (
    <div className="fixed inset-0 z-50 bg-primary flex flex-col">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.08]">
        <span className="text-white font-display font-bold text-sm flex items-center gap-1.5"><Tv size={14} /> Teleprompter</span>
        <div className="flex items-center gap-4 ml-4">
          <div className="flex items-center gap-2">
            <span className="text-white/40 text-[10px] uppercase tracking-wide font-semibold">Velocidad</span>
            <button onClick={() => setSpeed(s => Math.max(0.3, +(s - 0.1).toFixed(1)))}
              className="w-6 h-6 rounded bg-white/10 text-white/60 flex items-center justify-center text-sm hover:bg-white/20">−</button>
            <span className="text-accent-amber font-bold text-sm w-8 text-center">{speed}x</span>
            <button onClick={() => setSpeed(s => Math.min(3, +(s + 0.1).toFixed(1)))}
              className="w-6 h-6 rounded bg-white/10 text-white/60 flex items-center justify-center text-sm hover:bg-white/20">+</button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white/40 text-[10px] uppercase tracking-wide font-semibold">Fuente</span>
            <button onClick={() => setFontSize(s => Math.max(16, s - 2))}
              className="w-6 h-6 rounded bg-white/10 text-white/60 flex items-center justify-center text-xs font-bold hover:bg-white/20">A-</button>
            <button onClick={() => setFontSize(s => Math.min(48, s + 2))}
              className="w-6 h-6 rounded bg-white/10 text-white/60 flex items-center justify-center text-xs font-bold hover:bg-white/20">A+</button>
          </div>
        </div>
        <button onClick={onClose} className="ml-auto text-white/40 hover:text-white text-sm">✕ Cerrar</button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-primary to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-primary to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-x-0 top-1/2 -translate-y-px h-px bg-amber-400/30 z-20 pointer-events-none" />
        <div ref={scrollRef} className="h-full overflow-hidden px-16 py-32">
          {fullText.split('\n\n').map((para, i) => (
            <p key={i} className="mb-8 text-white/90 leading-relaxed font-display font-bold"
              style={{ fontSize }}>
              {para}
            </p>
          ))}
          <div style={{ height: '60vh' }} />
        </div>
      </div>

      <div className="flex items-center gap-3 px-5 py-4 border-t border-white/[0.08]">
        <button
          onClick={() => { setElapsed(0); if (scrollRef.current) scrollRef.current.scrollTop = 0 }}
          className="w-9 h-9 rounded-lg bg-white/10 text-white/60 flex items-center justify-center hover:bg-white/20 text-base"
        ><RotateCcw size={16} /></button>
        <button
          onClick={() => setPlaying(p => !p)}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm transition-all"
          style={{ background: playing ? 'rgba(255,59,48,0.9)' : '#f59e0b', color: playing ? 'white' : '#0a0a0a' }}
        >
          {playing ? (
            <><div className="w-2 h-2 rounded-full bg-white animate-pulse" /> Pausar</>
          ) : (
            <><Play size={14} fill="currentColor" /> Iniciar</>
          )}
        </button>
        <span className="text-white/40 font-display font-bold text-sm w-12 text-center">{formatTime(elapsed)}</span>
      </div>
    </div>
  )
}

// ── SCRIPT VIEW ──
function ScriptView({ content, onOpenTeleprompter, onBack }) {
  const { script } = content
  const [selectedHook, setSelectedHook] = useState(0)
  const [copyTab, setCopyTab] = useState('tiktok')

  if (!script) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-7 h-7 border-2 border-black/10 border-t-accent-purple rounded-full animate-spin" />
    </div>
  )

  const ScriptSection = ({ icon, title, duration, text, tip }) => (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-black/[0.06]">
        <span className="text-lg">{icon}</span>
        <span className="font-display font-bold text-sm">{title}</span>
        {duration && <span className="ml-auto text-[11px] font-semibold text-tertiary bg-surface-2 px-2 py-0.5 rounded-full border border-black/[0.08]">{duration}</span>}
      </div>
      <div className="p-5">
        <p className="font-display font-semibold text-[15px] leading-relaxed text-primary mb-3">{text}</p>
        {tip && (
          <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-[8px] px-3 py-2 items-start">
            <span className="text-sm flex-shrink-0 mt-[2px]"><Lightbulb size={14} className="text-amber-500" /></span>
            <p className="text-xs text-amber-800 leading-relaxed">{tip}</p>
          </div>
        )}
      </div>
    </div>
  )

  const activeCopy = script.copies?.[copyTab]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="bg-surface border-b border-black/[0.08] px-5 py-3 flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack} className="text-xs text-secondary hover:text-primary transition-colors flex items-center gap-1">
          ← Volver
        </button>
        <div className="w-px h-4 bg-black/[0.1]" />
        <span className="font-display font-bold text-sm truncate flex-1">{content.title}</span>
        <div className="flex gap-2">
          <button onClick={onOpenTeleprompter}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90 transition-opacity">
            <Tv size={14} /> Teleprompter
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-2xl mx-auto flex flex-col gap-4">
          <div className="card p-5">
            <div className="font-display font-bold text-sm mb-3 flex items-center gap-2">
              <Fish size={14} /> Hook <span className="text-tertiary text-xs font-normal">— elige uno</span>
            </div>
            <div className="flex flex-col gap-2">
              {(script.hooks || []).map((hook, i) => (
                <div key={i} onClick={() => setSelectedHook(i)}
                  className={clsx('p-3 rounded-[10px] border cursor-pointer transition-all',
                    selectedHook === i ? 'border-accent-amber bg-amber-50' : 'border-black/[0.08] hover:border-black/[0.16]'
                  )}>
                  <div className="text-[10px] font-bold text-tertiary uppercase tracking-wide mb-1 capitalize">{hook.type}</div>
                  <p className="text-[13.5px] font-semibold text-primary leading-snug">{hook.text}</p>
                </div>
              ))}
            </div>
          </div>

          <ScriptSection icon={<MapPin size={16} />} title="Contexto" duration={script.script?.context?.duration}
            text={script.script?.context?.text} tip={script.script?.context?.tip} />
          <ScriptSection icon={<Search size={16} />} title="Desarrollo" duration={script.script?.development?.duration}
            text={script.script?.development?.text} tip={script.script?.development?.tip} />
          <ScriptSection icon={<Rocket size={16} />} title="CTA" duration={script.script?.cta?.duration}
            text={script.script?.cta?.text} tip={script.script?.cta?.tip} />

          {script.copies && (
            <div className="card overflow-hidden">
              <div className="flex items-center gap-0 px-5 pt-4 border-b border-black/[0.06]">
                <span className="font-display font-bold text-sm mr-4 flex items-center gap-1.5"><PenTool size={14} /> Copy por red</span>
                <div className="flex gap-0">
                  {NETWORKS.filter(n => script.copies?.[n.value]).map(n => (
                    <button key={n.value} onClick={() => setCopyTab(n.value)}
                      className={clsx('px-3 py-2.5 text-[12px] font-semibold border-b-2 transition-all',
                        copyTab === n.value ? 'border-primary text-primary' : 'border-transparent text-secondary hover:text-primary'
                      )}>
                      {n.icon} {n.label}
                    </button>
                  ))}
                </div>
              </div>
              {activeCopy && (
                <div className="p-5">
                  <p className="text-[13.5px] text-primary leading-relaxed mb-3">{activeCopy.caption}</p>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {(activeCopy.hashtags || []).map(tag => (
                      <span key={tag} className="text-[11px] text-accent-blue font-semibold">#{tag}</span>
                    ))}
                  </div>
                  {activeCopy.cta && (
                    <p className="text-[12px] font-semibold text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                      → {activeCopy.cta}
                    </p>
                  )}
                  <button onClick={() => {
                    navigator.clipboard.writeText(`${activeCopy.caption}\n\n${(activeCopy.hashtags || []).map(t => '#' + t).join(' ')}`)
                    toast.success('Copiado')
                  }} className="mt-3 btn-secondary text-xs py-1.5 px-3">
                    Copiar todo
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── TOPICS CONFIG ──
function TopicsConfig({ orgId, topics, setTopics }) {
  const [newTopic, setNewTopic] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await setDoc(doc(db, 'organizations', orgId, 'settings', 'content'), { topics }, { merge: true })
      toast.success('Temas guardados ✓')
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const addTopic = () => {
    if (!newTopic.trim()) return
    if (topics.includes(newTopic.trim())) { toast.error('Ese tema ya existe'); return }
    setTopics(t => [...t, newTopic.trim()])
    setNewTopic('')
  }

  const removeTopic = (i) => setTopics(t => t.filter((_, j) => j !== i))

  return (
    <div className="flex-1 overflow-y-auto p-5">
      <div className="max-w-lg mx-auto flex flex-col gap-4">

        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-[12px]">
          <span className="text-xl flex-shrink-0">🎯</span>
          <div>
            <p className="text-[12.5px] text-amber-800 font-semibold mb-0.5">Temas del radar de noticias</p>
            <p className="text-[11.5px] text-amber-700 leading-relaxed">El radar buscará noticias virales del día sobre estos temas específicamente. Entre más específicos sean, mejores resultados.</p>
          </div>
        </div>

        <div className="card p-5 flex flex-col gap-4">
          <div>
            <h3 className="font-display font-bold text-sm text-primary mb-1">Temas configurados</h3>
            <p className="text-xs text-secondary">Se usarán cada vez que hagas una búsqueda en el radar</p>
          </div>

          {topics.length === 0 ? (
            <div className="text-center py-8 text-tertiary">
              <Radio size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm font-semibold">Sin temas configurados</p>
              <p className="text-xs mt-1">Agrega al menos un tema para usar el radar</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {topics.map((t, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2.5 bg-surface-2 rounded-[10px] border border-black/[0.08]">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent-amber flex-shrink-0" />
                  <span className="text-[13px] font-semibold text-primary flex-1">{t}</span>
                  <button onClick={() => removeTopic(i)}
                    className="text-tertiary hover:text-red-500 transition-colors text-lg leading-none">×</button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              value={newTopic}
              onChange={e => setNewTopic(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addTopic() }}
              placeholder="Ej: Marketing digital, FinTech México, IA generativa..."
              className="input text-sm flex-1"
            />
            <button onClick={addTopic} disabled={!newTopic.trim()}
              className="btn-secondary px-4 text-sm disabled:opacity-40">
              + Agregar
            </button>
          </div>

          <button onClick={handleSave} disabled={saving || topics.length === 0}
            className="btn-primary text-sm py-2.5 flex items-center justify-center gap-2 disabled:opacity-40">
            {saving
              ? <><div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> Guardando...</>
              : '💾 Guardar temas'
            }
          </button>
        </div>

        <div className="card p-4">
          <p className="text-[11px] font-bold text-secondary uppercase tracking-wide mb-2">Ejemplos de temas</p>
          <div className="flex flex-wrap gap-1.5">
            {['IA & Tecnología', 'Marketing Digital', 'Negocios LATAM', 'Finanzas personales', 'Emprendimiento', 'Redes sociales', 'E-commerce', 'Startups México', 'Productividad', 'Ventas B2B'].map(t => (
              <button key={t} onClick={() => { if (!topics.includes(t)) setTopics(tp => [...tp, t]) }}
                className={clsx('text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all',
                  topics.includes(t)
                    ? 'bg-amber-50 border-amber-300 text-amber-700'
                    : 'bg-surface-2 border-black/[0.1] text-secondary hover:border-black/[0.2]'
                )}>
                {topics.includes(t) ? '✓ ' : '+ '}{t}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

// ── MAIN COMPONENT ──
export default function ContentStudio() {
  const { org } = useAuthStore()
  const [view, setView] = useState('dashboard')
  const [contents, setContents] = useState([])
  const [loadingNews, setLoadingNews] = useState(false)
  const [news, setNews] = useState([])
  const [selectedNews, setSelectedNews] = useState(null)
  const [selectedNetworks, setSelectedNetworks] = useState(['tiktok', 'instagram', 'youtube'])
  const [generatingScript, setGeneratingScript] = useState(false)
  const [selectedContent, setSelectedContent] = useState(null)
  const [showTeleprompter, setShowTeleprompter] = useState(false)
  const [agentConfig, setAgentConfig] = useState({ personality: 'amigable' })
  const [topics, setTopics] = useState([])
  const [activeTab, setActiveTab] = useState('radar')

  // Load agent config
  useEffect(() => {
    if (!org?.id) return
    getDoc(doc(db, 'organizations', org.id, 'settings', 'agent'))
      .then(snap => { if (snap.exists()) setAgentConfig(snap.data()) })
  }, [org?.id])

  // Load topics from Firestore
  useEffect(() => {
    if (!org?.id) return
    const unsub = onSnapshot(
      doc(db, 'organizations', org.id, 'settings', 'content'),
      snap => { if (snap.exists()) setTopics(snap.data().topics || []) }
    )
    return () => unsub()
  }, [org?.id])

  // Real-time content pipeline
  useEffect(() => {
    if (!org?.id) return
    const q = query(
      collection(db, 'organizations', org.id, 'content'),
      orderBy('createdAt', 'desc')
    )
    const unsub = onSnapshot(q, snap => {
      setContents(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [org?.id])

  const handleFetchNews = async () => {
    if (topics.length === 0) {
      toast.error('Configura al menos un tema en la pestaña Temas')
      setActiveTab('temas')
      return
    }
    setLoadingNews(true)
    try {
      const res = await fetch('/.netlify/functions/news-radar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topics }),
      })
      const data = await res.json()
      if (data.news) setNews(data.news)
      else toast.error('Error al obtener noticias')
    } catch {
      toast.error('Error al conectar con el radar')
    } finally {
      setLoadingNews(false)
    }
  }

  const handleGenerateScript = async (newsItem) => {
    if (selectedNetworks.length === 0) { toast.error('Selecciona al menos una red'); return }
    setGeneratingScript(true)
    try {
      const res = await fetch('/.netlify/functions/gen-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ news: newsItem, networks: selectedNetworks, agentConfig }),
      })
      const script = await res.json()
      const docRef = await addDoc(collection(db, 'organizations', org.id, 'content'), {
        title: newsItem.title,
        newsSource: newsItem.source,
        newsCategory: newsItem.category,
        viralScore: newsItem.score,
        networks: selectedNetworks,
        script,
        stage: 'scripting',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      const saved = { id: docRef.id, title: newsItem.title, script, networks: selectedNetworks, stage: 'scripting' }
      setSelectedContent(saved)
      setView('script')
      toast.success('Guión generado')
    } catch (err) {
      console.error(err)
      toast.error('Error al generar el guión')
    } finally {
      setGeneratingScript(false)
    }
  }

  const handleStageChange = async (contentId, stage) => {
    await updateDoc(doc(db, 'organizations', org.id, 'content', contentId), { stage, updatedAt: serverTimestamp() })
    if (selectedContent?.id === contentId) setSelectedContent(c => ({ ...c, stage }))
  }

  const pipelineByStage = Object.keys(STAGE_CONFIG).reduce((acc, stage) => {
    acc[stage] = contents.filter(c => c.stage === stage)
    return acc
  }, {})

  if (view === 'script' && selectedContent) {
    return (
      <>
        <ScriptView
          content={selectedContent}
          onBack={() => setView('dashboard')}
          onOpenTeleprompter={() => setShowTeleprompter(true)}
        />
        {showTeleprompter && (
          <Teleprompter
            script={selectedContent.script}
            onClose={() => setShowTeleprompter(false)}
          />
        )}
      </>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* TOPBAR */}
      <div className="bg-surface border-b border-black/[0.08] px-5 h-[68px] flex items-center gap-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.15)' }}>
            <Clapperboard size={14} className="text-amber-500" />
          </div>
          <h1 className="font-display font-bold text-[15px] tracking-tight">Content Studio</h1>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 ml-1">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-amber animate-pulse" />
            <span className="text-[10px] font-bold text-amber-700">MÓDULO EXCLUSIVO</span>
          </div>
        </div>

        <div className="ml-auto flex gap-1 bg-surface-2 border border-black/[0.08] rounded-[8px] p-0.5">
          {[
            ['radar', <><Radio size={13} className="inline-block mr-1" />Radar</>],
            ['pipeline', <><Clapperboard size={13} className="inline-block mr-1" />Pipeline</>],
            ['temas', <><Settings size={13} className="inline-block mr-1" />Temas{topics.length === 0 && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />}</>],
          ].map(([v, l]) => (
            <button key={v} onClick={() => setActiveTab(v)}
              className={clsx('px-3 py-1.5 rounded-[6px] text-[12px] font-semibold transition-all',
                activeTab === v ? 'bg-surface text-primary shadow-sm' : 'text-secondary hover:text-primary'
              )}>{l}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">

        {/* ── RADAR TAB ── */}
        {activeTab === 'radar' && (
          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 border-r border-black/[0.08]">

              <div className="flex items-center gap-3 mb-4">
                <div className="flex flex-wrap gap-1.5 flex-1">
                  {topics.length === 0 ? (
                    <button onClick={() => setActiveTab('temas')}
                      className="text-[11px] font-semibold px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-colors">
                      ⚠ Configura tus temas primero →
                    </button>
                  ) : (
                    topics.map(t => (
                      <span key={t} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-surface border border-black/[0.08] text-secondary">
                        {t}
                      </span>
                    ))
                  )}
                </div>
                <button onClick={handleFetchNews} disabled={loadingNews || topics.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-all flex-shrink-0">
                  {loadingNews
                    ? <><div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> Buscando...</>
                    : <><Radio size={14} /> Buscar noticias</>}
                </button>
              </div>

              {news.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-3 flex justify-center text-primary"><Radio size={40} strokeWidth={1.5} /></div>
                  <p className="font-display font-bold text-base text-primary mb-1">Radar de noticias</p>
                  <p className="text-sm text-secondary max-w-xs">
                    {topics.length === 0
                      ? 'Primero configura tus temas en la pestaña Temas'
                      : 'El agente busca las noticias más virales del día sobre tus temas de interés.'
                    }
                  </p>
                  {topics.length === 0 ? (
                    <button onClick={() => setActiveTab('temas')} className="mt-4 btn-primary text-sm py-2 px-5">
                      Configurar temas →
                    </button>
                  ) : (
                    <button onClick={handleFetchNews} disabled={loadingNews}
                      className="mt-4 btn-primary text-sm py-2 px-5 flex items-center gap-2">
                      {loadingNews ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Buscando...</> : <><Radio size={14} /> Buscar ahora</>}
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {news.map((item, i) => (
                    <div key={i}
                      onClick={() => setSelectedNews(item)}
                      className={clsx('card p-4 cursor-pointer transition-all hover:shadow-card-md',
                        selectedNews === item ? 'border-accent-amber ring-2 ring-amber-200' : 'hover:border-black/[0.14]'
                      )}>
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                              {item.category}
                            </span>
                            <span className="text-[10px] text-tertiary">{item.source} · {item.publishedAt}</span>
                          </div>
                          <h3 className="font-display font-bold text-[13.5px] text-primary leading-tight mb-1.5">{item.title}</h3>
                          <p className="text-[12px] text-secondary leading-relaxed line-clamp-2">{item.summary}</p>
                          <p className="text-[11px] text-tertiary mt-1.5 italic flex items-center gap-1">
                            <Lightbulb size={11} className="text-amber-500" /> {item.viralAngle}
                          </p>
                        </div>
                        <div className="flex flex-col items-center flex-shrink-0">
                          <div className={clsx('text-[13px] font-bold px-2 py-1 rounded-lg',
                            item.score >= 85 ? 'bg-red-50 text-red-600' :
                              item.score >= 70 ? 'bg-amber-50 text-amber-700' : 'bg-surface-2 text-secondary'
                          )}>
                            {item.score >= 85 ? <Flame size={12} className="inline-block" /> : <BarChart2 size={12} className="inline-block" />} {item.score}
                          </div>
                          <span className="text-[9px] text-tertiary mt-0.5">score</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: create content panel */}
            <div className="w-[300px] min-w-[300px] flex flex-col bg-surface">
              <div className="px-5 py-4 border-b border-black/[0.08]">
                <h3 className="font-display font-bold text-sm">Crear contenido</h3>
                <p className="text-xs text-secondary mt-0.5">
                  {selectedNews ? `"${selectedNews.title.slice(0, 40)}..."` : 'Selecciona una noticia'}
                </p>
              </div>
              <div className="p-5 flex flex-col gap-4 flex-1">
                <div>
                  <label className="text-[11px] font-semibold text-secondary uppercase tracking-wide block mb-2">Redes destino</label>
                  <div className="flex flex-col gap-1.5">
                    {NETWORKS.map(n => (
                      <div key={n.value}
                        onClick={() => setSelectedNetworks(nets =>
                          nets.includes(n.value) ? nets.filter(x => x !== n.value) : [...nets, n.value]
                        )}
                        className={clsx('flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-all text-sm font-semibold',
                          selectedNetworks.includes(n.value)
                            ? 'bg-primary text-white border-primary'
                            : 'border-black/[0.1] text-secondary hover:border-black/[0.2]'
                        )}>
                        <span>{n.icon}</span> {n.label}
                        {selectedNetworks.includes(n.value) && <span className="ml-auto text-xs">✓</span>}
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => selectedNews && handleGenerateScript(selectedNews)}
                  disabled={!selectedNews || generatingScript || selectedNetworks.length === 0}
                  className="flex items-center justify-center gap-2 py-3 rounded-[10px] font-bold text-sm transition-all disabled:opacity-40"
                  style={{ background: '#f59e0b', color: '#0a0a0a' }}
                >
                  {generatingScript
                    ? <><div className="w-4 h-4 border-2 border-black/20 border-t-black/60 rounded-full animate-spin" /> Generando guión...</>
                    : <><Zap size={14} /> Generar guión con IA</>}
                </button>
                {!selectedNews && (
                  <p className="text-[11px] text-center text-tertiary">← Selecciona una noticia del radar</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── PIPELINE TAB ── */}
        {activeTab === 'pipeline' && (
          <div className="flex-1 overflow-x-auto overflow-y-hidden p-5">
            <div className="flex gap-4 h-full w-max">
              {Object.entries(STAGE_CONFIG).map(([stage, cfg]) => {
                const items = pipelineByStage[stage] || []
                return (
                  <div key={stage} className="w-[240px] min-w-[240px] flex flex-col">
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: cfg.color }} />
                      <span className="font-display font-bold text-[12.5px] text-primary flex-1">{cfg.label}</span>
                      <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: cfg.bg, color: cfg.color }}>{items.length}</span>
                    </div>
                    <div className="flex-1 bg-black/[0.02] rounded-[10px] p-2 flex flex-col gap-2 overflow-y-auto">
                      {items.map(item => (
                        <div key={item.id}
                          className="bg-surface rounded-[8px] border border-black/[0.08] p-3 cursor-pointer hover:border-black/[0.16] transition-all"
                          onClick={() => { setSelectedContent(item); setView('script') }}
                        >
                          <p className="font-semibold text-[12px] text-primary leading-tight mb-2 line-clamp-2">{item.title}</p>
                          <div className="flex items-center gap-1.5 flex-wrap mb-2">
                            {(item.networks || []).map(n => {
                              const net = NETWORKS.find(x => x.value === n)
                              return net ? <span key={n} className="text-sm">{net.icon}</span> : null
                            })}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-tertiary">
                              {item.createdAt?.toDate ? format(item.createdAt.toDate(), 'd MMM', { locale: es }) : ''}
                            </span>
                            <select
                              value={item.stage}
                              onChange={e => { e.stopPropagation(); handleStageChange(item.id, e.target.value) }}
                              onClick={e => e.stopPropagation()}
                              className="text-[10px] border border-black/[0.08] rounded-md px-1.5 py-0.5 bg-surface-2 text-secondary outline-none cursor-pointer"
                            >
                              {Object.entries(STAGE_CONFIG).map(([v, c]) => (
                                <option key={v} value={v}>{c.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                      {items.length === 0 && (
                        <div className="text-center py-4 text-tertiary text-xs">Sin contenido</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── TEMAS TAB ── */}
        {activeTab === 'temas' && (
          <TopicsConfig orgId={org?.id} topics={topics} setTopics={setTopics} />
        )}

      </div>
    </div>
  )
}
