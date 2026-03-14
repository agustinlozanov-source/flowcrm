import { useState, useEffect } from 'react'
import { collection, onSnapshot, query, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import clsx from 'clsx'
import toast from 'react-hot-toast'

const css = `
  .of-root * { box-sizing: border-box; }
  .of-root { font-family: 'Inter', sans-serif; color: #070708; }

  .of-layout { display: grid; grid-template-columns: 320px 1fr; gap: 20px; min-height: 600px; }

  .of-card {
    background: white;
    border: 1px solid rgba(0,0,0,0.08);
    box-shadow: 0 4px 12px rgba(0,0,0,0.03);
    border-radius: 14px; overflow: hidden;
    display: flex; flex-direction: column;
  }

  .of-header {
    padding: 16px 20px; border-bottom: 1px solid rgba(0,0,0,0.06);
    display: flex; align-items: center; gap: 10px; flex-shrink: 0;
  }
  .of-header-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 15px; font-weight: 800; flex: 1; }

  .of-list { flex: 1; overflow-y: auto; }

  .of-item {
    padding: 16px 20px; border-bottom: 1px solid rgba(0,0,0,0.04);
    cursor: pointer; transition: background 0.15s;
  }
  .of-item:hover { background: rgba(0,0,0,0.02); }
  .of-item.active { background: rgba(0,102,255,0.06); border-left: 3px solid #0066ff; }

  .of-item-top { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
  .of-item-name { font-size: 14px; font-weight: 700; flex: 1; color: #1c1c1e; }
  .of-item-time { font-size: 11px; color: #8e8e93; }
  .of-item-company { font-size: 13px; color: #8e8e93; }

  .of-badge {
    font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 6px;
  }
  .of-badge-new { background: rgba(0,102,255,0.1); color: #0066ff; border: 1px solid rgba(0,102,255,0.2); }
  .of-badge-reviewed { background: rgba(0,200,83,0.1); color: #00c853; border: 1px solid rgba(0,200,83,0.2); }

  /* DETAIL */
  .of-detail { overflow-y: auto; padding: 32px; }

  .of-detail-header { margin-bottom: 28px; }
  .of-detail-name { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 20px; font-weight: 900; letter-spacing: -0.3px; margin-bottom: 6px; color: #070708; }
  .of-detail-meta { font-size: 13px; color: #8e8e93; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

  .of-section { margin-bottom: 32px; }
  .of-section-title {
    font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; font-weight: 800;
    text-transform: uppercase; letter-spacing: 0.5px; color: #8e8e93;
    margin-bottom: 16px; display: flex; align-items: center; gap: 10px;
  }
  .of-section-title::after { content: ''; flex: 1; height: 1px; background: rgba(0,0,0,0.06); }

  .of-qa { margin-bottom: 16px; }
  .of-question { font-size: 13px; color: #8e8e93; margin-bottom: 6px; font-weight: 600; }
  .of-answer {
    font-size: 15px; color: #1c1c1e; line-height: 1.6;
    background: #f9f9f9; border: 1px solid rgba(0,0,0,0.06);
    border-radius: 10px; padding: 12px 16px;
  }
  .of-answer-empty { color: #8e8e93; font-style: italic; background: transparent; border: 1px dashed rgba(0,0,0,0.1); }
  .of-answer-tags { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 12px; border: none; background: transparent; }
  .of-tag {
    background: rgba(0,102,255,0.08); border: 1px solid rgba(0,102,255,0.18);
    border-radius: 8px; padding: 5px 12px; font-size: 13px; font-weight: 500; color: #0066ff;
  }
  .of-scale-display { display: flex; gap: 6px; padding: 8px 12px; align-items: center; border: none; background: transparent; }
  .of-scale-dot {
    width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center;
    justify-content: center; font-size: 13px; font-weight: 700;
    border: 1.5px solid rgba(0,0,0,0.1); color: #8e8e93; background: white;
  }
  .of-scale-dot.active { background: rgba(0,102,255,0.1); border-color: rgba(0,102,255,0.4); color: #0066ff; box-shadow: 0 2px 8px rgba(0,102,255,0.15); }

  .of-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 16px; border-radius: 8px;
    font-size: 13px; font-weight: 700; cursor: pointer; border: none;
    font-family: 'Inter', sans-serif; transition: all 0.15s;
  }
  .of-btn-white { background: #070708; color: white; }
  .of-btn-white:hover { background: #1c1c1e; }
  .of-btn-ghost { background: transparent; color: #8e8e93; border: 1px solid rgba(0,0,0,0.1); }
  .of-btn-ghost:hover { background: rgba(0,0,0,0.04); color: #070708; }
  .of-btn-green { background: rgba(0,200,83,0.1); color: #00c853; border: 1px solid rgba(0,200,83,0.2); }
  .of-btn-green:hover { background: rgba(0,200,83,0.18); }
  .of-btn-sm { padding: 6px 12px; font-size: 12px; }

  .of-link-box {
    background: rgba(0,102,255,0.05); border: 1px solid rgba(0,102,255,0.15);
    border-radius: 12px; padding: 16px 20px; margin-bottom: 24px;
    display: flex; align-items: center; gap: 12px;
  }
  .of-link-url { font-size: 14px; font-weight: 500; color: #0066ff; flex: 1; word-break: break-all; }

  .of-empty { text-align: center; padding: 60px 20px; color: #8e8e93; font-size: 14px; }
  .of-empty-icon { font-size: 32px; margin-bottom: 12px; opacity: 0.4; }

  .of-stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin-bottom: 20px; }
  .of-stat { background: white; border: 1px solid rgba(0,0,0,0.08); box-shadow: 0 4px 12px rgba(0,0,0,0.03); border-radius: 12px; padding: 18px 20px; }
  .of-stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #8e8e93; font-weight: 700; margin-bottom: 6px; }
  .of-stat-value { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 26px; font-weight: 900; color: #070708; }
`

const SECTION_LABELS = {
  general: { icon: '🏢', label: 'Datos generales' },
  sales: { icon: '🎯', label: 'Proceso de ventas' },
  metrics: { icon: '📊', label: 'Métricas actuales' },
  channels: { icon: '💬', label: 'Canales de comunicación' },
  tech: { icon: '⚙️', label: 'Tecnología' },
  goals: { icon: '🚀', label: 'Objetivos y expectativas' },
}

const FIELD_LABELS = {
  company: 'Empresa', industry: 'Industria', website: 'Sitio web',
  contactName: 'Contacto', contactRole: 'Cargo', teamSize: 'Tamaño del equipo',
  leadSource: 'Origen de leads', salesProcess: 'Proceso de ventas definido',
  salesProcessDesc: 'Descripción del proceso', avgCycle: 'Ciclo de venta promedio',
  avgTicket: 'Ticket promedio',
  monthlyLeads: 'Leads mensuales', closeRate: 'Tasa de cierre',
  mainChallenge: 'Principal reto', lostLeads: 'Leads que no cierran',
  activeChannels: 'Canales activos', mainChannel: 'Canal principal',
  hasFacebook: 'Página de Facebook', hasInstagram: 'Instagram Business',
  socialManager: 'Gestión de redes',
  currentTools: 'Herramientas actuales', techLevel: 'Nivel tecnológico',
  aiExperience: 'Experiencia con IA', integrations: 'Integraciones necesarias',
  mainGoal: 'Objetivo principal (90 días)', priority: 'Módulo prioritario',
  successMetric: 'Métrica de éxito', concerns: 'Preocupaciones o dudas',
  extraNotes: 'Notas adicionales',
}

const SECTION_FIELDS = {
  general: ['company','industry','website','contactName','contactRole','teamSize'],
  sales: ['leadSource','salesProcess','salesProcessDesc','avgCycle','avgTicket'],
  metrics: ['monthlyLeads','closeRate','mainChallenge','lostLeads'],
  channels: ['activeChannels','mainChannel','hasFacebook','hasInstagram','socialManager'],
  tech: ['currentTools','techLevel','aiExperience','integrations'],
  goals: ['mainGoal','priority','successMetric','concerns','extraNotes'],
}

const fmtDate = (ts) => {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function AnswerDisplay({ fieldId, value }) {
  if (!value || value === '' || (Array.isArray(value) && value.length === 0)) {
    return <div className="of-answer of-answer-empty">Sin respuesta</div>
  }

  if (Array.isArray(value)) {
    return (
      <div className="of-answer of-answer-tags">
        {value.map(v => <span key={v} className="of-tag">{v}</span>)}
      </div>
    )
  }

  if (fieldId === 'techLevel' && typeof value === 'number') {
    const labels = ['Básico', 'Principiante', 'Intermedio', 'Avanzado', 'Experto']
    return (
      <div className="of-answer of-scale-display">
        {[1,2,3,4,5].map(n => (
          <div key={n} className={clsx('of-scale-dot', value === n && 'active')}>
            {n}
          </div>
        ))}
        <span style={{ fontSize: 12, color: '#8e8e93', marginLeft: 6 }}>{labels[(value||1)-1]}</span>
      </div>
    )
  }

  return <div className="of-answer">{value}</div>
}

export default function OnboardingResponses() {
  const [forms, setForms] = useState([])
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'onboardingForms'), orderBy('submittedAt', 'desc'))
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setForms(data)
      if (!selectedId && data.length > 0) setSelectedId(data[0].id)
    })
    return unsub
  }, [])

  const selected = forms.find(f => f.id === selectedId)

  const markReviewed = async () => {
    if (!selected) return
    await updateDoc(doc(db, 'onboardingForms', selected.id), {
      status: 'reviewed', reviewedAt: serverTimestamp()
    })
    toast.success('Marcado como revisado')
  }

  const formUrl = `${window.location.origin}/welcome`
  const stats = {
    total: forms.length,
    pending: forms.filter(f => f.status === 'pending_review').length,
    reviewed: forms.filter(f => f.status === 'reviewed').length,
  }

  return (
    <div className="of-root sa-content" style={{ maxWidth: '100%' }}>
      <style>{css}</style>

      {/* Stats */}
      <div className="of-stats">
        <div className="of-stat">
          <div className="of-stat-label">Total</div>
          <div className="of-stat-value">{stats.total}</div>
        </div>
        <div className="of-stat">
          <div className="of-stat-label">Por revisar</div>
          <div className="of-stat-value" style={{ color: '#4d9fff' }}>{stats.pending}</div>
        </div>
        <div className="of-stat">
          <div className="of-stat-label">Revisados</div>
          <div className="of-stat-value" style={{ color: '#00c853' }}>{stats.reviewed}</div>
        </div>
      </div>

      {/* Link to share */}
      <div className="of-link-box">
        <span style={{ fontSize: 16 }}>🔗</span>
        <div className="of-link-url">{formUrl}?org=ORG_ID&name=Nombre+Cliente</div>
        <button className="of-btn of-btn-ghost of-btn-sm" onClick={() => { navigator.clipboard.writeText(formUrl); toast.success('URL copiada') }}>
          Copiar base
        </button>
      </div>

      <div className="of-layout">
        {/* List */}
        <div className="of-card">
          <div className="of-header">
            <div className="of-header-title">Respuestas ({forms.length})</div>
          </div>
          <div className="of-list">
            {forms.length === 0 && (
              <div className="of-empty">
                <div className="of-empty-icon">📋</div>
                Sin formularios aún
              </div>
            )}
            {forms.map(f => (
              <div
                key={f.id}
                className={clsx('of-item', selectedId === f.id && 'active')}
                onClick={() => setSelectedId(f.id)}
              >
                <div className="of-item-top">
                  <div className="of-item-name">{f.answers?.contactName || f.clientName || 'Sin nombre'}</div>
                  <span className={clsx('of-badge', f.status === 'reviewed' ? 'of-badge-reviewed' : 'of-badge-new')}>
                    {f.status === 'reviewed' ? 'Revisado' : 'Nuevo'}
                  </span>
                </div>
                <div className="of-item-company">{f.answers?.company || '—'} · {fmtDate(f.submittedAt)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Detail */}
        <div className="of-card">
          {!selected ? (
            <div className="of-empty" style={{ paddingTop: 80 }}>
              <div className="of-empty-icon">📋</div>
              Selecciona un formulario
            </div>
          ) : (
            <div className="of-detail">
              <div className="of-detail-header">
                <div className="of-detail-name">
                  {selected.answers?.contactName || selected.clientName || 'Sin nombre'} · {selected.answers?.company || '—'}
                </div>
                <div className="of-detail-meta">
                  <span>{selected.answers?.industry || '—'}</span>
                  <span>·</span>
                  <span>{fmtDate(selected.submittedAt)}</span>
                  <span>·</span>
                  <span className={clsx('of-badge', selected.status === 'reviewed' ? 'of-badge-reviewed' : 'of-badge-new')}>
                    {selected.status === 'reviewed' ? '✓ Revisado' : '● Nuevo'}
                  </span>
                  {selected.status !== 'reviewed' && (
                    <button className="of-btn of-btn-green of-btn-sm" onClick={markReviewed}>
                      ✓ Marcar revisado
                    </button>
                  )}
                </div>
              </div>

              {Object.entries(SECTION_FIELDS).map(([sectionId, fieldIds]) => {
                const section = SECTION_LABELS[sectionId]
                const hasAnswers = fieldIds.some(fId => {
                  const v = selected.answers?.[fId]
                  return v && v !== '' && !(Array.isArray(v) && v.length === 0)
                })
                if (!hasAnswers) return null

                return (
                  <div key={sectionId} className="of-section">
                    <div className="of-section-title">
                      {section.icon} {section.label}
                    </div>
                    {fieldIds.map(fId => {
                      const val = selected.answers?.[fId]
                      if (!val || val === '' || (Array.isArray(val) && val.length === 0)) return null
                      return (
                        <div key={fId} className="of-qa">
                          <div className="of-question">{FIELD_LABELS[fId] || fId}</div>
                          <AnswerDisplay fieldId={fId} value={val} />
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
