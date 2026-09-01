// Company Profile Builder — formulario que llena el cliente final.
// Ruta pública: /perfil
//
// El acceso lo crea el superadmin (pestaña "Perfiles de empresa"), igual que el
// acceso al portal de implementación: se genera un password y el cliente entra
// con su email + ese password.
//
// Fase 1 del roadmap: carga de archivos, las 7 secciones, auto-save, panel de
// completitud y envío. El motor de extracción (Fase 2) todavía no corre, así
// que ningún campo llega en verde/amarillo — la infraestructura de estados ya
// está lista para cuando se conecte.

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { signInWithCustomToken } from 'firebase/auth'
import { profileAuth, profileDb as db } from '@/lib/firebaseProfile'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import {
  Building2, Heart, Package, Award, Users, Target, Folder,
  Check, AlertTriangle, Circle, Sun, Moon, Menu, X, ArrowLeft, ArrowRight,
  Send, Save, Sparkles, ClipboardCheck, Loader2,
} from 'lucide-react'

import {
  SECTIONS, INTERVIEW_QUESTIONS, emptyProfile, fieldState, sectionProgress,
  sectionStatus, globalProgress, allMissingCritical, missingCritical,
  missingOptional, buildSnapshot, FIELD_STATE,
} from '@/lib/companyProfileSchema'
import { FieldShell, FieldRenderer, useAutoSave } from '@/components/profile/ProfileFields'
import { UploadZone, MaterialsSection, deleteMaterialFile } from '@/components/profile/ProfileUpload'

const THEME_KEY = 'cpb_theme'
const LOGO = { dark: '/flowhub-logo2.png', light: '/logo.png' }

const getInitialTheme = () => {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* storage bloqueado */ }
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light'
  return 'dark'
}

const SECTION_ICON = {
  building: Building2, heart: Heart, package: Package,
  award: Award, users: Users, target: Target, folder: Folder,
}

const STATUS_DOT = {
  complete: { icon: <Check size={11} />, cls: 'is-complete', label: 'Completa' },
  review: { icon: <AlertTriangle size={11} />, cls: 'is-review', label: 'Con revisiones pendientes' },
  critical: { icon: <Circle size={8} fill="currentColor" />, cls: 'is-critical', label: 'Con campos críticos vacíos' },
  untouched: { icon: null, cls: 'is-untouched', label: 'Sin abrir' },
}

