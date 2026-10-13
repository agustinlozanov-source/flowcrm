import { useState, useEffect, useMemo } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { Plus, RotateCcw, LayoutGrid } from 'lucide-react'
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
export default function Tablero({ datos, periodo }) {
  const { org } = useAuthStore()
  const orgId = org?.id
  const [activo, setActivo] = useState('operacion')
  const [personalizados, setPersonalizados] = useState({})
  const [editando, setEditando] = useState(null) // { filaId, tarjeta? }
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

  if (!listo) return <div className="p-6 text-sm text-secondary">Cargando el tablero…</div>

  const filaEnEdicion = editando && tablero.filas.find(f => f.id === editando.filaId)
  const libre = filaEnEdicion ? 4 - ocupado(filaEnEdicion) + (editando.tarjeta?.ancho || 0) : 4

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
        {esModificado && (
          <button onClick={restaurar}
            className="text-[11.5px] text-tertiary hover:text-primary flex items-center gap-1 ml-1">
            <RotateCcw size={12} /> Restaurar
          </button>
        )}
      </div>
      <p className="text-xs text-secondary -mt-2">{(TODOS.find(t => t.id === activo) || {}).para}</p>

      {/* Filas */}
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
          <div key={fila.id} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(fila.tarjetas || []).map(t => (
              <div key={t.id} className="group/t" style={{ gridColumn: `span ${Math.min(t.ancho || 1, 4)}` }}>
                <TarjetaDato
                  tarjeta={t} datos={datos} periodo={periodo}
                  onEditar={() => setEditando({ filaId: fila.id, tarjeta: t })}
                  onBorrar={() => borrarTarjeta(fila.id, t.id)}
                />
              </div>
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
          </div>
        )
      })}

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
