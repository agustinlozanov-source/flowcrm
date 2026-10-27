import { useState, useEffect, useRef } from 'react'
import { doc, getDoc, setDoc, onSnapshot, collection, query, orderBy, limit } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, auth, storage } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { REGIMENES, USOS_CFDI, rfcValido, normalizarRfc, faltaParaFacturar } from '@/lib/fiscal'

/* El historial de cobros: una línea por pago.
 *
 * El pago y su factura vivían separados —el recibo de Stripe por un lado, el
 * CFDI por otro— y para el cliente eso son dos listas que tiene que cruzar a
 * mano. Lo que él quiere saber es una sola cosa: qué le cobraron, cuándo, por
 * qué periodo, y dónde está el papel.
 *
 * Los archivos no se guardan de nuestro lado: el recibo lo sirve Stripe y el
 * CFDI se le pide al PAC al descargar. Ya viven ahí y nunca cambian.
 */
function HistorialDeCobros({ orgId }) {
  const [recibos, setRecibos] = useState([])
  const [facturas, setFacturas] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!orgId) return
    const sub = (nombre, set) => onSnapshot(
      query(collection(db, 'organizations', orgId, nombre), orderBy('createdAt', 'desc'), limit(24)),
      snap => { set(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setCargando(false) },
      e => { console.error(`[${nombre}]`, e); setCargando(false) },
    )
    const a = sub('billing_receipts', setRecibos)
    const b = sub('facturas', setFacturas)
    return () => { a(); b() }
  }, [orgId])

  if (cargando || recibos.length === 0) return null

  // La factura se encuentra por el cobro de Stripe que la originó.
  const facturaDe = id => facturas.find(f => f.stripeInvoiceId === id)

  const fecha = v => {
    const d = v?.toDate?.() || (v ? new Date(v) : null)
    return d ? d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
  }

  const bajar = (f, formato) =>
    `/.netlify/functions/factura-descargar?orgId=${orgId}&facturaId=${f.facturapiId}&formato=${formato}`

  return (
    <Section title="Historial de cobros" description="Qué te cobramos, cuándo, y el comprobante de cada uno">
      <div className="rounded-xl border border-gray-100 bg-white divide-y divide-gray-50">
        {recibos.map(r => {
          const f = facturaDe(r.invoiceId)
          return (
            <div key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-gray-900">
                  ${Number(r.amountPaid || 0).toLocaleString('es-MX')} {r.currency || 'MXN'}
                  {f?.prueba && <span className="ml-2 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">PRUEBA</span>}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {fecha(r.createdAt)}
                  {r.periodStart && r.periodEnd && ` · cubre ${fecha(r.periodStart)} – ${fecha(r.periodEnd)}`}
                </div>
              </div>

              {r.hostedUrl && (
                <a href={r.hostedUrl} target="_blank" rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                  Recibo
                </a>
              )}

              {f ? (
                <>
                  <a href={bajar(f, 'pdf')} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                    Factura PDF
                  </a>
                  <a href={bajar(f, 'xml')} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                    XML
                  </a>
                </>
              ) : (
                /* Decir por qué no está, en vez de dejar un hueco. Casi siempre
                   es que faltaban datos fiscales cuando se cobró. */
                <span className="text-[11px] text-amber-700">Factura pendiente</span>
              )}
            </div>
          )
        })}
      </div>
    </Section>
  )
}

/* Los datos fiscales del cliente, capturados por él mismo.
 *
 * En CFDI 4.0 el RFC, el régimen, el código postal y la razón social del
 * receptor tienen que coincidir EXACTAMENTE con lo que el SAT tiene
 * registrado, o el timbrado se rechaza. Por eso los captura el cliente
 * mirando su Constancia de Situación Fiscal, y no nosotros de oído por
 * teléfono: un acento o una abreviatura de más y la factura no sale.
 */
