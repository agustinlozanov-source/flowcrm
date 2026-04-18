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
  const [showWhatsAppOptions, setShowWhatsAppOptions] = useState(false)
  const [whatsappStep, setWhatsappStep] = useState('options')
  const [purchasedNumber, setPurchasedNumber] = useState(null)
  const [assignedNumber, setAssignedNumber] = useState(null) // { phoneNumber, metaPreverifiedId }

  const RAILWAY = 'https://flowcrm-production-6d63.up.railway.app'

  const whatsappConnected = integrations?.whatsapp?.connected === true

  // Load integrations from Firestore
  useEffect(() => {
    if (!orgId) return
    const ref = doc(db, 'organizations', orgId, 'settings', 'integrations')
    getDoc(ref).then(snap => {
      if (snap.exists()) {
        const data = snap.data()
        setIntegrations(data)
        // Flujo legado (pendingNumberId)
        if (data?.whatsapp?.pendingNumberId && !data?.whatsapp?.connected) {
          setPurchasedNumber({
            id: data.whatsapp.pendingNumberId,
            phoneNumber: data.whatsapp.pendingPhoneNumber,
          })
          setWhatsappStep('ready')
          setShowWhatsAppOptions(true)
        }
        // Flujo nuevo (assignedNumber por admin)
        if (data?.whatsapp?.assignedNumber && !data?.whatsapp?.connected) {
          setAssignedNumber({
            phoneNumber: data.whatsapp.assignedNumber,
            metaPreverifiedId: data.whatsapp.metaPreverifiedId,
          })
        }
      }
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

  const connectEmbedded = async () => {
    setWhatsappStep('loading_sdk')
    try {
      // 1. Obtener sdk-config del backend (appId, configId, metaPreverifiedId)
      const configRes = await fetch(`${RAILWAY}/whatsapp/sdk-config?orgId=${orgId}`)
      const configData = await configRes.json()
      if (!configRes.ok) throw new Error(configData.error || 'Error al obtener configuración')
      const { appId, configId, metaPreverifiedId } = configData

      // 2. Cargar FB SDK si no está cargado
      await new Promise((resolve, reject) => {
        if (window.FB) return resolve()
        const script = document.createElement('script')
        script.src = 'https://connect.facebook.net/en_US/sdk.js'
        script.onload = () => {
          window.FB.init({ appId, cookie: true, xfbml: false, version: 'v22.0' })
          resolve()
        }
        script.onerror = reject
        document.body.appendChild(script)
      })

      // 3. Escuchar postMessage para capturar wabaId y phoneNumberId
      let wabaId = null
      let phoneNumberId = null
      const messageHandler = (e) => {
        if (!e.origin.includes('facebook.com')) return
        try {
          const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
          if (data?.type === 'WA_EMBEDDED_SIGNUP') {
            wabaId = data.data?.waba_id
            phoneNumberId = data.data?.phone_number_id
          }
        } catch {}
      }
      window.addEventListener('message', messageHandler)

      // 4. Lanzar FB.login
      setWhatsappStep('popup')
      window.FB.login(async (response) => {
        window.removeEventListener('message', messageHandler)
        if (!response?.authResponse?.code) {
          setWhatsappStep('assigned')
          return
        }
        // 5. Completar signup en backend
        setWhatsappStep('completing')
        try {
          const signupRes = await fetch(`${RAILWAY}/whatsapp/embedded-signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orgId, code: response.authResponse.code, wabaId, phoneNumberId }),
          })
          const signupData = await signupRes.json()
          if (!signupRes.ok) throw new Error(signupData.error || 'Error al conectar')
          // Actualizar estado local
          setIntegrations(prev => ({ ...prev, whatsapp: { ...prev.whatsapp, connected: true } }))
          setShowWhatsAppOptions(false)
          toast.success('¡WhatsApp conectado exitosamente! 🎉')
        } catch (err) {
          toast.error(err.message)
          setWhatsappStep('assigned')
        }
      }, {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {
            preVerifiedPhone: { ids: [metaPreverifiedId] }
          }
        }
      })
    } catch (err) {
      toast.error(err.message)
      setWhatsappStep('options')
    }
  }

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
    window.open(
      `https://flowcrm-production-6d63.up.railway.app/whatsapp/connect?orgId=${orgId}&phoneNumberId=${purchasedNumber.id}`,
      '_blank'
    )
    setTimeout(() => setWhatsappStep('ready'), 2000)
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
      icon: '/icons/Facebook Icon.png',
      name: 'Facebook Messenger',
      description: 'Conecta tu página de Facebook para recibir mensajes',
      connectUrl: `https://flowcrm-production-6d63.up.railway.app/facebook/connect?orgId=${orgId}`,
    },
    {
      key: 'instagram',
      icon: '/icons/Instagram Icon.png',
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
              <img src="/icons/WhatsApp Icon.png" alt="WhatsApp" style={{ width: 36, height: 36, objectFit: 'contain', flexShrink: 0 }} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">WhatsApp Business</span>
                  {whatsappConnected ? (
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
            {whatsappConnected ? (
              <button
                onClick={() => handleDisconnect('whatsapp')}
                disabled={loadingChannel === 'whatsapp'}
                className="text-xs text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                Desconectar
              </button>
            ) : !showWhatsAppOptions ? (
              <button
                onClick={() => {
                  setShowWhatsAppOptions(true)
                  if (assignedNumber) setWhatsappStep('assigned')
                  else setWhatsappStep('options')
                }}
                className="text-xs font-medium text-white bg-gray-900 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                Conectar
              </button>
            ) : null}
          </div>

          {/* Panel de opciones */}
          {showWhatsAppOptions && !whatsappConnected && (
            <div style={{ marginTop: 16, padding: 20, background: '#f5f5f7',
              borderRadius: 12, border: '1px solid #e8e8ed' }}>

              {/* ESTADO: opciones iniciales */}
              {whatsappStep === 'options' && (
                <div>
                  <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif",
                    fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Conecta tu WhatsApp Business</div>
                  <div style={{ fontSize: 13, color: '#8e8e93', marginBottom: 16 }}>Necesitas un número dedicado para WhatsApp Business API</div>

                  {/* Opción A: número ya asignado por admin */}
                  {assignedNumber ? (
                    <div onClick={() => setWhatsappStep('assigned')}
                      style={{ padding: '16px 20px', background: 'white', borderRadius: 10,
                        border: '2px solid #25d366', marginBottom: 10, cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <img src="/icons/WhatsApp Icon.png" alt="WhatsApp" style={{ width: 40, height: 40, objectFit: 'contain' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>Número listo: {assignedNumber.phoneNumber}</div>
                          <div style={{ fontSize: 12, color: '#8e8e93' }}>Sin OTP · Verificado · Conectar en 1 clic</div>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#25d366' }}>Conectar →</div>
                      </div>
                    </div>
                  ) : (
                    <div onClick={purchaseNumber}
                      style={{ padding: '16px 20px', background: 'white', borderRadius: 10,
                        border: '2px solid #0066ff', marginBottom: 10, cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <img src="/icons/WhatsApp Icon.png" alt="WhatsApp" style={{ width: 40, height: 40, objectFit: 'contain' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>Obtener número US</div>
                          <div style={{ fontSize: 12, color: '#8e8e93' }}>$2/mes · Sin OTP · Verificado automáticamente</div>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#0066ff' }}>Recomendado →</div>
                      </div>
                    </div>
                  )}

                  <div onClick={connectOwnNumber}
                    style={{ padding: '16px 20px', background: 'white', borderRadius: 10,
                      border: '1px solid #e8e8ed', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10,
                        background: '#f5f5f7', display: 'flex',
                        alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 18 }}>🔢</span>
                      </div>
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

              {/* ESTADO: número asignado por admin — listo para conectar via embedded signup */}
              {whatsappStep === 'assigned' && assignedNumber && (
                <div>
                  <div style={{ padding: '14px 16px', background: 'rgba(37,211,102,0.08)',
                    border: '1px solid rgba(37,211,102,0.25)', borderRadius: 10, marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, fontSize: 13, color: '#1a7f37', marginBottom: 4 }}>
                      <img src="/icons/WhatsApp Icon.png" alt="WhatsApp" style={{ width: 20, height: 20, objectFit: 'contain' }} />
                      Número reservado para ti
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#070708' }}>
                      {assignedNumber.phoneNumber}
                    </div>
                    <div style={{ fontSize: 12, color: '#8e8e93', marginTop: 2 }}>
                      Verificado · Sin OTP · Solo necesitas tu cuenta de Facebook Business
                    </div>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
                      Qué va a pasar:
                    </div>
                    {[
                      'Se abrirá una ventana de Meta',
                      'Inicia sesión con tu cuenta de Facebook Business',
                      'Selecciona o crea tu cuenta de WhatsApp Business',
                      `El número ${assignedNumber.phoneNumber} aparece pre-seleccionado — sin OTP`,
                      'Acepta permisos y cierra la ventana',
                    ].map((step, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#25d366',
                          color: 'white', fontSize: 11, fontWeight: 800, display: 'flex',
                          alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {i + 1}
                        </div>
                        <div style={{ fontSize: 13, color: '#3a3a3c', lineHeight: 1.5 }}>{step}</div>
                      </div>
                    ))}
                  </div>

                  <button onClick={connectEmbedded}
                    style={{ width: '100%', padding: '14px 20px', background: '#25d366',
                      color: 'white', border: 'none', borderRadius: 10,
                      fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    Conectar WhatsApp →
                  </button>

                  <button onClick={() => setWhatsappStep('options')}
                    style={{ marginTop: 8, width: '100%', padding: '10px',
                      background: 'transparent', border: 'none',
                      color: '#8e8e93', cursor: 'pointer', fontSize: 13 }}>
                    Volver
                  </button>
                </div>
              )}

              {/* ESTADO: cargando FB SDK */}
              {whatsappStep === 'loading_sdk' && (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>⚙️</div>
                  <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Preparando conexión...</div>
                  <div style={{ fontSize: 13, color: '#8e8e93' }}>Cargando configuración de Meta</div>
                </div>
              )}

              {/* ESTADO: popup abierto */}
              {whatsappStep === 'popup' && (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🔗</div>
                  <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Ventana de Meta abierta</div>
                  <div style={{ fontSize: 13, color: '#8e8e93' }}>Completa el proceso en la ventana de Facebook</div>
                </div>
              )}

              {/* ESTADO: completando signup */}
              {whatsappStep === 'completing' && (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
                  <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Activando WhatsApp...</div>
                  <div style={{ fontSize: 13, color: '#8e8e93' }}>Configurando tu canal en Flow Hub</div>
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
                  <div style={{ padding: '14px 16px', background: 'rgba(0,200,83,0.08)',
                    border: '1px solid rgba(0,200,83,0.2)', borderRadius: 10, marginBottom: 16 }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#00a04a', marginBottom: 4 }}>
                      ✅ Número asignado y verificado
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#070708' }}>
                      {purchasedNumber?.phoneNumber}
                    </div>
                    <div style={{ fontSize: 12, color: '#8e8e93', marginTop: 2 }}>
                      Guarda este número — lo necesitarás en el siguiente paso
                    </div>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
                      Cómo conectar tu WhatsApp Business:
                    </div>
                    {[
                      'Se abrirá una ventana de Meta en nueva pestaña',
                      'Inicia sesión con tu cuenta de Facebook',
                      'Selecciona tu Portfolio comercial',
                      'En "Cuenta de WhatsApp Business" → elige "Crear una cuenta nueva"',
                      `En el paso de número → selecciona ${purchasedNumber?.phoneNumber} — ya aparece como Verificado`,
                      'Completa el proceso y cierra la ventana de Meta',
                    ].map((step, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#0066ff',
                          color: 'white', fontSize: 11, fontWeight: 800, display: 'flex',
                          alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {i + 1}
                        </div>
                        <div style={{ fontSize: 13, color: '#3a3a3c', lineHeight: 1.5 }}>{step}</div>
                      </div>
                    ))}
                  </div>

                  <button onClick={connectNumber}
                    style={{ width: '100%', padding: '14px 20px', background: '#0066ff',
                      color: 'white', border: 'none', borderRadius: 10,
                      fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    Conectar {purchasedNumber?.phoneNumber} con WhatsApp →
                  </button>

                  <button onClick={() => { setWhatsappStep('options'); setPurchasedNumber(null) }}
                    style={{ marginTop: 8, width: '100%', padding: '10px',
                      background: 'transparent', border: 'none',
                      color: '#8e8e93', cursor: 'pointer', fontSize: 13 }}>
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
              onClick={() => { window.location.href = `https://flowcrm-production-6d63.up.railway.app/meetings/auth/google?orgId=${orgId}&redirect=settings` }}
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
