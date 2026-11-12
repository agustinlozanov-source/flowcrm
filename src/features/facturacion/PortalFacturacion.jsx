/* El portal de facturación manual.
 *
 * Factura cosas que no pasan por Stripe: transferencias, consultorías,
 * diagnósticos, cualquier servicio que no sea una suscripción al CRM.
 *
 * Dos cuidados que lo separan de un formulario que timbra:
 *
 * - Nada se escribe en la base desde aquí. Timbrar, cancelar y reenviar van
 *   por la función de Netlify, que comprueba el token otra vez del lado del
 *   servidor. Las reglas de Firestore dejan leer estas colecciones y no
 *   escribirlas, justo para que no puedan quedar registros sin CFDI detrás.
 * - Los totales se ven ANTES. Timbrar no se deshace: cancelar un CFDI real
 *   exige que el receptor acepte.
 */
import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, orderBy, query, limit } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import {
  REGIMENES, USOS_CFDI, FORMAS_PAGO, METODOS_PAGO,
  CLAVES_SERVICIO, CLAVES_UNIDAD, MONEDAS,
  rfcValido, normalizarRfc, totalesCfdi, claveSatValida,
} from '@/lib/fiscal'

const dinero = (n, moneda = 'MXN') =>
  `$${(Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${moneda}`

/* El padrón del SAT guarda los nombres sin acentos, así que «MÉNDEZ» contra
 * «MENDEZ» devuelve «el nombre no pertenece al RFC» — el rechazo más común de
 * todos, y el que más cuesta adivinar porque el nombre se ve bien. */
const sinAcentos = (t) =>
  String(t || '')
    /* La eñe se protege antes de normalizar. No es una letra acentuada: es
       otra letra, y el SAT la conserva. Sin esto, MUÑOZ y PEÑA salían como
       MUNOZ y PENA — rompiendo justo los apellidos que esto venía a salvar. */
    .replace(/ñ/g, '\u0001').replace(/Ñ/g, '\u0002')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0001/g, 'ñ').replace(/\u0002/g, 'Ñ')
const tieneAcentos = (t) => sinAcentos(t) !== String(t || '')

const conceptoVacio = () => ({
  id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  descripcion: '', cantidad: 1, precio: '', claveSat: '81161700', claveUnidad: 'E48', ivaIncluido: false,
})

const fiscalVacio = () => ({
  razonSocial: '', rfc: '', regimen: '', cp: '', usoCfdi: 'G03', correo: '',
})

/** Llama a la función con el token de la sesión en la cabecera. */
async function llamar(cuerpo) {
  const u = auth.currentUser
  if (!u) throw new Error('No hay sesión iniciada')
  const token = await u.getIdToken()
  const res = await fetch('/.netlify/functions/factura-manual', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(cuerpo),
  })
  const datos = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(datos.error || `Falló con HTTP ${res.status}`)
  return datos
}

