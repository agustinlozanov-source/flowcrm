// Acuerdos y entregables de una implementación.
//
// Lo usan las dos caras del portal:
//   - modo 'admin'   → superadmin › Implementaciones: registra acuerdos y
//                      entregas, y marca una entrega como entregada.
//   - modo 'cliente' → /portal: el cliente da su «Enterado» a un acuerdo y
//                      aprueba o pide cambios a una entrega.
//
// Las acciones del cliente no escriben directo en Firestore: pasan por la
// function portal-accion, que pone el nombre y la hora del servidor. Así nadie
// firma por otro ni cambia la hora, y la constancia sirve como evidencia.
// Un acuerdo con «Enterado» ya no se edita: si algo cambia, se registra otro.
import { useEffect, useState } from 'react'
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import toast from 'react-hot-toast'

const MEDIOS = { reunion: 'Reunión', llamada: 'Llamada', whatsapp: 'WhatsApp', correo: 'Correo' }
const ESTADOS = {
  pendiente: { texto: 'Por entregar', color: '#8e8e93' },
  entregado: { texto: 'Entregado, espera aprobación', color: '#0066ff' },
  aprobado: { texto: 'Aprobado', color: '#00a35c' },
  con_cambios: { texto: 'Con cambios solicitados', color: '#d98200' },
}

const css = `
  .ae { display: flex; flex-direction: column; gap: 12px; }
  .ae-cab { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 4px; }
  .ae-titulo { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 20px; font-weight: 800; }
  .ae-sub { font-size: 15px; opacity: .6; margin-top: 2px; }
  .ae-tarjeta { border: 1px solid rgba(127,127,127,.22); border-radius: 14px; padding: 16px 18px; background: rgba(127,127,127,.04); }
  .ae-meta { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-size: 14px; opacity: .7; }
  .ae-pildora { display: inline-flex; align-items: center; font-size: 13px; font-weight: 700; padding: 2px 9px; border-radius: 999px; border: 1px solid currentColor; }
  .ae-nombre { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 18px; font-weight: 800; margin-top: 6px; line-height: 1.3; }
  .ae-detalle { font-size: 16px; line-height: 1.5; opacity: .85; margin-top: 4px; white-space: pre-line; }
  .ae-pie { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(127,127,127,.18); font-size: 14px; }
  .ae-firmas { opacity: .75; }
  .ae-botones { display: flex; gap: 6px; flex-wrap: wrap; }
  .ae-btn { border-radius: 999px; padding: 6px 14px; font-size: 14px; font-weight: 700; cursor: pointer; border: 1px solid rgba(127,127,127,.35); background: transparent; color: inherit; font-family: inherit; text-decoration: none; display: inline-flex; align-items: center; }
  .ae-btn:hover { border-color: currentColor; }
  .ae-btn-fuerte { background: #0066ff; border-color: #0066ff; color: #fff; }
  .ae-btn-fuerte:hover { opacity: .88; border-color: #0066ff; }
  .ae-btn-peligro { border: none; opacity: .6; }
  .ae-btn:disabled { opacity: .4; cursor: default; }
  .ae-vacio { text-align: center; padding: 28px; opacity: .55; font-size: 16px; border: 1px dashed rgba(127,127,127,.3); border-radius: 14px; }
  .ae-modal-fondo { position: fixed; inset: 0; z-index: 300; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; padding: 20px; }
  .ae-modal { background: #1c1c1e; color: #fff; border: 1px solid rgba(255,255,255,.1); border-radius: 18px; padding: 26px; width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; }
  .ae-modal h3 { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 21px; font-weight: 800; margin: 0 0 16px; }
  .ae-campo { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
  .ae-campo span { font-size: 13px; text-transform: uppercase; letter-spacing: .5px; opacity: .6; font-weight: 700; }
  .ae-campo input, .ae-campo select, .ae-campo textarea { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); border-radius: 8px; padding: 9px 12px; font-size: 16px; color: #fff; font-family: inherit; outline: none; width: 100%; }
  .ae-campo input:focus, .ae-campo select:focus, .ae-campo textarea:focus { border-color: #0066ff; }
  .ae-fila { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .ae-acciones { display: flex; justify-content: space-between; align-items: center; margin-top: 18px; gap: 8px; }
`

