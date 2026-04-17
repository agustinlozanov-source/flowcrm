import { useState, useEffect } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

// ── Channel card ──────────────────────────────────────────────────────────────
function ChannelCard({ icon, name, description, connected, onConnect, onDisconnect, loading }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-white">
      <div className="flex items-center gap-3">
        <div className="text-2xl">{icon}</div>
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
  const [showWhatsAppOptions, setShowWhatsAppOptions] = useState(false)
  const [whatsappStep, setWhatsappStep] = useState('options')
  const [purchasedNumber, setPurchasedNumber] = useState(null)

  // Load integrations from Firestore
  useEffect(() => {
    if (!orgId) return
    const ref = doc(db, 'organizations', orgId, 'settings', 'integrations')
    getDoc(ref).then(snap => {
      if (snap.exists()) setIntegrations(snap.data())
    })
  }, [orgId])

  // Detect OAuth callback params and show toast
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const channels = ['whatsapp', 'facebook', 'instagram']
    const labels = { whatsapp: 'WhatsApp', facebook: 'Facebook', instagram: 'Instagram' }
    channels.forEach(ch => {
      if (params.get(ch) === 'connected') toast.success(`${labels[ch]} conectado ✓`)
      if (params.get(ch) === 'error') toast.error(`Error al conectar ${labels[ch]}`)
    })
    if (params.toString()) window.history.replaceState({}, '', '/settings')
  }, [])

  const purchaseNumber = async () => {
    setWhatsappStep('verifying')
    try {
      const res = await fetch('https://flowcrm-production-6d63.up.railway.app/whatsapp/purchase-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      })
      const data = await res.json()
      if (!data.success) {
        setWhatsappStep('options')
        toast.error('Error al obtener el número')
        return
      }
      setPurchasedNumber(data.number)

      // Polling cada 3 segundos hasta que Meta verifique (máx 2 min)
      const maxAttempts = 40
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 3000))
        const statusRes = await fetch(
          `https://flowcrm-production-6d63.up.railway.app/whatsapp/number-status/${data.number.id}`
        )
        const statusData = await statusRes.json()
        if (statusData.verified) {
          setWhatsappStep('ready')
          return
        }
      }

      toast.error('La verificación tardó demasiado — intenta de nuevo')
      setWhatsappStep('options')
      setPurchasedNumber(null)
    } catch {
      toast.error('Error al comprar número')
      setWhatsappStep('options')
    }
  }

  const connectNumber = () => {
    setWhatsappStep('connecting')
    window.location.href =
      `https://flowcrm-production-6d63.up.railway.app/whatsapp/connect?orgId=${orgId}&phoneNumberId=${purchasedNumber.id}`
  }

  const connectOwnNumber = () => {
    window.location.href = `https://flowcrm-production-6d63.up.railway.app/whatsapp/connect?orgId=${orgId}`
  }

  const handleDisconnect = async (channel) => {
    setLoadingChannel(channel)
    try {
      const ref = doc(db, 'organizations', orgId, 'settings', 'integrations')
      await setDoc(ref, { [channel]: { connected: false } }, { merge: true })
      setIntegrations(prev => ({ ...prev, [channel]: { ...prev[channel], connected: false } }))
      toast.success('Canal desconectado')
    } catch {
      toast.error('Error al desconectar')
    } finally {
      setLoadingChannel(null)
    }
  }

  const otherChannels = [
    {
      key: 'facebook',
      icon: '💬',
      name: 'Facebook Messenger',
      description: 'Conecta tu página de Facebook para recibir mensajes',
      connectUrl: `https://flowcrm-production-6d63.up.railway.app/facebook/connect?orgId=${orgId}`,
    },
    {
      key: 'instagram',
      icon: '📸',
      name: 'Instagram DM',
      description: 'Recibe mensajes directos de Instagram en tu inbox',
      connectUrl: `https://flowcrm-production-6d63.up.railway.app/instagram/connect?orgId=${orgId}`,
    },
  ]

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900">Configuración</h1>
        <p className="text-sm text-gray-500 mt-1">Gestiona tus canales, integraciones y cuenta</p>
      </div>

      <Section
        title="Canales"
        description="Conecta tus plataformas de mensajería para que el agente pueda recibir y responder mensajes"
      >
        {/* ── WhatsApp — flujo especial ── */}
        <div className="p-4 rounded-xl border border-gray-100 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-2xl">📱</div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">WhatsApp Business</span>
                  {integrations.whatsapp?.connected ? (
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
                <p className="text-xs text-gray-500 mt-0.5">Recibe y responde mensajes de WhatsApp automáticamente</p>
              </div>
            </div>
            {integrations.whatsapp?.connected ? (
              <button
                onClick={() => handleDisconnect('whatsapp')}
                disabled={loadingChannel === 'whatsapp'}
                className="text-xs text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                Desconectar
              </button>
            ) : !showWhatsAppOptions ? (
              <button
                onClick={() => setShowWhatsAppOptions(true)}
                className="text-xs font-medium text-white bg-gray-900 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                Conectar
              </button>
            ) : null}
          </div>

          {/* Panel de opciones */}
          {showWhatsAppOptions && !integrations.whatsapp?.connected && (
            <div style={{ marginTop: 16, padding: 20, background: '#f5f5f7',
              borderRadius: 12, border: '1px solid #e8e8ed' }}>

              {/* ESTADO: opciones iniciales */}
              {whatsappStep === 'options' && (
                <div>
                  <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif",
                    fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Conecta tu WhatsApp Business</div>
                  <div style={{ fontSize: 13, color: '#8e8e93', marginBottom: 16 }}>Necesitas un número dedicado para WhatsApp Business API</div>
                  <div onClick={purchaseNumber}
                    style={{ padding: '16px 20px', background: 'white', borderRadius: 10,
                      border: '2px solid #0066ff', marginBottom: 10, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10,
                        background: 'rgba(0,102,255,0.08)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📱</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>Obtener número US</div>
                        <div style={{ fontSize: 12, color: '#8e8e93' }}>$2/mes · Sin OTP · Verificado automáticamente</div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#0066ff' }}>Recomendado →</div>
                    </div>
                  </div>
                  <div onClick={connectOwnNumber}
                    style={{ padding: '16px 20px', background: 'white', borderRadius: 10,
                      border: '1px solid #e8e8ed', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10,
                        background: '#f5f5f7', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🔢</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>Usar mi propio número</div>
                        <div style={{ fontSize: 12, color: '#8e8e93' }}>Requiere verificación OTP</div>
                      </div>
                      <div style={{ fontSize: 12, color: '#8e8e93' }}>→</div>
                    </div>
                  </div>
                  <button onClick={() => setShowWhatsAppOptions(false)}
                    style={{ marginTop: 12, background: 'none', border: 'none',
                      color: '#8e8e93', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
                </div>
              )}

              {/* ESTADO: verificando con Meta */}
              {whatsappStep === 'verifying' && (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
                  <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Verificando número con Meta</div>
                  {purchasedNumber && (
                    <div style={{ fontSize: 14, color: '#0066ff', fontWeight: 700, marginBottom: 8 }}>
                      {purchasedNumber.phoneNumber}
                    </div>
                  )}
                  <div style={{ fontSize: 13, color: '#8e8e93', marginBottom: 16 }}>Zernio está registrando tu número con Meta</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '10px 20px', background: 'rgba(0,102,255,0.08)',
                    borderRadius: 20, fontSize: 14, fontWeight: 700, color: '#0066ff' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#0066ff' }} />
                    Verificando con Meta...
                  </div>
                </div>
              )}

              {/* ESTADO: listo para conectar */}
              {whatsappStep === 'ready' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10,
                    padding: '14px 16px', background: 'rgba(0,200,83,0.08)',
                    border: '1px solid rgba(0,200,83,0.2)', borderRadius: 10, marginBottom: 16 }}>
                    <span style={{ fontSize: 24 }}>✅</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14, color: '#00a04a' }}>Número verificado con Meta</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#070708', marginTop: 2 }}>{purchasedNumber?.phoneNumber}</div>
                      <div style={{ fontSize: 12, color: '#8e8e93', marginTop: 2 }}>Listo para conectar · Sin OTP requerido</div>
                    </div>
                  </div>
                  <button onClick={connectNumber}
                    style={{ width: '100%', padding: '14px 20px', background: '#0066ff',
                      color: 'white', border: 'none', borderRadius: 10,
                      fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    Conectar {purchasedNumber?.phoneNumber} con WhatsApp →
                  </button>
                  <button onClick={() => { setWhatsappStep('options'); setPurchasedNumber(null) }}
                    style={{ marginTop: 8, width: '100%', padding: '10px',
                      background: 'transparent', border: 'none', color: '#8e8e93', cursor: 'pointer', fontSize: 13 }}>
                    Cancelar
                  </button>
                </div>
              )}

              {/* ESTADO: conectando */}
              {whatsappStep === 'connecting' && (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🔗</div>
                  <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Abriendo WhatsApp Business...</div>
                  <div style={{ fontSize: 13, color: '#8e8e93' }}>Completa el proceso en la ventana de Meta</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Facebook e Instagram — flujo directo ── */}
        {otherChannels.map(ch => (
          <ChannelCard
            key={ch.key}
            icon={ch.icon}
            name={ch.name}
            description={ch.description}
            connected={integrations[ch.key]?.connected || false}
            loading={loadingChannel === ch.key}
            onConnect={() => { window.location.href = ch.connectUrl }}
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
            <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50">
              <svg viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-11V7h2v4h4v2h-6v-2z" fill="#4285F4"/>
                <path d="M12 2a10 10 0 100 20A10 10 0 0012 2z" fill="none" stroke="#4285F4" strokeWidth="0"/>
                <circle cx="12" cy="12" r="10" fill="#fff" opacity="0"/>
              </svg>
            </div>
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
              onClick={() => { window.location.href = `https://flowcrm-production-6d63.up.railway.app/auth/google?orgId=${orgId}` }}
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
        </div>
      </Section>
    </div>
  )
}
