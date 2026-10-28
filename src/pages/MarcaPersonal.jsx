/* Marca Personal.
 *
 * Una cuenta de FlowCRM puede llevar varias marcas personales a la vez: ese es
 * el caso de uso del "grow operator", que asesora a varios creadores sin tener
 * que abrir una cuenta por cada uno. Cada marca tiene un dueño, y el dueño
 * entra y ve solo la suya.
 */
import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { collection, query, orderBy, limit, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import {
  Plus, X, Pencil, Trash2, ChevronLeft, Instagram,
  AlertTriangle, Check, BarChart3, Users, Link2, RefreshCw, MessageSquare, ImageOff, Clock,
} from 'lucide-react'
import { useBrands, estadoDeConexion, diasParaCaducar, SIN_CONECTAR, CONECTADA, CON_PROBLEMA } from '@/hooks/useBrands'
import Referencias from '@/features/marca/Referencias'
import Produccion from '@/features/marca/Produccion'
import Publicar from '../features/marca/Publicar'
import { useTeam } from '@/hooks/useTeam'
import { usePipeline } from '@/hooks/usePipeline'
import { useAuthStore } from '@/store/authStore'
import { Minutos, HorariosDeAtencion } from '@/components/agenda/ControlesDeAgenda'

const NICHOS_SUGERIDOS = [
  'Negocios', 'Salud', 'Fitness', 'Finanzas', 'Inmobiliaria',
  'Educación', 'Tecnología', 'Belleza', 'Legal', 'Motivación',
]

const ESTADOS = {
  [SIN_CONECTAR]: { texto: 'Sin conectar', color: 'text-tertiary', punto: 'bg-tertiary' },
  [CONECTADA]:    { texto: 'Conectada',    color: 'text-accent-green', punto: 'bg-accent-green' },
  [CON_PROBLEMA]: { texto: 'Revisar',      color: 'text-accent-amber', punto: 'bg-accent-amber' },
}

// ─── TARJETA ──────────────────────────────────────────────────────
function TarjetaDeMarca({ marca, dueño, onAbrir }) {
  const estado = ESTADOS[estadoDeConexion(marca)]
  return (
    <button
      onClick={onAbrir}
      className="text-left bg-surface border border-border rounded-card p-4 shadow-card hover:shadow-card-md transition-all"
    >
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-full bg-surface-2 border border-border flex items-center justify-center shrink-0 overflow-hidden">
          {marca.fotoURL
            ? <img src={marca.fotoURL} alt="" className="w-full h-full object-cover" />
            : <Instagram size={18} className="text-tertiary" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display font-bold text-[14px] text-primary truncate">
            {marca.nombre || 'Marca sin nombre'}
          </div>
          <div className="text-[12px] text-tertiary truncate">
            {marca.handle ? `@${marca.handle}` : 'Sin cuenta de Instagram'}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
        <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', estado.punto)} />
        <span className={clsx('text-[11px] font-semibold', estado.color)}>{estado.texto}</span>
        {marca.nicho && (
          <span className="ml-auto text-[11px] text-tertiary truncate">{marca.nicho}</span>
        )}
      </div>

      {dueño && (
        <div className="flex items-center gap-1.5 mt-2 text-[11px] text-tertiary">
          <Users size={11} /> <span className="truncate">{dueño}</span>
        </div>
      )}
    </button>
  )
}

// ─── FORMULARIO ───────────────────────────────────────────────────
function FormularioDeMarca({ marca, miembros, pipelines, onGuardar, onCerrar }) {
  const [nombre, setNombre] = useState(marca?.nombre || '')
  const [handle, setHandle] = useState(marca?.handle || '')
  const [nicho, setNicho] = useState(marca?.nicho || '')
  const [ownerUserId, setOwnerUserId] = useState(marca?.ownerUserId || '')
  const [pipelineId, setPipelineId] = useState(marca?.pipelineId || '')
  const [guardando, setGuardando] = useState(false)

  const guardar = async () => {
    if (!nombre.trim()) { toast.error('Ponle un nombre a la marca'); return }
    setGuardando(true)
    try {
      await onGuardar({ nombre, handle, nicho, ownerUserId, pipelineId })
      onCerrar()
    } catch (err) {
      console.error(err)
      toast.error('No se pudo guardar la marca')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-[460px] bg-surface border border-border rounded-card shadow-card-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-display font-bold text-[15px] text-primary">
            {marca ? 'Editar marca' : 'Nueva marca personal'}
          </h2>
          <button onClick={onCerrar} className="text-tertiary hover:text-primary"><X size={18} /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-tertiary mb-1.5">Nombre</label>
            <input
              value={nombre} onChange={e => setNombre(e.target.value)} autoFocus
              placeholder="Agustín Lozano"
              className="w-full px-3 py-2 rounded-btn bg-surface-2 border border-border text-[13px] text-primary outline-none focus:border-accent-blue"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-tertiary mb-1.5">Cuenta de Instagram</label>
            <input
              value={handle} onChange={e => setHandle(e.target.value)}
              placeholder="@coach.lozano"
              className="w-full px-3 py-2 rounded-btn bg-surface-2 border border-border text-[13px] text-primary outline-none focus:border-accent-blue"
            />
            <p className="text-[11px] text-tertiary mt-1.5">
              Puedes pegar la URL del perfil; nos quedamos con el usuario.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-tertiary mb-1.5">Nicho</label>
            <input
              value={nicho} onChange={e => setNicho(e.target.value)}
              placeholder="Negocios"
              list="nichos-marca"
              className="w-full px-3 py-2 rounded-btn bg-surface-2 border border-border text-[13px] text-primary outline-none focus:border-accent-blue"
            />
            <datalist id="nichos-marca">
              {NICHOS_SUGERIDOS.map(n => <option key={n} value={n} />)}
            </datalist>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-tertiary mb-1.5">Pipeline</label>
            <select
              value={pipelineId} onChange={e => setPipelineId(e.target.value)}
              className="w-full px-3 py-2 rounded-btn bg-surface-2 border border-border text-[13px] text-primary outline-none focus:border-accent-blue"
            >
              <option value="">Sin pipeline</option>
              {(pipelines || []).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <p className="text-[11px] text-tertiary mt-1.5">
              Aquí caen los mensajes de esta cuenta, y de aquí salen el nombre del agente,
              sus instrucciones y su scoring.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-tertiary mb-1.5">Dueño</label>
            <select
              value={ownerUserId} onChange={e => setOwnerUserId(e.target.value)}
              className="w-full px-3 py-2 rounded-btn bg-surface-2 border border-border text-[13px] text-primary outline-none focus:border-accent-blue"
            >
              <option value="">Yo</option>
              {miembros.map(m => (
                <option key={m.id} value={m.id}>{m.name || m.email}</option>
              ))}
            </select>
            <p className="text-[11px] text-tertiary mt-1.5">
              El dueño entra a FlowCRM y ve solo esta marca.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <button onClick={onCerrar} className="px-3 py-2 rounded-btn text-[13px] font-semibold text-secondary hover:text-primary">
            Cancelar
          </button>
          <button
            onClick={guardar} disabled={guardando}
            className="px-4 py-2 rounded-btn bg-accent-blue text-white text-[13px] font-bold disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── CONEXIÓN ─────────────────────────────────────────────────────
function PanelDeConexion({ marca, orgId }) {
  const estado = estadoDeConexion(marca)
  const dias = diasParaCaducar(marca)
  const [pegando, setPegando] = useState(false)
  const [token, setToken] = useState('')
  const [trabajando, setTrabajando] = useState(false)

  const conectarConToken = async () => {
    if (!token.trim()) { toast.error('Pega el token'); return }
    setTrabajando(true)
    try {
      const res = await fetch('/.netlify/functions/instagram-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, brandId: marca.id, token: token.trim() }),
      })
      const r = await res.json()
      if (!res.ok || !r.ok) throw new Error(r.detalle || r.error || 'No se pudo conectar')
      // El token no se queda en pantalla ni un segundo de más.
      setToken('')
      setPegando(false)
      toast.success(`Conectada como @${r.username}`)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <div className="bg-surface border border-border rounded-card shadow-card p-5 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Link2 size={15} className="text-tertiary" />
        <h2 className="font-display font-bold text-[14px] text-primary">Instagram</h2>
      </div>

      {estado === CONECTADA && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[13px] text-accent-green font-semibold">
            <Check size={15} /> Conectada como @{marca.ig?.username || marca.handle}
          </div>
          {marca.ig?.seguidores != null && (
            <p className="text-[12px] text-tertiary">
              {marca.ig.seguidores.toLocaleString('es-MX')} seguidores
            </p>
          )}
          {dias !== null && (
            <p className={clsx('text-[12px]', dias <= 7 ? 'text-accent-amber' : 'text-tertiary')}>
              {dias > 0
                ? `La conexión se renueva en ${dias} ${dias === 1 ? 'día' : 'días'}.`
                : 'La conexión caducó. Hay que generar un token nuevo.'}
            </p>
          )}

          {/* Los permisos se conceden al hacer login, así que una cuenta
              conectada se queda con los que pidió aquel día. Cuando la app
              empieza a pedir más —mensajes, comentarios—, la única forma de
              que el token los tenga es volver a pasar por la pantalla de
              Instagram. Sin este botón la única salida era borrar la marca,
              que además se lleva el pipeline y la regla de comentarios. */}
          <div className="pt-2">
            <a
              href={`/.netlify/functions/instagram-auth?orgId=${orgId}&brandId=${marca.id}`}
              className="inline-flex items-center gap-1.5 text-[12px] text-tertiary hover:text-primary underline underline-offset-2"
            >
              <Instagram size={13} /> Volver a conectar
            </a>
            <p className="text-[11px] text-tertiary mt-1">
              No borra nada. Sirve para renovar los permisos cuando Instagram pide unos nuevos.
            </p>
          </div>
        </div>
      )}

      {estado === CON_PROBLEMA && (
        <div className="flex items-start gap-2 text-[13px] text-accent-amber mb-3">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <span>{marca.ig?.error || 'La conexión dejó de funcionar.'}</span>
        </div>
      )}

      {estado !== CONECTADA && (
        <>
          <p className="text-[13px] text-secondary mb-3">
            Sin conectar no hay métricas. La cuenta tiene que ser Business o Creator.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/.netlify/functions/instagram-auth?orgId=${orgId}&brandId=${marca.id}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-btn bg-accent-blue text-white text-[13px] font-bold"
            >
              <Instagram size={15} /> Conectar con Instagram
            </a>
            <button
              onClick={() => setPegando(v => !v)}
              className="text-[12px] text-tertiary hover:text-primary underline underline-offset-2"
            >
              Pegar un token
            </button>
          </div>

          {pegando && (
            <div className="mt-3 pt-3 border-t border-border">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-tertiary mb-1.5">
                Token de acceso
              </label>
              <input
                type="password" value={token} onChange={e => setToken(e.target.value)}
                placeholder="IGAA…"
                className="w-full px-3 py-2 rounded-btn bg-surface-2 border border-border text-[13px] text-primary outline-none focus:border-accent-blue"
              />
              <p className="text-[11px] text-tertiary mt-1.5">
                El que genera la consola de Meta en “Generar tokens de acceso”. Se guarda
                cifrado y no se vuelve a mostrar.
              </p>
              <button
                onClick={conectarConToken} disabled={trabajando}
                className="mt-2 px-3.5 py-2 rounded-btn bg-accent-blue text-white text-[13px] font-bold disabled:opacity-50"
              >
                {trabajando ? 'Comprobando…' : 'Conectar'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── COMENTARIOS ──────────────────────────────────────────────────
/* El "comenta X y te mando el PDF".
 *
 * Hay dos reglas de Instagram que condicionan todo esto y por eso están
 * dichas en pantalla: solo se puede mandar UN privado por comentario, y ese
 * privado NO abre la conversación. Hasta que la persona conteste, no se le
 * puede escribir otra vez — así que ese mensaje tiene que llevar ya lo
 * prometido y una pregunta que invite a responder. */
const FRANJAS = [
  ['America/Mexico_City', 'Centro de México (CDMX, Guadalajara, Monterrey)'],
  ['America/Cancun', 'Cancún y Quintana Roo'],
  ['America/Matamoros', 'Frontera noreste (Matamoros, Reynosa, Nuevo Laredo)'],
  ['America/Chihuahua', 'Chihuahua'],
  ['America/Ojinaga', 'Frontera de Chihuahua (Ojinaga)'],
  ['America/Mazatlan', 'Pacífico (Mazatlán, La Paz)'],
  ['America/Hermosillo', 'Sonora'],
  ['America/Tijuana', 'Baja California (Tijuana, Mexicali)'],
  ['America/Bogota', 'Colombia'],
  ['America/Lima', 'Perú'],
  ['America/Santiago', 'Chile'],
  ['America/Argentina/Buenos_Aires', 'Argentina'],
  ['America/New_York', 'Este de Estados Unidos'],
  ['Europe/Madrid', 'España'],
]

/* La agenda de la marca.
 *
 * Vive acá y no en la pantalla del agente a propósito: el horario de una marca
 * personal es suyo —qué días abre, a qué hora, en qué franja— y no una
 * configuración de la organización. Se guarda bajo el embudo de la marca, así
 * que el agente que atiende ese embudo la respeta sin saber que existe una
 * marca detrás.
 *
 * Lo que no se cambie acá se hereda de la organización, campo por campo.
 */
function PanelDeAgenda({ marca, orgId }) {
  const [cfg, setCfg] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const pid = marca.pipelineId

  useEffect(() => {
    if (!orgId) return
    return onSnapshot(
      doc(db, 'organizations', orgId, 'settings', 'agent'),
      snap => setCfg(snap.data() || {}),
      err => console.error('[marca] no se pudo leer la agenda:', err)
    )
  }, [orgId])

  if (!pid) return (
    <div className="bg-surface border border-border rounded-card shadow-card p-5">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-primary mb-1">
        <Clock size={15} className="text-tertiary" /> Agenda
      </div>
      <p className="text-[12.5px] text-tertiary">
        Esta marca todavía no tiene embudo. Asígnale uno y acá podrás poner sus días, sus horas y su franja horaria.
      </p>
    </div>
  )

  if (!cfg) return (
    <div className="bg-surface border border-border rounded-card shadow-card p-5">
      <p className="text-[12.5px] text-tertiary">Cargando la agenda…</p>
    </div>
  )

  const propio = cfg.agendaPorEmbudo?.[pid] || {}
  const esPropio = (c) => propio[c] !== undefined && propio[c] !== null
  const valor = (c, pom) => (esPropio(c) ? propio[c] : (cfg[c] ?? pom))
  const marcaPropio = (c) => (esPropio(c) ? ' · propio' : ' · heredado')

  const escribir = async (campos) => {
    setGuardando(true)
    try {
      await setDoc(
        doc(db, 'organizations', orgId, 'settings', 'agent'),
        { agendaPorEmbudo: { [pid]: { ...propio, ...campos } }, updatedAt: serverTimestamp() },
        { merge: true }
      )
    } catch (e) {
      toast.error('No se pudo guardar: ' + e.message)
    } finally { setGuardando(false) }
  }

  const heredarTodo = () => escribir({
    timezone: null, meetingDuration: null, slotStep: null, meetingBuffer: null, workingHours: null,
  })

  const tienePropio = Object.values(propio).some(v => v !== null && v !== undefined)

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-surface border border-border rounded-card shadow-card p-5">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <div className="flex items-center gap-2 text-[13.5px] font-display font-bold text-primary">
              <Clock size={15} className="text-tertiary" /> La agenda de esta marca
            </div>
            <p className="text-[11.5px] text-tertiary mt-0.5">
              Qué días atiende, a qué horas y en qué franja. Lo que no cambies acá lo hereda de la organización.
            </p>
          </div>
          {tienePropio && (
            <button onClick={heredarTodo} disabled={guardando}
              className="text-[11px] font-semibold text-accent-blue whitespace-nowrap hover:underline disabled:opacity-40">
              Volver a heredar todo
            </button>
          )}
        </div>
      </div>

      <div className="bg-surface border border-border rounded-card shadow-card p-4">
        <div className="font-display font-bold text-[13px] text-primary mb-0.5">
          Franja horaria{marcaPropio('timezone')}
        </div>
        <p className="text-[11.5px] text-tertiary mb-2">
          Con la que el agente interpreta "mañana a las 5". Si no coincide con la del calendario, todas las horas que diga se corren sin avisar.
        </p>
        <select value={valor('timezone', 'America/Mexico_City')}
          onChange={e => escribir({ timezone: e.target.value })}
          disabled={guardando}
          className="w-full px-3 py-2 rounded-[10px] border border-black/[0.1] bg-surface text-[13px] text-primary">
          {FRANJAS.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
        </select>
      </div>

      <div className="bg-surface border border-border rounded-card shadow-card p-4">
        <div className="font-display font-bold text-[13px] text-primary mb-0.5">
          Cuánto dura una cita{marcaPropio('meetingDuration')}
        </div>
        <p className="text-[11.5px] text-tertiary mb-2">Los minutos que el agente aparta al ofrecer un horario.</p>
        <Minutos valor={valor('meetingDuration', 30)} onChange={v => escribir({ meetingDuration: v })}
          presets={[15, 20, 30, 45, 60]} min={5} />
      </div>

      <div className="bg-surface border border-border rounded-card shadow-card p-4">
        <div className="font-display font-bold text-[13px] text-primary mb-0.5">
          Cada cuánto puede empezar una cita{marcaPropio('slotStep')}
        </div>
        <p className="text-[11.5px] text-tertiary mb-2">Con 30 ofrece 9:00, 9:30, 10:00… Con 15 aprovecha más la agenda.</p>
        <Minutos valor={valor('slotStep', 30)} onChange={v => escribir({ slotStep: v })}
          presets={[10, 15, 20, 30, 60]} min={5} />
      </div>

      <div className="bg-surface border border-border rounded-card shadow-card p-4">
        <div className="font-display font-bold text-[13px] text-primary mb-0.5">
          Respiro entre citas{marcaPropio('meetingBuffer')}
        </div>
        <p className="text-[11.5px] text-tertiary mb-2">Tiempo libre antes y después de cada cita ya tomada.</p>
        <Minutos valor={valor('meetingBuffer', 15)} onChange={v => escribir({ meetingBuffer: v })}
          presets={[0, 10, 15, 30, 45]} />
      </div>

      <div className="[&_.bg-surface]:border-border">
        <HorariosDeAtencion
          valor={valor('workingHours', null)}
          onChange={h => escribir({ workingHours: h })}
        />
      </div>
    </div>
  )
}

function PanelDeComentarios({ marca, onGuardar }) {
  const inicial = marca.comentarios || {}
  const [activo, setActivo] = useState(Boolean(inicial.activo))
  const [palabra, setPalabra] = useState(inicial.palabra || '')
  const [publica, setPublica] = useState(inicial.respuestaPublica || '')
  const [privada, setPrivada] = useState(inicial.respuestaPrivada || '')
  const [guardando, setGuardando] = useState(false)

  const guardar = async () => {
    setGuardando(true)
    try {
      await onGuardar({
        comentarios: {
          activo,
          palabra: palabra.trim(),
          respuestaPublica: publica.trim(),
          respuestaPrivada: privada.trim(),
        },
      })
      toast.success('Guardado')
    } catch {
      toast.error('No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="bg-surface border border-border rounded-card shadow-card p-5 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare size={15} className="text-tertiary" />
        <h2 className="font-display font-bold text-[14px] text-primary">Comentarios</h2>
        <label className="ml-auto flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} />
          <span className="text-[12px] text-secondary">Activo</span>
        </label>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-tertiary mb-1.5">
            Palabra que lo dispara
          </label>
          <input
            value={palabra} onChange={e => setPalabra(e.target.value)}
            placeholder="GUIA"
            className="w-full px-3 py-2 rounded-btn bg-surface-2 border border-border text-[13px] text-primary outline-none focus:border-accent-blue"
          />
          <p className="text-[11px] text-tertiary mt-1.5">
            Si lo dejas vacío responde a todos los comentarios.
          </p>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-tertiary mb-1.5">
            Respuesta en el hilo
          </label>
          <input
            value={publica} onChange={e => setPublica(e.target.value)}
            placeholder="¡Te lo acabo de mandar por privado! 📩"
            className="w-full px-3 py-2 rounded-btn bg-surface-2 border border-border text-[13px] text-primary outline-none focus:border-accent-blue"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-tertiary mb-1.5">
            Mensaje privado
          </label>
          <textarea
            value={privada} onChange={e => setPrivada(e.target.value)} rows={3}
            placeholder="Aquí tienes la guía: ejemplo.com/guia&#10;&#10;¿Qué es lo que más se te complica hoy?"
            className="w-full px-3 py-2 rounded-btn bg-surface-2 border border-border text-[13px] text-primary outline-none focus:border-accent-blue resize-none"
          />
          <div className="flex items-start gap-1.5 mt-2 text-[11px] text-accent-amber leading-snug">
            <AlertTriangle size={12} className="shrink-0 mt-0.5" />
            <span>
              Instagram deja <strong>un solo privado por comentario</strong>, y ese mensaje
              no abre la conversación: hasta que la persona conteste, el agente no puede
              escribirle. Mete el enlace <strong>y</strong> una pregunta — esa respuesta es
              la que le abre la puerta.
            </span>
          </div>
        </div>

        <button onClick={guardar} disabled={guardando}
          className="px-4 py-2 rounded-btn bg-accent-blue text-white text-[13px] font-bold disabled:opacity-50">
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}

// ─── RENDIMIENTO ──────────────────────────────────────────────────
const pct = (n) => (typeof n === 'number' ? `${(n * 100).toFixed(1)}%` : '—')
const num = (n) => (typeof n === 'number' ? Math.round(n).toLocaleString('es-MX') : '—')
const veces = (n) => (typeof n === 'number' ? `${n.toFixed(2)}x` : '—')

function Dato({ valor, titulo, pie }) {
  return (
    <div className="bg-surface-2 border border-border rounded-btn p-3">
      <div className="font-display font-bold text-[20px] text-primary leading-none">{valor}</div>
      <div className="text-[12px] font-semibold text-secondary mt-1.5">{titulo}</div>
      <div className="text-[11px] text-tertiary mt-0.5 leading-snug">{pie}</div>
    </div>
  )
}

function PanelDeRendimiento({ marca, orgId }) {
  const [sincronizando, setSincronizando] = useState(false)
  const r = marca.resumen
  const conectada = estadoDeConexion(marca) === CONECTADA

  const sincronizar = async () => {
    setSincronizando(true)
    try {
      const res = await fetch('/.netlify/functions/instagram-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, brandId: marca.id }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.detalle || data.error || 'No se pudo sincronizar')
      toast.success(`${data.publicaciones} publicaciones analizadas`)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSincronizando(false)
    }
  }

  return (
    <div className="bg-surface border border-border rounded-card shadow-card p-5 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 size={15} className="text-tertiary" />
        <h2 className="font-display font-bold text-[14px] text-primary">Rendimiento</h2>
        {conectada && (
          <button
            onClick={sincronizar} disabled={sincronizando}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-btn bg-surface-2 border border-border text-[12px] font-semibold text-secondary hover:text-primary disabled:opacity-50"
          >
            <RefreshCw size={13} className={sincronizando ? 'animate-spin' : undefined} />
            {sincronizando ? 'Analizando…' : 'Actualizar'}
          </button>
        )}
      </div>

      {!conectada ? (
        <p className="text-[13px] text-tertiary">
          Cadencia, propagación y multiplicador de alcance aparecen en cuanto conectes Instagram.
        </p>
      ) : !r ? (
        <p className="text-[13px] text-tertiary">
          Todavía no se ha analizado nada. Dale a Actualizar.
        </p>
      ) : (
        <>
          <div className="grid gap-2.5 grid-cols-2 lg:grid-cols-4">
            <Dato
              valor={r.publicadosUltimos30 ?? '—'}
              titulo="Cadencia"
              pie="Publicaciones en 30 días. Lo único que de verdad controlas."
            />
            <Dato
              valor={num(r.medianaVistas)}
              titulo="Vistas típicas"
              pie="La mediana, no el promedio: un viral no te engaña."
            />
            <Dato
              valor={pct(r.propagacionMedia)}
              titulo="Propagación"
              pie="Compartidos entre vistas. Predice viralidad mejor que los likes."
            />
            <Dato
              valor={veces(r.multiplicadorMedio)}
              titulo="Multiplicador"
              pie="Vistas entre seguidores. Arriba de 1x saliste de tu audiencia."
            />
          </div>
          {r.analizados != null && (
            <p className="text-[11px] text-tertiary mt-2.5">
              Sobre las últimas {r.analizados} publicaciones.
            </p>
          )}
        </>
      )}
    </div>
  )
}

/* De dónde vinieron los leads.
 *
 * Las cuatro métricas de arriba las da cualquier herramienta de analítica:
 * son alcance. Esta es la única que necesita que la publicación haya salido
 * desde el CRM — porque entonces el comentario que llega trae el id del post,
 * y el lead que nace de ahí queda amarrado a la pieza que lo trajo.
 *
 * Es la respuesta a "¿y esto para qué me sirve?": no cuántos vieron el reel,
 * sino a cuántos pacientes se convirtió. */
function PanelDeAtribucion({ marca, orgId }) {
  const [posts, setPosts] = useState(null)

  useEffect(() => {
    if (!orgId || !marca?.id) return
    const q = query(
      collection(db, 'organizations', orgId, 'brands', marca.id, 'publicaciones'),
      orderBy('leads', 'desc'),
      limit(8),
    )
    return onSnapshot(q,
      snap => setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => (p.leads || 0) > 0)),
      err => { console.error('[marca] no se pudieron leer las publicaciones:', err); setPosts([]) },
    )
  }, [orgId, marca?.id])

  const total = (posts || []).reduce((s, p) => s + (p.leads || 0), 0)

  return (
    <div className="bg-surface border border-border rounded-card shadow-card p-5 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Users size={15} className="text-tertiary" />
        <h2 className="font-display font-bold text-[14px] text-primary">De dónde vinieron los leads</h2>
        {total > 0 && (
          <span className="ml-auto font-display font-bold text-[20px] text-accent-green leading-none">{total}</span>
        )}
      </div>

      {posts === null ? (
        <p className="text-[13px] text-tertiary">Cargando…</p>
      ) : !posts.length ? (
        <p className="text-[13px] text-tertiary">
          Todavía ninguna publicación trajo un lead. En cuanto alguien comente una
          pieza publicada desde aquí, aparece en esta lista con su nombre.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {posts.map(p => (
            <div key={p.id} className="flex items-center gap-3 bg-surface-2 border border-border rounded-btn px-3 py-2.5">
              <span className="font-display font-bold text-[17px] text-accent-green leading-none w-7 shrink-0">
                {p.leads}
              </span>
              <span className="text-[12.5px] text-secondary truncate flex-1 min-w-0">
                {p.caption?.trim() || <span className="text-tertiary">Publicación sin texto</span>}
              </span>
              <span className="text-[11px] text-tertiary shrink-0">
                {{ imagen: 'Foto', carrusel: 'Carrusel' }[p.tipo] || 'Reel'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── FICHA ────────────────────────────────────────────────────────
function FichaDeMarca({ marca, orgId, dueño, puedeEditar, onVolver, onEditar, onEliminar, onActualizar }) {

  return (
    <div className="max-w-[900px] mx-auto">
      <button onClick={onVolver} className="flex items-center gap-1 text-[13px] text-tertiary hover:text-primary mb-4">
        <ChevronLeft size={15} /> Todas las marcas
      </button>

      <div className="bg-surface border border-border rounded-card shadow-card p-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-surface-2 border border-border flex items-center justify-center shrink-0 overflow-hidden">
            {marca.fotoURL
              ? <img src={marca.fotoURL} alt="" className="w-full h-full object-cover" />
              : <Instagram size={22} className="text-tertiary" />}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display font-bold text-[20px] text-primary truncate">{marca.nombre}</h1>
            <div className="text-[13px] text-tertiary">
              {marca.handle ? `@${marca.handle}` : 'Sin cuenta de Instagram'}
              {marca.nicho && ` · ${marca.nicho}`}
            </div>
            {!marca.pipelineId && (
              <div className="flex items-center gap-1.5 mt-1 text-[12px] text-accent-amber">
                <AlertTriangle size={12} /> Sin pipeline: los mensajes de esta cuenta no sabrían a dónde ir
              </div>
            )}
            {dueño && (
              <div className="flex items-center gap-1.5 mt-1 text-[12px] text-tertiary">
                <Users size={12} /> {dueño}
              </div>
            )}
          </div>
          {puedeEditar && (
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={onEditar} title="Editar"
                className="w-8 h-8 rounded-btn flex items-center justify-center text-tertiary hover:text-primary hover:bg-surface-2">
                <Pencil size={15} />
              </button>
              <button onClick={onEliminar} title="Eliminar"
                className="w-8 h-8 rounded-btn flex items-center justify-center text-tertiary hover:text-accent-red hover:bg-surface-2">
                <Trash2 size={15} />
              </button>
            </div>
          )}
        </div>
      </div>

      <PanelDeConexion marca={marca} orgId={orgId} />
      <PanelDeAgenda marca={marca} orgId={orgId} />
      <PanelDeRendimiento marca={marca} orgId={orgId} />
      <PanelDeAtribucion marca={marca} orgId={orgId} />
      {estadoDeConexion(marca) === CONECTADA && (
        <PanelDeComentarios marca={marca} onGuardar={onActualizar} />
      )}
    </div>
  )
}

// ─── PANTALLA ─────────────────────────────────────────────────────
export default function MarcaPersonal() {
  const { marcas, cargando, veTodas, puedeEditar, crear, actualizar, eliminar } = useBrands()
  const { members } = useTeam()
  const { pipelines } = usePipeline()
  const { user, org } = useAuthStore()
  const [abierta, setAbierta] = useState(null)
  const [pestana, setPestana] = useState('marcas')
  const [params, setParams] = useSearchParams()

  // Instagram devuelve al usuario aquí con el resultado en la URL. Se avisa y
  // se limpia, para que un refresco no vuelva a cantar "conectada".
  useEffect(() => {
    const ig = params.get('ig')
    if (!ig) return
    if (ig === 'connected') toast.success('Instagram conectado')
    else toast.error(params.get('msg') || 'No se pudo conectar con Instagram')
    const limpio = new URLSearchParams(params)
    limpio.delete('ig'); limpio.delete('msg')
    setParams(limpio, { replace: true })
  }, [params, setParams])
  const [editando, setEditando] = useState(null)   // objeto marca, o 'nueva'

  const nombreDelDueño = (marca) => {
    if (!marca?.ownerUserId || marca.ownerUserId === user?.uid) return null
    const m = members.find(x => x.id === marca.ownerUserId)
    return m?.name || m?.email || null
  }

  const marcaAbierta = marcas.find(m => m.id === abierta) || null

  const guardar = async (datos) => {
    if (editando === 'nueva') {
      const id = await crear(datos)
      toast.success('Marca creada')
      if (id) setAbierta(id)
    } else {
      await actualizar(editando.id, datos)
      toast.success('Marca actualizada')
    }
  }

  const borrar = async (marca) => {
    if (!window.confirm(`¿Eliminar la marca "${marca.nombre}"? No se puede deshacer.`)) return
    await eliminar(marca.id)
    setAbierta(null)
    toast.success('Marca eliminada')
  }

  if (cargando) {
    return <div className="p-6 text-[13px] text-tertiary">Cargando marcas…</div>
  }

  return (
    <div className="p-6">
      {marcaAbierta ? (
        <FichaDeMarca
          marca={marcaAbierta}
          orgId={org?.id}
          dueño={nombreDelDueño(marcaAbierta)}
          puedeEditar={puedeEditar}
          onVolver={() => setAbierta(null)}
          onEditar={() => setEditando(marcaAbierta)}
          onEliminar={() => borrar(marcaAbierta)}
          onActualizar={cambios => actualizar(marcaAbierta.id, cambios)}
        />
      ) : (
        <>
          <div className="flex items-center gap-3 mb-4">
            <div>
              <h1 className="font-display font-bold text-[20px] text-primary">Marca personal</h1>
              <p className="text-[13px] text-tertiary">
                {veTodas
                  ? `${marcas.length} ${marcas.length === 1 ? 'marca' : 'marcas'} en esta cuenta`
                  : 'Tus marcas'}
              </p>
            </div>
            {puedeEditar && pestana === 'marcas' && (
              <button
                onClick={() => setEditando('nueva')}
                className="ml-auto flex items-center gap-1.5 px-3.5 py-2 rounded-btn bg-accent-blue text-white text-[13px] font-bold"
              >
                <Plus size={15} /> Nueva marca
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 mb-5 border-b border-border">
            {[
              { id: 'marcas', label: 'Marcas' },
              { id: 'referencias', label: 'Referencias' },
              { id: 'produccion', label: 'Producción' },
              { id: 'publicar', label: 'Publicar' },
            ].map(t => (
              <button key={t.id} onClick={() => setPestana(t.id)}
                className={clsx('px-3 py-2 text-[13px] font-semibold border-b-2 -mb-px transition-colors',
                  pestana === t.id
                    ? 'border-accent-blue text-primary'
                    : 'border-transparent text-tertiary hover:text-secondary')}>
                {t.label}
              </button>
            ))}
          </div>

          {pestana === 'referencias' ? (
            <Referencias marcas={marcas} />
          ) : pestana === 'produccion' ? (
            <Produccion marcas={marcas} />
          ) : pestana === 'publicar' ? (
            <PanelPublicar marcas={marcas} orgId={org?.id} />
          ) : marcas.length === 0 ? (
            <div className="bg-surface border border-border rounded-card shadow-card p-10 text-center">
              <Instagram size={28} className="text-tertiary mx-auto mb-3" />
              <h2 className="font-display font-bold text-[15px] text-primary mb-1">
                Todavía no hay marcas
              </h2>
              <p className="text-[13px] text-tertiary max-w-[420px] mx-auto">
                Una marca es la cuenta de Instagram de una persona. Crea una por cada
                creador al que le lleves el contenido: cada quien entra y ve la suya.
              </p>
              {puedeEditar && (
                <button
                  onClick={() => setEditando('nueva')}
                  className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-btn bg-accent-blue text-white text-[13px] font-bold"
                >
                  <Plus size={15} /> Crear la primera
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {marcas.map(m => (
                <TarjetaDeMarca
                  key={m.id}
                  marca={m}
                  dueño={nombreDelDueño(m)}
                  onAbrir={() => setAbierta(m.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {editando && (
        <FormularioDeMarca
          marca={editando === 'nueva' ? null : editando}
          miembros={members}
          pipelines={pipelines}
          onGuardar={guardar}
          onCerrar={() => setEditando(null)}
        />
      )}
    </div>
  )
}

const fecha = (ts) => {
  const d = ts?.toDate?.() || (ts ? new Date(ts) : null)
  if (!d || isNaN(d)) return ''
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

/* El historial de la cuenta.
 *
 * Instagram ya devuelve todas las publicaciones con su miniatura y sus
 * números; eso vive en `posts` y lo llena el botón Actualizar. Lo que solo
 * existe acá son las que salieron DESDE FlowHub: esas están además en
 * `publicaciones`, con el contador de leads que el comentario fue sumando.
 *
 * Verlas juntas es el argumento entero en una pantalla: las mismas columnas
 * para todas, y la de leads llena únicamente en las que se publicaron desde
 * el CRM. */
function Historial({ marca, orgId }) {
  const [posts, setPosts] = useState(null)
  const [desdeCRM, setDesdeCRM] = useState({})

  useEffect(() => {
    if (!orgId || !marca?.id) return
    const base = ['organizations', orgId, 'brands', marca.id]
    const corta = (e) => console.error('[marca] historial:', e)

    const a = onSnapshot(
      query(collection(db, ...base, 'posts'), orderBy('publicadoEn', 'desc'), limit(12)),
      s => setPosts(s.docs.map(d => ({ id: d.id, ...d.data() }))),
      e => { corta(e); setPosts([]) })

    const b = onSnapshot(
      query(collection(db, ...base, 'publicaciones'), limit(100)),
      s => setDesdeCRM(Object.fromEntries(s.docs.map(d => [d.id, d.data()]))),
      corta)

    return () => { a(); b() }
  }, [orgId, marca?.id])

  return (
    <div className="bg-surface border border-border rounded-card shadow-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 size={15} className="text-tertiary" />
        <h2 className="font-display font-bold text-[14px] text-primary">Historial</h2>
        <span className="ml-auto text-[11px] text-tertiary">
          Se llena con Actualizar, en la ficha de la marca
        </span>
      </div>

      {posts === null ? (
        <p className="text-[13px] text-tertiary">Cargando…</p>
      ) : !posts.length ? (
        <p className="text-[13px] text-tertiary">
          Todavía no hay publicaciones analizadas. Ve a Marcas, abre esta marca y
          dale a Actualizar.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {posts.map(p => {
            const crm = desdeCRM[p.mediaId || p.id]
            return (
              <a key={p.id} href={p.permalink || undefined} target="_blank" rel="noreferrer"
                className="flex items-center gap-3 p-2 rounded-btn bg-surface-2 border border-border hover:border-accent-blue transition-colors">
                <div className="w-12 h-12 rounded-btn bg-surface overflow-hidden shrink-0">
                  {p.miniatura
                    ? <img src={p.miniatura} alt="" className="w-full h-full object-cover" loading="lazy" />
                    : <div className="w-full h-full flex items-center justify-center"><ImageOff size={14} className="text-tertiary" /></div>}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] text-secondary truncate">
                    {p.caption?.trim() || <span className="text-tertiary">Sin texto</span>}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-tertiary mt-0.5">
                    <span>{fecha(p.publicadoEn)}</span>
                    {crm && <span className="text-accent-blue font-semibold">Desde FlowHub</span>}
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 text-right">
                  <div>
                    <div className="font-display font-bold text-[13px] text-primary leading-none">{num(p.vistas)}</div>
                    <div className="text-[10px] text-tertiary mt-0.5">vistas</div>
                  </div>
                  <div>
                    <div className="font-display font-bold text-[13px] text-primary leading-none">{num(p.comentarios)}</div>
                    <div className="text-[10px] text-tertiary mt-0.5">coment.</div>
                  </div>
                  <div className="w-10">
                    <div className={clsx('font-display font-bold text-[13px] leading-none',
                      crm?.leads ? 'text-accent-green' : 'text-tertiary')}>
                      {crm ? (crm.leads || 0) : '—'}
                    </div>
                    <div className="text-[10px] text-tertiary mt-0.5">leads</div>
                  </div>
                </div>
              </a>
            )
          })}
        </div>
      )}

      <p className="text-[11px] text-tertiary mt-3">
        La columna de leads solo se puede llenar en las publicaciones que salieron
        desde aquí: es el comentario el que trae el id del post, y así se sabe cuál
        trajo a quién.
      </p>
    </div>
  )
}

/* Publicar es por marca, así que hay que elegir cuál antes de nada. Mismo
 * criterio que el resto del módulo: si solo hay una, no se pregunta. */
function PanelPublicar({ marcas, orgId }) {
  const conectadas = marcas.filter(m => m.ig?.userId)
  const [elegida, setElegida] = useState(conectadas[0]?.id || null)

  if (conectadas.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-card shadow-card p-10 text-center">
        <Instagram size={28} className="text-tertiary mx-auto mb-3" />
        <h2 className="font-display font-bold text-[15px] text-primary mb-1">
          Ninguna marca tiene Instagram conectado
        </h2>
        <p className="text-[13px] text-tertiary max-w-[420px] mx-auto">
          Conecta una cuenta desde la pestaña Marcas y vuelve aquí.
        </p>
      </div>
    )
  }

  const marca = conectadas.find(m => m.id === elegida) || conectadas[0]

  return (
    <div className="space-y-4">
      {conectadas.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {conectadas.map(m => (
            <button key={m.id} onClick={() => setElegida(m.id)}
              className={clsx('px-3 py-1.5 rounded-btn text-[12px] font-bold border transition-colors',
                m.id === marca.id
                  ? 'bg-accent-blue text-white border-accent-blue'
                  : 'bg-surface-2 text-secondary border-border hover:text-primary')}>
              @{m.ig?.username || m.handle}
            </button>
          ))}
        </div>
      )}
      <Publicar orgId={orgId} marca={marca} />
      <Historial orgId={orgId} marca={marca} />
    </div>
  )
}
