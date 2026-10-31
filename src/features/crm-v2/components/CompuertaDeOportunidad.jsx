import { useState, useMemo } from 'react'
import SelectorConCrear from './SelectorConCrear'
import { useOpportunities } from '@/hooks/useOpportunities'
import { useProducts } from '@/hooks/useProducts'
import { normalizar } from '../buscar'
import toast from 'react-hot-toast'

/**
 * La pregunta que nadie se hace: ¿qué le estás dando seguimiento?
 *
 * En Prospección todavía se está averiguando qué necesita. Pero en Seguimiento
 * ya se le da seguimiento a algo, y si no hay oportunidad no hay a qué.
 * Preguntarlo al cerrar es tarde — ahí ya nadie se acuerda de qué se trataba.
 *
 * No es un trámite: es la definición que obliga a que el tablero signifique
 * algo. Sin esto se puede llegar a Cierre sin haber vendido nada, y el dinero
 * del tablero deja de ser dinero.
 */
export default function CompuertaDeOportunidad({ lead, products = [], onListo, onCancelar }) {
  const { crear } = useOpportunities(lead?.id)
  const { createProduct } = useProducts()
  const [producto, setProducto] = useState(null)
  const [monto, setMonto] = useState('')
  const [guardando, setGuardando] = useState(false)

  const disponibles = useMemo(
    () => products.filter(p => p.status !== 'inactive'),
    [products]
  )

  /* Crear el producto sin salir de aquí. Si hay que ir al catálogo a darlo de
   * alta, la compuerta deja de ser una pregunta útil y se vuelve un muro. */
  const crearProducto = async (nombre) => {
    try {
      const nuevo = await createProduct({ name: nombre, price: 0 })
      if (nuevo) { setProducto(nuevo); setMonto('') }
    } catch {
      toast.error('No se pudo crear el producto')
    }
  }

  const elegir = (p) => {
    setProducto(p)
    if (p?.price) setMonto(String(p.price))
  }

  const confirmar = async () => {
    if (!producto || guardando) return
    setGuardando(true)
    try {
      await crear({ name: producto.name, value: Number(monto) || 0, productId: producto.id })
      onListo()
    } catch {
      toast.error('No se pudo crear la oportunidad')
      setGuardando(false)
    }
  }

  return (
    <div className="pv2-dialog">
      <div className="pv2-dialog__backdrop" onClick={onCancelar} />
      <div className="pv2-dialog__box">
        <h2 className="pv2-dialog__title">¿Qué le estás dando seguimiento?</h2>
        <p className="pv2-dialog__hint">
          {lead?.name} pasa a Seguimiento y todavía no tiene ninguna oportunidad.
        </p>

        <div>
          <label className="pv2-input-label">Producto *</label>
          <SelectorConCrear
            autoFocus
            items={disponibles}
            valor={producto}
            etiqueta={p => p.name}
            detalle={p => (p.price ? `$${Number(p.price).toLocaleString('es-MX')}` : 'Sin precio')}
            filtrar={(p, t) => normalizar(p.name).includes(normalizar(t))}
            placeholder="Busca un producto o crea uno"
            textoCrear="Crear producto"
            onElegir={elegir}
            onCrear={crearProducto}
          />
        </div>

        {producto && (
          <div>
            <label className="pv2-input-label">Monto</label>
            <input className="pv2-input" value={monto} onChange={e => setMonto(e.target.value)}
              inputMode="numeric" placeholder="0" />
          </div>
        )}

        <div className="pv2-dialog__actions">
          <button type="button" className="pv2-btn" onClick={onCancelar}>Cancelar</button>
          <button type="button" className="pv2-btn pv2-btn--primary"
            onClick={confirmar} disabled={!producto || guardando}>
            {guardando ? 'Guardando…' : 'Crear y mover'}
          </button>
        </div>
      </div>
    </div>
  )
}