const aFecha = (v) => (v?.toDate ? v.toDate() : v ? new Date(v) : null)
const momento = (v) => {
  const d = aFecha(v)
  return d ? d.toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
}
const dia = (s) => {
  if (!s) return ''
  const [a, m, d] = s.split('-').map(Number)
  return new Date(a, m - 1, d).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
}
const hoy = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const nuevoId = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const whatsapp = (texto) => `https://wa.me/?text=${encodeURIComponent(texto)}`

/** Lee acuerdos y entregables de una implementación, en vivo. */
export function useAcuerdosEntregables(implId) {
  const [acuerdos, setAcuerdos] = useState([])
  const [entregables, setEntregables] = useState([])
  useEffect(() => {
    if (!implId) return
    const u1 = onSnapshot(collection(db, 'implementations', implId, 'acuerdos'), (s) =>
      setAcuerdos(s.docs.map((d) => ({ id: d.id, ...d.data() }))))
    const u2 = onSnapshot(collection(db, 'implementations', implId, 'entregables'), (s) =>
      setEntregables(s.docs.map((d) => ({ id: d.id, ...d.data() }))))
    return () => { u1(); u2() }
  }, [implId])
  return { acuerdos, entregables }
}

async function accionCliente(implId, accion, datos) {
  const token = await auth.currentUser?.getIdToken()
  const res = await fetch('/.netlify/functions/portal-accion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ implId, accion, ...datos }),
  })
  const r = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(r.error || 'No se pudo guardar')
}

// ─── ACUERDOS ────────────────────────────────────────────────────────────────

export function Acuerdos({ impl, acuerdos, modo }) {
  const [edicion, setEdicion] = useState(null)
  const [ocupado, setOcupado] = useState(null)
  const correoCliente = String(impl.email || '').toLowerCase()
  const lista = [...acuerdos].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || (aFecha(b.createdAt)?.getTime() || 0) - (aFecha(a.createdAt)?.getTime() || 0))
  const portal = `${window.location.origin}/portal`

  const enterado = async (a) => {
    setOcupado(a.id)
    try { await accionCliente(impl.id, 'enterado', { acuerdoId: a.id }); toast.success('Gracias, quedó registrado') }
    catch (e) { toast.error(e.message) }
    setOcupado(null)
  }

  return (
    <div className="ae">
      <style>{css}</style>
      <div className="ae-cab">
        <div>
          <div className="ae-titulo">Acuerdos</div>
          <div className="ae-sub">El registro oficial del proyecto. Lo que no está aquí, no está acordado.</div>
        </div>
        {modo === 'admin' && (
          <button className="ae-btn ae-btn-fuerte" onClick={() => setEdicion({ id: nuevoId('a'), fecha: hoy(), titulo: '', detalle: '', medio: 'reunion', responsable: '', compromiso: '', enterados: [] })}>
            + Registrar acuerdo
          </button>
        )}
      </div>

      {lista.length === 0 && <div className="ae-vacio">Todavía no hay acuerdos. Cada reunión, llamada o mensaje importante va a quedar aquí.</div>}

      {lista.map((a) => {
        const enterados = a.enterados || []
        const yaLoVi = enterados.some((f) => f.correo === correoCliente)
        return (
          <div key={a.id} className="ae-tarjeta">
            <div className="ae-meta">
              <span style={{ fontWeight: 700, textTransform: 'capitalize' }}>{dia(a.fecha)}</span>
              <span className="ae-pildora">{MEDIOS[a.medio] || a.medio}</span>
            </div>
            <div className="ae-nombre">{a.titulo}</div>
            {a.detalle && <div className="ae-detalle">{a.detalle}</div>}
            {(a.responsable || a.compromiso) && (
              <div className="ae-meta" style={{ marginTop: 8, opacity: 0.85 }}>
                {a.responsable && <span>Responsable: <b>{a.responsable}</b></span>}
                {a.compromiso && <span>· Para el {dia(a.compromiso)}</span>}
              </div>
            )}
            <div className="ae-pie">
              <div className="ae-firmas">
                {enterados.length === 0
                  ? 'Sin «Enterado» todavía.'
                  : enterados.map((f, i) => <span key={i} style={{ marginRight: 12 }}><span style={{ color: '#00a35c' }}>✓</span> {f.nombre} · {momento(f.en)}</span>)}
              </div>
              <div className="ae-botones">
                {modo === 'cliente' && !yaLoVi && (
                  <button className="ae-btn ae-btn-fuerte" disabled={ocupado === a.id} onClick={() => enterado(a)}>Enterado</button>
                )}
                {modo === 'admin' && (
                  <a className="ae-btn" target="_blank" rel="noreferrer"
                    href={whatsapp(`Registramos un acuerdo en el portal de su proyecto: «${a.titulo}». ¿Nos confirma con su «Enterado»? ${portal}`)}>
                    Avisar por WhatsApp
                  </a>
                )}
                {modo === 'admin' && enterados.length === 0 && <button className="ae-btn" onClick={() => setEdicion(a)}>Editar</button>}
              </div>
            </div>
          </div>
        )
      })}

      {edicion && <EditorAcuerdo impl={impl} item={edicion} existe={acuerdos.some((x) => x.id === edicion.id)} cerrar={() => setEdicion(null)} />}
    </div>
  )
}

