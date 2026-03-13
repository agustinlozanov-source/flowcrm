import { useState, useEffect } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'

// This component is used as a standalone page: /diagnostico?org=ORG_ID&name=NAME
// Extract params from URL
function getParams() {
  const p = new URLSearchParams(window.location.search)
  return { orgId: p.get('org') || '', orgName: p.get('orgName') || '', respondentName: p.get('name') || '' }
}

const SCALE_OPTIONS = [
  { value: 1, label: 'Nunca', sub: 'No ocurre en mi forma de trabajar' },
  { value: 2, label: 'Casi nunca', sub: 'Ocurre esporádicamente' },
  { value: 3, label: 'A veces', sub: 'Con cierta regularidad, pero no siempre' },
  { value: 4, label: 'Casi siempre', sub: 'La mayoría de las veces' },
  { value: 5, label: 'Siempre', sub: 'Parte natural de mi forma de trabajar' },
]

export default function DiagnosticoForm() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [answers, setAnswers] = useState({})
  const [name, setName] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [activeCategory, setActiveCategory] = useState(0)
  const [alreadyAnswered, setAlreadyAnswered] = useState(false)

  const { orgId, orgName, respondentName } = getParams()

  useEffect(() => {
    if (respondentName) setName(respondentName)
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const snap = await getDoc(doc(db, 'diagnostico_config', 'v1'))
      if (snap.exists()) {
        setConfig(snap.data())
      }
      // Check if already answered
      if (orgId) {
        const existing = await getDoc(doc(db, 'diagnosticos', orgId + '_' + (respondentName || 'anon').replace(/\s+/g, '_')))
        if (existing.exists()) setAlreadyAnswered(true)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const setAnswer = (catId, qIdx, value) => {
    setAnswers(p => ({ ...p, [`${catId}_${qIdx}`]: value }))
  }

  const cats = config?.categories || []
  const totalQ = cats.reduce((s, c) => s + c.questions.length, 0)
  const answeredCount = Object.keys(answers).length
  const progress = totalQ > 0 ? Math.round(answeredCount / totalQ * 100) : 0

  const currentCat = cats[activeCategory]
  const currentCatAnswered = currentCat
    ? currentCat.questions.every((_, qi) => answers[`${currentCat.id}_${qi}`])
    : false

  const allAnswered = answeredCount === totalQ

  const submit = async () => {
    if (!allAnswered) return
    if (!name.trim()) return
    setSubmitting(true)

    try {
      const totalScore = Object.values(answers).reduce((s, v) => s + v, 0)
      const docId = orgId
        ? `${orgId}_${name.trim().replace(/\s+/g, '_').toLowerCase()}`
        : `anon_${Date.now()}`

      await setDoc(doc(db, 'diagnosticos', docId), {
        orgId: orgId || null,
        orgName: orgName || null,
        respondentName: name.trim(),
        answers,
        totalScore,
        totalQuestions: totalQ,
        maxScore: totalQ * 5,
        minScore: totalQ,
        respondedAt: serverTimestamp()
      })

      // Calculate category scores for result screen
      const catScores = cats.map(cat => {
        const score = cat.questions.reduce((s, _, qi) => s + (answers[`${cat.id}_${qi}`] || 1), 0)
        return { name: cat.name, score, max: cat.questions.length * 5, color: cat.color }
      })

      setResult({ totalScore, catScores, maxScore: totalQ * 5, minScore: totalQ })
      setSubmitted(true)
    } catch (e) {
      console.error(e)
      alert('Hubo un error al enviar. Por favor intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  function levelInfo(score, min, max) {
    const pct = (score - min) / (max - min)
    if (pct < 0.2) return { label: 'Inicial', color: '#ff3b30', msg: 'Hay mucho espacio para construir un sistema de trabajo sólido. Este es el momento ideal para hacerlo.' }
    if (pct < 0.4) return { label: 'En desarrollo', color: '#ff9500', msg: 'Tienes bases. El trabajo ahora es volverlas consistentes y sistemáticas.' }
    if (pct < 0.6) return { label: 'Intermedio', color: '#ffcc00', msg: 'Estás en la mitad del camino. Con las herramientas correctas, el salto al siguiente nivel es realista y cercano.' }
    if (pct < 0.8) return { label: 'Avanzado', color: '#00c853', msg: 'Trabajas con criterio y disciplina. FlowCRM va a potenciar lo que ya funciona bien.' }
    return { label: 'Profesional', color: '#0066ff', msg: 'Tu nivel de organización es sólido. La plataforma va a amplificar resultados que ya son buenos.' }
  }

  if (loading) return (
    <div style={styles.loadingScreen}>
      <div style={styles.loadingText}>Cargando cuestionario...</div>
    </div>
  )

  if (!config) return (
    <div style={styles.loadingScreen}>
      <div style={styles.loadingText}>Cuestionario no disponible.</div>
    </div>
  )

  if (alreadyAnswered) return (
    <div style={styles.loadingScreen}>
      <div style={{ ...styles.card, maxWidth: 480, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
        <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 22, fontWeight: 900, marginBottom: 10 }}>Ya respondiste este diagnóstico</div>
        <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>Tu equipo de Qubit ya tiene tus respuestas y las está revisando. Nos pondremos en contacto contigo pronto.</div>
      </div>
    </div>
  )

  if (submitted && result) {
    const level = levelInfo(result.totalScore, result.minScore, result.maxScore)
    const pct = Math.round((result.totalScore - result.minScore) / (result.maxScore - result.minScore) * 100)
    return (
      <div style={styles.root}>
        <style>{formCss}</style>
        <div style={styles.container}>
          {/* Logo */}
          <div style={styles.logoRow}>
            <div style={styles.logoMark}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            </div>
            <span style={styles.logoText}>FlowCRM</span>
          </div>

          {/* Result card */}
          <div style={{ ...styles.card, textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 12 }}>Tu diagnóstico está completo</div>
            <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 28, fontWeight: 900, marginBottom: 4 }}>Gracias, {name}.</div>
            <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', marginBottom: 28 }}>Aquí está tu resultado.</div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 28 }}>
              <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 56, fontWeight: 900, letterSpacing: '-2px', color: level.color, lineHeight: 1 }}>
                {result.totalScore}
              </div>
              <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.35)' }}>de {result.maxScore} puntos posibles</div>
              <div style={{ display: 'inline-flex', padding: '6px 18px', borderRadius: 20, background: level.color + '18', color: level.color, border: `1px solid ${level.color}33`, fontWeight: 700, fontSize: 14 }}>
                {level.label}
              </div>
            </div>

            {/* Score bar */}
            <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
              <div style={{ height: '100%', width: pct + '%', background: `linear-gradient(90deg, #0066ff, #7c3aed)`, borderRadius: 4, transition: 'width 1s ease' }} />
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 24 }}>{pct}% del máximo posible</div>

            <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', lineHeight: 1.65, maxWidth: 480, margin: '0 auto' }}>{level.msg}</div>
          </div>

          {/* Category breakdown */}
          <div style={styles.card}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 16 }}>Desglose por categoría</div>
            {result.catScores.map((c, i) => {
              const cp = Math.round((c.score - c.max / 5) / (c.max - c.max / 5) * 100)
              return (
                <div key={i} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>{c.name}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: c.color }}>{c.score}/{c.max}</span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: cp + '%', background: c.color, borderRadius: 3 }} />
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: 'rgba(255,255,255,0.2)' }}>
            Tu equipo de Qubit Corp recibirá este diagnóstico y lo usará para personalizar tu implementación. · FlowCRM
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.root}>
      <style>{formCss}</style>

      {/* Sticky progress bar */}
      <div style={styles.progressBar}>
        <div style={styles.progressInner}>
          <div style={styles.progressLogoRow}>
            <div style={styles.logoMark}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            </div>
            <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 14, fontWeight: 800, color: 'white' }}>Diagnóstico Comercial</span>
          </div>
          <div style={styles.progressRight}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{answeredCount} / {totalQ}</span>
            <div style={{ width: 120, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: progress + '%', background: 'linear-gradient(90deg,#0066ff,#7c3aed)', borderRadius: 3, transition: 'width 0.3s' }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: progress === 100 ? '#00c853' : 'rgba(255,255,255,0.4)' }}>{progress}%</span>
          </div>
        </div>
      </div>

      <div style={styles.container}>

        {/* Intro */}
        {activeCategory === 0 && (
          <div style={{ marginBottom: 32, paddingTop: 80 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 12 }}>FlowCRM · Qubit Corp.</div>
            <h1 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 36, fontWeight: 900, letterSpacing: '-1px', marginBottom: 12, lineHeight: 1.1 }}>
              Diagnóstico<br />Comercial
            </h1>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, maxWidth: 520, marginBottom: 24 }}>
              Este cuestionario nos ayuda a entender cómo trabajas hoy para configurar FlowCRM de la forma que más te beneficie. No hay respuestas correctas ni incorrectas — solo sé honesto contigo mismo.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={styles.infoPill}>📋 {totalQ} afirmaciones</div>
              <div style={styles.infoPill}>⏱ ~10 minutos</div>
              <div style={styles.infoPill}>🔒 Solo lo ve tu equipo Qubit</div>
            </div>

            {/* Name input */}
            {!respondentName && (
              <div style={{ marginTop: 28 }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>Tu nombre</div>
                <input
                  style={styles.nameInput}
                  placeholder="¿Cómo te llamas?"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        {activeCategory > 0 && <div style={{ paddingTop: 80 }} />}

        {/* Category navigation pills */}
        <div style={styles.catNav}>
          {cats.map((cat, i) => {
            const catDone = cat.questions.every((_, qi) => answers[`${cat.id}_${qi}`])
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(i)}
                style={{
                  ...styles.catPill,
                  background: activeCategory === i ? cat.color + '20' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${activeCategory === i ? cat.color + '50' : 'rgba(255,255,255,0.08)'}`,
                  color: activeCategory === i ? cat.color : catDone ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.35)',
                }}
              >
                {catDone && <span style={{ color: '#00c853', fontSize: 10 }}>✓</span>}
                {cat.name}
              </button>
            )
          })}
        </div>

        {/* Active category */}
        {currentCat && (
          <div>
            <div style={styles.catHeader}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: currentCat.color, flexShrink: 0 }} />
              <h2 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 22, fontWeight: 900, letterSpacing: '-0.5px' }}>{currentCat.name}</h2>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', marginLeft: 'auto' }}>
                {currentCat.questions.filter((_, qi) => answers[`${currentCat.id}_${qi}`]).length} / {currentCat.questions.length}
              </div>
            </div>

            {currentCat.questions.map((q, qi) => {
              const key = `${currentCat.id}_${qi}`
              const val = answers[key]
              return (
                <div key={qi} style={styles.questionCard}>
                  <div style={styles.questionNum} data-color={currentCat.color}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: currentCat.color + '25', color: currentCat.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{qi + 1}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={styles.questionText}>{q}</div>
                    <div style={styles.scaleRow}>
                      {SCALE_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setAnswer(currentCat.id, qi, opt.value)}
                          className={`scale-btn ${val === opt.value ? 'selected' : ''}`}
                          style={{
                            '--sel-color': currentCat.color,
                            background: val === opt.value ? currentCat.color + '18' : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${val === opt.value ? currentCat.color + '60' : 'rgba(255,255,255,0.08)'}`,
                            color: val === opt.value ? currentCat.color : 'rgba(255,255,255,0.45)',
                          }}
                        >
                          <div style={{ fontSize: 10, fontWeight: 800, opacity: 0.5, marginBottom: 2 }}>{opt.value}</div>
                          <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.2 }}>{opt.label}</div>
                          <div style={{ fontSize: 10, opacity: 0.6, lineHeight: 1.3, marginTop: 2 }}>{opt.sub}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Navigation buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, marginBottom: 48 }}>
              {activeCategory > 0 ? (
                <button style={styles.navBtn} onClick={() => setActiveCategory(p => p - 1)}>← Anterior</button>
              ) : <div />}

              {activeCategory < cats.length - 1 ? (
                <button
                  style={{ ...styles.navBtnPrimary, opacity: currentCatAnswered ? 1 : 0.4, cursor: currentCatAnswered ? 'pointer' : 'not-allowed' }}
                  onClick={() => currentCatAnswered && setActiveCategory(p => p + 1)}
                >
                  Siguiente →
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                  {!name.trim() && <div style={{ fontSize: 13, color: '#ff9500' }}>Ingresa tu nombre para continuar</div>}
                  {!allAnswered && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>{totalQ - answeredCount} respuestas pendientes</div>}
                  <button
                    style={{ ...styles.navBtnPrimary, background: allAnswered && name.trim() ? '#00c853' : 'rgba(255,255,255,0.1)', opacity: allAnswered && name.trim() ? 1 : 0.5, cursor: allAnswered && name.trim() ? 'pointer' : 'not-allowed' }}
                    onClick={submit}
                    disabled={submitting || !allAnswered || !name.trim()}
                  >
                    {submitting ? 'Enviando...' : '✓ Enviar diagnóstico'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  root: { minHeight: '100vh', background: '#070708', color: 'white', fontFamily: "'Inter', sans-serif" },
  loadingScreen: { minHeight: '100vh', background: '#070708', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 16, color: 'rgba(255,255,255,0.4)' },
  container: { maxWidth: 720, margin: '0 auto', padding: '0 24px' },
  logoRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32, paddingTop: 32 },
  logoMark: { width: 28, height: 28, background: 'linear-gradient(135deg, #0066ff, #7c3aed)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  logoText: { fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 15, fontWeight: 800 },
  card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '28px 28px' },
  infoPill: { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '6px 14px', fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  nameInput: { width: '100%', maxWidth: 360, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '12px 16px', fontSize: 16, color: 'white', fontFamily: "'Inter',sans-serif", outline: 'none' },
  progressBar: { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(7,7,8,0.9)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)', height: 56 },
  progressInner: { maxWidth: 720, margin: '0 auto', padding: '0 24px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  progressLogoRow: { display: 'flex', alignItems: 'center', gap: 10 },
  progressRight: { display: 'flex', alignItems: 'center', gap: 10 },
  catNav: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 },
  catPill: { padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter',sans-serif", transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 5 },
  catHeader: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 },
  questionCard: { display: 'flex', gap: 14, padding: '18px 20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, marginBottom: 10 },
  questionText: { fontSize: 15, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, marginBottom: 14 },
  scaleRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  navBtn: { padding: '10px 20px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif" },
  navBtnPrimary: { padding: '11px 24px', background: '#0066ff', border: 'none', borderRadius: 9, color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter',sans-serif", transition: 'all 0.15s' },
}

const formCss = `
  .scale-btn {
    flex: 1; min-width: 100px; padding: 10px 8px;
    border-radius: 10px; cursor: pointer; text-align: center;
    font-family: 'Inter', sans-serif; transition: all 0.15s;
    line-height: 1.2;
  }
  .scale-btn:hover { border-color: rgba(255,255,255,0.2) !important; }
  .scale-btn.selected { transform: translateY(-1px); }
`
