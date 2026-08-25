import { useState, useEffect } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'

// This component is used as a standalone page: /diagnostico?org=ORG_ID&name=NAME
// Extract params from URL
function getParams() {
  const p = new URLSearchParams(window.location.search)
  return { orgId: p.get('org') || '', orgName: p.get('orgName') || '', respondentName: p.get('name') || '' }
}

const LEGAL_NAME = 'Flow Hub Tecnología e Inteligencia Comercial S.A. de C.V.'

// Dark logo file has the "flow" wordmark in white -> use it over dark backgrounds.
const LOGO = { dark: '/flowhub-logo2.png', light: '/logo.png' }

const THEME_KEY = 'diagnostico_theme'

// Color tokens exposed as CSS custom properties on the page root, so the inline
// style objects below can stay constant and just reference var(--d-*).
const THEMES = {
  dark: {
    '--d-bg': '#070708',
    '--d-bar-bg': 'rgba(7,7,8,0.9)',
    '--d-fg': '#ffffff',
    '--d-fg-85': 'rgba(255,255,255,0.85)',
    '--d-fg-60': 'rgba(255,255,255,0.6)',
    '--d-fg-45': 'rgba(255,255,255,0.45)',
    '--d-fg-35': 'rgba(255,255,255,0.35)',
    '--d-fg-30': 'rgba(255,255,255,0.3)',
    '--d-fg-20': 'rgba(255,255,255,0.2)',
    '--d-surface': 'rgba(255,255,255,0.04)',
    '--d-surface-soft': 'rgba(255,255,255,0.03)',
    '--d-surface-strong': 'rgba(255,255,255,0.06)',
    '--d-pill': 'rgba(255,255,255,0.05)',
    '--d-border': 'rgba(255,255,255,0.08)',
    '--d-border-soft': 'rgba(255,255,255,0.06)',
    '--d-border-strong': 'rgba(255,255,255,0.12)',
    '--d-hover-border': 'rgba(255,255,255,0.2)',
    '--d-track': 'rgba(255,255,255,0.08)',
    '--d-shadow': '0 0 0 rgba(0,0,0,0)',
    '--d-ok': '#00c853',
    '--d-warn': '#ff9500',
    colorScheme: 'dark',
  },
  light: {
    '--d-bg': '#f6f7f9',
    '--d-bar-bg': 'rgba(246,247,249,0.9)',
    '--d-fg': '#0f1115',
    '--d-fg-85': 'rgba(15,17,21,0.88)',
    '--d-fg-60': 'rgba(15,17,21,0.62)',
    '--d-fg-45': 'rgba(15,17,21,0.5)',
    '--d-fg-35': 'rgba(15,17,21,0.42)',
    '--d-fg-30': 'rgba(15,17,21,0.38)',
    '--d-fg-20': 'rgba(15,17,21,0.28)',
    '--d-surface': '#ffffff',
    '--d-surface-soft': '#ffffff',
    '--d-surface-strong': '#ffffff',
    '--d-pill': 'rgba(15,17,21,0.04)',
    '--d-border': 'rgba(15,17,21,0.10)',
    '--d-border-soft': 'rgba(15,17,21,0.08)',
    '--d-border-strong': 'rgba(15,17,21,0.16)',
    '--d-hover-border': 'rgba(15,17,21,0.28)',
    '--d-track': 'rgba(15,17,21,0.08)',
    '--d-shadow': '0 1px 3px rgba(15,17,21,0.06)',
    '--d-ok': '#00a844',
    '--d-warn': '#c26a00',
    colorScheme: 'light',
  },
}

const getInitialTheme = () => {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* storage bloqueado */ }
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light'
  return 'dark'
}

const SCALE_OPTIONS = [
  { value: 1, label: 'Nunca', sub: 'No ocurre en mi forma de trabajar' },
  { value: 2, label: 'Casi nunca', sub: 'Ocurre esporádicamente' },
  { value: 3, label: 'A veces', sub: 'Con cierta regularidad, pero no siempre' },
  { value: 4, label: 'Casi siempre', sub: 'La mayoría de las veces' },
  { value: 5, label: 'Siempre', sub: 'Parte natural de mi forma de trabajar' },
]

