/* El reporte de dirección.
 *
 * La página no espera a que termine: la función de fondo escribe el documento
 * en Firestore y acá se escucha. Eso es lo que permite que el modelo se tome
 * el minuto o los dos que necesita para escribir un reporte entero sin que el
 * navegador se quede colgado ni nada se corte a medias.
 */
import { useEffect, useState } from 'react'
import { doc, onSnapshot, deleteDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { Sparkles, RotateCcw, TriangleAlert, Printer, Trash2 } from 'lucide-react'

const DIAS_POR_PERIODO = { '7d': 7, '30d': 30, month: 30, year: 365 }

/* Un solo reporte por organización, siempre en el mismo documento.
 *
 * Antes cada clic creaba uno con id nuevo y la página solo recordaba el de
 * esta sesión: al recargar desaparecía de la vista aunque siguiera existiendo,
 * y los anteriores se quedaban en la base para siempre sin que nadie pudiera
 * verlos ni borrarlos. Con un id fijo, el reporte sobrevive a la recarga,
 * generar de nuevo reemplaza al viejo, y borrar significa borrar. */
const DOC_ID = 'ultimo'

function Bloque({ titulo, children, className }) {
  return (
    <section className={clsx('rounded-[12px] border border-black/[0.08] bg-surface p-4', className)}>
      <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wide text-tertiary">{titulo}</h3>
      {children}
    </section>
  )
}

function Lista({ items, color }) {
  return (
    <ol className="flex flex-col gap-2.5">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-primary">
          <span
            className="mt-[3px] flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ background: color }}
          >
            {i + 1}
          </span>
          <span>{t}</span>
        </li>
      ))}
    </ol>
  )
}

