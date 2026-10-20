/* Marca Personal.
 *
 * Una cuenta de FlowCRM puede llevar varias marcas personales a la vez: ese es
 * el caso de uso del "grow operator", que asesora a varios creadores sin tener
 * que abrir una cuenta por cada uno. Cada marca tiene un dueño, y el dueño
 * entra y ve solo la suya.
 */
import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import {
  Plus, X, Pencil, Trash2, ChevronLeft, Instagram,
  AlertTriangle, Check, BarChart3, Users, Link2, RefreshCw,
} from 'lucide-react'
import { useBrands, estadoDeConexion, diasParaCaducar, SIN_CONECTAR, CONECTADA, CON_PROBLEMA } from '@/hooks/useBrands'
import Referencias from '@/features/marca/Referencias'
import Produccion from '@/features/marca/Produccion'
import { useTeam } from '@/hooks/useTeam'
import { useAuthStore } from '@/store/authStore'

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
function FormularioDeMarca({ marca, miembros, onGuardar, onCerrar }) {
  const [nombre, setNombre] = useState(marca?.nombre || '')
  const [handle, setHandle] = useState(marca?.handle || '')
  const [nicho, setNicho] = useState(marca?.nicho || '')
  const [ownerUserId, setOwnerUserId] = useState(marca?.ownerUserId || '')
  const [guardando, setGuardando] = useState(false)

  const guardar = async () => {
    if (!nombre.trim()) { toast.error('Ponle un nombre a la marca'); return }
    setGuardando(true)
    try {
      await onGuardar({ nombre, handle, nicho, ownerUserId })
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

// ─── FICHA ────────────────────────────────────────────────────────
function FichaDeMarca({ marca, orgId, dueño, puedeEditar, onVolver, onEditar, onEliminar }) {

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
      <PanelDeRendimiento marca={marca} orgId={orgId} />
    </div>
  )
}

// ─── PANTALLA ─────────────────────────────────────────────────────
export default function MarcaPersonal() {
  const { marcas, cargando, veTodas, puedeEditar, crear, actualizar, eliminar } = useBrands()
  const { members } = useTeam()
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
          onGuardar={guardar}
          onCerrar={() => setEditando(null)}
        />
      )}
    </div>
  )
}