function DatosFiscales({ org, orgId }) {
  const [f, setF] = useState({
    rfc: '', razonSocial: '', regimen: '', cp: '', usoCfdi: 'G03',
    ...(org?.fiscal || {}),
  })
  const [guardando, setGuardando] = useState(false)

  /* Lo último que se guardó, para saber si hay cambios.
   *
   * No se compara contra `org.fiscal` directo: ese dato viene del estado de
   * la aplicación y puede no haberse refrescado justo después de guardar, así
   * que el botón se quedaría encendido como si faltara algo. La referencia la
   * movemos nosotros al guardar con éxito. */
  const [base, setBase] = useState(org?.fiscal || {})
  useEffect(() => {
    if (org?.fiscal) { setF(v => ({ ...v, ...org.fiscal })); setBase(org.fiscal) }
  }, [org?.fiscal])

  const rfcMal = f.rfc && !rfcValido(f.rfc)
  /* Lo que importa es lo GUARDADO, no lo escrito.
   *
   * Antes el "✓ Listo" se calculaba sobre el formulario, así que aparecía en
   * cuanto terminabas de teclear — y quien cerraba sin guardar se iba creyendo
   * que ya estaba. */
  const CAMPOS = ['rfc', 'razonSocial', 'regimen', 'cp', 'usoCfdi']
  const falta = faltaParaFacturar(base)
  const sinGuardar = CAMPOS.some(k => (f[k] || '') !== (base[k] || ''))

  const guardar = async () => {
    if (rfcMal) return toast.error('El RFC no tiene una forma válida')
    setGuardando(true)
    try {
      const limpio = { ...f, rfc: normalizarRfc(f.rfc) }
      await setDoc(doc(db, 'organizations', orgId),
        { fiscal: { ...limpio, actualizadoEn: new Date().toISOString() } },
        { merge: true })
      setF(limpio)
      setBase(limpio)
      toast.success('Datos fiscales guardados')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setGuardando(false)
    }
  }

  const campo = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-400'
  const etiqueta = 'block text-xs font-medium text-gray-500 mb-1.5'

  return (
    <Section title="Datos de facturación" description="Para poder emitirte tu factura (CFDI)">
      <div className="p-4 rounded-xl border border-gray-100 bg-white space-y-4">
        <p className="text-xs text-gray-500">
          Con estos datos te emitimos tu factura automáticamente cada vez que pagas, y te
          llega a tu correo. Cópialos tal cual de tu <b>Constancia de Situación Fiscal</b>:
          si alguno no coincide con lo que tiene el SAT, la factura no se puede emitir.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={etiqueta}>RFC</label>
            <input className={clsx(campo, rfcMal && 'border-red-400')} value={f.rfc}
              onChange={e => setF(v => ({ ...v, rfc: e.target.value.toUpperCase() }))}
              placeholder="XAXX010101000" maxLength={13} />
            {rfcMal && <div className="text-[11px] text-red-600 mt-1">Son 12 caracteres para empresa, 13 para persona física.</div>}
          </div>
          <div>
            <label className={etiqueta}>Código postal fiscal</label>
            <input className={campo} value={f.cp} inputMode="numeric" maxLength={5}
              onChange={e => setF(v => ({ ...v, cp: e.target.value.replace(/\D/g, '') }))}
              placeholder="87300" />
          </div>
        </div>

        <div>
          <label className={etiqueta}>Razón social o nombre</label>
          <input className={campo} value={f.razonSocial}
            onChange={e => setF(v => ({ ...v, razonSocial: e.target.value }))}
            placeholder="Como aparece en tu constancia, sin S.A. de C.V." />
          <div className="text-[11px] text-gray-400 mt-1">Sin el régimen de capital: va "MI EMPRESA", no "MI EMPRESA SA DE CV".</div>
        </div>

        <div>
          <label className={etiqueta}>Régimen fiscal</label>
          <select className={campo} value={f.regimen} onChange={e => setF(v => ({ ...v, regimen: e.target.value }))}>
            <option value="">Elige el tuyo</option>
            {REGIMENES.map(r => <option key={r.clave} value={r.clave}>{r.clave} — {r.nombre}</option>)}
          </select>
        </div>

        <div>
          <label className={etiqueta}>Uso de la factura</label>
          <select className={campo} value={f.usoCfdi} onChange={e => setF(v => ({ ...v, usoCfdi: e.target.value }))}>
            {USOS_CFDI.map(u => <option key={u.clave} value={u.clave}>{u.clave} — {u.nombre}</option>)}
          </select>
          <div className="text-[11px] text-gray-400 mt-1">Si no sabes cuál, "Gastos en general" es lo habitual.</div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-gray-400">
            {sinGuardar
              ? '⚠︎ Tienes cambios sin guardar'
              : falta.length === 0
                ? '✓ Listo — tus facturas llegarán a tu correo al pagar'
                : `Falta: ${falta.join(', ')}`}
          </span>
          {/* Vivo solo cuando hay algo que guardar. Un botón siempre
              encendido no distingue "falta guardar" de "ya está", que es
              justo lo que hay que saber de un vistazo. */}
          <button onClick={guardar} disabled={guardando || !sinGuardar}
            className={clsx('px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
              sinGuardar && !guardando
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-400 cursor-default')}>
            {guardando ? 'Guardando…' : sinGuardar ? 'Guardar' : 'Guardado'}
          </button>
        </div>
      </div>
    </Section>
  )
}

/* Suscripción, vista por el propio cliente.
 *
 * Antes el enlace de pago se generaba en el Superadmin y viajaba por
 * WhatsApp, así que el cliente no tenía dónde ver qué plan tiene, cuánto
 * lleva consumido ni cuándo le toca pagar — y para cambiar su tarjeta había
 * que pedírselo a mano.
 *
 * Lo que toca dinero —tarjeta, facturas, historial— no se construye aquí: se
 * manda al portal que aloja Stripe. Hacerlo a mano obligaría a guardar datos
 * de tarjeta de nuestro lado, que es exactamente lo que no queremos.
 */
function Suscripcion({ org, orgId }) {
  const [plan, setPlan] = useState(null)
  const [abriendo, setAbriendo] = useState(false)

  useEffect(() => {
    if (!org?.planId) return
    getDoc(doc(db, 'plans', org.planId)).then(d => d.exists() && setPlan(d.data()))
  }, [org?.planId])

  const abrirPortal = async () => {
    setAbriendo(true)
    try {
      const res = await fetch('/.netlify/functions/stripe-billing-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'portal', orgId }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      window.location.href = data.url
    } catch (e) {
      toast.error(e.message)
      setAbriendo(false)
    }
  }

  const consumo = org?.consumo || {}
  const usados = consumo.leads ?? 0
  const incluidos = consumo.incluidos ?? null
  const pct = incluidos ? Math.min(100, Math.round((usados / incluidos) * 100)) : null
  const pasado = incluidos && usados > incluidos
  const cerca = pct !== null && pct >= 80 && !pasado

  const faltaFiscal = faltaParaFacturar(org?.fiscal || {})
  const moneda = (org?.currency || 'MXN').toUpperCase()
  const precio = moneda === 'USD' ? plan?.monthlyUSD : plan?.monthlyMXN
  // Una suscripción está activa si Stripe dice que lo está, tenga o no su id
  // guardado. El id lo escribe el webhook del checkout, que a veces no llega;
  // el estado lo escribe el del pago, que sí. Mirar solo el id dejaba a un
  // cliente que ya había pagado viendo el botón de "Activar mi suscripción".
  const activa = Boolean(org?.stripeSubscriptionId) || org?.stripeSubscriptionStatus === 'active'

  const fecha = org?.nextBillingDate
    ? new Date(org.nextBillingDate).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <Section title="Suscripción" description="Tu plan, tu consumo y tu facturación">
      <div className="p-4 rounded-xl border border-gray-100 bg-white space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-sm font-semibold text-gray-900">{plan?.name || org?.planName || 'Sin plan'}</div>
            {precio > 0 && (
              <div className="text-xs text-gray-500 mt-0.5">
                ${Number(precio).toLocaleString('es-MX')} {moneda} / mes
              </div>
            )}
          </div>
          <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${activa ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
            {activa ? 'Activa' : 'Sin activar'}
          </span>
        </div>

        {/* El consumo lo escribe la tarea diaria; si nunca ha corrido para
            esta organización, no se inventa un número. */}
        {incluidos !== null && (
          <div>
            <div className="flex justify-between items-baseline mb-1.5">
              <span className="text-xs text-gray-500">Leads este mes</span>
              <span className={`text-sm font-semibold ${pasado ? 'text-red-600' : cerca ? 'text-amber-600' : 'text-gray-900'}`}>
                {usados.toLocaleString('es-MX')} / {incluidos.toLocaleString('es-MX')}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className={`h-full rounded-full ${pasado ? 'bg-red-500' : cerca ? 'bg-amber-500' : 'bg-green-500'}`}
                style={{ width: `${pct}%` }} />
            </div>
            {pasado && (
              <div className="text-[11px] text-red-600 mt-1.5">
                Llevas {(usados - incluidos).toLocaleString('es-MX')} leads por encima de tu plan.
              </div>
            )}
          </div>
        )}

        {fecha && activa && (
          <div className="flex justify-between items-center pt-1">
            <span className="text-xs text-gray-500">Próximo cobro</span>
            <span className="text-sm text-gray-900">{fecha}</span>
          </div>
        )}

        {/* Avisarle ANTES de pagar, no después.
            Sin datos fiscales el pago entra igual pero la factura queda
            pendiente, y él no tiene cómo saber por qué. */}
        {faltaFiscal.length > 0 && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
            <div className="text-xs font-semibold text-amber-900 mb-0.5">
              Para que te llegue tu factura, completa tus datos de facturación
            </div>
            <div className="text-[11px] text-amber-800">
              Te falta: {faltaFiscal.join(', ')}. Están aquí abajo, en “Datos de facturación”.
            </div>
          </div>
        )}

        <div className="pt-1">
          {activa ? (
            <button onClick={abrirPortal} disabled={abriendo}
              className="w-full px-4 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-semibold disabled:opacity-50">
              {abriendo ? 'Abriendo…' : 'Gestionar mi facturación'}
            </button>
          ) : org?.stripeCheckoutUrl ? (
            <a href={org.stripeCheckoutUrl} target="_blank" rel="noreferrer"
              className="block w-full px-4 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-semibold text-center">
              Activar mi suscripción
            </a>
          ) : (
            <div className="text-xs text-gray-400 text-center py-2">
              Tu suscripción todavía no está configurada. Escríbenos y la activamos.
            </div>
          )}
          {activa && (
            <div className="text-[11px] text-gray-400 mt-2 text-center">
              Cambia tu tarjeta, descarga tus facturas y revisa tu historial.
            </div>
          )}
        </div>
      </div>
    </Section>
  )
}

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
  const { org, user, memberData } = useAuthStore()
  const orgId = org?.id

  const [integrations, setIntegrations] = useState({})
  const [loadingChannel, setLoadingChannel] = useState(null)
  const [timezone, setTimezone] = useState(org?.timezone || 'America/Mexico_City')
  const [savingTimezone, setSavingTimezone] = useState(false)

  /* Perfil y empresa.
   *
   * El perfil vive en el documento del miembro dentro de la organización, que
   * es de donde ya lee el resto del sistema el nombre y el rol. La empresa, en
   * el documento de la organización.
   */
  const [perfil, setPerfil] = useState({ name: '', email: '', phone: '', address: '', photoURL: '' })
  const [empresa, setEmpresa] = useState({ name: '', address: '', phone: '', website: '' })
  const [guardandoPerfil, setGuardandoPerfil] = useState(false)
  const [guardandoEmpresa, setGuardandoEmpresa] = useState(false)
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const fotoRef = useRef(null)

  const subirFoto = async (file) => {
    if (!file.type.startsWith('image/')) { toast.error('Tiene que ser una imagen'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error('La imagen supera los 5 MB'); return }
    setSubiendoFoto(true)
    try {
      // Un nombre fijo por usuario: cambiar la foto reemplaza la anterior en
      // vez de ir dejando archivos sueltos para siempre.
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const r = storageRef(storage, `organizations/${orgId}/members/${user.uid}/foto.${ext}`)
      await uploadBytes(r, file)
      const url = await getDownloadURL(r)
      setPerfil(p => ({ ...p, photoURL: url }))
      toast.success('Foto lista — tocá Guardar perfil')
    } catch {
      toast.error('No se pudo subir la foto')
    } finally {
      setSubiendoFoto(false)
    }
  }

  useEffect(() => {
    setPerfil({
      name: memberData?.name || user?.displayName || '',
      email: memberData?.email || user?.email || '',
      phone: memberData?.phone || '',
      address: memberData?.address || '',
      photoURL: memberData?.photoURL || user?.photoURL || '',
    })
  }, [memberData, user])

  useEffect(() => {
    setEmpresa({
      name: org?.name || '',
      address: org?.address || '',
      phone: org?.phone || '',
      website: org?.website || '',
    })
  }, [org])

  const guardarPerfil = async () => {
    if (!orgId || !user?.uid) return
    setGuardandoPerfil(true)
    try {
      await setDoc(doc(db, 'organizations', orgId, 'members', user.uid), perfil, { merge: true })
      toast.success('Perfil guardado')
    } catch { toast.error('No se pudo guardar el perfil') }
    finally { setGuardandoPerfil(false) }
  }

  const guardarEmpresa = async () => {
    if (!orgId) return
    setGuardandoEmpresa(true)
    try {
      await setDoc(doc(db, 'organizations', orgId), empresa, { merge: true })
      toast.success('Datos de la empresa guardados')
    } catch { toast.error('No se pudieron guardar') }
    finally { setGuardandoEmpresa(false) }
  }

  // Agendas de Google: se cargan bajo demanda, solo si está conectado.
  const [calendars, setCalendars] = useState([])
  const [loadingCalendars, setLoadingCalendars] = useState(false)
  const [savingCalendar, setSavingCalendar] = useState(false)

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

  // Traer las agendas de la cuenta conectada. Una cuenta de Google puede
  // tener varias y hay que decirle a cuál agendar.
  useEffect(() => {
    if (!orgId || !integrations.googleCalendar?.connected) { setCalendars([]); return }
    let alive = true
    setLoadingCalendars(true)
    fetch('/.netlify/functions/google-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list-calendars', orgId }),
    })
      .then(r => r.json())
      .then(d => { if (alive && d.calendars) setCalendars(d.calendars) })
      .catch(() => {})
      .finally(() => { if (alive) setLoadingCalendars(false) })
    return () => { alive = false }
  }, [orgId, integrations.googleCalendar?.connected])

  const handleSelectCalendar = async (calendarId) => {
    const cal = calendars.find(c => c.id === calendarId)
    setSavingCalendar(true)
    try {
      const res = await fetch('/.netlify/functions/google-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-calendar', orgId, calendarId, calendarName: cal?.name || '' }),
      })
      if (!res.ok) throw new Error('fallo')
      toast.success(`Las citas se agendarán en «${cal?.name || calendarId}»`)
    } catch {
      toast.error('No se pudo cambiar la agenda')
    } finally {
      setSavingCalendar(false)
    }
  }

  // Detect OAuth callback params and show toast
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const channelKeys = ['whatsapp', 'facebook', 'instagram']
    const labels = { whatsapp: 'WhatsApp', facebook: 'Facebook', instagram: 'Instagram' }
    channelKeys.forEach(ch => {
      if (params.get(ch) === 'connected') toast.success(`${labels[ch]} conectado ✓`)
      if (params.get(ch) === 'error') {
        const msg = params.get('msg')
        toast.error(msg ? `${labels[ch]}: ${msg}` : `Error al conectar ${labels[ch]}`)
      }
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
        title="Mi perfil"
        description="Cómo te ve el resto del equipo"
      >
        <div className="p-4 rounded-xl border border-gray-100 bg-white flex flex-col gap-3">
          <div className="flex items-center gap-3">
            {perfil.photoURL
              ? <img src={perfil.photoURL} alt="" className="w-14 h-14 rounded-full object-cover flex-shrink-0" />
              : <div className="w-14 h-14 rounded-full bg-gray-900 text-white flex items-center justify-center text-lg font-bold flex-shrink-0">
                  {(perfil.name || user?.email || '?')[0]?.toUpperCase()}
                </div>}
            <div className="flex-1 min-w-0">
              <label className="block text-xs text-gray-500 mb-1">Foto de perfil</label>
              <input
                ref={fotoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) subirFoto(f); e.target.value = '' }}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fotoRef.current?.click()}
                  disabled={subiendoFoto}
                  className="text-xs font-medium border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg disabled:opacity-50"
                >
                  {subiendoFoto ? 'Subiendo…' : perfil.photoURL ? 'Cambiar foto' : 'Subir foto'}
                </button>
                {perfil.photoURL && (
                  <button
                    onClick={() => setPerfil(p => ({ ...p, photoURL: '' }))}
                    className="text-xs text-red-600 hover:text-red-700 px-2 py-1.5"
                  >
                    Quitar
                  </button>
                )}
              </div>
              <p className="text-[10.5px] text-gray-400 mt-1">JPG o PNG, hasta 5 MB. Se guarda al tocar Guardar perfil.</p>
            </div>
          </div>

          {[
            { k: 'name', label: 'Nombre completo', ph: 'Nombre y apellido' },
            { k: 'email', label: 'Correo', ph: 'nombre@empresa.com', type: 'email' },
            { k: 'phone', label: 'Teléfono', ph: '52 55 1234 5678' },
            { k: 'address', label: 'Dirección', ph: 'Calle, número, ciudad' },
          ].map(c => (
            <div key={c.k} className="flex items-center justify-between gap-3">
              <label className="text-sm text-gray-700 flex-shrink-0 w-36">{c.label}</label>
              <input
                type={c.type || 'text'}
                value={perfil[c.k]}
                onChange={e => setPerfil(p => ({ ...p, [c.k]: e.target.value }))}
                placeholder={c.ph}
                className="flex-1 min-w-0 text-xs border border-gray-200 rounded-lg px-2 py-1.5"
              />
            </div>
          ))}

          <button
            onClick={guardarPerfil}
            disabled={guardandoPerfil}
            className="self-end text-xs font-medium text-white bg-gray-900 hover:bg-gray-700 px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            {guardandoPerfil ? 'Guardando…' : 'Guardar perfil'}
          </button>
        </div>
      </Section>

      <Section
        title="Mi empresa"
        description="Estos datos aparecen en el sistema y en lo que se le muestra al cliente"
      >
        <div className="p-4 rounded-xl border border-gray-100 bg-white flex flex-col gap-3">
          {[
            { k: 'name', label: 'Nombre de la empresa', ph: 'Como la conocen tus clientes' },
            { k: 'address', label: 'Dirección', ph: 'Calle, número, colonia, ciudad' },
            { k: 'phone', label: 'Teléfono', ph: '(868) 813 2110' },
            { k: 'website', label: 'Sitio web', ph: 'https://…' },
          ].map(c => (
            <div key={c.k} className="flex items-center justify-between gap-3">
              <label className="text-sm text-gray-700 flex-shrink-0 w-36">{c.label}</label>
              <input
                value={empresa[c.k]}
                onChange={e => setEmpresa(p => ({ ...p, [c.k]: e.target.value }))}
                placeholder={c.ph}
                className="flex-1 min-w-0 text-xs border border-gray-200 rounded-lg px-2 py-1.5"
              />
            </div>
          ))}
          <button
            onClick={guardarEmpresa}
            disabled={guardandoEmpresa}
            className="self-end text-xs font-medium text-white bg-gray-900 hover:bg-gray-700 px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            {guardandoEmpresa ? 'Guardando…' : 'Guardar empresa'}
          </button>
        </div>
      </Section>

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
              <p className="text-xs text-gray-500 mt-0.5">Agenda las citas y genera los links de Meet automáticamente</p>
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

        {/* A qué agenda van las citas */}
        {integrations.googleCalendar?.connected && (
          <div className="p-4 rounded-xl border border-gray-100 bg-white">
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Agenda donde se crean las citas</label>
            {loadingCalendars ? (
              <p className="text-xs text-gray-400">Cargando tus agendas…</p>
            ) : calendars.length === 0 ? (
              <p className="text-xs text-gray-400">
                No pudimos leer tus agendas. Desconecta y vuelve a conectar Google Calendar.
              </p>
            ) : (
              <>
                <select
                  value={
                    integrations.googleCalendar?.calendarId
                    || calendars.find(c => c.primary)?.id
                    || 'primary'
                  }
                  onChange={e => handleSelectCalendar(e.target.value)}
                  disabled={savingCalendar}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white disabled:opacity-50"
                >
                  {calendars.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.primary ? ' (principal)' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1.5">
                  Las citas que ya existen se quedan en la agenda donde se crearon.
                </p>
              </>
            )}
          </div>
        )}
      </Section>

      {/* La facturación solo la ve quien administra la cuenta: un vendedor no
          tiene por qué ver el precio ni abrir el portal de pagos. */}
      {memberData?.role === 'admin' && <Suscripcion org={org} orgId={orgId} />}
      {memberData?.role === 'admin' && <DatosFiscales org={org} orgId={orgId} />}
      {memberData?.role === 'admin' && <HistorialDeCobros orgId={orgId} />}

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
            <div className="flex items-center gap-2 flex-shrink-0 min-w-0">
              <select
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/10 w-[190px] max-w-full truncate"
              >
                <optgroup label="México">
                  <option value="America/Mexico_City">México Centro (UTC-6)</option>
                  <option value="America/Monterrey">Monterrey / NL (UTC-6)</option>
                  <option value="America/Matamoros">Frontera Tamaulipas (UTC-5)</option>
                  <option value="America/Ojinaga">Frontera Chihuahua (UTC-6)</option>
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
