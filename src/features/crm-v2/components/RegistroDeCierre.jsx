/* Qué pasó realmente cuando se cerró la venta.
 *
 * Antes, marcar ganada cambiaba el estado y nada más: el monto que entraba al
 * reporte era el de lista. Una venta cerrada con 20% de descuento se reportaba
 * completa, y la bolsa no se podía medir aunque estuviera perfectamente
 * definida.
 *
 * Dos decisiones de forma que importan más de lo que parecen:
 *
 * El **código llena el número**. Elegirlo de la lista ahorra escribir, así que
 * el camino fácil es el trazable. Al revés, en un mes nadie usaría códigos.
 *
 * Las **cortesías van acá y no en una nota**. Cerrar regalando una herramienta
 * cuesta igual que cerrar con descuento; si solo se registra el porcentaje, esa
 * concesión desaparece de los números.
 */
import { useMemo, useState } from 'react'
import { X, Check } from 'lucide-react'
import SelectorConCrear from './SelectorConCrear'
import { useBolsa, montoDescuento } from '@/hooks/useBolsa'
import { usePermissions } from '@/hooks/usePermissions'
import toast from 'react-hot-toast'

const pesos = n => '$' + Math.round(Number(n) || 0).toLocaleString('es-MX')
const normalizar = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export default function RegistroDeCierre({ oportunidad, onConfirmar, onCerrar }) {
  const { codigos, cortesias, crearCodigo, crearCortesia } = useBolsa()
  const { canManageProducts } = usePermissions()

  const listPrice = Number(oportunidad?.value) || 0

  const [tipo, setTipo] = useState('porcentaje')
  const [valor, setValor] = useState('')
  const [codigo, setCodigo] = useState(null)
  const [elegidas, setElegidas] = useState([])
  const [formaPago, setFormaPago] = useState('contado')
  const [cuotas, setCuotas] = useState(3)
  const [guardando, setGuardando] = useState(false)

  const descuento = montoDescuento(listPrice, tipo, valor)
  const closePrice = Math.max(0, listPrice - descuento)
  const valorCortesias = elegidas.reduce((s, c) => s + (Number(c.listPrice) || 0), 0)

  const disponibles = useMemo(
    () => cortesias.filter(c => !elegidas.some(e => e.id === c.id)),
    [cortesias, elegidas],
  )

  /* Elegir un código escribe el descuento. Si después se cambia el número a
     mano, el código se suelta: el registro diría que vino de una táctica que
     ya no es la que se aplicó. */
  const elegirCodigo = (c) => {
    setCodigo(c)
    setTipo(c.tipo || 'porcentaje')
    setValor(String(c.valor ?? ''))
  }

  const cambiarValor = (v) => {
    setValor(v)
    if (codigo && String(v) !== String(codigo.valor)) setCodigo(null)
  }

  const nuevoCodigo = async (texto) => {
    const id = await crearCodigo({ code: texto, label: texto, tipo, valor: Number(valor) || 0 })
    if (!id) return
    toast.success(`Código ${texto.toUpperCase()} creado`)
    setCodigo({ id, code: texto.toUpperCase(), label: texto, tipo, valor: Number(valor) || 0 })
  }

  const nuevaCortesia = async (texto) => {
    const id = await crearCortesia({ name: texto, listPrice: 0 })
    if (!id) return
    setElegidas(e => [...e, { id, name: texto, listPrice: 0 }])
    toast('Ponle su precio de lista en la bolsa cuando puedas', { icon: '💡' })
  }

  const confirmar = async () => {
    setGuardando(true)
    try {
      await onConfirmar({
        listPrice,
        discountType: valor ? tipo : null,
        discountValue: valor ? Number(valor) : 0,
        discountAmount: descuento,
        discountCode: codigo ? (codigo.code || null) : null,
        discountCodeId: codigo ? (codigo.id || null) : null,
        courtesies: elegidas.map(c => ({ id: c.id, name: c.name, listPrice: Number(c.listPrice) || 0 })),
        courtesiesValue: valorCortesias,
        closePrice,
        paymentType: formaPago,
        installments: formaPago === 'cuotas' ? Number(cuotas) || 1 : 1,
      })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="pv2-dialog">
      <div className="pv2-dialog__backdrop" onClick={onCerrar} />
      <div className="pv2-dialog__box" style={{ maxWidth: 440 }}>
        <h2 className="pv2-dialog__title">Cómo se cerró</h2>
        <p className="pv2-dialog__hint">{oportunidad?.name}</p>

        <div className="pv2-cierre-lista">
          <span>Precio de lista</span>
          <b>{pesos(listPrice)}</b>
        </div>

        <div>
          <label className="pv2-input-label">Descuento</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <div className="pv2-seg">
              <button className={tipo === 'porcentaje' ? 'on' : ''} onClick={() => setTipo('porcentaje')}>%</button>
              <button className={tipo === 'monto' ? 'on' : ''} onClick={() => setTipo('monto')}>$</button>
            </div>
            <input
              className="pv2-input"
              type="number" min="0" step="any"
              value={valor}
              onChange={e => cambiarValor(e.target.value)}
              placeholder={tipo === 'porcentaje' ? '0' : '0'}
              style={{ flex: 1 }}
            />
          </div>
          {descuento > 0 && (
            <p className="pv2-hint">Son {pesos(descuento)} menos.</p>
          )}
        </div>

        <div>
          <label className="pv2-input-label">Código</label>
          <SelectorConCrear
            items={codigos}
            valor={codigo}
            etiqueta={c => c.code}
            detalle={c => `${c.tipo === 'monto' ? pesos(c.valor) : c.valor + '%'} · ${c.label || ''}`}
            filtrar={(c, t) => normalizar(c.code).includes(normalizar(t)) || normalizar(c.label).includes(normalizar(t))}
            placeholder="Sin código"
            textoCrear="Crear código"
            onElegir={elegirCodigo}
            onCrear={canManageProducts ? nuevoCodigo : undefined}
            mensajeVacio={canManageProducts
              ? 'Ninguno coincide'
              : 'No existe ese código. El descuento a mano de arriba funciona igual.'}
          />
          <p className="pv2-hint">Déjalo vacío si el descuento no vino de una táctica.</p>
        </div>

        <div>
          <label className="pv2-input-label">Cortesías</label>
          {elegidas.length > 0 && (
            <div className="pv2-cortesias">
              {elegidas.map(c => (
                <span key={c.id} className="pv2-cortesia">
                  {c.name}
                  {c.listPrice > 0 && <i>{pesos(c.listPrice)}</i>}
                  <button onClick={() => setElegidas(e => e.filter(x => x.id !== c.id))} title="Quitar">
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <SelectorConCrear
            items={disponibles}
            valor={null}
            etiqueta={c => c.name}
            detalle={c => (c.listPrice ? pesos(c.listPrice) : 'Sin precio de lista')}
            filtrar={(c, t) => normalizar(c.name).includes(normalizar(t))}
            placeholder="Qué regalaste"
            textoCrear="Agregar"
            onElegir={c => setElegidas(e => [...e, c])}
            onCrear={nuevaCortesia}
            mensajeVacio="Ninguna coincide"
          />
          {valorCortesias > 0 && (
            <p className="pv2-hint">{pesos(valorCortesias)} de precio de lista entregados sin costo.</p>
          )}
        </div>

        <div>
          <label className="pv2-input-label">Forma de pago</label>
          <div className="pv2-seg">
            <button className={formaPago === 'contado' ? 'on' : ''} onClick={() => setFormaPago('contado')}>Contado</button>
            <button className={formaPago === 'cuotas' ? 'on' : ''} onClick={() => setFormaPago('cuotas')}>Cuotas</button>
          </div>
          {formaPago === 'cuotas' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <input
                className="pv2-input" type="number" min="2" max="36"
                value={cuotas} onChange={e => setCuotas(e.target.value)}
                style={{ width: 70 }}
              />
              <span className="pv2-hint" style={{ margin: 0 }}>
                cuotas de {pesos(closePrice / Math.max(1, Number(cuotas) || 1))}
              </span>
            </div>
          )}
        </div>

        <div className="pv2-cierre-total">
          <span>Precio de cierre</span>
          <b>{pesos(closePrice)}</b>
        </div>
        <div className="pv2-dialog__actions">
          <button type="button" className="pv2-btn" onClick={onCerrar}>Cancelar</button>
          <button type="button" className="pv2-btn pv2-btn--primary" onClick={confirmar} disabled={guardando}>
            <Check size={13} /> {guardando ? 'Guardando…' : 'Marcar como ganada'}
          </button>
        </div>
      </div>
    </div>
  )
}