function EditorAcuerdo({ impl, item, existe, cerrar }) {
  const [a, setA] = useState(item)
  const set = (k) => (e) => setA({ ...a, [k]: e.target.value })
  const guardar = async () => {
    const { id, ...datos } = a
    try {
      await setDoc(doc(db, 'implementations', impl.id, 'acuerdos', id), {
        ...datos, enterados: a.enterados || [], ...(existe ? {} : { createdAt: serverTimestamp() }), updatedAt: serverTimestamp(),
      }, { merge: true })
      cerrar()
    } catch (e) { toast.error(e.message) }
  }
  const borrar = async () => {
    if (!window.confirm('¿Borrar este acuerdo?')) return
    await deleteDoc(doc(db, 'implementations', impl.id, 'acuerdos', a.id))
    cerrar()
  }
  return (
    <div className="ae-modal-fondo" onClick={(e) => e.target === e.currentTarget && cerrar()}>
      <div className="ae-modal">
        <h3>{existe ? 'Editar acuerdo' : 'Registrar acuerdo'}</h3>
        <div className="ae-fila">
          <label className="ae-campo"><span>Fecha</span><input type="date" value={a.fecha} onChange={set('fecha')} /></label>
          <label className="ae-campo"><span>Dónde se acordó</span>
            <select value={a.medio} onChange={set('medio')}>{Object.entries(MEDIOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </label>
        </div>
        <label className="ae-campo"><span>Acuerdo</span><input value={a.titulo} onChange={set('titulo')} placeholder="Ej. La capacitación de óptica se mueve al jueves 10" /></label>
        <label className="ae-campo"><span>Detalle</span><textarea rows={4} value={a.detalle} onChange={set('detalle')} /></label>
        <div className="ae-fila">
          <label className="ae-campo"><span>Responsable</span><input value={a.responsable} onChange={set('responsable')} placeholder="Flow Hub, la clínica…" /></label>
          <label className="ae-campo"><span>Fecha compromiso</span><input type="date" value={a.compromiso} onChange={set('compromiso')} /></label>
        </div>
        <div className="ae-acciones">
          {existe ? <button className="ae-btn ae-btn-peligro" onClick={borrar}>Borrar</button> : <span />}
          <div className="ae-botones">
            <button className="ae-btn" onClick={cerrar}>Cancelar</button>
            <button className="ae-btn ae-btn-fuerte" disabled={!a.titulo.trim()} onClick={guardar}>Guardar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── ENTREGABLES ─────────────────────────────────────────────────────────────

export function Entregables({ impl, entregables, modo }) {
  const [edicion, setEdicion] = useState(null)
  const [entregar, setEntregar] = useState(null)
  const [responder, setResponder] = useState(null)
  const [texto, setTexto] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const lista = [...entregables].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || (a.orden || 0) - (b.orden || 0))
  const portal = `${window.location.origin}/portal`

  const marcarEntregado = async () => {
    try {
      await updateDoc(doc(db, 'implementations', impl.id, 'entregables', entregar.id), {
        estado: 'entregado', enlace: entregar.enlace || '', entregadoEn: serverTimestamp(), respuesta: null, updatedAt: serverTimestamp(),
      })
      setEntregar(null)
    } catch (e) { toast.error(e.message) }
  }
  const enviarRespuesta = async () => {
    setOcupado(true)
    try {
      await accionCliente(impl.id, responder.aprobar ? 'aprobar' : 'cambios', { entregableId: responder.e.id, comentario: texto.trim() })
      toast.success(responder.aprobar ? 'Entrega aprobada' : 'Enviamos sus comentarios')
      setResponder(null)
      setTexto('')
    } catch (e) { toast.error(e.message) }
    setOcupado(false)
  }

  return (
    <div className="ae">
      <style>{css}</style>
      <div className="ae-cab">
        <div>
          <div className="ae-titulo">Entregables</div>
          <div className="ae-sub">Cada entrega del proyecto. {modo === 'cliente' ? 'Revísela y apruébela, o pídanos cambios.' : 'El cliente la aprueba o pide cambios.'}</div>
        </div>
        {modo === 'admin' && (
          <button className="ae-btn ae-btn-fuerte" onClick={() => setEdicion({ id: nuevoId('e'), titulo: '', detalle: '', fecha: hoy(), estado: 'pendiente', enlace: '', orden: entregables.length })}>
            + Agregar entregable
          </button>
        )}
      </div>

      {lista.length === 0 && <div className="ae-vacio">Todavía no hay entregables.</div>}

      {lista.map((e) => {
        const est = ESTADOS[e.estado] || ESTADOS.pendiente
        return (
          <div key={e.id} className="ae-tarjeta">
            <div className="ae-meta">
              <span className="ae-pildora" style={{ color: est.color }}>{est.texto}</span>
              {e.estado === 'pendiente' && e.fecha && <span>Para el {dia(e.fecha)}</span>}
            </div>
            <div className="ae-nombre">{e.titulo}</div>
            {e.detalle && <div className="ae-detalle">{e.detalle}</div>}
            {e.enlace && <a href={e.enlace} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 6, color: '#0066ff', fontWeight: 700 }}>Ver el entregable →</a>}
            {(e.entregadoEn || e.respuesta) && (
              <div className="ae-pie">
                <div className="ae-firmas">
                  {e.entregadoEn && <div>Entregado el {momento(e.entregadoEn)}</div>}
                  {e.respuesta && (
                    <div style={{ color: e.estado === 'aprobado' ? '#00a35c' : '#d98200' }}>
                      {e.estado === 'aprobado' ? 'Aprobado' : 'Cambios pedidos'} por {e.respuesta.nombre} · {momento(e.respuesta.en)}
                      {e.respuesta.comentario ? ` · «${e.respuesta.comentario}»` : ''}
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="ae-botones" style={{ marginTop: 10 }}>
              {modo === 'cliente' && e.estado === 'entregado' && (
                <>
                  <button className="ae-btn ae-btn-fuerte" onClick={() => setResponder({ e, aprobar: true })}>Aprobar</button>
                  <button className="ae-btn" onClick={() => setResponder({ e, aprobar: false })}>Pedir cambios</button>
                </>
              )}
              {modo === 'admin' && (e.estado === 'pendiente' || e.estado === 'con_cambios') && (
                <button className="ae-btn ae-btn-fuerte" onClick={() => setEntregar({ ...e })}>Marcar entregado</button>
              )}
              {modo === 'admin' && e.estado === 'entregado' && (
                <a className="ae-btn" target="_blank" rel="noreferrer"
                  href={whatsapp(`Le entregamos «${e.titulo}». Puede revisarlo y aprobarlo en el portal de su proyecto: ${portal}`)}>
                  Avisar por WhatsApp
                </a>
              )}
              {modo === 'admin' && e.estado !== 'aprobado' && <button className="ae-btn" onClick={() => setEdicion(e)}>Editar</button>}
            </div>
          </div>
        )
      })}

      {entregar && (
        <div className="ae-modal-fondo" onClick={(ev) => ev.target === ev.currentTarget && setEntregar(null)}>
          <div className="ae-modal">
            <h3>Marcar como entregado</h3>
            <p style={{ opacity: 0.7, marginTop: -6 }}>«{entregar.titulo}». El cliente lo verá como «espera su aprobación».</p>
            <label className="ae-campo"><span>Enlace al entregable (opcional)</span>
              <input value={entregar.enlace || ''} onChange={(ev) => setEntregar({ ...entregar, enlace: ev.target.value })} placeholder="https://" />
            </label>
            <div className="ae-acciones"><span />
              <div className="ae-botones">
                <button className="ae-btn" onClick={() => setEntregar(null)}>Cancelar</button>
                <button className="ae-btn ae-btn-fuerte" onClick={marcarEntregado}>Marcar entregado</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {responder && (
        <div className="ae-modal-fondo" onClick={(ev) => ev.target === ev.currentTarget && setResponder(null)}>
          <div className="ae-modal">
            <h3>{responder.aprobar ? 'Aprobar entrega' : 'Pedir cambios'}</h3>
            <p style={{ opacity: 0.7, marginTop: -6 }}>
              «{responder.e.titulo}». {responder.aprobar ? 'Su aprobación queda registrada con su nombre, fecha y hora.' : 'Díganos qué hay que cambiar y lo volvemos a entregar.'}
            </p>
            <label className="ae-campo"><span>{responder.aprobar ? 'Comentario (opcional)' : 'Qué hay que cambiar'}</span>
              <textarea rows={3} value={texto} onChange={(ev) => setTexto(ev.target.value)} />
            </label>
            <div className="ae-acciones"><span />
              <div className="ae-botones">
                <button className="ae-btn" onClick={() => setResponder(null)}>Cancelar</button>
                <button className="ae-btn ae-btn-fuerte" disabled={ocupado || (!responder.aprobar && !texto.trim())} onClick={enviarRespuesta}>
                  {responder.aprobar ? 'Aprobar' : 'Enviar cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {edicion && <EditorEntregable impl={impl} item={edicion} existe={entregables.some((x) => x.id === edicion.id)} cerrar={() => setEdicion(null)} />}
    </div>
  )
}

function EditorEntregable({ impl, item, existe, cerrar }) {
  const [e, setE] = useState(item)
  const set = (k) => (ev) => setE({ ...e, [k]: ev.target.value })
  const guardar = async () => {
    const { id, ...datos } = e
    try {
      await setDoc(doc(db, 'implementations', impl.id, 'entregables', id), {
        ...datos, ...(existe ? {} : { createdAt: serverTimestamp(), entregadoEn: null, respuesta: null }), updatedAt: serverTimestamp(),
      }, { merge: true })
      cerrar()
    } catch (err) { toast.error(err.message) }
  }
  const borrar = async () => {
    if (!window.confirm('¿Borrar este entregable?')) return
    await deleteDoc(doc(db, 'implementations', impl.id, 'entregables', e.id))
    cerrar()
  }
  return (
    <div className="ae-modal-fondo" onClick={(ev) => ev.target === ev.currentTarget && cerrar()}>
      <div className="ae-modal">
        <h3>{existe ? 'Editar entregable' : 'Nuevo entregable'}</h3>
        <label className="ae-campo"><span>Entregable</span><input value={e.titulo} onChange={set('titulo')} /></label>
        <label className="ae-campo"><span>Detalle</span><textarea rows={2} value={e.detalle} onChange={set('detalle')} /></label>
        <div className="ae-fila">
          <label className="ae-campo"><span>Fecha compromiso</span><input type="date" value={e.fecha} onChange={set('fecha')} /></label>
          <label className="ae-campo"><span>Enlace</span><input value={e.enlace || ''} onChange={set('enlace')} placeholder="https://" /></label>
        </div>
        <div className="ae-acciones">
          {existe ? <button className="ae-btn ae-btn-peligro" onClick={borrar}>Borrar</button> : <span />}
          <div className="ae-botones">
            <button className="ae-btn" onClick={cerrar}>Cancelar</button>
            <button className="ae-btn ae-btn-fuerte" disabled={!e.titulo.trim()} onClick={guardar}>Guardar</button>
          </div>
        </div>
      </div>
    </div>
  )
}
