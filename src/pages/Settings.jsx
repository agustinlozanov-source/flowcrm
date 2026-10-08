import { useState, useEffect } from 'react'
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { auth } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth'
import toast from 'react-hot-toast'

// ── Channel card ──────────────────────────────────────────────────────────────
function ChannelCard({ icon, name, description, connected, onConnect, onDisconnect, loading }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-white">
      <div className="flex items-center gap-3">
        <img src={icon} alt={name} style={{ width: 36, height: 36, objectFit: 'contain', flexShrink: 0 }} />
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">{name}</span>
            {connected ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                Conectado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
                No conectado
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
      </div>
      {connected ? (
        <button
          onClick={onDisconnect}
          disabled={loading}
          className="text-xs text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          Desconectar
        </button>
      ) : (
        <button
          onClick={onConnect}
          disabled={loading}
          className="text-xs font-medium text-white bg-gray-900 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          Conectar
        </button>
      )}
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, description, children }) {
  return (
    <div className="mb-8">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Settings() {
  const { org, user } = useAuthStore()
  const orgId = org?.id

  const [integrations, setIntegrations] = useState({})
  const [loadingChannel, setLoadingChannel] = useState(null)
  const [timezone, setTimezone] = useState(org?.timezone || 'America/Mexico_City')
  const [savingTimezone, setSavingTimezone] = useState(false)

  // Password change state
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [savingPw, setSavingPw] = useState(false)
  const [showPwForm, setShowPwForm] = useState(false)

  // Load integrations from Firestore — tiempo real
  useEffect(() => {
    if (!orgId) return
    const ref = doc(db, 'organizations', orgId, 'settings', 'integrations')
    const unsub = onSnapshot(ref, snap => {
      if (!snap.exists()) return
      setIntegrations(snap.data())
    })
    return unsub
  }, [orgId])

  // Detect OAuth callback params and show toast
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const channelKeys = ['whatsapp', 'facebook', 'instagram']
    const labels = { whatsapp: 'WhatsApp', facebook: 'Facebook', instagram: 'Instagram' }
    channelKeys.forEach(ch => {
      if (params.get(ch) === 'connected') toast.success(`${labels[ch]} conectado ✓`)
      if (params.get(ch) === 'error') toast.error(`Error al conectar ${labels[ch]}`)
    })
    if (params.get('google') === 'connected') {
      toast.success('Google Calendar conectado ✓')
      setIntegrations(prev => ({ ...prev, googleCalendar: { connected: true } }))
    }
    if (params.get('google') === 'error') {
      const msg = params.get('msg') || 'Error al conectar Google Calendar'
      toast.error(msg)
    }
    if (params.toString()) window.history.replaceState({}, '', '/settings')
  }, [])

  // Zernio devuelve la URL donde el cliente completa la conexión. No decidimos
  // nosotros si compra un número o usa el suyo: esa pantalla es de Zernio, con
  // sus precios y países reales. El resultado llega por webhook.
  const connectChannel = async (platform) => {
    setLoadingChannel(platform)
    try {
      const res = await fetch('/.netlify/functions/zernio-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, platform }),
      })
      const data = await res.json()
      if (!res.ok || !data.authUrl) throw new Error(data.error || 'No se pudo iniciar la conexión')
      window.location.href = data.authUrl
    } catch (e) {
      toast.error(e.message)
      setLoadingChannel(null)
    }
  }

  const handleDisconnect = async (channel) => {
    setLoadingChannel(channel)
    try {
      const res = await fetch('/.netlify/functions/zernio-disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, platform: channel }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error del servidor')
      toast.success('Canal desconectado')
    } catch (e) {
      toast.error(e.message || 'Error al desconectar')
    } finally {
      setLoadingChannel(null)
    }
  }

  const handleChangePassword = async () => {
    if (!pwForm.current) { toast.error('Ingresa tu contraseña actual'); return }
    if (pwForm.next.length < 6) { toast.error('La nueva contraseña debe tener mínimo 6 caracteres'); return }
    if (pwForm.next !== pwForm.confirm) { toast.error('Las contraseñas no coinciden'); return }
    setSavingPw(true)
    try {
      const currentUser = auth.currentUser
      if (!currentUser) throw new Error('Sesión expirada. Recarga la página.')

      // Re-autenticar antes de cambiar contraseña (requerido por Firebase)
      const credential = EmailAuthProvider.credential(currentUser.email, pwForm.current)
      await reauthenticateWithCredential(currentUser, credential)

      // Cambiar contraseña
      await updatePassword(currentUser, pwForm.next)

      // Enviar correo de notificación
      try {
        await fetch('/.netlify/functions/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'reset_password',
            to: currentUser.email,
            data: {
              nombre: user?.nombre || currentUser.email.split('@')[0],
              email: currentUser.email,
              newPassword: '•••••••• (contraseña actualizada — no se muestra por seguridad)',
            },
          }),
        })
      } catch (emailErr) {
        console.warn('[email] No se pudo enviar notificación:', emailErr)
      }

      toast.success('Contraseña actualizada correctamente')
      setPwForm({ current: '', next: '', confirm: '' })
      setShowPwForm(false)
    } catch (e) {
      if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        toast.error('Contraseña actual incorrecta')
      } else if (e.code === 'auth/weak-password') {
        toast.error('La contraseña es demasiado débil')
      } else {
        toast.error(e.message)
      }
    } finally {
      setSavingPw(false)
    }
  }

  const channels = [
    {
      key: 'whatsapp',
      icon: '/icons/WhatsApp Icon.png',
      name: 'WhatsApp Business',
      description: 'Recibe y responde mensajes de WhatsApp automáticamente',
    },
    {
      key: 'facebook',
      icon: '/icons/Facebook Icon.png',
      name: 'Facebook Messenger',
      description: 'Conecta tu página de Facebook para recibir mensajes',
    },
    {
      key: 'instagram',
      icon: '/icons/Instagram Icon.png',
      name: 'Instagram DM',
      description: 'Recibe mensajes directos de Instagram en tu inbox',
    },
  ]

  return (
    <div className="p-6 max-w-2xl mx-auto h-full overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900">Configuración</h1>
        <p className="text-sm text-gray-500 mt-1">Gestiona tus canales, integraciones y cuenta</p>
      </div>

      <Section
        title="Canales"
        description="Conecta tus plataformas de mensajería para que el agente pueda recibir y responder mensajes"
      >
        {/* ── Un botón por canal. Las opciones las muestra Zernio. ── */}
        {channels.map(ch => (
          <ChannelCard
            key={ch.key}
            icon={ch.icon}
            name={ch.name}
            description={ch.description}
            connected={integrations[ch.key]?.connected || false}
            loading={loadingChannel === ch.key}
            onConnect={() => connectChannel(ch.key)}
            onDisconnect={() => handleDisconnect(ch.key)}
          />
        ))}
      </Section>

      {/* ── Integraciones ── */}
      <Section
        title="Integraciones"
        description="Conecta herramientas externas para potenciar tu flujo de trabajo"
      >
        <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <img src="/icons/Google Calendar.png" alt="Google Calendar" style={{ width: 36, height: 36, objectFit: 'contain', flexShrink: 0 }} />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">Google Calendar</span>
                {integrations.googleCalendar?.connected ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    Conectado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
                    No conectado
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Crea reuniones y genera links de Google Meet automáticamente</p>
            </div>
          </div>
          {integrations.googleCalendar?.connected ? (
            <button
              onClick={() => handleDisconnect('googleCalendar')}
              disabled={loadingChannel === 'googleCalendar'}
              className="text-xs text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              Desconectar
            </button>
          ) : (
            <button
              onClick={() => { window.location.href = `/.netlify/functions/google-auth?orgId=${orgId}&redirect=settings` }}
              className="text-xs font-medium text-white bg-gray-900 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              Conectar
            </button>
          )}
        </div>
      </Section>

      {/* ── Cuenta ── */}
      <Section title="Cuenta" description="Información básica de tu organización">
        <div className="p-4 rounded-xl border border-gray-100 bg-white space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">Organización</span>
            <span className="text-sm font-medium text-gray-900">{org?.name || '—'}</span>
          </div>
          <div className="border-t border-gray-50" />
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">ID</span>
            <span className="text-xs font-mono text-gray-400">{orgId || '—'}</span>
          </div>
          <div className="border-t border-gray-50" />
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">Email</span>
            <span className="text-sm text-gray-700">{user?.email || '—'}</span>
          </div>
          <div className="border-t border-gray-50" />
          <div className="flex justify-between items-center gap-3">
            <div>
              <span className="text-xs text-gray-500 block">Zona horaria</span>
              <span className="text-[11px] text-gray-400">Se usa para agendar videollamadas correctamente</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <select
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              >
                <optgroup label="México">
                  <option value="America/Mexico_City">México Centro (UTC-6)</option>
                  <option value="America/Monterrey">Monterrey / NL (UTC-6)</option>
                  <option value="America/Mazatlan">Mazatlán / Noroeste (UTC-7)</option>
                  <option value="America/Tijuana">Tijuana / Pacifico (UTC-8)</option>
                </optgroup>
                <optgroup label="Latinoamérica">
                  <option value="America/Bogota">Colombia (UTC-5)</option>
                  <option value="America/Lima">Perú (UTC-5)</option>
                  <option value="America/Santiago">Chile (UTC-4)</option>
                  <option value="America/Argentina/Buenos_Aires">Argentina (UTC-3)</option>
                  <option value="America/Sao_Paulo">Brasil (UTC-3)</option>
                  <option value="America/Caracas">Venezuela (UTC-4)</option>
                  <option value="America/Guayaquil">Ecuador (UTC-5)</option>
                  <option value="America/La_Paz">Bolivia (UTC-4)</option>
                  <option value="America/Asuncion">Paraguay (UTC-4)</option>
                  <option value="America/Montevideo">Uruguay (UTC-3)</option>
                </optgroup>
                <optgroup label="América del Norte">
                  <option value="America/New_York">Este EE.UU. (UTC-5)</option>
                  <option value="America/Chicago">Centro EE.UU. (UTC-6)</option>
                  <option value="America/Denver">Montaña EE.UU. (UTC-7)</option>
                  <option value="America/Los_Angeles">Pacífico EE.UU. (UTC-8)</option>
                </optgroup>
                <optgroup label="España">
                  <option value="Europe/Madrid">España (UTC+1)</option>
                </optgroup>
              </select>
              <button
                onClick={async () => {
                  setSavingTimezone(true)
                  try {
                    await setDoc(doc(db, 'organizations', orgId), { timezone }, { merge: true })
                    toast.success('Zona horaria guardada')
                  } catch { toast.error('Error al guardar') }
                  finally { setSavingTimezone(false) }
                }}
                disabled={savingTimezone || timezone === (org?.timezone || 'America/Mexico_City')}
                className="text-xs font-medium text-white bg-gray-900 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
              >
                {savingTimezone ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Seguridad ── */}
      <Section title="Seguridad" description="Administra el acceso y la seguridad de tu cuenta">
        <div className="p-4 rounded-xl border border-gray-100 bg-white space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-sm font-medium text-gray-900">Contraseña</span>
              <p className="text-xs text-gray-500 mt-0.5">Cambia tu contraseña de acceso</p>
            </div>
            <button
              onClick={() => { setShowPwForm(f => !f); setPwForm({ current: '', next: '', confirm: '' }) }}
              className="text-xs font-medium text-white bg-gray-900 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              {showPwForm ? 'Cancelar' : 'Cambiar'}
            </button>
          </div>

          {showPwForm && (
            <>
              <div className="border-t border-gray-50" />
              <div className="space-y-3 pt-1">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Contraseña actual</label>
                  <input
                    type="password"
                    value={pwForm.current}
                    onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Nueva contraseña</label>
                  <input
                    type="password"
                    value={pwForm.next}
                    onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Confirmar nueva contraseña</label>
                  <input
                    type="password"
                    value={pwForm.confirm}
                    onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                    placeholder="Repite la nueva contraseña"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                    onKeyDown={e => e.key === 'Enter' && handleChangePassword()}
                  />
                </div>
                {pwForm.next && pwForm.next.length < 6 && (
                  <p className="text-xs text-red-500">Mínimo 6 caracteres</p>
                )}
                {pwForm.next && pwForm.confirm && pwForm.next !== pwForm.confirm && (
                  <p className="text-xs text-red-500">Las contraseñas no coinciden</p>
                )}
                <button
                  onClick={handleChangePassword}
                  disabled={savingPw || !pwForm.current || pwForm.next.length < 6 || pwForm.next !== pwForm.confirm}
                  className="w-full text-sm font-medium text-white bg-gray-900 hover:bg-gray-700 px-4 py-2.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {savingPw ? 'Actualizando...' : 'Guardar nueva contraseña'}
                </button>
              </div>
            </>
          )}
        </div>
      </Section>
    </div>
  )
}
