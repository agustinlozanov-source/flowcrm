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
  const [purchasingNumber, setPurchasingNumber] = useState(false)
  const [purchasedNumber, setPurchasedNumber] = useState(null)
  const [connectingNumber, setConnectingNumber] = useState(false)
  const [connectingSeconds, setConnectingSeconds] = useState(35)

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
    setPurchasingNumber(true)
    try {
      const res = await fetch('https://flowcrm-production-6d63.up.railway.app/whatsapp/purchase-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      })
      const data = await res.json()
      if (data.success) {
        setPurchasedNumber(data.number)
        toast.success(`Número ${data.number.phoneNumber} asignado ✓`)
      } else {
        toast.error('Error al obtener el número')
      }
    } catch {
      toast.error('Error al comprar número')
    } finally {
      setPurchasingNumber(false)
    }
  }

  const connectPurchasedNumber = async () => {
    setConnectingNumber(true)
    for (let i = 35; i > 0; i--) {
      setConnectingSeconds(i)
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
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
            <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">

              {/* PASO 2 — Número ya comprado */}
              {purchasedNumber ? (
                <div>
                  <div className="flex items-center gap-3 mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <span className="text-xl">✓</span>
                    <div>
                      <div className="text-sm font-bold text-emerald-700">Número asignado: {purchasedNumber.phoneNumber}</div>
                      <div className="text-xs text-gray-500">Pre-verificado con Meta · Listo para conectar</div>
                    </div>
                  </div>
                  <button
                    onClick={connectPurchasedNumber}
                    disabled={connectingNumber}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-70"
                  >
                    {connectingNumber ? `Verificando con Meta... ${connectingSeconds}s` : 'Conectar con WhatsApp →'}
                  </button>
                  {!connectingNumber && (
                    <button
                      onClick={() => setPurchasedNumber(null)}
                      className="mt-2 w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              ) : (
                /* PASO 1 — Elegir opción */
                <div>
                  <p className="text-sm font-bold text-gray-900 mb-0.5">Conecta tu WhatsApp Business</p>
                  <p className="text-xs text-gray-500 mb-4">Necesitas un número dedicado para WhatsApp Business API</p>

                  {/* Opción A — Comprar número */}
                  <div
                    onClick={!purchasingNumber ? purchaseNumber : undefined}
                    className={`flex items-center gap-3 p-4 bg-white rounded-xl border-2 border-blue-500 mb-3 cursor-pointer transition-opacity ${purchasingNumber ? 'opacity-60 pointer-events-none' : 'hover:bg-blue-50'}`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-xl flex-shrink-0">📱</div>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-gray-900">
                        {purchasingNumber ? 'Comprando número...' : 'Obtener número US'}
                      </div>
                      <div className="text-xs text-gray-500">$2/mes · Verificado con Meta · Sin OTP</div>
                    </div>
                    <span className="text-xs font-bold text-blue-600 flex-shrink-0">Recomendado →</span>
                  </div>

                  {/* Opción B — Número propio */}
                  <div
                    onClick={connectOwnNumber}
                    className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-xl flex-shrink-0">🔢</div>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-gray-900">Usar mi propio número</div>
                      <div className="text-xs text-gray-500">Conecta un número existente · Requiere verificación OTP</div>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">→</span>
                  </div>

                  <button
                    onClick={() => setShowWhatsAppOptions(false)}
                    className="mt-3 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Cancelar
                  </button>
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
