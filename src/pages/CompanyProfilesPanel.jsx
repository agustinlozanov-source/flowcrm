// Panel del superadmin para el Company Profile Builder.
// Crea el acceso del cliente (mismo patrón que el portal de implementación:
// email + password generado) y muestra los perfiles enviados.

import { useState, useEffect } from 'react'
import {
  collection, onSnapshot, query, orderBy, addDoc, doc, updateDoc, deleteDoc,
  serverTimestamp, getDocs,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import {
  Building2, Plus, Copy, Key as KeyIcon, Mail, Trash2, ChevronRight,
  ExternalLink, ClipboardList, Send,
} from 'lucide-react'

import {
  SECTIONS, WEEKDAYS, globalProgress, allMissingCritical, emptyProfile, isFieldFilled,
} from '@/lib/companyProfileSchema'

const genPassword = () => Math.random().toString(36).slice(2, 10).toUpperCase()

export default function CompanyProfilesPanel() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ companyName: '', clientName: '', clientEmail: '' })
  const [expanded, setExpanded] = useState(null)
  const [sending, setSending] = useState({})

  useEffect(() => {
    const q = query(collection(db, 'company_profiles'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q,
      snap => { setProfiles(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) },
      () => setLoading(false),
    )
    return () => unsub()
  }, [])

  const portalUrl = `${window.location.origin}/perfil`

  const create = async () => {
    const { companyName, clientName, clientEmail } = form
    if (!companyName.trim() || !clientEmail.trim()) {
      toast.error('Nombre de empresa y email son obligatorios')
      return
    }
    const email = clientEmail.trim().toLowerCase()

    setCreating(true)
    try {
      // El login busca por clientEmail, así que un email duplicado haría que el
      // cliente entre siempre al primer perfil que exista.
      const dupe = await getDocs(query(collection(db, 'company_profiles')))
      if (dupe.docs.some(d => d.data().clientEmail === email)) {
        toast.error('Ya existe un perfil con ese email')
        return
      }

      const accessPassword = genPassword()
      await addDoc(collection(db, 'company_profiles'), {
        companyName: companyName.trim(),
        clientName: clientName.trim(),
        clientEmail: email,
        accessPassword,
        status: 'draft',
        data: emptyProfile(),
        materials: [],
        visited: {},
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setForm({ companyName: '', clientName: '', clientEmail: '' })
      toast.success(`Perfil creado — código de acceso: ${accessPassword}`)
    } catch {
      toast.error('No se pudo crear el perfil')
    } finally {
      setCreating(false)
    }
  }

  const copyAccess = p => {
    navigator.clipboard.writeText(
      `Perfil de empresa — ${p.companyName}\n${portalUrl}\nEmail: ${p.clientEmail}\nCódigo de acceso: ${p.accessPassword}`
    )
    toast.success('Datos de acceso copiados')
  }

  const sendAccess = async p => {
    setSending(s => ({ ...s, [p.id]: true }))
    try {
      const res = await fetch('/.netlify/functions/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'custom',
          to: p.clientEmail,
          data: {
            subject: `Cuéntanos de ${p.companyName} — perfil de empresa`,
            bodyHtml: `
              <h2 style="margin:0 0 12px;font-size:20px;color:#070708">Hola${p.clientName ? ` ${p.clientName}` : ''},</h2>
              <p style="font-size:15px;color:#3a3a3c;line-height:1.6">
                Para configurar tu CRM y entrenar a tu agente necesitamos conocer tu empresa a fondo.
                Preparamos un formulario donde nos puedes contar todo — puedes subir el material que ya
                tengas y salir y volver cuando quieras.
              </p>
              <table style="margin:20px 0">
                <tr><td style="padding:4px 12px 4px 0;color:#8e8e93;font-size:14px">Liga</td><td style="padding:4px 0;font-size:14px"><a href="${portalUrl}" style="color:#0066ff">${portalUrl}</a></td></tr>
                <tr><td style="padding:4px 12px 4px 0;color:#8e8e93;font-size:14px">Email</td><td style="padding:4px 0;font-size:14px;color:#070708"><strong>${p.clientEmail}</strong></td></tr>
                <tr><td style="padding:4px 12px 4px 0;color:#8e8e93;font-size:14px">Código de acceso</td><td style="padding:4px 0;font-size:14px;color:#070708"><strong>${p.accessPassword}</strong></td></tr>
              </table>`,
          },
        }),
      })
      if (!res.ok) throw new Error()
      await updateDoc(doc(db, 'company_profiles', p.id), { accessSentAt: serverTimestamp() })
      toast.success('Acceso enviado por correo')
    } catch {
      toast.error('No se pudo enviar el correo')
    } finally {
      setSending(s => ({ ...s, [p.id]: false }))
    }
  }

  const remove = async p => {
    if (!window.confirm(`¿Eliminar el perfil de ${p.companyName}? Se borran también los envíos que haya hecho. Los archivos que subió quedan en Storage.`)) return
    try {
      // Firestore no borra subcolecciones en cascada: sin esto los snapshots
      // de submissions quedan huérfanos y siguen ocupando la base.
      const subs = await getDocs(collection(db, 'company_profiles', p.id, 'submissions'))
      await Promise.all(subs.docs.map(d => deleteDoc(d.ref)))
      await deleteDoc(doc(db, 'company_profiles', p.id))
      toast.success('Perfil eliminado')
    } catch {
      toast.error('No se pudo eliminar por completo')
    }
  }

  const reopen = async p => {
    if (!window.confirm(`¿Reabrir el perfil de ${p.companyName} para que pueda editarlo de nuevo?`)) return
    await updateDoc(doc(db, 'company_profiles', p.id), { status: 'draft' })
    toast.success('Perfil reabierto — el cliente ya puede editarlo')
  }

  if (loading) return <div className="sa-content" style={{ color: 'var(--gray-4)', paddingTop: 40 }}>Cargando perfiles...</div>

  return (
    <div className="sa-content">
      <style>{PANEL_CSS}</style>

      <div className="sa-card">
        <div className="sa-card-header">
          <div className="sa-card-title">Crear perfil de empresa</div>
        </div>
        <div className="cpp-create">
          <input className="sa-input" placeholder="Nombre de la empresa *" value={form.companyName}
            onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} />
          <input className="sa-input" placeholder="Nombre del contacto" value={form.clientName}
            onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} />
          <input className="sa-input" type="email" placeholder="Email del contacto *" value={form.clientEmail}
            onChange={e => setForm(f => ({ ...f, clientEmail: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && create()} />
          <button className="sa-btn sa-btn-blue" onClick={create} disabled={creating}>
            <Plus size={13} /> {creating ? 'Creando...' : 'Crear acceso'}
          </button>
        </div>
        <div className="cpp-hint">
          Se genera un código de acceso y el cliente entra en <strong>{portalUrl}</strong> con su email y ese código —
          igual que el portal de implementación.
        </div>
      </div>

      {profiles.length === 0 ? (
        <div className="sa-card">
          <div className="sa-empty" style={{ padding: '60px 20px' }}>
            <div className="sa-empty-icon" style={{ display: 'flex', justifyContent: 'center' }}>
              <Building2 size={40} strokeWidth={1.2} />
            </div>
            <div className="sa-empty-text">Todavía no has creado ningún perfil de empresa</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {profiles.map(p => {
            const pct = globalProgress(p.data || {}, { visited: p.visited || {}, materials: p.materials || [] })
            const crit = allMissingCritical(p.data || {}, { materials: p.materials || [] }).length
            const submitted = p.status === 'submitted'
            const isOpen = expanded === p.id
            return (
              <div key={p.id} className="sa-card">
                <div className="cpp-row" onClick={() => setExpanded(isOpen ? null : p.id)}>
                  <div className="cpp-avatar">{(p.companyName || '?')[0].toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="cpp-name">{p.companyName}</div>
                    <div className="cpp-sub">{p.clientName ? `${p.clientName} · ` : ''}{p.clientEmail}</div>
                  </div>

                  <div className="cpp-progress">
                    <div className="cpp-track"><div className="cpp-fill" style={{ width: `${pct}%` }} /></div>
                    <span className="cpp-pct">{pct}%</span>
                  </div>

                  <span className={clsx('cpp-badge', submitted ? 'is-sent' : crit ? 'is-pending' : 'is-ready')}>
                    {submitted ? 'Enviado' : crit ? `${crit} críticos` : 'Listo para enviar'}
                  </span>

                  <span className="cpp-date">
                    {(p.submittedAt || p.updatedAt)?.toDate?.()?.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) || '—'}
                  </span>
                  <ChevronRight size={15} className={clsx('cpp-chevron', isOpen && 'is-open')} />
                </div>

                {isOpen && (
                  <div className="cpp-detail">
                    <div className="cpp-access">
                      <span><KeyIcon size={12} /> {p.accessPassword}</span>
                      <button className="sa-btn sa-btn-ghost sa-btn-sm" onClick={() => copyAccess(p)}>
                        <Copy size={12} /> Copiar acceso
                      </button>
                      <button className="sa-btn sa-btn-ghost sa-btn-sm" onClick={() => sendAccess(p)} disabled={sending[p.id]}>
                        <Mail size={12} /> {sending[p.id] ? 'Enviando...' : p.accessSentAt ? 'Reenviar correo' : 'Enviar por correo'}
                      </button>
                      <a className="sa-btn sa-btn-ghost sa-btn-sm" href={portalUrl} target="_blank" rel="noreferrer">
                        <ExternalLink size={12} /> Abrir formulario
                      </a>
                      {submitted && (
                        <button className="sa-btn sa-btn-ghost sa-btn-sm" onClick={() => reopen(p)}>
                          <Send size={12} /> Reabrir para editar
                        </button>
                      )}
                      <button className="sa-btn sa-btn-danger sa-btn-sm" onClick={() => remove(p)}>
                        <Trash2 size={12} /> Eliminar
                      </button>
                    </div>

                    <ProfileReadout profile={p} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Lectura del perfil ──────────────────────────────────────────────────────

function ProfileReadout({ profile }) {
  const data = profile.data || {}
  const materials = profile.materials || []

  return (
    <div className="cpp-readout">
      {SECTIONS.map(s => {
        if (s.isMaterials) {
          if (!materials.length) return null
          return (
            <div key={s.key} className="cpp-sec">
              <div className="cpp-sec-title">{s.num}. {s.title}</div>
              {materials.map(m => (
                <div key={m.fileId} className="cpp-kv">
                  <span className="cpp-k">{m.originalName}</span>
                  <span className="cpp-v">
                    {m.materialType || <em>sin etiquetar</em>}
                    {m.whenToServe?.length ? ` · ${m.whenToServe.length} momentos` : ''}
                    {m.url && <> · <a href={m.url} target="_blank" rel="noreferrer">abrir</a></>}
                  </span>
                </div>
              ))}
            </div>
          )
        }

        const secData = data[s.key] || {}
        const rows = s.fields
          .map(f => [f, secData[f.id]])
          .filter(([f, v]) => isFieldFilled(f, v, { skipped: secData._skipped }))
        if (!rows.length) return null

        return (
          <div key={s.key} className="cpp-sec">
            <div className="cpp-sec-title">{s.num}. {s.title}</div>
            {rows.map(([f, v]) => (
              <div key={f.id} className="cpp-kv">
                <span className="cpp-k">{f.label}</span>
                <span className="cpp-v">{renderValue(f, v)}</span>
              </div>
            ))}
          </div>
        )
      })}

      {!SECTIONS.some(s => s.fields?.some(f =>
        isFieldFilled(f, (data[s.key] || {})[f.id], { skipped: (data[s.key] || {})._skipped })
      )) && !materials.length && (
        <div className="cpp-nothing"><ClipboardList size={14} /> El cliente todavía no ha llenado nada.</div>
      )}
    </div>
  )
}

function renderValue(field, v) {
  switch (field.type) {
    case 'table': {
      const rows = Array.isArray(v) ? v : []
      if (!rows.length) return <em>vacío</em>
      return (
        <ul className="cpp-list">
          {rows.map((r, i) => (
            <li key={i}>{field.columns.map(c => r[c.key]).filter(x => x !== '' && x !== false && x != null).join(' · ')}</li>
          ))}
        </ul>
      )
    }
    case 'group':
      return Object.entries(v || {}).filter(([, x]) => x).map(([k, x]) => `${k}: ${x}`).join(' · ') || <em>vacío</em>
    case 'category':
      return [v?.main, v?.sub].filter(Boolean).join(' → ') || <em>vacío</em>
    case 'agerange':
      return `${v?.min}–${v?.max} años`
    case 'multiselect':
      return (v || []).join(', ')
    case 'checklist':
      return (
        <ul className="cpp-list">
          {Object.entries(v || {}).filter(([, x]) => x?.checked).map(([k, x]) => (
            <li key={k}><strong>{k}</strong>{x.detail ? ` — ${x.detail}` : ''}</li>
          ))}
        </ul>
      )
    case 'schedule': {
      const locs = Object.keys(v || {})
      if (!locs.length) return <em>vacío</em>
      return (
        <ul className="cpp-list">
          {locs.map(l => {
            const days = Object.entries(v[l] || {}).filter(([, d]) => d?.open)
            const dayLabel = id => WEEKDAYS.find(w => w.id === id)?.short || id
            return <li key={l}><strong>{l}</strong> — {days.length ? days.map(([d, x]) => `${dayLabel(d)} ${x.is24h ? '24h' : `${x.from || '?'}-${x.to || '?'}`}`).join(', ') : 'sin días'}</li>
          })}
        </ul>
      )
    }
    default:
      return String(v)
  }
}

const PANEL_CSS = `
  .cpp-create { display: grid; grid-template-columns: 1.2fr 1fr 1.2fr auto; gap: 8px; padding: 14px 16px; }
  .cpp-hint { padding: 0 16px 14px; font-size: 12.5px; color: var(--gray-4); line-height: 1.6; }
  .cpp-row { display: flex; align-items: center; gap: 12px; padding: 14px 16px; cursor: pointer; }
  .cpp-avatar {
    width: 34px; height: 34px; border-radius: 9px; flex-shrink: 0;
    background: linear-gradient(135deg, #1aab99, #3533cd); color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 800; font-size: 14px;
  }
  .cpp-name { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 800; font-size: 15px; }
  .cpp-sub { font-size: 13px; color: var(--gray-4); margin-top: 2px; }
  .cpp-progress { display: flex; align-items: center; gap: 8px; width: 130px; flex-shrink: 0; }
  .cpp-track { flex: 1; height: 5px; background: rgba(0,0,0,0.08); border-radius: 3px; overflow: hidden; }
  .cpp-fill { height: 100%; border-radius: 3px; background: linear-gradient(90deg, #1aab99, #3533cd); }
  .cpp-pct { font-size: 12px; color: var(--gray-4); width: 32px; text-align: right; font-variant-numeric: tabular-nums; }
  .cpp-badge { font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 6px; white-space: nowrap; flex-shrink: 0; }
  .cpp-badge.is-sent { background: rgba(0,200,83,0.12); color: #00a844; border: 1px solid rgba(0,200,83,0.25); }
  .cpp-badge.is-ready { background: rgba(0,102,255,0.1); color: #0052cc; border: 1px solid rgba(0,102,255,0.22); }
  .cpp-badge.is-pending { background: rgba(255,149,0,0.12); color: #b26a00; border: 1px solid rgba(255,149,0,0.25); }
  .cpp-date { font-size: 12px; color: var(--gray-4); width: 58px; text-align: right; flex-shrink: 0; }
  .cpp-chevron { color: var(--gray-4); transition: transform .2s; flex-shrink: 0; }
  .cpp-chevron.is-open { transform: rotate(90deg); }
  .cpp-detail { border-top: 1px solid rgba(0,0,0,0.07); padding: 14px 16px; }
  .cpp-access { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; margin-bottom: 16px; }
  .cpp-access > span {
    display: inline-flex; align-items: center; gap: 5px;
    font-family: ui-monospace, monospace; font-size: 13px; font-weight: 700;
    padding: 5px 10px; border-radius: 6px; background: rgba(0,0,0,0.05); color: var(--gray-4);
  }
  .cpp-readout { display: flex; flex-direction: column; gap: 16px; }
  .cpp-sec-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; font-weight: 800; margin-bottom: 7px; }
  .cpp-kv { display: flex; gap: 12px; padding: 4px 0; font-size: 13px; align-items: flex-start; }
  .cpp-k { width: 190px; flex-shrink: 0; color: var(--gray-4); }
  .cpp-v { flex: 1; min-width: 0; line-height: 1.55; }
  .cpp-list { margin: 0; padding-left: 16px; }
  .cpp-list li { margin-bottom: 3px; }
  .cpp-nothing { display: flex; align-items: center; gap: 7px; font-size: 13px; color: var(--gray-4); }
  @media (max-width: 860px) {
    .cpp-create { grid-template-columns: 1fr; }
    .cpp-progress, .cpp-date { display: none; }
    .cpp-kv { flex-direction: column; gap: 2px; }
    .cpp-k { width: auto; }
  }
`
