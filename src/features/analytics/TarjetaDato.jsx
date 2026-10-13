import { useMemo } from 'react'
import { Pencil, Trash2, Download, AlertTriangle, Info } from 'lucide-react'
import { MEDIDAS, DIMENSIONES } from './catalogo'
import { calcular } from './motor'
import { RENDERIZADORES } from './Formas'
import { descargarCSV } from '@/lib/exportar'

/**
 * Una tarjeta del tablero: un cruce de medida por dimensión, mostrado de la
 * forma elegida.
 *
 * Siempre muestra el aviso de confiabilidad cuando corresponde. No es un
 * adorno: un porcentaje sobre seis casos se mueve diecisiete puntos con un
 * caso más, y quien lo mira decide como si fuera firme.
 */
export default function TarjetaDato({ tarjeta, datos, periodo, onEditar, onBorrar }) {
  const res = useMemo(
    () => calcular(datos, tarjeta.medida, tarjeta.dimension, periodo),
    [datos, tarjeta.medida, tarjeta.dimension, periodo],
  )

  const medida = MEDIDAS[tarjeta.medida]
  const dimension = DIMENSIONES[tarjeta.dimension]
  if (!medida) return null

  const Render = RENDERIZADORES[tarjeta.forma] || RENDERIZADORES.numero
  const titulo = tarjeta.titulo
    || (tarjeta.dimension === 'ninguna' ? medida.label : `${medida.label} por ${dimension.label.toLowerCase()}`)

  const exportar = () => {
    descargarCSV(
      titulo.toLowerCase().replace(/\s+/g, '-'),
      [
        { label: dimension.label, valor: f => f.label },
        { label: medida.label, valor: f => f.valor },
        { label: 'Casos', valor: f => f.casos },
      ],
      res.filas,
    )
  }

  return (
    <div className="card p-4 flex flex-col gap-2 h-full min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display font-bold text-[13.5px] truncate">{titulo}</h3>
          <p className="text-[11px] text-tertiary truncate" title={medida.descripcion}>
            {medida.descripcion}
          </p>
        </div>
        <div className="flex gap-0.5 flex-shrink-0 opacity-0 group-hover/t:opacity-100 transition-opacity">
          <button onClick={exportar} title="Exportar a CSV"
            className="p-1 rounded text-tertiary hover:text-primary"><Download size={13} /></button>
          {onEditar && (
            <button onClick={onEditar} title="Editar"
              className="p-1 rounded text-tertiary hover:text-primary"><Pencil size={13} /></button>
          )}
          {onBorrar && (
            <button onClick={onBorrar} title="Quitar del tablero"
              className="p-1 rounded text-tertiary hover:text-red-500"><Trash2 size={13} /></button>
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        {tarjeta.forma === 'numero'
          ? <Render valor={res.total} formato={res.formato} sub={`${res.casos} ${res.casos === 1 ? 'caso' : 'casos'} en el período`} />
          : <Render filas={res.filas} formato={res.formato} />}
      </div>

      {res.aviso && (
        <div className={`flex items-start gap-1.5 text-[11px] leading-snug pt-2 border-t border-border ${
          res.aviso.nivel === 'vacio' ? 'text-tertiary' : 'text-amber-500'
        }`}>
          {res.aviso.nivel === 'vacio'
            ? <Info size={12} className="flex-shrink-0 mt-0.5" />
            : <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />}
          <span>{res.aviso.texto}</span>
        </div>
      )}
    </div>
  )
}
