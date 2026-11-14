/* Cargar una configuración pegando texto.
 *
 * El mismo panel sirve para el embudo y para el scoring: lo que cambia es el
 * traductor que se le pasa, no la pantalla.
 *
 * Tres decisiones que lo hacen seguro de usar:
 *
 * - Enseña ANTES de aplicar. Pegar algo que reemplaza la configuración de un
 *   cliente sin dejar verlo primero es pedirle que confíe a ciegas, y el día
 *   que el texto venía mal nadie sabe qué había antes.
 * - Los problemas se ven mientras se escribe, no al guardar. Un tope que no
 *   suma 100 o un hueco entre rangos no rompen nada: hacen que el embudo deje
 *   de moverse, en silencio, semanas después.
 * - Se puede COPIAR lo que ya existe. Sin eso habría que escribir desde cero
 *   cada vez; con eso se copia, se cambian tres líneas y se vuelve a pegar.
 */
import { useState, useMemo } from 'react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { FileText, Copy, Check, AlertTriangle, ChevronDown } from 'lucide-react'

export default function PanelMarkdown({
  titulo = 'Cargar pegando texto',
  ayuda,
  ejemplo = '',
  textoActual = '',
  leer,          // (md) => { problemas, ...resultado }
  resumen,       // (resultado) => JSX, lo que se va a aplicar
  onAplicar,     // (resultado) => void
  abiertoAlInicio = false,
}) {
  const [abierto, setAbierto] = useState(abiertoAlInicio)
  const [md, setMd] = useState('')
  const [copiado, setCopiado] = useState(false)

  /* Se traduce en cada tecla. Es texto en memoria, sin red ni base: el costo
   * es nada y el aviso llega mientras todavía se está escribiendo. */
  const resultado = useMemo(() => (md.trim() ? leer(md) : null), [md, leer])
  const problemas = resultado?.problemas || []

  const copiarActual = async () => {
    try {
      await navigator.clipboard.writeText(textoActual)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1600)
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  const aplicar = () => {
    if (!resultado) return
    onAplicar(resultado)
    setMd('')
    setAbierto(false)
    toast.success('Cargado. Revísalo y guarda.')
  }

  return (
    <div className="rounded-[10px] border border-black/[0.08] bg-surface-2 overflow-hidden">
      <button
        onClick={() => setAbierto(a => !a)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <FileText size={14} className="shrink-0 text-tertiary" />
        <span className="flex-1 text-[12.5px] font-semibold text-primary">{titulo}</span>
        <ChevronDown size={14} className={clsx('text-tertiary transition-transform', abierto && 'rotate-180')} />
      </button>

      {abierto && (
        <div className="flex flex-col gap-2.5 border-t border-black/[0.06] p-3">
          {ayuda && <p className="text-[11.5px] leading-relaxed text-tertiary">{ayuda}</p>}

          {ejemplo && (
            <pre className="overflow-x-auto rounded-[8px] border border-black/[0.06] bg-surface px-2.5 py-2 font-mono text-[10.5px] leading-relaxed text-tertiary">
{ejemplo}
            </pre>
          )}

          <textarea
            value={md}
            onChange={e => setMd(e.target.value)}
            rows={10}
            placeholder="Pega aquí el texto."
            className="w-full resize-y rounded-[8px] border border-black/[0.08] bg-surface px-3 py-2 font-mono text-[12px] leading-relaxed text-primary outline-none transition-colors placeholder-tertiary focus:border-primary/40"
          />

          {/* Lo que se va a aplicar, antes de aplicarlo. */}
          {resultado && resumen && (
            <div className="rounded-[8px] border border-black/[0.06] bg-surface px-3 py-2.5 text-[12px] leading-relaxed text-secondary">
              {resumen(resultado)}
            </div>
          )}

          {problemas.length > 0 && (
            <div
              className="flex gap-2 rounded-[8px] border px-3 py-2.5 text-[11.5px] leading-relaxed"
              style={{ background: 'rgba(245,158,11,0.09)', borderColor: 'rgba(245,158,11,0.35)', color: '#8a5a00' }}
            >
              <AlertTriangle size={14} className="mt-[1px] shrink-0" />
              <ul className="flex flex-col gap-1">
                {problemas.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={aplicar}
              disabled={!resultado}
              className="rounded-[8px] bg-[#0066ff] px-3.5 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-40"
            >
              Cargar
            </button>

            {textoActual && (
              <button
                onClick={copiarActual}
                className="flex items-center gap-1.5 rounded-[8px] border border-black/[0.1] px-3 py-1.5 text-[12.5px] font-semibold text-secondary transition-colors hover:text-primary"
              >
                {copiado ? <Check size={13} /> : <Copy size={13} />}
                {copiado ? 'Copiado' : 'Copiar lo de ahora'}
              </button>
            )}

            {/* Los problemas avisan, no detienen.
              *
              * Una configuración a medias es un paso legítimo: se carga lo que
              * hay, se termina a mano y se guarda. Bloquear aquí obligaría a
              * arreglar el texto en un cuadro que no es un editor. */}
            {problemas.length > 0 && (
              <span className="text-[11px] text-tertiary">
                Se carga igual. Lo de arriba son avisos, no errores.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
