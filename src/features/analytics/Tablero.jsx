import { useState, useEffect, useMemo } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { Plus, RotateCcw, LayoutGrid, GripVertical, Tv, X } from 'lucide-react'
import {
  DndContext, DragOverlay, closestCorners,
  PointerSensor, useSensor, useSensors, useDraggable, useDroppable,
} from '@dnd-kit/core'
import toast from 'react-hot-toast'
import TarjetaDato from './TarjetaDato'
import EditorTarjeta from './EditorTarjeta'
import EmbudoCard from './EmbudoCard'
import { PRESETS, EN_BLANCO, conIds } from './presets'

const TODOS = [...PRESETS, EN_BLANCO]
const ocupado = fila => (fila.tarjetas || []).reduce((s, t) => s + (t.ancho || 1), 0)

/**
 * El tablero: filas de hasta cuatro columnas, con tarjetas que ocupan de una a
 * cuatro. Los predefinidos viven en el código; solo se guarda lo que el
 * usuario cambió, así un preset mejorado le llega a todos sin pisar su trabajo.
 */
/* Modo pantalla.
 *
 * Para dejar el tablero puesto en un televisor de la oficina. No hace falta
 * ninguna tecnología de transmisión: se abre a pantalla completa y los datos
 * se actualizan solos, porque el tablero ya escucha los cambios en vivo. Para
 * llevarlo al televisor alcanza con el Chromecast o AirPlay del navegador.
 *
 * Se achica el ancho de las cosas y se agranda la letra, porque una pantalla
 * se mira de lejos y por eso muestra menos y más grande.
 */