export default function ReporteIA({ orgId, periodo }) {
  const [doc_, setDoc_] = useState(null)
  const [lanzando, setLanzando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  // Se escucha desde que abre la página: si ya había reporte, aparece solo.
  useEffect(() => {
    if (!orgId) return
    return onSnapshot(
      doc(db, 'organizations', orgId, 'reportes', DOC_ID),
      snap => setDoc_(snap.exists() ? snap.data() : null),
      err => console.error('[reporte] no se pudo escuchar:', err),
    )
  }, [orgId])

  const generar = async () => {
    if (!orgId || lanzando) return
    setLanzando(true)
    setConfirmando(false)
    try {
      const res = await fetch('/.netlify/functions/reporte-analitica-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, reporteId: DOC_ID, dias: DIAS_POR_PERIODO[periodo] || 30 }),
      })
      /* Una Background Function contesta 202 y nada más: el resultado no viene
         por acá, llega al documento, y el onSnapshot de arriba lo recoge. Un
         código distinto significa que ni siquiera arrancó. */
      if (res.status !== 202 && !res.ok) throw new Error(`No arrancó (${res.status})`)
    } catch (e) {
      console.error('[reporte]', e)
      toast.error(e.message || 'No se pudo generar el reporte')
    } finally {
      setLanzando(false)
    }
  }

  const borrar = async () => {
    try {
      await deleteDoc(doc(db, 'organizations', orgId, 'reportes', DOC_ID))
      setConfirmando(false)
      toast.success('Reporte borrado')
    } catch (e) {
      console.error('[reporte] borrar:', e)
      toast.error('No se pudo borrar')
    }
  }

  const estado = doc_?.estado ?? (lanzando ? 'generando' : null)
  const r = doc_?.reporte

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-[15px] font-bold tracking-tight">Reporte de dirección</h2>
          <p className="text-[12px] text-secondary">
            Lee todos los números del periodo y escribe qué significan, qué decidir y qué hacer mañana.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {estado === 'listo' && (
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-[10px] border border-black/[0.08] px-3 py-2 text-[12.5px] font-semibold text-secondary transition-colors hover:text-primary"
            >
              <Printer size={14} /> Imprimir
            </button>
          )}

          {(estado === 'listo' || estado === 'error') && (
            confirmando ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] text-secondary">¿Borrarlo?</span>
                <button
                  onClick={borrar}
                  className="rounded-[10px] bg-red-600 px-3 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-red-700"
                >
                  Sí, borrar
                </button>
                <button
                  onClick={() => setConfirmando(false)}
                  className="rounded-[10px] border border-black/[0.08] px-3 py-2 text-[12.5px] font-semibold text-secondary transition-colors hover:text-primary"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmando(true)}
                className="flex items-center gap-1.5 rounded-[10px] border border-black/[0.08] px-3 py-2 text-[12.5px] font-semibold text-secondary transition-colors hover:text-red-600"
              >
                <Trash2 size={14} /> Borrar
              </button>
            )
          )}
          <button
            onClick={generar}
            disabled={lanzando || estado === 'generando'}
            className="flex items-center gap-1.5 rounded-[10px] px-4 py-2 text-[12.5px] font-semibold text-white transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(90deg, #1aab99, #3533cd)' }}
          >
            {estado === 'generando' || lanzando
              ? <><RotateCcw size={14} className="animate-spin" /> Escribiendo…</>
              : <><Sparkles size={14} /> {estado === 'listo' ? 'Generar de nuevo' : 'Generar reporte'}</>}
          </button>
        </div>
      </div>

      {estado === 'generando' && (
        <div className="rounded-[12px] border border-black/[0.08] bg-surface-2 px-4 py-6 text-center">
          <p className="text-[13px] text-secondary">
            Reuniendo los números y escribiendo. Tarda uno o dos minutos.
          </p>
          <p className="mt-1 text-[11.5px] text-tertiary">
            Puedes seguir usando el CRM; el reporte aparece acá solo cuando esté.
          </p>
        </div>
      )}

      {estado === 'error' && (
        <div className="flex items-start gap-3 rounded-[12px] border border-red-200 bg-red-50 px-4 py-3">
          <TriangleAlert size={16} className="mt-0.5 flex-shrink-0 text-red-600" />
          <div>
            <p className="text-[12.5px] font-semibold text-red-800">No se pudo generar el reporte</p>
            <p className="text-[11.5px] leading-relaxed text-red-700">{doc_?.motivo || 'Error desconocido'}</p>
          </div>
        </div>
      )}

      {estado === 'listo' && r && (
        <div className="flex flex-col gap-4">
          <div className="rounded-[12px] border border-black/[0.08] bg-surface p-5">
            <p className="font-display text-[19px] font-bold leading-snug tracking-tight text-primary">{r.titular}</p>
            <p className="mt-2 text-[13.5px] leading-relaxed text-secondary">{r.resumen}</p>
            <p className="mt-3 text-[11px] text-tertiary">
              Sobre {doc_.numeros?.volumen?.leadsDelPeriodo ?? 0} leads de los últimos {doc_.dias} días
              {doc_.numeros?.topeAlcanzado ? ' (se leyeron los más recientes hasta el tope)' : ''}.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {(r.categorias || []).map((c, i) => (
              <Bloque key={i} titulo={c.titulo}>
                <p className="font-display text-[22px] font-bold leading-none tracking-tight text-primary">{c.numero}</p>
                <p className="mt-2.5 text-[13px] leading-relaxed text-primary">{c.hallazgo}</p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-secondary">{c.porQueImporta}</p>
              </Bloque>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Bloque titulo="Para dirección">
              <Lista items={r.direccion || []} color="#3533cd" />
            </Bloque>
            <Bloque titulo="Para quien atiende clientes">
              <Lista items={r.piso || []} color="#1aab99" />
            </Bloque>
          </div>

          {(r.sinDatosSuficientes || []).length > 0 && (
            <Bloque titulo="Lo que todavía no se puede concluir">
              <ul className="flex flex-col gap-2">
                {r.sinDatosSuficientes.map((t, i) => (
                  <li key={i} className="text-[12.5px] leading-relaxed text-secondary">• {t}</li>
                ))}
              </ul>
            </Bloque>
          )}
        </div>
      )}
    </div>
  )
}