function ThemeToggle({ theme, onToggle }) {
  return (
    <button
      className="diag-theme-btn"
      style={styles.themeBtn}
      onClick={onToggle}
      title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      {theme === 'dark' ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      )}
    </button>
  )
}

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
  const [theme, setTheme] = useState(getInitialTheme)

  const { orgId, orgName, respondentName } = getParams()
  const vars = THEMES[theme]
  const logoSrc = LOGO[theme]

  useEffect(() => {
    if (respondentName) setName(respondentName)
    loadConfig()
  }, [])

  useEffect(() => {
    try { localStorage.setItem(THEME_KEY, theme) } catch { /* storage bloqueado */ }
    document.body.style.background = theme === 'dark' ? '#070708' : '#f6f7f9'
    return () => { document.body.style.background = '' }
  }, [theme])

  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))

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
    const isLight = theme === 'light'
    if (pct < 0.2) return { label: 'Inicial', color: isLight ? '#d92d20' : '#ff3b30', msg: 'Hay mucho espacio para construir un sistema de trabajo sólido. Este es el momento ideal para hacerlo.' }
    if (pct < 0.4) return { label: 'En desarrollo', color: isLight ? '#c26a00' : '#ff9500', msg: 'Tienes bases. El trabajo ahora es volverlas consistentes y sistemáticas.' }
    if (pct < 0.6) return { label: 'Intermedio', color: isLight ? '#a37800' : '#ffcc00', msg: 'Estás en la mitad del camino. Con las herramientas correctas, el salto al siguiente nivel es realista y cercano.' }
    if (pct < 0.8) return { label: 'Avanzado', color: isLight ? '#00a844' : '#00c853', msg: 'Trabajas con criterio y disciplina. FlowCRM va a potenciar lo que ya funciona bien.' }
    return { label: 'Profesional', color: isLight ? '#0052cc' : '#0066ff', msg: 'Tu nivel de organización es sólido. La plataforma va a amplificar resultados que ya son buenos.' }
  }

  if (loading) return (
    <div style={{ ...styles.loadingScreen, ...vars }}>
      <style>{formCss}</style>
      <div style={styles.loadingText}>Cargando cuestionario...</div>
    </div>
  )

  if (!config) return (
    <div style={{ ...styles.loadingScreen, ...vars }}>
      <style>{formCss}</style>
      <div style={styles.loadingText}>Cuestionario no disponible.</div>
    </div>
  )

  if (alreadyAnswered) return (
    <div style={{ ...styles.loadingScreen, ...vars }}>
      <style>{formCss}</style>
      <div style={{ ...styles.card, maxWidth: 480, textAlign: 'center' }}>
        <img src={logoSrc} alt="Flow Hub" style={{ ...styles.logoImg, height: 26, marginBottom: 20 }} />
        <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
        <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 22, fontWeight: 900, marginBottom: 10 }}>Ya respondiste este diagnóstico</div>
        <div style={{ fontSize: 15, color: 'var(--d-fg-45)', lineHeight: 1.6 }}>Tu equipo de Flow Hub ya tiene tus respuestas y las está revisando. Nos pondremos en contacto contigo pronto.</div>
      </div>
    </div>
  )

  if (submitted && result) {
    const level = levelInfo(result.totalScore, result.minScore, result.maxScore)
    const pct = Math.round((result.totalScore - result.minScore) / (result.maxScore - result.minScore) * 100)
    return (
      <div style={{ ...styles.root, ...vars }}>
        <style>{formCss}</style>
        <div style={styles.container}>
          {/* Logo */}
          <div style={styles.logoRow}>
            <img src={logoSrc} alt="Flow Hub" style={styles.logoImg} />
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>

          {/* Result card */}
          <div style={{ ...styles.card, textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--d-fg-35)', marginBottom: 12 }}>Tu diagnóstico está completo</div>
            <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 28, fontWeight: 900, marginBottom: 4 }}>Gracias, {name}.</div>
            <div style={{ fontSize: 15, color: 'var(--d-fg-45)', marginBottom: 28 }}>Aquí está tu resultado.</div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 28 }}>
              <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 56, fontWeight: 900, letterSpacing: '-2px', color: level.color, lineHeight: 1 }}>
                {result.totalScore}
              </div>
              <div style={{ fontSize: 16, color: 'var(--d-fg-35)' }}>de {result.maxScore} puntos posibles</div>
              <div style={{ display: 'inline-flex', padding: '6px 18px', borderRadius: 20, background: level.color + '18', color: level.color, border: `1px solid ${level.color}33`, fontWeight: 700, fontSize: 14 }}>
                {level.label}
              </div>
            </div>

            {/* Score bar */}
            <div style={{ height: 8, background: 'var(--d-track)', borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
              <div style={{ height: '100%', width: pct + '%', background: `linear-gradient(90deg, #1aab99, #3533cd)`, borderRadius: 4, transition: 'width 1s ease' }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--d-fg-30)', marginBottom: 24 }}>{pct}% del máximo posible</div>

            <div style={{ fontSize: 15, color: 'var(--d-fg-60)', lineHeight: 1.65, maxWidth: 480, margin: '0 auto' }}>{level.msg}</div>
          </div>

          {/* Category breakdown */}
          <div style={styles.card}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--d-fg-30)', marginBottom: 16 }}>Desglose por categoría</div>
            {result.catScores.map((c, i) => {
              const cp = Math.round((c.score - c.max / 5) / (c.max - c.max / 5) * 100)
              return (
                <div key={i} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--d-fg-85)' }}>{c.name}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: c.color }}>{c.score}/{c.max}</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--d-track)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: cp + '%', background: c.color, borderRadius: 3 }} />
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: 'var(--d-fg-20)', lineHeight: 1.7 }}>
            Tu equipo de Flow Hub recibirá este diagnóstico y lo usará para personalizar tu implementación.
            <br />{LEGAL_NAME}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ ...styles.root, ...vars }}>
      <style>{formCss}</style>

      {/* Sticky progress bar */}
      <div style={styles.progressBar}>
        <div style={styles.progressInner}>
          <div style={styles.progressLogoRow}>
            <img src={logoSrc} alt="Flow Hub" style={styles.logoImgSm} />
            <span className="diag-bar-divider" style={styles.barDivider} />
            <span className="diag-bar-title" style={styles.barTitle}>Diagnóstico Comercial</span>
          </div>
          <div style={styles.progressRight}>
            <span className="diag-bar-count" style={{ fontSize: 13, color: 'var(--d-fg-45)' }}>{answeredCount} / {totalQ}</span>
            <div className="diag-bar-track" style={{ width: 120, height: 6, background: 'var(--d-track)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: progress + '%', background: 'linear-gradient(90deg,#1aab99,#3533cd)', borderRadius: 3, transition: 'width 0.3s' }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: progress === 100 ? 'var(--d-ok)' : 'var(--d-fg-45)' }}>{progress}%</span>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
        </div>
      </div>

      <div style={styles.container}>

        {/* Intro */}
        {activeCategory === 0 && (
          <div style={{ marginBottom: 32, paddingTop: 80 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--d-fg-35)', marginBottom: 12, lineHeight: 1.6 }}>FlowCRM · {LEGAL_NAME}</div>
            <h1 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 36, fontWeight: 900, letterSpacing: '-1px', marginBottom: 12, lineHeight: 1.1 }}>
              Diagnóstico<br />Comercial
            </h1>
            <p style={{ fontSize: 16, color: 'var(--d-fg-60)', lineHeight: 1.7, maxWidth: 520, marginBottom: 24 }}>
              Este cuestionario nos ayuda a entender cómo trabajas hoy para configurar FlowCRM de la forma que más te beneficie. No hay respuestas correctas ni incorrectas — solo sé honesto contigo mismo.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={styles.infoPill}>📋 {totalQ} afirmaciones</div>
              <div style={styles.infoPill}>⏱ ~10 minutos</div>
              <div style={styles.infoPill}>🔒 Solo lo ve tu equipo Flow Hub</div>
            </div>

            {/* Name input */}
            {!respondentName && (
              <div style={{ marginTop: 28 }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--d-fg-35)', marginBottom: 8 }}>Tu nombre</div>
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
                  background: activeCategory === i ? cat.color + '20' : 'var(--d-pill)',
                  border: `1px solid ${activeCategory === i ? cat.color + '50' : 'var(--d-border)'}`,
                  color: activeCategory === i ? cat.color : catDone ? 'var(--d-fg-60)' : 'var(--d-fg-35)',
                }}
              >
                {catDone && <span style={{ color: 'var(--d-ok)', fontSize: 10 }}>✓</span>}
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
              <div style={{ fontSize: 13, color: 'var(--d-fg-30)', marginLeft: 'auto' }}>
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
                            background: val === opt.value ? currentCat.color + '18' : 'var(--d-surface-strong)',
                            border: `1px solid ${val === opt.value ? currentCat.color + '60' : 'var(--d-border)'}`,
                            color: val === opt.value ? currentCat.color : 'var(--d-fg-45)',
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
                  {!name.trim() && <div style={{ fontSize: 13, color: 'var(--d-warn)' }}>Ingresa tu nombre para continuar</div>}
                  {!allAnswered && <div style={{ fontSize: 13, color: 'var(--d-fg-35)' }}>{totalQ - answeredCount} respuestas pendientes</div>}
                  <button
                    style={{ ...styles.navBtnPrimary, background: allAnswered && name.trim() ? 'var(--d-ok)' : 'var(--d-track)', color: allAnswered && name.trim() ? 'white' : 'var(--d-fg-45)', opacity: allAnswered && name.trim() ? 1 : 0.7, cursor: allAnswered && name.trim() ? 'pointer' : 'not-allowed' }}
                    onClick={submit}
                    disabled={submitting || !allAnswered || !name.trim()}
                  >
                    {submitting ? 'Enviando...' : '✓ Enviar diagnóstico'}
                  </button>
                </div>
              )}
            </div>

            <div style={styles.legalFooter}>{LEGAL_NAME}</div>
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  root: { minHeight: '100vh', background: 'var(--d-bg)', color: 'var(--d-fg)', fontFamily: "'Inter', sans-serif", transition: 'background 0.2s ease, color 0.2s ease' },
  loadingScreen: { minHeight: '100vh', background: 'var(--d-bg)', color: 'var(--d-fg)', fontFamily: "'Inter', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { fontSize: 16, color: 'var(--d-fg-45)' },
  container: { maxWidth: 720, margin: '0 auto', padding: '0 24px' },
  logoRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 32, paddingTop: 32 },
  logoImg: { height: 30, width: 'auto', objectFit: 'contain', display: 'block' },
  logoImgSm: { height: 22, width: 'auto', objectFit: 'contain', display: 'block', flexShrink: 0 },
  barDivider: { width: 1, height: 18, background: 'var(--d-border-strong)', flexShrink: 0 },
  barTitle: { fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 14, fontWeight: 800, color: 'var(--d-fg)', whiteSpace: 'nowrap' },
  card: { background: 'var(--d-surface)', border: '1px solid var(--d-border)', borderRadius: 16, padding: '28px 28px', boxShadow: 'var(--d-shadow)' },
  infoPill: { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--d-pill)', border: '1px solid var(--d-border)', borderRadius: 20, padding: '6px 14px', fontSize: 13, color: 'var(--d-fg-60)' },
  nameInput: { width: '100%', maxWidth: 360, background: 'var(--d-surface-strong)', border: '1px solid var(--d-border-strong)', borderRadius: 10, padding: '12px 16px', fontSize: 16, color: 'var(--d-fg)', fontFamily: "'Inter',sans-serif", outline: 'none' },
  progressBar: { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'var(--d-bar-bg)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--d-border-soft)', height: 56 },
  progressInner: { maxWidth: 720, margin: '0 auto', padding: '0 24px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  progressLogoRow: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 },
  progressRight: { display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 },
  themeBtn: { width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: 'var(--d-pill)', border: '1px solid var(--d-border)', color: 'var(--d-fg-60)', cursor: 'pointer', flexShrink: 0, padding: 0, transition: 'all 0.15s' },
  catNav: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 },
  catPill: { padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter',sans-serif", transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 5 },
  catHeader: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 },
  questionCard: { display: 'flex', gap: 14, padding: '18px 20px', background: 'var(--d-surface-soft)', border: '1px solid var(--d-border-soft)', borderRadius: 12, marginBottom: 10, boxShadow: 'var(--d-shadow)' },
  questionText: { fontSize: 15, color: 'var(--d-fg-85)', lineHeight: 1.6, marginBottom: 14 },
  scaleRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  navBtn: { padding: '10px 20px', background: 'var(--d-pill)', border: '1px solid var(--d-border)', borderRadius: 9, color: 'var(--d-fg-60)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif" },
  navBtnPrimary: { padding: '11px 24px', background: '#3533cd', border: 'none', borderRadius: 9, color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter',sans-serif", transition: 'all 0.15s' },
  legalFooter: { textAlign: 'center', paddingBottom: 40, fontSize: 12, color: 'var(--d-fg-20)', lineHeight: 1.6 },
}

const formCss = `
  .scale-btn {
    flex: 1; min-width: 100px; padding: 10px 8px;
    border-radius: 10px; cursor: pointer; text-align: center;
    font-family: 'Inter', sans-serif; transition: all 0.15s;
    line-height: 1.2;
  }
  .scale-btn:hover { border-color: var(--d-hover-border) !important; }
  .scale-btn.selected { transform: translateY(-1px); }
  .diag-theme-btn:hover { border-color: var(--d-hover-border) !important; color: var(--d-fg) !important; }
  input::placeholder { color: var(--d-fg-30); }
  @media (max-width: 620px) {
    .diag-bar-title, .diag-bar-divider { display: none; }
  }
  @media (max-width: 460px) {
    .diag-bar-count { display: none; }
    .diag-bar-track { width: 70px !important; }
  }
`