export default function CompanyProfileForm() {
  const [theme, setTheme] = useState(getInitialTheme)
  const [authed, setAuthed] = useState(false)
  const [profileId, setProfileId] = useState(null)
  const [profile, setProfile] = useState(null)

  const [emailInput, setEmailInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [loginError, setLoginError] = useState('')
  const [logging, setLogging] = useState(false)

  const [step, setStep] = useState('welcome') // welcome | upload | form | review | done
  const [activeSection, setActiveSection] = useState(0)
  const [data, setData] = useState(emptyProfile)
  const [materials, setMaterials] = useState([])
  const [visited, setVisited] = useState({})
  const [saveState, setSaveState] = useState('idle') // idle | saving | saved
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [interviewOpen, setInterviewOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const dataRef = useRef(data)
  const matRef = useRef(materials)
  const visitedRef = useRef(visited)
  useEffect(() => { dataRef.current = data }, [data])
  useEffect(() => { matRef.current = materials }, [materials])
  useEffect(() => { visitedRef.current = visited }, [visited])

  useEffect(() => {
    try { localStorage.setItem(THEME_KEY, theme) } catch { /* storage bloqueado */ }
    document.body.style.background = theme === 'dark' ? '#070708' : '#f6f7f9'
    return () => { document.body.style.background = '' }
  }, [theme])

  const readOnly = profile?.status === 'submitted'

  // ── Persistencia ──────────────────────────────────────────────────────────

  const persist = useCallback(async () => {
    if (!profileId || readOnly) return
    setSaveState('saving')
    try {
      await updateDoc(doc(db, 'company_profiles', profileId), {
        data: dataRef.current,
        materials: matRef.current,
        visited: visitedRef.current,
        updatedAt: serverTimestamp(),
      })
      setSaveState('saved')
      setTimeout(() => setSaveState(s => (s === 'saved' ? 'idle' : s)), 2000)
    } catch {
      setSaveState('idle')
      toast.error('No se pudo guardar. Revisa tu conexión.')
    }
  }, [profileId, readOnly])

  const { schedule, flush } = useAutoSave(persist)

  // Guarda al cerrar la pestaña con cambios pendientes.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flush() }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [flush])

  // ── Login ─────────────────────────────────────────────────────────────────

  const login = async () => {
    if (!emailInput || !passwordInput) { setLoginError('Ingresa tu email y tu código de acceso'); return }
    setLogging(true)
    setLoginError('')
    try {
      let res
      try {
        res = await fetch('/.netlify/functions/profile-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailInput.trim().toLowerCase(), code: passwordInput.trim() }),
        })
      } catch {
        setLoginError('No pudimos conectar. Revisa tu conexión e intenta de nuevo.')
        return
      }

      if (res.status === 404) {
        // Pasa con `npm run dev`, que no levanta las Netlify functions.
        setLoginError('El servicio de acceso no está disponible en este entorno.')
        return
      }

      const out = await res.json().catch(() => ({}))
      if (!res.ok) { setLoginError(out.error || 'No pudimos validar tu acceso'); return }

      await signInWithCustomToken(profileAuth, out.token)

      const snap = await getDoc(doc(db, 'company_profiles', out.profileId))
      if (!snap.exists()) { setLoginError('No encontramos tu perfil'); return }
      const p = { id: snap.id, ...snap.data() }

      setProfileId(p.id)
      setProfile(p)
      setData({ ...emptyProfile(), ...(p.data || {}) })
      setMaterials(p.materials || [])
      setVisited(p.visited || {})
      setStep(p.status === 'submitted' ? 'done' : (p.startedAt ? 'form' : 'welcome'))
      setAuthed(true)
    } catch {
      setLoginError('Error al entrar. Intenta de nuevo.')
    } finally {
      setLogging(false)
    }
  }

  // ── Mutaciones ────────────────────────────────────────────────────────────

  const setField = (sectionKey, fieldId, value) => {
    setData(d => ({ ...d, [sectionKey]: { ...d[sectionKey], [fieldId]: value } }))
    schedule()
  }

  const toggleSkip = (sectionKey, fieldId) => {
    setData(d => {
      const sec = d[sectionKey] || {}
      const skipped = { ...(sec._skipped || {}) }
      skipped[fieldId] = !skipped[fieldId]
      return { ...d, [sectionKey]: { ...sec, _skipped: skipped } }
    })
    setTimeout(flush, 0)
  }

  const addMaterial = m => { setMaterials(ms => [...ms, m]); setTimeout(flush, 0) }
  const updateMaterial = (fileId, patch) => {
    setMaterials(ms => ms.map(m => (m.fileId === fileId ? { ...m, ...patch } : m)))
    schedule()
  }
  const removeMaterial = async m => {
    setMaterials(ms => ms.filter(x => x.fileId !== m.fileId))
    await deleteMaterialFile(m)
    setTimeout(flush, 0)
  }

  const goSection = (i, scrollToTop = true) => {
    const s = SECTIONS[i]
    setActiveSection(i)
    setSidebarOpen(false)
    if (!visitedRef.current[s.key]) {
      setVisited(v => ({ ...v, [s.key]: true }))
      setTimeout(flush, 0)
    }
    if (scrollToTop) window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Marca la primera sección como visitada al entrar al formulario.
  useEffect(() => {
    if (step === 'form' && !visitedRef.current[SECTIONS[activeSection].key]) {
      setVisited(v => ({ ...v, [SECTIONS[activeSection].key]: true }))
    }
  }, [step, activeSection])

  // ── Derivados ─────────────────────────────────────────────────────────────

  const ctx = useMemo(() => ({
    visited,
    materials,
    extraction: profile?.extraction?.fields || {},
    locations: data.identity?.locations || [],
    suggestions: {
      services: [...new Set((data.catalog?.services || []).map(s => s.category).filter(Boolean))],
    },
  }), [visited, materials, profile, data])

  const progress = useMemo(() => globalProgress(data, ctx), [data, ctx])
  const criticals = useMemo(() => allMissingCritical(data, ctx), [data, ctx])

  // ── Envío final ───────────────────────────────────────────────────────────

  const submitProfile = async () => {
    if (criticals.length || submitting) return
    setSubmitting(true)
    try {
      await flush()
      const snapshot = buildSnapshot(data, materials)
      const stats = {
        totalFilesUploaded: materials.length,
        fieldsManual: SECTIONS.reduce((n, s) => n + (s.isMaterials ? 0 : s.fields.length), 0) - criticals.length,
        fieldsExtracted: Object.keys(profile?.extraction?.fields || {}).length,
      }

      await addDoc(collection(db, 'company_profiles', profileId, 'submissions'), {
        profile: snapshot, stats, submittedAt: serverTimestamp(),
      })
      await updateDoc(doc(db, 'company_profiles', profileId), {
        status: 'submitted', submittedAt: serverTimestamp(), data, materials,
      })

      notifySubmission(profile, stats).catch(() => { /* el envío ya quedó guardado */ })

      setProfile(p => ({ ...p, status: 'submitted' }))
      setStep('done')
      window.scrollTo({ top: 0 })
    } catch {
      toast.error('No se pudo enviar. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  const saveDraft = async () => { await flush(); toast.success('Borrador guardado') }

  // Marca que el cliente ya pasó la zona de carga, para no volver a mandarlo a
  // la bienvenida cuando regrese en otra sesión.
  const enterForm = async () => {
    setStep('form')
    if (profileId && !readOnly) {
      try { await updateDoc(doc(db, 'company_profiles', profileId), { startedAt: serverTimestamp() }) } catch { /* el flush posterior lo reintenta */ }
    }
    flush()
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const vars = theme === 'light' ? LIGHT_VARS : DARK_VARS
  const rootClass = clsx('cpb-root', theme === 'light' && 'light')
  const ThemeBtn = (
    <button
      className="cpb-theme-btn"
      onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
      title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  )

  if (!authed) {
    return (
      <div className={rootClass} style={vars}>
        <style>{CSS}</style>
        <div className="cpb-login">
          <div className="cpb-theme-float">{ThemeBtn}</div>
          <div className="cpb-login-card">
            <img src={LOGO[theme]} alt="Flow Hub" className="cpb-login-logo" />
            <div className="cpb-login-title">Perfil de empresa</div>
            <div className="cpb-login-sub">
              Entra con el email y el código de acceso que te compartió tu equipo de Flow Hub.
            </div>
            <input
              className="cpb-input" type="email" placeholder="Tu email"
              value={emailInput} onChange={e => setEmailInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && login()}
            />
            <input
              className="cpb-input" type="password" placeholder="Código de acceso"
              value={passwordInput} onChange={e => setPasswordInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && login()}
            />
            {loginError && <div className="cpb-login-error">{loginError}</div>}
            <button className="cpb-btn-primary" onClick={login} disabled={logging}>
              {logging ? 'Verificando...' : 'Entrar'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Bienvenida ────────────────────────────────────────────────────────────
  if (step === 'welcome') {
    return (
      <div className={rootClass} style={vars}>
        <style>{CSS}</style>
        <TopBar theme={theme} themeBtn={ThemeBtn} title={profile?.companyName} />
        <div className="cpb-centered">
          <div className="cpb-welcome">
            <div className="cpb-eyebrow">Flow Hub · Perfil de empresa</div>
            <h1 className="cpb-h1">Vamos a conocer tu empresa</h1>
            <p className="cpb-lead">
              Esto no es un formulario de trámite. Es la información con la que vamos a configurar tu CRM y a
              entrenar al agente que va a atender a tus clientes. Mientras mejor nos cuentes quiénes son,
              mejor va a hablar de ustedes.
            </p>
            <div className="cpb-pills">
              <div className="cpb-pill">7 secciones</div>
              <div className="cpb-pill">~25 minutos</div>
              <div className="cpb-pill">Puedes salir y volver cuando quieras</div>
            </div>
            <div className="cpb-welcome-note">
              Empieza subiendo el material institucional que tengas a la mano — catálogos, listas de precios,
              brochures. Nos ahorra que tengas que escribir de cero.
            </div>
            <button className="cpb-btn-primary cpb-btn-wide" onClick={() => setStep('upload')}>
              Empezar <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Carga de archivos ─────────────────────────────────────────────────────
  if (step === 'upload') {
    return (
      <div className={rootClass} style={vars}>
        <style>{CSS}</style>
        <TopBar theme={theme} themeBtn={ThemeBtn} title={profile?.companyName} />
        <div className="cpb-centered">
          <div className="cpb-upload-page">
            <h1 className="cpb-h1">Súbenos todo lo institucional que tengas</h1>
            <p className="cpb-lead">
              Mientras más nos des, menos vas a tener que escribir. Puedes arrastrar carpetas completas.
            </p>

            <UploadZone
              profileId={profileId}
              materials={materials}
              onAdd={addMaterial}
              onRemove={removeMaterial}
            />

            <div className="cpb-examples">
              <div className="cpb-examples-title">Ejemplos de lo que puedes subir</div>
              <ul>
                <li>Catálogo de servicios</li>
                <li>Lista de precios</li>
                <li>Brochures y flyers</li>
                <li>Fotos de instalaciones</li>
                <li>Presentaciones institucionales</li>
                <li>Cotizaciones</li>
              </ul>
            </div>

            <div className="cpb-upload-actions">
              <button className="cpb-btn-ghost" onClick={enterForm}>
                {materials.length ? 'Continuar sin subir más' : 'No tengo archivos, arrancar sin nada'}
              </button>
              <button className="cpb-btn-primary" onClick={enterForm} disabled={!materials.length}>
                Continuar <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Confirmación ──────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className={rootClass} style={vars}>
        <style>{CSS}</style>
        <TopBar theme={theme} themeBtn={ThemeBtn} title={profile?.companyName} />
        <div className="cpb-centered">
          <div className="cpb-done">
            <div className="cpb-done-check"><Check size={28} /></div>
            <h1 className="cpb-h1">Recibimos tu perfil</h1>
            <p className="cpb-lead">
              Tu equipo de Flow Hub ya tiene toda la información y va a empezar a configurar tu CRM y tu agente.
              Te contactamos si necesitamos aclarar algo.
            </p>
            <div className="cpb-done-note">
              Puedes seguir consultando lo que enviaste, pero para modificarlo pídeselo a tu equipo de Flow Hub.
            </div>
            <button className="cpb-btn-ghost" onClick={() => { setStep('form'); goSection(0) }}>
              Ver lo que envié
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Panel de completitud ──────────────────────────────────────────────────
  if (step === 'review') {
    return (
      <div className={rootClass} style={vars}>
        <style>{CSS}</style>
        <TopBar theme={theme} themeBtn={ThemeBtn} title={profile?.companyName} saveState={saveState} />
        <div className="cpb-centered">
          <div className="cpb-review">
            <button className="cpb-back-link" onClick={() => setStep('form')}>
              <ArrowLeft size={14} /> Volver al formulario
            </button>
            <h1 className="cpb-h1">Antes de enviar</h1>
            <p className="cpb-lead">
              Revisa qué quedó completo. Los campos críticos son los que necesitamos sí o sí para poder configurar tu agente.
            </p>

            <div className="cpb-review-hero">
              <div className="cpb-review-pct">{progress}%</div>
              <div className="cpb-review-hero-info">
                <div className="cpb-review-hero-label">Completitud global</div>
                <div className="cpb-progress-track">
                  <div className="cpb-progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <div className={clsx('cpb-review-hero-sub', criticals.length ? 'is-bad' : 'is-good')}>
                  {criticals.length
                    ? `${criticals.length} ${criticals.length === 1 ? 'campo crítico pendiente' : 'campos críticos pendientes'}`
                    : 'Todos los campos críticos están completos'}
                </div>
              </div>
            </div>

            {SECTIONS.map((s, i) => {
              const secData = data[s.key]
              const crit = missingCritical(s, secData, ctx)
              const opt = missingOptional(s, secData, ctx)
              const pct = sectionProgress(s, secData, ctx)
              return (
                <div key={s.key} className="cpb-review-section">
                  <div className="cpb-review-sec-head">
                    <span className="cpb-review-sec-num">{s.num}</span>
                    <span className="cpb-review-sec-title">{s.title}</span>
                    <span className={clsx('cpb-review-sec-pct', pct === 100 && 'is-full')}>{pct}%</span>
                  </div>
                  {crit.length > 0 && (
                    <div className="cpb-review-list is-critical">
                      <div className="cpb-review-list-title">Críticos pendientes</div>
                      {crit.map(c => (
                        <button key={c.fieldId} className="cpb-review-item" onClick={() => { setStep('form'); goSection(i, false); jumpTo(s.key, c.fieldId) }}>
                          <Circle size={7} fill="currentColor" /> {c.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {opt.length > 0 && (
                    <div className="cpb-review-list">
                      <div className="cpb-review-list-title">Opcionales vacíos — no bloquean el envío</div>
                      {opt.map(c => (
                        <button key={c.fieldId} className="cpb-review-item is-optional" onClick={() => { setStep('form'); goSection(i, false); jumpTo(s.key, c.fieldId) }}>
                          {c.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {!crit.length && !opt.length && (
                    <div className="cpb-review-done"><Check size={12} /> Sección completa</div>
                  )}
                </div>
              )
            })}

            <div className="cpb-review-actions">
              <button className="cpb-btn-ghost" onClick={saveDraft}>
                <Save size={14} /> Guardar como borrador
              </button>
              <button
                className="cpb-btn-primary"
                onClick={submitProfile}
                disabled={!!criticals.length || submitting || readOnly}
                title={criticals.length ? 'Completa los campos críticos para poder enviar' : ''}
              >
                {submitting ? <><Loader2 size={15} className="cpb-spin" /> Enviando...</> : <><Send size={15} /> Enviar a Flow Hub</>}
              </button>
            </div>
            {criticals.length > 0 && (
              <div className="cpb-review-blocked">
                El envío se habilita cuando completes los {criticals.length} campos críticos de arriba.
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Formulario ────────────────────────────────────────────────────────────
  const section = SECTIONS[activeSection]
  const secData = data[section.key] || {}

  return (
    <div className={rootClass} style={vars}>
      <style>{CSS}</style>
      <TopBar
        theme={theme} themeBtn={ThemeBtn} title={profile?.companyName}
        saveState={saveState} progress={progress}
        onMenu={() => setSidebarOpen(o => !o)}
      />

      <div className="cpb-layout">
        <aside className={clsx('cpb-sidebar', sidebarOpen && 'is-open')}>
          <div className="cpb-sidebar-close">
            <button onClick={() => setSidebarOpen(false)} aria-label="Cerrar menú"><X size={16} /></button>
          </div>

          <nav className="cpb-nav">
            {SECTIONS.map((s, i) => {
              const status = STATUS_DOT[sectionStatus(s, data[s.key], ctx)]
              const Icon = SECTION_ICON[s.icon]
              const pct = sectionProgress(s, data[s.key], ctx)
              return (
                <button
                  key={s.key}
                  className={clsx('cpb-nav-item', i === activeSection && 'is-active')}
                  onClick={() => goSection(i)}
                >
                  <span className={clsx('cpb-nav-status', status.cls)} title={status.label}>{status.icon}</span>
                  <Icon size={14} className="cpb-nav-icon" />
                  <span className="cpb-nav-label">{s.num}. {s.title}</span>
                  <span className="cpb-nav-pct">{pct}%</span>
                </button>
              )
            })}
          </nav>

          <div className="cpb-sidebar-foot">
            <div className="cpb-sidebar-label">Progreso global</div>
            <div className="cpb-progress-track"><div className="cpb-progress-fill" style={{ width: `${progress}%` }} /></div>
            <div className="cpb-sidebar-pct">{progress}%</div>
            {criticals.length > 0 && (
              <div className="cpb-sidebar-crit">
                <Circle size={7} fill="currentColor" />
                {criticals.length} {criticals.length === 1 ? 'crítico pendiente' : 'críticos pendientes'}
              </div>
            )}
            <button className="cpb-btn-ghost cpb-btn-block" onClick={() => setStep('review')}>
              <ClipboardCheck size={14} /> Revisar y enviar
            </button>
          </div>
        </aside>

        {sidebarOpen && <div className="cpb-scrim" onClick={() => setSidebarOpen(false)} />}

        <main className="cpb-main">
          {readOnly && (
            <div className="cpb-readonly-banner">
              Este perfil ya fue enviado. Lo puedes consultar, pero para modificarlo pídeselo a tu equipo de Flow Hub.
            </div>
          )}

          <div className="cpb-sec-head">
            <div className="cpb-sec-num">Sección {section.num} de 7</div>
            <h2 className="cpb-sec-title">{section.title}</h2>
            <p className="cpb-sec-intro">{section.intro}</p>
          </div>

          {section.hasInterview && !readOnly && (
            <button className="cpb-interview-cta" onClick={() => setInterviewOpen(true)}>
              <Sparkles size={16} />
              <div>
                <strong>Responde 5 preguntas rápidas y armamos el perfil</strong>
                <span>Es más fácil que llenar los campos uno por uno. Después puedes ajustar lo que quieras.</span>
              </div>
            </button>
          )}

          <fieldset className="cpb-fields" disabled={readOnly}>
            {section.isMaterials ? (
              <MaterialsSection
                profileId={profileId}
                materials={materials}
                onAdd={addMaterial}
                onRemove={removeMaterial}
                onUpdate={updateMaterial}
                readOnly={readOnly}
              />
            ) : (
              section.fields.map(field => {
                const skipped = secData._skipped?.[field.id]
                const state = fieldState(field, secData[field.id], {
                  ...ctx, sectionKey: section.key, skipped: secData._skipped,
                })
                const meta = ctx.extraction[`${section.key}.${field.id}`]
                return (
                  <FieldShell
                    key={field.id}
                    field={field}
                    state={state}
                    meta={meta}
                    anchorId={anchorOf(section.key, field.id)}
                  >
                    {field.skippable && (
                      <label className="cpb-skip">
                        <input type="checkbox" checked={!!skipped} onChange={() => toggleSkip(section.key, field.id)} />
                        {field.skipLabel}
                      </label>
                    )}
                    {!skipped && (
                      <FieldRenderer
                        field={field}
                        value={secData[field.id]}
                        onChange={v => setField(section.key, field.id, v)}
                        onBlur={flush}
                        ctx={ctx}
                      />
                    )}
                  </FieldShell>
                )
              })
            )}
          </fieldset>

          <div className="cpb-pager">
            {activeSection > 0
              ? <button className="cpb-btn-ghost" onClick={() => goSection(activeSection - 1)}><ArrowLeft size={14} /> Anterior</button>
              : <span />}
            {activeSection < SECTIONS.length - 1
              ? <button className="cpb-btn-primary" onClick={() => goSection(activeSection + 1)}>Siguiente <ArrowRight size={14} /></button>
              : <button className="cpb-btn-primary" onClick={() => setStep('review')}><ClipboardCheck size={14} /> Revisar y enviar</button>}
          </div>
        </main>
      </div>

      {interviewOpen && (
        <InterviewModal
          onClose={() => setInterviewOpen(false)}
          onDone={answers => {
            setData(d => ({ ...d, idealCustomer: { ...d.idealCustomer, ...interviewToFields(answers, d.idealCustomer) } }))
            setInterviewOpen(false)
            setTimeout(flush, 0)
            toast.success('Listo — revisa y ajusta lo que haga falta')
          }}
        />
      )}
    </div>
  )
}

// ── Sub-componentes ─────────────────────────────────────────────────────────

const anchorOf = (sectionKey, fieldId) => `f-${sectionKey}-${fieldId}`

function jumpTo(sectionKey, fieldId) {
  // Se espera a que React monte la sección destino y a que el layout quede
  // firme: un scroll suave lanzado antes del commit apunta a una posición que
  // deja de ser válida y el campo termina fuera de pantalla.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const el = document.getElementById(anchorOf(sectionKey, fieldId))
    if (!el) return
    el.scrollIntoView({ behavior: 'auto', block: 'start' })
    el.classList.add('is-flash')
    setTimeout(() => el.classList.remove('is-flash'), 1600)
  }))
}

function TopBar({ theme, themeBtn, title, saveState, progress, onMenu }) {
  return (
    <header className="cpb-topbar">
      <div className="cpb-topbar-inner">
        {onMenu && (
          <button className="cpb-menu-btn" onClick={onMenu} aria-label="Abrir secciones"><Menu size={17} /></button>
        )}
        <img src={LOGO[theme]} alt="Flow Hub" className="cpb-topbar-logo" />
        {title && <><span className="cpb-topbar-sep" /><span className="cpb-topbar-title">{title}</span></>}
        <div className="cpb-topbar-right">
          {typeof progress === 'number' && <span className="cpb-topbar-pct">{progress}%</span>}
          {saveState === 'saving' && <span className="cpb-save-ind"><Loader2 size={12} className="cpb-spin" /> Guardando</span>}
          {saveState === 'saved' && <span className="cpb-save-ind is-ok"><Check size={12} /> Guardado</span>}
          {themeBtn}
        </div>
      </div>
    </header>
  )
}

function InterviewModal({ onClose, onDone }) {
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState({})
  const [draft, setDraft] = useState('')
  const q = INTERVIEW_QUESTIONS[idx]
  const last = idx === INTERVIEW_QUESTIONS.length - 1

  const next = () => {
    const a = { ...answers, [q.id]: draft.trim() }
    setAnswers(a)
    setDraft('')
    if (last) onDone(a)
    else setIdx(i => i + 1)
  }

  return (
    <div className="cpb-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="cpb-modal">
        <div className="cpb-modal-head">
          <span className="cpb-modal-step">Pregunta {idx + 1} de {INTERVIEW_QUESTIONS.length}</span>
          <button onClick={onClose} aria-label="Cerrar"><X size={16} /></button>
        </div>
        <div className="cpb-modal-track">
          <div className="cpb-modal-fill" style={{ width: `${((idx + 1) / INTERVIEW_QUESTIONS.length) * 100}%` }} />
        </div>
        <div className="cpb-modal-q">{q.text}</div>
        <textarea
          className="cpb-textarea"
          rows={3}
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Responde con tus palabras, sin formalismos"
        />
        <div className="cpb-modal-actions">
          <button className="cpb-btn-ghost" onClick={onClose}>Prefiero llenar los campos directo</button>
          <button className="cpb-btn-primary" onClick={next} disabled={!draft.trim()}>
            {last ? 'Armar perfil' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Traduce las respuestas de la entrevista a campos de la sección 5.
 *  Es un mapeo heurístico deliberadamente conservador: solo llena lo que puede
 *  inferir sin ambigüedad y nunca pisa un valor que el cliente ya escribió. */
export function interviewToFields(a, current = {}) {
  const out = {}

  const ages = (a.q1 || '').match(/\d{1,3}/g)?.map(Number).filter(n => n > 0 && n < 110) || []
  if (ages.length) {
    const base = ages[0]
    out.ageRange = ages.length > 1
      ? { min: Math.min(...ages), max: Math.max(...ages) }
      : { min: Math.max(0, base - 10), max: Math.min(100, base + 10) }
  }

  const trigger = [a.q3, a.q2 && `Suele venir así: ${a.q2}`].filter(Boolean).join(' ')
  if (trigger && !current.contactTrigger) out.contactTrigger = trigger.slice(0, 500)

  if (a.q4 && !current.typicalBudget) out.typicalBudget = a.q4.slice(0, 200)
  if (a.q5 && !current.doNotWorkWith) out.doNotWorkWith = a.q5.slice(0, 500)

  return out
}

/** Notifica al equipo Flow Hub y confirma al cliente (§8.3). */
async function notifySubmission(profile, stats) {
  const link = `${window.location.origin}/superadmin`
  const rows = [
    ['Empresa', profile.companyName],
    ['Contacto', `${profile.clientName || ''} · ${profile.clientEmail}`],
    ['Archivos subidos', stats.totalFilesUploaded],
    ['Campos extraídos automáticamente', stats.fieldsExtracted],
  ].map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#8e8e93;font-size:14px">${k}</td><td style="padding:4px 0;font-size:14px;color:#070708"><strong>${v}</strong></td></tr>`).join('')

  const post = (to, subject, bodyHtml) => fetch('/.netlify/functions/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'custom', to, data: { subject, bodyHtml } }),
  })

  await Promise.all([
    post('atencion@flowhubcrm.app', `Perfil de empresa enviado — ${profile.companyName}`,
      `<h2 style="margin:0 0 12px;font-size:20px;color:#070708">${profile.companyName} envió su perfil</h2>
       <table style="margin:12px 0 20px">${rows}</table>
       <a href="${link}" style="color:#0066ff">Abrir en el superadmin</a>`),
    post(profile.clientEmail, 'Recibimos tu perfil de empresa',
      `<h2 style="margin:0 0 12px;font-size:20px;color:#070708">Gracias, ya tenemos tu perfil</h2>
       <p style="font-size:15px;color:#3a3a3c;line-height:1.6">
         Tu equipo de Flow Hub va a usar esta información para configurar tu CRM y entrenar a tu agente.
         Te contactamos si necesitamos aclarar algo.
       </p>`),
  ])
}

// ── Tokens de tema ──────────────────────────────────────────────────────────

const DARK_VARS = {
  '--c-bg': '#070708',
  '--c-bar': 'rgba(7,7,8,0.92)',
  '--c-fg': '#ffffff',
  '--c-fg-80': 'rgba(255,255,255,0.82)',
  '--c-fg-60': 'rgba(255,255,255,0.6)',
  '--c-fg-40': 'rgba(255,255,255,0.42)',
  '--c-fg-25': 'rgba(255,255,255,0.26)',
  '--c-surface': 'rgba(255,255,255,0.03)',
  '--c-surface-2': 'rgba(255,255,255,0.05)',
  '--c-surface-3': 'rgba(255,255,255,0.08)',
  '--c-border': 'rgba(255,255,255,0.09)',
  '--c-border-soft': 'rgba(255,255,255,0.06)',
  '--c-border-strong': 'rgba(255,255,255,0.16)',
  '--c-track': 'rgba(255,255,255,0.08)',
  '--c-shadow': '0 0 0 rgba(0,0,0,0)',
  '--c-input-bg': 'rgba(255,255,255,0.05)',
  '--c-btn-fg': '#ffffff',
  '--c-scrim': 'rgba(0,0,0,0.65)',
  '--c-ok': '#00c853',
  '--c-warn': '#ff9500',
  '--c-bad': '#ff453a',
  '--c-accent': '#3533cd',
  '--c-accent-2': '#1aab99',
  colorScheme: 'dark',
}

const LIGHT_VARS = {
  '--c-bg': '#f6f7f9',
  '--c-bar': 'rgba(246,247,249,0.92)',
  '--c-fg': '#0f1115',
  '--c-fg-80': 'rgba(15,17,21,0.84)',
  '--c-fg-60': 'rgba(15,17,21,0.62)',
  '--c-fg-40': 'rgba(15,17,21,0.46)',
  '--c-fg-25': 'rgba(15,17,21,0.32)',
  '--c-surface': '#ffffff',
  '--c-surface-2': '#ffffff',
  '--c-surface-3': 'rgba(15,17,21,0.05)',
  '--c-border': 'rgba(15,17,21,0.12)',
  '--c-border-soft': 'rgba(15,17,21,0.08)',
  '--c-border-strong': 'rgba(15,17,21,0.24)',
  '--c-track': 'rgba(15,17,21,0.1)',
  '--c-shadow': '0 1px 3px rgba(15,17,21,0.06)',
  '--c-input-bg': '#ffffff',
  '--c-btn-fg': '#ffffff',
  '--c-scrim': 'rgba(15,17,21,0.4)',
  '--c-ok': '#00a844',
  '--c-warn': '#b26a00',
  '--c-bad': '#d92d20',
  '--c-accent': '#3533cd',
  '--c-accent-2': '#1aab99',
  colorScheme: 'light',
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&family=Inter:wght@400;500;600;700&display=swap');

.cpb-root *, .cpb-root *::before, .cpb-root *::after { box-sizing: border-box; }
.cpb-root {
  font-family: 'Inter', sans-serif;
  background: var(--c-bg); color: var(--c-fg);
  min-height: 100vh;
  transition: background .2s ease, color .2s ease;
}
.cpb-root h1, .cpb-root h2 { margin: 0; }
.cpb-root fieldset { border: none; margin: 0; padding: 0; min-width: 0; }
.cpb-root fieldset:disabled { opacity: .75; }
.cpb-spin { animation: cpb-spin 1s linear infinite; }
@keyframes cpb-spin { to { transform: rotate(360deg); } }

/* TOPBAR */
.cpb-topbar {
  position: sticky; top: 0; z-index: 50; height: 56px;
  background: var(--c-bar); backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--c-border-soft);
}
.cpb-topbar-inner {
  max-width: 1180px; margin: 0 auto; padding: 0 20px; height: 100%;
  display: flex; align-items: center; gap: 10px;
}
.cpb-topbar-logo { height: 21px; width: auto; object-fit: contain; display: block; flex-shrink: 0; }
.cpb-topbar-sep { width: 1px; height: 18px; background: var(--c-border-strong); flex-shrink: 0; }
.cpb-topbar-title {
  font-family: 'Plus Jakarta Sans', sans-serif; font-size: 14px; font-weight: 800;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cpb-topbar-right { margin-left: auto; display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.cpb-topbar-pct { font-size: 13px; font-weight: 700; color: var(--c-fg-60); }
.cpb-save-ind { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--c-fg-40); }
.cpb-save-ind.is-ok { color: var(--c-ok); }
.cpb-menu-btn {
  display: none; width: 32px; height: 32px; align-items: center; justify-content: center;
  background: none; border: 1px solid var(--c-border); border-radius: 8px;
  color: var(--c-fg-60); cursor: pointer;
}
.cpb-theme-btn {
  width: 30px; height: 30px; padding: 0; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 8px; cursor: pointer;
  background: var(--c-surface-3); border: 1px solid var(--c-border);
  color: var(--c-fg-60); transition: all .15s;
}
.cpb-theme-btn:hover { color: var(--c-fg); border-color: var(--c-border-strong); }
.cpb-theme-float { position: absolute; top: 20px; right: 20px; z-index: 2; }

/* LOGIN */
.cpb-login { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; position: relative; }
.cpb-login-card {
  width: 100%; max-width: 380px; padding: 40px;
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: 20px; box-shadow: var(--c-shadow); text-align: center;
}
.cpb-login-logo { height: 34px; width: auto; object-fit: contain; margin: 0 auto 26px; display: block; }
.cpb-login-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 24px; font-weight: 900; margin-bottom: 6px; }
.cpb-login-sub { font-size: 14px; color: var(--c-fg-60); line-height: 1.6; margin-bottom: 24px; }
.cpb-login-error { color: var(--c-bad); font-size: 13px; margin-top: 8px; }

/* LAYOUT */
.cpb-centered { max-width: 780px; margin: 0 auto; padding: 40px 20px 80px; }
.cpb-layout { max-width: 1180px; margin: 0 auto; display: flex; gap: 32px; padding: 0 20px; align-items: flex-start; }

.cpb-sidebar {
  width: 270px; flex-shrink: 0; position: sticky; top: 76px;
  padding: 24px 0 32px; max-height: calc(100vh - 92px); overflow-y: auto;
}
.cpb-sidebar-close { display: none; }
.cpb-nav { display: flex; flex-direction: column; gap: 2px; }
.cpb-nav-item {
  display: flex; align-items: center; gap: 8px; width: 100%;
  padding: 9px 11px; border-radius: 9px; cursor: pointer;
  background: none; border: 1px solid transparent; text-align: left;
  color: var(--c-fg-60); font-family: 'Inter', sans-serif; font-size: 13px;
  transition: all .15s;
}
.cpb-nav-item:hover { background: var(--c-surface-3); color: var(--c-fg); }
.cpb-nav-item.is-active { background: var(--c-surface); border-color: var(--c-border); color: var(--c-fg); font-weight: 600; }
.cpb-nav-icon { flex-shrink: 0; opacity: .6; }
.cpb-nav-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cpb-nav-pct { font-size: 11px; color: var(--c-fg-25); font-variant-numeric: tabular-nums; }
.cpb-nav-status {
  width: 16px; height: 16px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.cpb-nav-status.is-complete { background: color-mix(in srgb, var(--c-ok) 18%, transparent); color: var(--c-ok); }
.cpb-nav-status.is-review { background: color-mix(in srgb, var(--c-warn) 18%, transparent); color: var(--c-warn); }
.cpb-nav-status.is-critical { background: color-mix(in srgb, var(--c-bad) 18%, transparent); color: var(--c-bad); }
.cpb-nav-status.is-untouched { border: 1.5px solid var(--c-border-strong); }

.cpb-sidebar-foot { margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--c-border-soft); }
.cpb-sidebar-label { font-size: 11px; font-weight: 700; letter-spacing: .8px; text-transform: uppercase; color: var(--c-fg-40); margin-bottom: 8px; }
.cpb-sidebar-pct { font-size: 12px; color: var(--c-fg-40); margin-top: 6px; }
.cpb-sidebar-crit { display: flex; align-items: center; gap: 6px; margin-top: 12px; font-size: 12px; font-weight: 600; color: var(--c-bad); }

.cpb-progress-track { height: 6px; background: var(--c-track); border-radius: 3px; overflow: hidden; }
.cpb-progress-fill { height: 100%; border-radius: 3px; background: linear-gradient(90deg, var(--c-accent-2), var(--c-accent)); transition: width .4s ease; }

.cpb-main { flex: 1; min-width: 0; padding: 28px 0 80px; }
.cpb-scrim { display: none; }

/* SECCIÓN */
.cpb-sec-head { margin-bottom: 26px; }
.cpb-sec-num { font-size: 11px; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase; color: var(--c-fg-40); margin-bottom: 8px; }
.cpb-sec-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 28px; font-weight: 900; letter-spacing: -.6px; margin-bottom: 8px; }
.cpb-sec-intro { font-size: 15px; color: var(--c-fg-60); line-height: 1.65; max-width: 62ch; margin: 0; }

.cpb-h1 { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 32px; font-weight: 900; letter-spacing: -.8px; margin-bottom: 12px; line-height: 1.15; }
.cpb-lead { font-size: 16px; color: var(--c-fg-60); line-height: 1.7; max-width: 60ch; margin: 0 0 24px; }
.cpb-eyebrow { font-size: 11px; font-weight: 700; letter-spacing: 1.6px; text-transform: uppercase; color: var(--c-fg-40); margin-bottom: 12px; }

/* CAMPOS */
.cpb-fields { display: flex; flex-direction: column; gap: 20px; }
.cpb-field {
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-left: 2px solid var(--c-border); border-radius: 12px;
  padding: 18px 20px; box-shadow: var(--c-shadow);
  transition: border-color .2s, background .2s;
}
.cpb-field.is-green { border-left-color: var(--c-ok); }
.cpb-field.is-yellow { border-left-color: var(--c-warn); }
.cpb-field.is-red { border-left-color: var(--c-bad); }
.cpb-field.is-flash { animation: cpb-flash 1.6s ease; }
.cpb-field { scroll-margin-top: 76px; }
@keyframes cpb-flash {
  0%, 100% { box-shadow: var(--c-shadow); }
  20%, 60% { box-shadow: 0 0 0 3px color-mix(in srgb, var(--c-accent) 35%, transparent); }
}
.cpb-field-head { display: flex; align-items: center; gap: 7px; margin-bottom: 10px; }
.cpb-label { font-size: 14px; font-weight: 700; color: var(--c-fg); }
.cpb-req { color: var(--c-bad); }
.cpb-state-icon { display: inline-flex; align-items: center; }
.cpb-state-icon.is-green { color: var(--c-ok); }
.cpb-state-icon.is-yellow { color: var(--c-warn); }
.cpb-state-icon.is-red { color: var(--c-bad); }
.cpb-help-btn { background: none; border: none; padding: 0; cursor: pointer; color: var(--c-fg-25); display: inline-flex; }
.cpb-help-btn:hover { color: var(--c-fg-60); }
.cpb-help { font-size: 12.5px; color: var(--c-fg-60); line-height: 1.6; margin-bottom: 10px; padding: 8px 11px; background: var(--c-surface-3); border-radius: 7px; }
.cpb-sublabel { font-size: 11.5px; font-weight: 600; color: var(--c-fg-40); margin-bottom: 5px; }
.cpb-extract-note { font-size: 11.5px; color: var(--c-fg-40); margin-top: 7px; }
.cpb-extract-note.is-yellow { color: var(--c-warn); }
.cpb-internal-tag { margin-left: 6px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; padding: 1px 5px; border-radius: 4px; background: var(--c-surface-3); color: var(--c-fg-40); }
.cpb-skip { display: flex; align-items: center; gap: 7px; font-size: 13px; color: var(--c-fg-60); margin-bottom: 12px; cursor: pointer; }

.cpb-input, .cpb-textarea {
  width: 100%; background: var(--c-input-bg);
  border: 1px solid var(--c-border); border-radius: 8px;
  padding: 9px 12px; font-size: 14px; color: var(--c-fg);
  font-family: 'Inter', sans-serif; outline: none; transition: border-color .15s;
}
.cpb-input:focus, .cpb-textarea:focus { border-color: var(--c-accent); }
.cpb-input::placeholder, .cpb-textarea::placeholder { color: var(--c-fg-25); }
.cpb-input-sm { padding: 6px 10px; font-size: 13px; }
.cpb-select { cursor: pointer; }
.cpb-textarea { resize: vertical; line-height: 1.55; }
.cpb-textarea-wrap { position: relative; }
.cpb-counter { position: absolute; right: 8px; bottom: 6px; font-size: 10.5px; color: var(--c-fg-25); pointer-events: none; }
.cpb-counter.is-near { color: var(--c-warn); }
.cpb-time { width: auto; padding: 6px 8px; font-size: 13px; }

.cpb-grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }

/* CHIPS */
.cpb-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.cpb-chip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 12px; border-radius: 18px; cursor: pointer;
  background: var(--c-surface-3); border: 1px solid var(--c-border);
  color: var(--c-fg-60); font-size: 12.5px; font-family: 'Inter', sans-serif;
  transition: all .15s; text-align: left;
}
.cpb-chip:hover:not(:disabled) { border-color: var(--c-border-strong); color: var(--c-fg); }
.cpb-chip.is-on { background: color-mix(in srgb, var(--c-accent) 14%, transparent); border-color: color-mix(in srgb, var(--c-accent) 45%, transparent); color: var(--c-accent); font-weight: 600; }
.cpb-chip:disabled { cursor: default; opacity: .7; }

/* CHECKBOX */
.cpb-checkbox {
  width: 16px; height: 16px; border-radius: 5px; flex-shrink: 0;
  border: 1.5px solid var(--c-border-strong);
  display: inline-flex; align-items: center; justify-content: center;
  color: #fff; transition: all .15s;
}
.cpb-checkbox.is-on { background: var(--c-accent); border-color: var(--c-accent); }
.cpb-checkbox-btn {
  display: inline-flex; align-items: center; gap: 7px; padding: 8px 12px;
  background: var(--c-input-bg); border: 1px solid var(--c-border); border-radius: 8px;
  color: var(--c-fg-60); font-size: 13px; cursor: pointer; font-family: 'Inter', sans-serif;
}
.cpb-checkbox-btn.is-on { color: var(--c-fg); }

/* CHECKLIST */
.cpb-checklist { display: flex; flex-direction: column; gap: 6px; }
.cpb-checklist-count { font-size: 12px; color: var(--c-fg-40); margin-bottom: 4px; }
.cpb-checklist-count.is-short { color: var(--c-warn); }
.cpb-check-item { border: 1px solid var(--c-border-soft); border-radius: 9px; overflow: hidden; }
.cpb-check-item.is-on { border-color: color-mix(in srgb, var(--c-accent) 35%, transparent); }
.cpb-check-row {
  display: flex; align-items: center; gap: 9px; width: 100%; padding: 10px 12px;
  background: none; border: none; cursor: pointer; text-align: left;
  color: var(--c-fg-80); font-size: 13.5px; font-family: 'Inter', sans-serif;
}
.cpb-check-detail { padding: 0 12px 12px 33px; }

/* AGE RANGE */
.cpb-agerange { padding-top: 4px; }
.cpb-age-display { font-size: 15px; color: var(--c-fg-60); margin-bottom: 10px; }
.cpb-age-display strong { color: var(--c-fg); font-size: 19px; font-family: 'Plus Jakarta Sans', sans-serif; }
.cpb-age-unset { color: var(--c-fg-25); font-size: 13.5px; }
.cpb-age-track { height: 6px; background: var(--c-track); border-radius: 3px; position: relative; margin-bottom: 14px; }
.cpb-age-fill { position: absolute; height: 100%; border-radius: 3px; background: linear-gradient(90deg, var(--c-accent-2), var(--c-accent)); }
.cpb-age-inputs { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.cpb-age-inputs label { display: flex; flex-direction: column; gap: 4px; font-size: 11.5px; color: var(--c-fg-40); }
.cpb-age-inputs input[type=range] { width: 100%; accent-color: var(--c-accent); }

/* SCHEDULE */
.cpb-schedule { display: flex; flex-direction: column; gap: 16px; }
.cpb-sched-loc { border: 1px solid var(--c-border-soft); border-radius: 10px; padding: 12px 14px; }
.cpb-sched-loc-name { font-size: 13px; font-weight: 700; margin-bottom: 10px; color: var(--c-fg-80); }
.cpb-sched-day { display: flex; align-items: center; gap: 10px; padding: 5px 0; flex-wrap: wrap; }
.cpb-sched-toggle {
  display: flex; align-items: center; gap: 8px; background: none; border: none;
  cursor: pointer; padding: 0; color: var(--c-fg-40); font-family: 'Inter', sans-serif; font-size: 13px;
  min-width: 130px;
}
.cpb-sched-day.is-open .cpb-sched-toggle { color: var(--c-fg); }
.cpb-sched-dayname { font-weight: 500; }
.cpb-sched-times { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.cpb-sched-24 { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--c-fg-60); cursor: pointer; }
.cpb-sched-sep { font-size: 12px; color: var(--c-fg-40); }
.cpb-sched-closed { font-size: 12px; color: var(--c-fg-25); }

/* TABLAS */
.cpb-table { display: flex; flex-direction: column; gap: 10px; }
.cpb-table-bar { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.cpb-table-count { font-size: 12px; color: var(--c-fg-40); }
.cpb-table-actions { display: flex; gap: 6px; }
.cpb-short { color: var(--c-warn); }
.cpb-dim { color: var(--c-fg-25); }
.cpb-row-card { border: 1px solid var(--c-border-soft); border-radius: 10px; padding: 12px 14px; background: var(--c-surface-2); }
.cpb-row-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.cpb-row-num { font-size: 11px; font-weight: 800; color: var(--c-fg-25); }
.cpb-row-tools { display: flex; gap: 2px; }
.cpb-row-tools button {
  width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center;
  background: none; border: 1px solid transparent; border-radius: 6px;
  color: var(--c-fg-25); cursor: pointer; transition: all .15s;
}
.cpb-row-tools button:hover:not(:disabled) { color: var(--c-fg); border-color: var(--c-border); }
.cpb-row-tools button:disabled { opacity: .3; cursor: not-allowed; }
.cpb-row-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
.cpb-cell.is-wide { grid-column: 1 / -1; }
.cpb-add-btn {
  display: inline-flex; align-items: center; gap: 6px; align-self: flex-start;
  padding: 8px 14px; border-radius: 8px; cursor: pointer;
  background: var(--c-surface-3); border: 1px dashed var(--c-border-strong);
  color: var(--c-fg-60); font-size: 13px; font-weight: 600; font-family: 'Inter', sans-serif;
  transition: all .15s;
}
.cpb-add-btn:hover { color: var(--c-fg); border-color: var(--c-accent); }
.cpb-compact-list { border: 1px solid var(--c-border-soft); border-radius: 9px; overflow: hidden; }
.cpb-compact-row { display: flex; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid var(--c-border-soft); font-size: 13px; }
.cpb-compact-row:last-child { border-bottom: none; }
.cpb-compact-name { color: var(--c-fg-80); }
.cpb-compact-val { color: var(--c-fg-40); font-variant-numeric: tabular-nums; }

.cpb-import { border: 1px solid var(--c-border); border-radius: 10px; padding: 14px; background: var(--c-surface-3); display: flex; flex-direction: column; gap: 10px; }
.cpb-import-head { display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
.cpb-import-head button { background: none; border: none; color: var(--c-fg-40); cursor: pointer; display: flex; }
.cpb-import-hint { font-size: 12px; color: var(--c-fg-60); line-height: 1.6; }
.cpb-import-cols { margin-top: 5px; font-size: 11px; color: var(--c-fg-40); }

.cpb-mini-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 9px; border-radius: 6px; cursor: pointer;
  background: var(--c-surface-3); border: 1px solid var(--c-border);
  color: var(--c-fg-40); font-size: 11.5px; font-family: 'Inter', sans-serif;
  text-decoration: none; transition: all .15s;
}
.cpb-mini-btn:hover { color: var(--c-fg); border-color: var(--c-border-strong); }
.cpb-empty-note {
  display: flex; align-items: center; gap: 8px;
  padding: 14px 16px; border-radius: 9px; border: 1px dashed var(--c-border-strong);
  color: var(--c-fg-40); font-size: 13px; line-height: 1.6;
}

/* UPLOAD */
.cpb-dropzone {
  border: 2px dashed var(--c-border-strong); border-radius: 16px;
  padding: 48px 24px; text-align: center; cursor: pointer;
  background: var(--c-surface); transition: all .2s; min-height: 260px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
}
.cpb-dropzone.is-compact { min-height: 0; padding: 24px; }
.cpb-dropzone:hover, .cpb-dropzone.is-dragging { border-color: var(--c-accent); background: color-mix(in srgb, var(--c-accent) 6%, var(--c-surface)); }
.cpb-drop-icon { color: var(--c-fg-25); margin-bottom: 6px; }
.cpb-drop-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 17px; font-weight: 800; }
.cpb-drop-sub { font-size: 13.5px; color: var(--c-fg-60); }
.cpb-drop-formats { font-size: 12px; color: var(--c-fg-25); margin-top: 8px; }
.cpb-drop-counter { font-size: 12px; color: var(--c-fg-25); margin-top: 10px; text-align: center; }
.cpb-uploading { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; }
.cpb-uploading-row { display: flex; align-items: center; gap: 10px; font-size: 12px; }
.cpb-uploading-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--c-fg-60); }
.cpb-uploading-track { width: 90px; height: 4px; background: var(--c-track); border-radius: 2px; overflow: hidden; }
.cpb-uploading-fill { height: 100%; background: var(--c-accent); transition: width .2s; }
.cpb-uploading-pct { width: 34px; text-align: right; color: var(--c-fg-40); font-variant-numeric: tabular-nums; }
.cpb-upload-errors { margin-top: 12px; padding: 12px 14px; border-radius: 9px; border: 1px solid color-mix(in srgb, var(--c-bad) 35%, transparent); background: color-mix(in srgb, var(--c-bad) 8%, transparent); display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
.cpb-upload-error { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--c-bad); }
.cpb-filegrid { margin-top: 16px; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; }
.cpb-filecard { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid var(--c-border); border-radius: 9px; background: var(--c-surface-2); }
.cpb-filecard-icon { color: var(--c-fg-40); flex-shrink: 0; display: flex; }
.cpb-filecard-body { flex: 1; min-width: 0; }
.cpb-filecard-name { font-size: 12.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cpb-filecard-size { font-size: 11px; color: var(--c-fg-25); }
.cpb-filecard-del { background: none; border: none; color: var(--c-fg-25); cursor: pointer; display: flex; flex-shrink: 0; }
.cpb-filecard-del:hover { color: var(--c-bad); }

/* MATERIALES */
.cpb-material { border: 1px solid var(--c-border); border-radius: 12px; padding: 16px; margin-bottom: 12px; background: var(--c-surface); box-shadow: var(--c-shadow); }
.cpb-material-head { display: flex; align-items: center; gap: 11px; margin-bottom: 14px; }
.cpb-material-icon { color: var(--c-fg-40); display: flex; flex-shrink: 0; }
.cpb-material-meta { flex: 1; min-width: 0; }
.cpb-material-name { font-size: 14px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cpb-material-sub { font-size: 11.5px; color: var(--c-fg-25); }
.cpb-material-tools { display: flex; gap: 5px; flex-shrink: 0; }
.cpb-material-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }

/* BOTONES */
.cpb-btn-primary, .cpb-btn-ghost {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  padding: 11px 20px; border-radius: 9px; cursor: pointer;
  font-size: 14px; font-weight: 700; font-family: 'Inter', sans-serif;
  transition: all .15s; border: 1px solid transparent;
}
.cpb-btn-primary { background: var(--c-accent); color: var(--c-btn-fg); }
.cpb-btn-primary:hover:not(:disabled) { filter: brightness(1.12); }
.cpb-btn-primary:disabled { opacity: .45; cursor: not-allowed; }
.cpb-btn-ghost { background: var(--c-surface-3); border-color: var(--c-border); color: var(--c-fg-60); }
.cpb-btn-ghost:hover { color: var(--c-fg); border-color: var(--c-border-strong); }
.cpb-btn-wide { width: 100%; margin-top: 8px; }
.cpb-btn-block { width: 100%; margin-top: 14px; }
.cpb-btn-sm { padding: 7px 14px; font-size: 13px; align-self: flex-start; }
.cpb-pager { display: flex; justify-content: space-between; align-items: center; margin-top: 32px; gap: 12px; }
.cpb-back-link { display: inline-flex; align-items: center; gap: 6px; background: none; border: none; color: var(--c-fg-40); font-size: 13px; cursor: pointer; margin-bottom: 18px; padding: 0; font-family: 'Inter', sans-serif; }
.cpb-back-link:hover { color: var(--c-fg); }

/* BIENVENIDA / UPLOAD PAGE / DONE */
.cpb-pills { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px; }
.cpb-pill { padding: 6px 14px; border-radius: 18px; background: var(--c-surface-3); border: 1px solid var(--c-border); font-size: 12.5px; color: var(--c-fg-60); }
.cpb-welcome-note { padding: 14px 16px; border-radius: 10px; background: var(--c-surface); border: 1px solid var(--c-border); font-size: 13.5px; color: var(--c-fg-60); line-height: 1.65; margin-bottom: 24px; }
.cpb-examples { margin-top: 24px; }
.cpb-examples-title { font-size: 12px; font-weight: 700; letter-spacing: .8px; text-transform: uppercase; color: var(--c-fg-40); margin-bottom: 10px; }
.cpb-examples ul { margin: 0; padding-left: 18px; columns: 2; font-size: 13.5px; color: var(--c-fg-60); line-height: 1.9; }
.cpb-upload-actions { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 32px; flex-wrap: wrap; }
.cpb-done { text-align: center; padding-top: 40px; }
.cpb-done-check { width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 22px; display: flex; align-items: center; justify-content: center; background: color-mix(in srgb, var(--c-ok) 16%, transparent); color: var(--c-ok); }
.cpb-done .cpb-lead { margin-left: auto; margin-right: auto; }
.cpb-done-note { font-size: 13px; color: var(--c-fg-40); margin-bottom: 22px; }
.cpb-readonly-banner { padding: 12px 16px; border-radius: 9px; background: color-mix(in srgb, var(--c-warn) 10%, transparent); border: 1px solid color-mix(in srgb, var(--c-warn) 30%, transparent); color: var(--c-warn); font-size: 13px; margin-bottom: 22px; }

/* ENTREVISTA */
.cpb-interview-cta {
  display: flex; align-items: flex-start; gap: 12px; width: 100%; text-align: left;
  padding: 16px 18px; margin-bottom: 22px; border-radius: 12px; cursor: pointer;
  background: color-mix(in srgb, var(--c-accent) 9%, transparent);
  border: 1px solid color-mix(in srgb, var(--c-accent) 35%, transparent);
  color: var(--c-fg); font-family: 'Inter', sans-serif; transition: all .15s;
}
.cpb-interview-cta:hover { background: color-mix(in srgb, var(--c-accent) 14%, transparent); }
.cpb-interview-cta svg { color: var(--c-accent); flex-shrink: 0; margin-top: 2px; }
.cpb-interview-cta strong { display: block; font-size: 14px; margin-bottom: 3px; }
.cpb-interview-cta span { font-size: 12.5px; color: var(--c-fg-60); line-height: 1.55; }

.cpb-modal-overlay { position: fixed; inset: 0; z-index: 200; background: var(--c-scrim); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 20px; }
.cpb-modal { background: var(--c-bg); border: 1px solid var(--c-border); border-radius: 16px; padding: 22px; width: 100%; max-width: 520px; }
.cpb-modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.cpb-modal-step { font-size: 11.5px; font-weight: 700; letter-spacing: .8px; text-transform: uppercase; color: var(--c-fg-40); }
.cpb-modal-head button { background: none; border: none; color: var(--c-fg-40); cursor: pointer; display: flex; }
.cpb-modal-track { height: 3px; background: var(--c-track); border-radius: 2px; overflow: hidden; margin-bottom: 20px; }
.cpb-modal-fill { height: 100%; background: var(--c-accent); transition: width .3s; }
.cpb-modal-q { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 17px; font-weight: 700; line-height: 1.45; margin-bottom: 16px; }
.cpb-modal-actions { display: flex; justify-content: space-between; gap: 10px; margin-top: 16px; flex-wrap: wrap; }

/* REVIEW */
.cpb-review-hero { display: flex; align-items: center; gap: 22px; padding: 22px 24px; border-radius: 14px; background: var(--c-surface); border: 1px solid var(--c-border); box-shadow: var(--c-shadow); margin-bottom: 24px; }
.cpb-review-pct { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 42px; font-weight: 900; letter-spacing: -1.5px; line-height: 1; }
.cpb-review-hero-info { flex: 1; min-width: 0; }
.cpb-review-hero-label { font-size: 12px; font-weight: 700; letter-spacing: .8px; text-transform: uppercase; color: var(--c-fg-40); margin-bottom: 8px; }
.cpb-review-hero-sub { font-size: 13px; margin-top: 8px; }
.cpb-review-hero-sub.is-good { color: var(--c-ok); }
.cpb-review-hero-sub.is-bad { color: var(--c-bad); }
.cpb-review-section { border: 1px solid var(--c-border-soft); border-radius: 12px; padding: 16px 18px; margin-bottom: 10px; }
.cpb-review-sec-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.cpb-review-sec-num { width: 20px; height: 20px; border-radius: 6px; background: var(--c-surface-3); color: var(--c-fg-40); font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
.cpb-review-sec-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 15px; font-weight: 800; flex: 1; }
.cpb-review-sec-pct { font-size: 13px; font-weight: 700; color: var(--c-fg-40); }
.cpb-review-sec-pct.is-full { color: var(--c-ok); }
.cpb-review-list { margin-top: 8px; }
.cpb-review-list-title { font-size: 11px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; color: var(--c-fg-25); margin-bottom: 6px; }
.cpb-review-item {
  display: flex; align-items: center; gap: 7px; padding: 5px 9px; margin: 0 5px 5px 0;
  border-radius: 6px; cursor: pointer; background: none; border: 1px solid var(--c-border-soft);
  color: var(--c-bad); font-size: 12.5px; font-family: 'Inter', sans-serif;
}
.cpb-review-item.is-optional { color: var(--c-fg-40); }
.cpb-review-item:hover { border-color: var(--c-border-strong); }
.cpb-review-list.is-critical { display: flex; flex-wrap: wrap; align-items: center; }
.cpb-review-list.is-critical .cpb-review-list-title { width: 100%; }
.cpb-review-done { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--c-ok); }
.cpb-review-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 26px; flex-wrap: wrap; }
.cpb-review-blocked { text-align: right; font-size: 12.5px; color: var(--c-fg-40); margin-top: 10px; }

/* RESPONSIVE */
@media (max-width: 900px) {
  .cpb-menu-btn { display: inline-flex; }
  .cpb-layout { display: block; padding: 0 16px; }
  .cpb-scrim { display: block; position: fixed; inset: 0; z-index: 60; background: var(--c-scrim); }
  .cpb-sidebar {
    display: none; position: fixed; top: 0; left: 0; bottom: 0; z-index: 70;
    width: 280px; max-height: none; background: var(--c-bg);
    border-right: 1px solid var(--c-border); padding: 16px 14px 24px; overflow-y: auto;
  }
  .cpb-sidebar.is-open { display: block; }
  .cpb-sidebar-close { display: flex; justify-content: flex-end; margin-bottom: 8px; }
  .cpb-sidebar-close button { background: none; border: none; color: var(--c-fg-40); cursor: pointer; display: flex; }
  .cpb-main { padding-top: 22px; }
  .cpb-sec-title { font-size: 24px; }
  .cpb-h1 { font-size: 26px; }
  .cpb-examples ul { columns: 1; }
  .cpb-review-hero { flex-direction: column; align-items: flex-start; gap: 12px; }
}
@media (max-width: 560px) {
  .cpb-topbar-title { display: none; }
  .cpb-topbar-sep { display: none; }
  .cpb-row-grid { grid-template-columns: 1fr; }
  .cpb-grid-2 { grid-template-columns: 1fr; }
  .cpb-age-inputs { grid-template-columns: 1fr; }
  .cpb-sched-day { align-items: flex-start; flex-direction: column; gap: 6px; }
  .cpb-material-form { grid-template-columns: 1fr; }
  .cpb-pager button { flex: 1; }
}
`
