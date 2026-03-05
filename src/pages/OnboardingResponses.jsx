import { useState, useEffect } from 'react'
import { collection, onSnapshot, query, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import clsx from 'clsx'
import toast from 'react-hot-toast'

const css = `
  .of-root * { box-sizing: border-box; }
  .of-root { font-family: 'Inter', sans-serif; }

  .of-layout { display: grid; grid-template-columns: 300px 1fr; gap: 16px; min-height: 600px; }

  .of-card {
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 14px; overflow: hidden;
    display: flex; flex-direction: column;
  }

  .of-header {
    padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,0.06);
    display: flex; align-items: center; gap: 10px; flex-shrink: 0;
  }
  .of-header-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; font-weight: 800; flex: 1; }

  .of-list { flex: 1; overflow-y: auto; }

  .of-item {
    padding: 13px 16px; border-bottom: 1px solid rgba(255,255,255,0.04);
    cursor: pointer; transition: background 0.15s;
  }
  .of-item:hover { background: rgba(255,255,255,0.03); }
  .of-item.active { background: rgba(0,102,255,0.08); border-left: 2px solid #0066ff; }

  .of-item-top { display: flex; align-items: center; gap: 7px; margin-bottom: 3px; }
  .of-item-name { font-size: 13px; font-weight: 700; flex: 1; }
  .of-item-time { font-size: 10.5px; color: #3a3a3c; }
  .of-item-company { font-size: 11.5px; color: #8e8e93; }

  .of-badge {
    font-size: 9.5px; font-weight: 700; padding: 2px 7px; border-radius: 5px;
  }
  .of-badge-new { background: rgba(0,102,255,0.1); color: #4d9fff; border: 1px solid rgba(0,102,255,0.2); }
  .of-badge-reviewed { background: rgba(0,200,83,0.1); color: #00c853; border: 1px solid rgba(0,200,83,0.2); }

  /* DETAIL */
  .of-detail { overflow-y: auto; padding: 24px; }

  .of-detail-header { margin-bottom: 24px; }
  .of-detail-name { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 18px; font-weight: 900; letter-spacing: -0.3px; margin-bottom: 4px; }
  .of-detail-meta { font-size: 12px; color: #8e8e93; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

  .of-section { margin-bottom: 24px; }
  .of-section-title {
    font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12px; font-weight: 800;
    text-transform: uppercase; letter-spacing: 0.5px; color: #8e8e93;
    margin-bottom: 12px; display: flex; align-items: center; gap: 7px;
  }
  .of-section-title::after { content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.06); }

  .of-qa { margin-bottom: 12px; }
  .of-question { font-size: 11.5px; color: #8e8e93; margin-bottom: 4px; font-weight: 600; }
  .of-answer {
    font-size: 13px; color: white; line-height: 1.6;
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
    border-radius: 8px; padding: 9px 13px;
  }
  .of-answer-empty { color: #3a3a3c; font-style: italic; }
  .of-answer-tags { display: flex; flex-wrap: wrap; gap: 5px; padding: 7px 10px; }
  .of-tag {
    background: rgba(0,102,255,0.08); border: 1px solid rgba(0,102,255,0.18);
    border-radius: 6px; padding: 3px 9px; font-size: 12px; color: #4d9fff;
  }
  .of-scale-display { display: flex; gap: 5px; padding: 7px 10px; align-items: center; }
  .of-scale-dot {
    width: 28px; height: 28px; border-radius: 7px; display: flex; align-items: center;
    justify-content: center; font-size: 11px; font-weight: 700;
    border: 1.5px solid rgba(255,255,255,0.07); color: #3a3a3c;
  }
  .of-scale-dot.active { background: rgba(0,102,255,0.15); border-color: rgba(0,102,255,0.4); color: #4d9fff; }

  .of-btn {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 7px 13px; border-radius: 8px;
    font-size: 12px; font-weight: 700; cursor: pointer; border: none;
    font-family: 'Inter', sans-serif; transition: all 0.15s;
  }
  .of-btn-white { background: white; color: #070708; }
  .of-btn-white:hover { background: #e8e8ed; }
  .of-btn-ghost { background: transparent; color: #8e8e93; border: 1px solid rgba(255,255,255,0.1); }
  .of-btn-ghost:hover { background: rgba(255,255,255,0.06); color: white; }
  .of-btn-green { background: rgba(0,200,83,0.1); color: #00c853; border: 1px solid rgba(0,200,83,0.2); }
  .of-btn-green:hover { background: rgba(0,200,83,0.18); }
  .of-btn-sm { padding: 4px 9px; font-size: 11px; }

  .of-link-box {
    background: rgba(0,102,255,0.05); border: 1px solid rgba(0,102,255,0.15);
    border-radius: 10px; padding: 14px 16px; margin-bottom: 20px;
    display: flex; align-items: center; gap: 10px;
  }
  .of-link-url { font-size: 12px; color: #4d9fff; flex: 1; word-break: break-all; }

  .of-empty { text-align: center; padding: 60px 20px; color: #3a3a3c; font-size: 13px; }
  .of-empty-icon { font-size: 28px; margin-bottom: 8px; opacity: 0.4; }

  .of-stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-bottom: 16px; }
  .of-stat { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 14px 16px; }
  .of-stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #8e8e93; font-weight: 700; margin-bottom: 5px; }
  .of-stat-value { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 22px; font-weight: 900; }
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