export default function PortalFacturacion() {
  const [vista, setVista] = useState('nueva')
  const [facturas, setFacturas] = useState([])
  const [clientes, setClientes] = useState([])
  const [errorLectura, setErrorLectura] = useState(null)

  const [fiscal, setFiscal] = useState(fiscalVacio)
  const [conceptos, setConceptos] = useState([conceptoVacio()])
  const [formaPago, setFormaPago] = useState('03')
  const [metodoPago, setMetodoPago] = useState('PUE')
  const [moneda, setMoneda] = useState('MXN')
  const [tipoCambio, setTipoCambio] = useState('')
  const [serie, setSerie] = useState('')
  const [notas, setNotas] = useState('')

  const [timbrando, setTimbrando] = useState(false)
  const [aviso, setAviso] = useState(null)
  const [error, setError] = useState(null)
  const [confirmando, setConfirmando] = useState(false)

  useEffect(() => {
    const q1 = query(collection(db, 'facturas_manuales'), orderBy('creadaEn', 'desc'), limit(200))
    const u1 = onSnapshot(q1,
      s => setFacturas(s.docs.map(d => ({ id: d.id, ...d.data() }))),
      e => setErrorLectura(e.message))
    const u2 = onSnapshot(collection(db, 'facturacion_clientes'),
      s => setClientes(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {})
    return () => { u1(); u2() }
  }, [])

  const totales = useMemo(() => totalesCfdi(conceptos), [conceptos])

  const problemas = useMemo(() => {
    const p = []
    if (!fiscal.razonSocial.trim()) p.push('Falta la razón social')
    else if (/\b(S\.?A\.?|S\.?\s?DE\s?R\.?L\.?|SAPI|SC|AC)\b/i.test(fiscal.razonSocial)) {
      p.push('La razón social va SIN el régimen de capital: «MI EMPRESA», no «MI EMPRESA SA DE CV»')
    }
    if (!rfcValido(fiscal.rfc)) p.push('El RFC no tiene forma válida')
    if (!fiscal.regimen) p.push('Falta el régimen fiscal')
    if (!/^\d{5}$/.test(String(fiscal.cp))) p.push('El código postal debe tener cinco dígitos')
    if (!conceptos.length) p.push('No hay conceptos')
    conceptos.forEach((c, i) => {
      if (!c.descripcion.trim()) p.push(`El concepto ${i + 1} no tiene descripción`)
      if (!(Number(c.precio) > 0)) p.push(`El concepto ${i + 1} no tiene precio`)
      if (!claveSatValida(c.claveSat)) p.push(`El concepto ${i + 1} no tiene una clave del SAT de ocho dígitos`)
      if (!String(c.claveUnidad || '').trim()) p.push(`El concepto ${i + 1} no tiene unidad`)
    })
    if (moneda !== 'MXN' && !(Number(tipoCambio) > 0)) p.push('Con moneda extranjera hace falta el tipo de cambio')
    return p
  }, [fiscal, conceptos, moneda, tipoCambio])

  const editarConcepto = (id, parche) =>
    setConceptos(cs => cs.map(c => c.id === id ? { ...c, ...parche } : c))

  const limpiar = () => {
    setFiscal(fiscalVacio()); setConceptos([conceptoVacio()])
    setNotas(''); setSerie(''); setTipoCambio(''); setConfirmando(false)
  }

  const timbrar = async () => {
    if (problemas.length || timbrando) return
    setTimbrando(true); setError(null); setAviso(null)
    try {
      const r = await llamar({
        accion: 'emitir',
        fiscal: { ...fiscal, rfc: normalizarRfc(fiscal.rfc) },
        conceptos: conceptos.map(({ id, ...c }) => c),
        formaPago, metodoPago, moneda,
        tipoCambio: moneda !== 'MXN' ? tipoCambio : null,
        serie: serie.trim() || null,
        notas,
      })
      setAviso(
        (r.prueba ? 'Timbrada con llave de PRUEBAS (no vale ante el SAT). ' : 'Timbrada. ') +
        (r.folio ? `Folio ${r.folio}. ` : '') +
        (r.avisoEnvio || (r.prueba ? '' : 'Enviada por correo.')),
      )
      limpiar()
      setVista('emitidas')
    } catch (e) {
      /* El mensaje del proveedor es preciso pero no dice qué hacer. Para el
         rechazo más frecuente se le agrega el qué. */
      const pista = /nombre del receptor/i.test(e.message)
        ? ' — Suele ser por acentos: el padrón del SAT los guarda sin ellos. Prueba sin tildes, y si no, copia el nombre tal cual de su Constancia.'
        : /r[ée]gimen/i.test(e.message)
          ? ' — El régimen tiene que ser el que el SAT le tiene registrado, no el que parezca correcto.'
          : ''
      setError(e.message + pista)
    } finally {
      setTimbrando(false)
    }
  }

  const bajar = async (f, formato) => {
    try {
      const r = await llamar({ accion: 'descargar', id: f.id, formato })
      const bin = Uint8Array.from(atob(r.base64), c => c.charCodeAt(0))
      const url = URL.createObjectURL(new Blob([bin], { type: r.tipo }))
      const a = document.createElement('a')
      a.href = url; a.download = r.nombre; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch (e) { setError(e.message) }
  }

  const caja = { background: '#111827', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 18 }
  const etiqueta = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#94a3b8', display: 'block', marginBottom: 6 }
  const campo = { width: '100%', background: '#0b1220', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: '9px 11px', color: '#e5e7eb', fontSize: 13, outline: 'none' }
  const boton = (primario) => ({
    background: primario ? '#0066ff' : 'transparent', color: primario ? '#fff' : '#cbd5e1',
    border: primario ? 'none' : '1px solid rgba(255,255,255,.14)',
    borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, color: '#e5e7eb' }}>

      <div style={{ display: 'flex', gap: 8 }}>
        {[{ id: 'nueva', n: 'Nueva factura' }, { id: 'emitidas', n: `Emitidas (${facturas.length})` }, { id: 'clientes', n: `Receptores (${clientes.length})` }].map(t => (
          <button key={t.id} onClick={() => setVista(t.id)}
            style={{ ...boton(vista === t.id), borderRadius: 50 }}>{t.n}</button>
        ))}
      </div>

      {aviso && <div style={{ ...caja, borderColor: '#22c55e', color: '#86efac', fontSize: 13 }}>{aviso}</div>}
      {error && <div style={{ ...caja, borderColor: '#ef4444', color: '#fca5a5', fontSize: 13 }}>{error}</div>}
      {errorLectura && <div style={{ ...caja, borderColor: '#f59e0b', color: '#fcd34d', fontSize: 13 }}>
        No se pueden leer las facturas: {errorLectura}. Si dice «permisos», falta publicar las reglas de Firestore.
      </div>}

      {/* ── Nueva ── */}
      {vista === 'nueva' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>

            <div style={caja}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>A quién se le factura</h3>
                {clientes.length > 0 && (
                  <select style={{ ...campo, width: 'auto', marginLeft: 'auto', fontSize: 12 }}
                    value="" onChange={e => {
                      const c = clientes.find(x => x.id === e.target.value)
                      if (c) setFiscal({ razonSocial: c.razonSocial || '', rfc: c.rfc || '', regimen: c.regimen || '', cp: c.cp || '', usoCfdi: c.usoCfdi || 'G03', correo: c.correo || '' })
                    }}>
                    <option value="">Traer un receptor guardado…</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.razonSocial} · {c.rfc}</option>)}
                  </select>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <div><label style={etiqueta}>Razón social</label>
                  <input style={campo} value={fiscal.razonSocial} onChange={e => setFiscal(f => ({ ...f, razonSocial: e.target.value }))} placeholder="Como aparece en su Constancia" />
                  {tieneAcentos(fiscal.razonSocial) && (
                    <div style={{ fontSize: 11.5, color: '#fcd34d', marginTop: 5, lineHeight: 1.5 }}>
                      El padrón del SAT suele guardar los nombres sin acentos.{' '}
                      <button type="button"
                        onClick={() => setFiscal(f => ({ ...f, razonSocial: sinAcentos(f.razonSocial) }))}
                        style={{ background: 'none', border: 'none', color: '#fcd34d', textDecoration: 'underline', cursor: 'pointer', padding: 0, font: 'inherit' }}>
                        Quitarlos
                      </button>
                    </div>
                  )}</div>
                <div><label style={etiqueta}>RFC</label>
                  <input style={campo} value={fiscal.rfc} onChange={e => setFiscal(f => ({ ...f, rfc: e.target.value.toUpperCase() }))} /></div>
                <div><label style={etiqueta}>Régimen fiscal</label>
                  <select style={campo} value={fiscal.regimen} onChange={e => setFiscal(f => ({ ...f, regimen: e.target.value }))}>
                    <option value="">Elegir…</option>
                    {REGIMENES.map(r => <option key={r.clave} value={r.clave}>{r.clave} · {r.nombre}</option>)}
                  </select></div>
                <div><label style={etiqueta}>Código postal fiscal</label>
                  <input style={campo} value={fiscal.cp} inputMode="numeric" maxLength={5} onChange={e => setFiscal(f => ({ ...f, cp: e.target.value.replace(/\D/g, '') }))} /></div>
                <div><label style={etiqueta}>Uso del CFDI</label>
                  <select style={campo} value={fiscal.usoCfdi} onChange={e => setFiscal(f => ({ ...f, usoCfdi: e.target.value }))}>
                    {USOS_CFDI.map(u => <option key={u.clave} value={u.clave}>{u.clave} · {u.nombre}</option>)}
                  </select></div>
                <div><label style={etiqueta}>Correo para enviarla</label>
                  <input style={campo} type="email" value={fiscal.correo} onChange={e => setFiscal(f => ({ ...f, correo: e.target.value }))} /></div>
              </div>
              <p style={{ fontSize: 11.5, color: '#64748b', margin: '12px 0 0', lineHeight: 1.6 }}>
                En CFDI 4.0 estos campos tienen que coincidir <b>exactamente</b> con lo que el SAT
                tiene registrado, o el timbrado se rechaza. Cópialos de su Constancia, no de oído.
              </p>
            </div>

            <div style={caja}>
              <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700 }}>Qué se le cobra</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {conceptos.map((c, i) => (
                  <div key={c.id} style={{ border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: 12 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      <input style={{ ...campo, flex: 1 }} value={c.descripcion} placeholder={`Concepto ${i + 1} — qué se está cobrando`}
                        onChange={e => editarConcepto(c.id, { descripcion: e.target.value })} />
                      {conceptos.length > 1 && (
                        <button onClick={() => setConceptos(cs => cs.filter(x => x.id !== c.id))}
                          style={{ ...boton(false), padding: '0 12px' }}>Quitar</button>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8 }}>
                      <BuscadorClave
                        valor={c.claveSat}
                        onElegir={v => editarConcepto(c.id, { claveSat: v })}
                        atajos={CLAVES_SERVICIO}
                        estilos={{ etiqueta, campo }}
                      />
                      <div><label style={etiqueta}>Unidad</label>
                        <input style={campo} list="unidades-sat" value={c.claveUnidad}
                          onChange={e => editarConcepto(c.id, { claveUnidad: e.target.value.toUpperCase() })} />
                        <datalist id="unidades-sat">
                          {CLAVES_UNIDAD.map(k => <option key={k.clave} value={k.clave}>{k.nombre}</option>)}
                        </datalist></div>
                      <div><label style={etiqueta}>Cantidad</label>
                        <input style={campo} type="number" min={1} value={c.cantidad}
                          onChange={e => editarConcepto(c.id, { cantidad: Number(e.target.value) || 1 })} /></div>
                      <div><label style={etiqueta}>Precio unitario</label>
                        <input style={campo} type="number" min={0} step="0.01" value={c.precio}
                          onChange={e => editarConcepto(c.id, { precio: e.target.value })} /></div>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12.5, color: '#cbd5e1', cursor: 'pointer' }}>
                      <input type="checkbox" checked={c.ivaIncluido}
                        onChange={e => editarConcepto(c.id, { ivaIncluido: e.target.checked })} />
                      El precio ya trae el IVA dentro
                    </label>
                  </div>
                ))}
              </div>
              <button onClick={() => setConceptos(cs => [...cs, conceptoVacio()])}
                style={{ ...boton(false), marginTop: 12 }}>Agregar concepto</button>
            </div>

            <div style={caja}>
              <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700 }}>Cómo se pagó</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <div><label style={etiqueta}>Forma de pago</label>
                  <select style={campo} value={formaPago} onChange={e => setFormaPago(e.target.value)}>
                    {FORMAS_PAGO.map(f => <option key={f.clave} value={f.clave}>{f.clave} · {f.nombre}</option>)}
                  </select></div>
                <div><label style={etiqueta}>Método</label>
                  <select style={campo} value={metodoPago} onChange={e => setMetodoPago(e.target.value)}>
                    {METODOS_PAGO.map(m => <option key={m.clave} value={m.clave}>{m.clave}</option>)}
                  </select></div>
                <div><label style={etiqueta}>Moneda</label>
                  <select style={campo} value={moneda} onChange={e => setMoneda(e.target.value)}>
                    {MONEDAS.map(m => <option key={m.clave} value={m.clave}>{m.clave}</option>)}
                  </select></div>
                <div><label style={etiqueta}>{moneda === 'MXN' ? 'Serie (opcional)' : 'Tipo de cambio'}</label>
                  {moneda === 'MXN'
                    ? <input style={campo} value={serie} onChange={e => setSerie(e.target.value)} placeholder="A" />
                    : <input style={campo} type="number" step="0.0001" value={tipoCambio} onChange={e => setTipoCambio(e.target.value)} />}
                </div>
              </div>
              {metodoPago === 'PPD' && (
                <p style={{ fontSize: 11.5, color: '#fcd34d', margin: '12px 0 0', lineHeight: 1.6 }}>
                  PPD obliga a emitir un complemento de pago por cada abono. Para un trato partido
                  en dos, sale más sencillo emitir una factura PUE por cada pago recibido.
                </p>
              )}
              <div style={{ marginTop: 12 }}>
                <label style={etiqueta}>Nota interna (no sale en el CFDI)</label>
                <input style={campo} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Ej: primer 50 % de Medical Hub OS, Monte Sinaí" />
              </div>
            </div>
          </div>

          {/* Resumen */}
          <div style={{ ...caja, position: 'sticky', top: 16 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700 }}>Lo que va a salir</h3>
            {[['Subtotal', totales.subtotal], ['IVA 16 %', totales.iva]].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#94a3b8', marginBottom: 7 }}>
                <span>{k}</span><span>{dinero(v, moneda)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px solid rgba(255,255,255,.1)', paddingTop: 10, marginTop: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Total</span>
              <span style={{ fontSize: 20, fontWeight: 800 }}>{dinero(totales.total, moneda)}</span>
            </div>

            {problemas.length > 0 && (
              <ul style={{ margin: '14px 0 0', paddingLeft: 16, fontSize: 12, color: '#fca5a5', lineHeight: 1.7 }}>
                {problemas.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            )}

            {confirmando ? (
              <div style={{ marginTop: 14 }}>
                <p style={{ fontSize: 12.5, color: '#fcd34d', lineHeight: 1.6, margin: '0 0 10px' }}>
                  Timbrar no se deshace. Cancelar un CFDI real necesita que el receptor acepte.
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={timbrar} disabled={timbrando} style={{ ...boton(true), flex: 1 }}>
                    {timbrando ? 'Timbrando…' : 'Sí, timbrar'}
                  </button>
                  <button onClick={() => setConfirmando(false)} style={boton(false)}>No</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmando(true)} disabled={problemas.length > 0}
                style={{ ...boton(true), width: '100%', marginTop: 14, opacity: problemas.length ? .4 : 1 }}>
                Timbrar y enviar
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Emitidas ── */}
      {vista === 'emitidas' && (
        <div style={caja}>
          {facturas.length === 0 && <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Todavía no hay facturas manuales.</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {facturas.map(f => (
              <div key={f.id} style={{ border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: 12, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                    {f.fiscal?.razonSocial || '—'}{' '}
                    <span style={{ color: '#64748b', fontWeight: 400 }}>{f.fiscal?.rfc}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                    {f.serie ? `${f.serie}-` : ''}{f.folio ?? '—'} · {f.uuid || 'sin UUID'}
                    {f.notas ? ` · ${f.notas}` : ''}
                  </div>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{dinero(f.totales?.total, f.moneda)}</span>
                {f.prueba && <Etiqueta color="#f59e0b">PRUEBAS</Etiqueta>}
                {f.estado === 'cancelada'
                  ? <Etiqueta color="#ef4444">Cancelada</Etiqueta>
                  : <Etiqueta color={f.enviada ? '#22c55e' : '#64748b'}>{f.enviada ? 'Enviada' : 'Sin enviar'}</Etiqueta>}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button style={boton(false)} onClick={() => bajar(f, 'pdf')}>PDF</button>
                  <button style={boton(false)} onClick={() => bajar(f, 'xml')}>XML</button>
                  {f.estado !== 'cancelada' && (
                    <>
                      <button style={boton(false)} onClick={async () => {
                        try { await llamar({ accion: 'reenviar', id: f.id }); setAviso('Reenviada.') }
                        catch (e) { setError(e.message) }
                      }}>Reenviar</button>
                      <BotonCancelar factura={f} onHecho={setAviso} onError={setError} />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Receptores ── */}
      {vista === 'clientes' && (
        <div style={caja}>
          <p style={{ fontSize: 12.5, color: '#94a3b8', margin: '0 0 14px', lineHeight: 1.6 }}>
            Los receptores se guardan solos la primera vez que les facturas, para no volver a
            teclear sus datos. Esta lista es de solo lectura desde aquí.
          </p>
          {clientes.length === 0
            ? <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Todavía no hay receptores guardados.</p>
            : clientes.map(c => (
              <div key={c.id} style={{ borderTop: '1px solid rgba(255,255,255,.06)', padding: '10px 0', fontSize: 13 }}>
                <b>{c.razonSocial}</b> <span style={{ color: '#64748b' }}>{c.rfc} · {c.regimen} · CP {c.cp}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

/* La clave del SAT se escribe o se busca, nunca se elige de una lista
 * cerrada: el catálogo tiene decenas de miles de entradas y ninguna lista
 * nuestra las cubre. Los atajos de arriba son eso, atajos. */
function BuscadorClave({ valor, onElegir, atajos, estilos }) {
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [aviso, setAviso] = useState(null)

  const elegido = atajos.find(a => a.clave === valor)
  const valida = claveSatValida(valor)

  const buscar = async () => {
    if (texto.trim().length < 3 || buscando) return
    setBuscando(true); setAviso(null)
    try {
      const r = await llamar({ accion: 'buscar-clave', texto, tipo: 'productos' })
      setResultados(r.resultados || [])
      if (r.aviso) setAviso(r.aviso)
      else if (!r.resultados?.length) setAviso('Sin resultados. Puedes escribir la clave a mano.')
    } catch (e) {
      setAviso(`No se pudo buscar: ${e.message}. Escribe la clave a mano.`)
    } finally {
      setBuscando(false)
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <label style={estilos.etiqueta}>Clave del SAT</label>
      <input
        style={{ ...estilos.campo, borderColor: valida ? 'rgba(255,255,255,.1)' : '#ef4444' }}
        list="claves-sat" value={valor} inputMode="numeric" maxLength={8}
        onChange={e => onElegir(e.target.value.replace(/\D/g, ''))}
        placeholder="8 dígitos"
      />
      <datalist id="claves-sat">
        {atajos.map(k => <option key={k.clave} value={k.clave}>{k.nombre}</option>)}
      </datalist>
      <div style={{ fontSize: 11, color: valida ? '#64748b' : '#fca5a5', marginTop: 4, lineHeight: 1.4 }}>
        {!valida ? 'Una clave del SAT tiene ocho dígitos' : (elegido?.nombre || 'Clave escrita a mano')}
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <input
          style={{ ...estilos.campo, fontSize: 12 }}
          value={texto} placeholder="Buscar en el catálogo…"
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), buscar())}
        />
        <button type="button" onClick={buscar} disabled={buscando}
          style={{ background: 'transparent', color: '#cbd5e1', border: '1px solid rgba(255,255,255,.14)', borderRadius: 8, padding: '0 12px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {buscando ? '…' : 'Buscar'}
        </button>
      </div>

      {aviso && <div style={{ fontSize: 11, color: '#fcd34d', marginTop: 5, lineHeight: 1.4 }}>{aviso}</div>}

      {resultados.length > 0 && (
        <div style={{ marginTop: 6, maxHeight: 180, overflowY: 'auto', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8 }}>
          {resultados.map(r => (
            <button key={r.clave} type="button"
              onClick={() => { onElegir(r.clave); setResultados([]); setTexto('') }}
              style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,.05)', color: '#cbd5e1', padding: '7px 10px', fontSize: 12, cursor: 'pointer', lineHeight: 1.4 }}>
              <b>{r.clave}</b> · {r.nombre}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Etiqueta({ children, color }) {
  return (
    <span style={{ border: `1px solid ${color}`, color, borderRadius: 50, padding: '3px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

/* Cancelar pide el motivo del SAT. El 01 obliga a decir cuál la sustituye,
 * así que se pregunta en vez de mandar algo que ya sabemos que falla. */
function BotonCancelar({ factura, onHecho, onError }) {
  const [abierto, setAbierto] = useState(false)
  const [motivo, setMotivo] = useState('02')
  const [sustituye, setSustituye] = useState('')

  const estilo = { background: 'transparent', color: '#cbd5e1', border: '1px solid rgba(255,255,255,.14)', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }

  if (!abierto) return <button style={estilo} onClick={() => setAbierto(true)}>Cancelar</button>

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <select value={motivo} onChange={e => setMotivo(e.target.value)}
        style={{ ...estilo, padding: '8px 10px', background: '#0b1220' }}>
        <option value="02">02 · No se llevó a cabo la operación</option>
        <option value="03">03 · No se llevó a cabo, hay otra que la sustituye globalmente</option>
        <option value="01">01 · Emitida con errores, con relación</option>
      </select>
      {motivo === '01' && (
        <input value={sustituye} onChange={e => setSustituye(e.target.value)} placeholder="UUID que la sustituye"
          style={{ ...estilo, background: '#0b1220', minWidth: 230 }} />
      )}
      <button style={{ ...estilo, borderColor: '#ef4444', color: '#fca5a5' }} onClick={async () => {
        try {
          await llamar({ accion: 'cancelar', id: factura.id, motivo, sustituye: sustituye || null })
          onHecho('Cancelada ante el SAT.')
          setAbierto(false)
        } catch (e) { onError(e.message) }
      }}>Confirmar</button>
      <button style={estilo} onClick={() => setAbierto(false)}>Volver</button>
    </div>
  )
}