export default function Tablero({ datos, periodo }) {
  const { org } = useAuthStore()
  const orgId = org?.id
  const [activo, setActivo] = useState('operacion')
  const [personalizados, setPersonalizados] = useState({})
  const [editando, setEditando] = useState(null) // { filaId, tarjeta? }
  const [arrastrando, setArrastrando] = useState(null)
  const [pantalla, setPantalla] = useState(false)
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [listo, setListo] = useState(false)

  useEffect(() => {
    if (!orgId) { setListo(true); return }
    const ref = doc(db, 'organizations', orgId, 'settings', 'analytics')
    return onSnapshot(ref, snap => {
      const d = snap.data() || {}
      if (d.activo) setActivo(d.activo)
      setPersonalizados(d.personalizados || {})
      setListo(true)
    }, () => setListo(true))
  }, [orgId])

  const guardar = async (cambios) => {
    if (!orgId) return
    await setDoc(doc(db, 'organizations', orgId, 'settings', 'analytics'), cambios, { merge: true })
  }

  const tablero = useMemo(() => {
    const preset = TODOS.find(t => t.id === activo) || TODOS[0]
    const propio = personalizados[activo]
    return propio ? { ...preset, filas: propio } : conIds(preset)
  }, [activo, personalizados])

  const esModificado = !!personalizados[activo]

  const escribirFilas = (filas) => {
    setPersonalizados(p => ({ ...p, [activo]: filas }))
    guardar({ activo, personalizados: { ...personalizados, [activo]: filas } })
  }

  const nuevoId = () => `x${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`

  const agregarFila = () => escribirFilas([...tablero.filas, { id: nuevoId(), tarjetas: [] }])

  const quitarFila = (filaId) =>
    escribirFilas(tablero.filas.filter(f => f.id !== filaId))

  const guardarTarjeta = (datosTarjeta) => {
    const { filaId, tarjeta } = editando
    escribirFilas(tablero.filas.map(f => {
      if (f.id !== filaId) return f
      const tarjetas = tarjeta
        ? f.tarjetas.map(t => (t.id === tarjeta.id ? { ...t, ...datosTarjeta } : t))
        : [...(f.tarjetas || []), { id: nuevoId(), ...datosTarjeta }]
      return { ...f, tarjetas }
    }))
    setEditando(null)
    toast.success(tarjeta ? 'Tarjeta actualizada' : 'Tarjeta agregada')
  }

  const borrarTarjeta = (filaId, tarjetaId) =>
    escribirFilas(tablero.filas.map(f =>
      f.id === filaId ? { ...f, tarjetas: f.tarjetas.filter(t => t.id !== tarjetaId) } : f))

  const restaurar = () => {
    const resto = { ...personalizados }
    delete resto[activo]
    setPersonalizados(resto)
    guardar({ activo, personalizados: resto })
    toast.success('Tablero restaurado')
  }

  const cambiarTablero = (id) => { setActivo(id); guardar({ activo: id }) }

  const entrarPantalla = async () => {
    setPantalla(true)
    // La pantalla completa del navegador puede fallar si no viene de un clic
    // directo o si el equipo no la permite; el modo sirve igual sin ella.
    try { await document.documentElement.requestFullscreen?.() } catch { /* ok */ }
  }

  const salirPantalla = async () => {
    setPantalla(false)
    try { if (document.fullscreenElement) await document.exitFullscreen() } catch { /* ok */ }
  }

  // Salir con Escape apaga la pantalla completa del navegador pero no nuestro
  // modo: hay que escuchar el cambio para que no queden desincronizados.
  useEffect(() => {
    const onCambio = () => { if (!document.fullscreenElement) setPantalla(false) }
    document.addEventListener('fullscreenchange', onCambio)
    return () => document.removeEventListener('fullscreenchange', onCambio)
  }, [])

  /* Mover una tarjeta de fila.
   *
   * Solo entra si cabe: una fila no puede pasar de cuatro columnas, y dejarla
   * desbordar rompe la grilla entera. Si no cabe, se avisa en vez de hacer
   * nada en silencio.
   */
  const soltar = ({ active, over }) => {
    setArrastrando(null)
    if (!over || active.id === over.id) return

    const origen = tablero.filas.find(f => (f.tarjetas || []).some(t => t.id === active.id))
    if (!origen) return
    const tarjeta = origen.tarjetas.find(t => t.id === active.id)

    // Se puede soltar sobre una fila (va al final) o sobre otra tarjeta (va en
    // su lugar). Lo segundo es lo que permite ordenarlas dentro de una fila.
    const sobre = String(over.id)
    let destino, posicion
    if (sobre.startsWith('tarjeta:')) {
      const destinoTarjetaId = sobre.slice(8)
      destino = tablero.filas.find(f => (f.tarjetas || []).some(t => t.id === destinoTarjetaId))
      posicion = destino?.tarjetas.findIndex(t => t.id === destinoTarjetaId)
    } else {
      destino = tablero.filas.find(f => f.id === sobre.replace(/^fila:/, ''))
      posicion = destino?.tarjetas?.length ?? 0
    }
    if (!destino || destino.tipo === 'embudo') return

    // Dentro de la misma fila solo cambia el orden: el espacio ya estaba
    // ocupado por esta tarjeta, así que no hay nada que verificar.
    if (destino.id === origen.id) {
      const resto = origen.tarjetas.filter(t => t.id !== tarjeta.id)
      const i = Math.max(0, Math.min(resto.length, posicion))
      resto.splice(i, 0, tarjeta)
      escribirFilas(tablero.filas.map(f => (f.id === origen.id ? { ...f, tarjetas: resto } : f)))
      return
    }

    const libre = 4 - ocupado(destino)
    if ((tarjeta.ancho || 1) > libre) {
      toast.error(`No entra: en esa fila quedan ${libre} de 4 y la tarjeta ocupa ${tarjeta.ancho || 1}.`)
      return
    }

    escribirFilas(tablero.filas.map(f => {
      if (f.id === origen.id) return { ...f, tarjetas: f.tarjetas.filter(t => t.id !== tarjeta.id) }
      if (f.id === destino.id) {
        const copia = [...(f.tarjetas || [])]
        copia.splice(Math.max(0, Math.min(copia.length, posicion)), 0, tarjeta)
        return { ...f, tarjetas: copia }
      }
      return f
    }))
  }

  if (!listo) return <div className="p-6 text-sm text-secondary">Cargando el tablero…</div>

  const filaEnEdicion = editando && tablero.filas.find(f => f.id === editando.filaId)
  const libre = filaEnEdicion ? 4 - ocupado(filaEnEdicion) + (editando.tarjeta?.ancho || 0) : 4

  if (pantalla) {
    return (
      <div className="fixed inset-0 z-[90] bg-bg overflow-auto p-8 pv2-pantalla">
        <div className="flex items-baseline justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display font-extrabold text-3xl">{tablero.nombre}</h1>
            <p className="text-sm text-secondary mt-1">{tablero.para}</p>
          </div>
          <button onClick={salirPantalla}
            className="btn-secondary text-sm flex items-center gap-1.5 flex-shrink-0">
            <X size={14} /> Salir
          </button>
        </div>
        <div className="flex flex-col gap-6">
          {tablero.filas.map(fila => (
            fila.tipo === 'embudo' ? (
              <EmbudoCard key={fila.id} leads={datos.leads} citas={datos.citas} periodo={periodo} />
            ) : (
              <div key={fila.id} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {(fila.tarjetas || []).map(t => (
                  <div key={t.id} style={{ gridColumn: `span ${Math.min(t.ancho || 1, 4)}` }}>
                    <TarjetaDato tarjeta={t} datos={datos} periodo={periodo} />
                  </div>
                ))}
              </div>
            )
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Elegir tablero */}
      <div className="flex items-center gap-2 flex-wrap">
        <LayoutGrid size={14} className="text-tertiary flex-shrink-0" />
        {TODOS.map(t => (
          <button key={t.id} onClick={() => cambiarTablero(t.id)}
            title={t.para}
            className={`px-3 py-1.5 rounded-lg text-[12.5px] font-semibold border transition-all ${
              activo === t.id ? 'bg-accent-blue text-white border-accent-blue'
                              : 'border-border-strong text-secondary hover:text-primary'
            }`}>{t.nombre}</button>
        ))}
        <button onClick={entrarPantalla}
          title="Dejarlo puesto en una pantalla — se actualiza solo"
          className="ml-auto text-[12px] text-tertiary hover:text-primary flex items-center gap-1.5 flex-shrink-0">
          <Tv size={14} /> Modo pantalla
        </button>
        {esModificado && (
          <button onClick={restaurar}
            className="text-[11.5px] text-tertiary hover:text-primary flex items-center gap-1 ml-1">
            <RotateCcw size={12} /> Restaurar
          </button>
        )}
      </div>
      <p className="text-xs text-secondary -mt-2">{(TODOS.find(t => t.id === activo) || {}).para}</p>

      {/* Filas */}
      <DndContext
        sensors={sensores}
        collisionDetection={closestCorners}
        onDragStart={({ active }) => setArrastrando(active.id)}
        onDragCancel={() => setArrastrando(null)}
        onDragEnd={soltar}
      >
      {tablero.filas.map(fila => {
        if (fila.tipo === 'embudo') {
          return (
            <div key={fila.id} className="grid grid-cols-4 gap-4">
              <div className="col-span-4">
                <EmbudoCard leads={datos.leads} citas={datos.citas} periodo={periodo} />
              </div>
            </div>
          )
        }
        const usado = ocupado(fila)
        return (
          <FilaSoltable key={fila.id} id={fila.id} activa={!!arrastrando}>
            {(fila.tarjetas || []).map(t => (
              <TarjetaArrastrable key={t.id} tarjeta={t} oculta={arrastrando === t.id}>
                <TarjetaDato
                  tarjeta={t} datos={datos} periodo={periodo}
                  onEditar={() => setEditando({ filaId: fila.id, tarjeta: t })}
                  onBorrar={() => borrarTarjeta(fila.id, t.id)}
                />
              </TarjetaArrastrable>
            ))}
            {usado < 4 && (
              <div style={{ gridColumn: `span ${4 - usado}` }}>
                <button
                  onClick={() => setEditando({ filaId: fila.id })}
                  className="w-full h-full min-h-[120px] rounded-[14px] border border-dashed border-border-strong
                             text-tertiary hover:text-primary hover:border-accent-blue
                             flex flex-col items-center justify-center gap-1 text-[12.5px] transition-all"
                >
                  <Plus size={16} />
                  Agregar tarjeta
                  <span className="text-[10.5px] opacity-70">quedan {4 - usado} de 4</span>
                </button>
              </div>
            )}
            {(fila.tarjetas || []).length === 0 && (
              <button onClick={() => quitarFila(fila.id)}
                className="text-[11px] text-tertiary hover:text-red-500 col-span-4 text-right">
                Quitar esta fila
              </button>
            )}
          </FilaSoltable>
        )
      })}

      <DragOverlay>
        {arrastrando && (
          <div className="opacity-90 rotate-1">
            <TarjetaDato
              tarjeta={tablero.filas.flatMap(f => f.tarjetas || []).find(t => t.id === arrastrando)}
              datos={datos} periodo={periodo}
            />
          </div>
        )}
      </DragOverlay>
      </DndContext>

      <button onClick={agregarFila}
        className="self-start text-[12.5px] text-tertiary hover:text-primary flex items-center gap-1.5">
        <Plus size={14} /> Agregar fila
      </button>

      {editando && (
        <EditorTarjeta
          inicial={editando.tarjeta}
          datos={datos}
          periodo={periodo}
          espacioLibre={libre}
          onGuardar={guardarTarjeta}
          onCerrar={() => setEditando(null)}
        />
      )}
    </div>
  )
}

/* La fila es el destino del arrastre. Se marca solo mientras hay algo en el
 * aire: un recuadro permanente ensucia el tablero. */
function FilaSoltable({ id, activa, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: `fila:${id}` })
  return (
    <div
      ref={setNodeRef}
      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 rounded-[14px] transition-all ${
        activa ? 'outline-dashed outline-1 outline-offset-4 outline-border-strong' : ''
      } ${isOver ? 'outline-accent-blue bg-accent-blue/[0.04]' : ''}`}
    >
      {children}
    </div>
  )
}

/* El asa de arrastre va aparte del cuerpo: si toda la tarjeta arrastrara, no
 * se podrían usar sus propios botones. */
function TarjetaArrastrable({ tarjeta, oculta, children }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: tarjeta.id })
  // Además de arrastrarse, recibe: soltar una tarjeta sobre otra es lo que
  // permite ordenarlas dentro de la fila.
  const { setNodeRef: setDrop, isOver } = useDroppable({ id: `tarjeta:${tarjeta.id}` })

  return (
    <div
      ref={el => { setNodeRef(el); setDrop(el) }}
      className={`group/t relative rounded-[14px] transition-all ${
        isOver && !oculta ? 'outline outline-2 outline-offset-2 outline-accent-blue' : ''
      }`}
      style={{ gridColumn: `span ${Math.min(tarjeta.ancho || 1, 4)}`, opacity: oculta ? 0.3 : 1 }}
    >
      <button
        {...attributes} {...listeners}
        title="Arrastrar a otra fila"
        className="absolute left-1.5 top-3 z-10 p-0.5 rounded text-tertiary hover:text-primary
                   opacity-0 group-hover/t:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
      >
        <GripVertical size={13} />
      </button>
      {children}
    </div>
  )
}
