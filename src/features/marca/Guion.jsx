/* De la referencia al guión, y del guión al teleprompter.
 *
 * El modelo no ve el video: solo tiene el texto de la publicación, la
 * duración y los números. Así que escribe la versión de la IDEA para esta
 * marca. El encuadre, el decorado y el ritmo de los cortes los copia la
 * persona mirando el original — por eso el panel deja el video a un clic y
 * trae una lista de qué mirar antes de grabar.
 */
import { useState } from 'react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { X, Sparkles, RefreshCw, Tv, Eye, ExternalLink, Check } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import Teleprompter from '@/components/Teleprompter'

function Seccion({ titulo, segundos, texto }) {
  return (
    <div className="bg-surface-2 border border-border rounded-btn p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wide text-tertiary">{titulo}</span>
        {typeof segundos === 'number' && (
          <span className="text-[11px] text-tertiary">{Math.round(segundos)}s</span>
        )}
      </div>
      <p className="text-[13px] text-primary leading-relaxed whitespace-pre-wrap">{texto}</p>
    </div>
  )
}

export default function Guion({ referencia, marcas, onCerrar }) {
  const { org } = useAuthStore()
  const [angulo, setAngulo] = useState('')
  const [marcaId, setMarcaId] = useState(marcas?.[0]?.id || '')
  const [generando, setGenerando] = useState(false)
  const [guion, setGuion] = useState(null)
  const [hook, setHook] = useState(0)
  const [enTeleprompter, setEnTeleprompter] = useState(false)

  const generar = async () => {
    setGenerando(true)
    try {
      const res = await fetch('/.netlify/functions/gen-script-emulado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: org?.id, brandId: marcaId, referenciaId: referencia.id, angulo,
        }),
      })
      const r = await res.json()
      if (!res.ok || !r.ok) throw new Error(r.detalle || r.error || 'No se pudo generar')
      setGuion(r.guion)
      setHook(0)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setGenerando(false)
    }
  }

  const parrafos = guion ? [
    guion.hooks?.[hook]?.texto,
    guion.guion?.apertura?.texto,
    guion.guion?.desarrollo?.texto,
    guion.guion?.cierre?.texto,
  ] : []

  if (enTeleprompter) {
    return <Teleprompter parrafos={parrafos} onClose={() => setEnTeleprompter(false)} />
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/40 overflow-y-auto">
      <div className="w-full max-w-[620px] my-8 bg-surface border border-border rounded-card shadow-card-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-display font-bold text-[15px] text-primary">Mi versión</h2>
          <button onClick={onCerrar} className="text-tertiary hover:text-primary"><X size={18} /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* La referencia */}
          <div className="flex items-center gap-3 bg-surface-2 border border-border rounded-btn p-3">
            {referencia.miniatura && (
              <img src={referencia.miniatura} alt="" className="w-10 h-14 rounded object-cover shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-primary truncate">@{referencia.autor?.usuario}</div>
              <div className="text-[11px] text-tertiary">
                {typeof referencia.vistas === 'number' && `${referencia.vistas.toLocaleString('es-MX')} vistas`}
                {typeof referencia.indice === 'number' && ` · ${referencia.indice.toFixed(1)}× su media`}
              </div>
            </div>
            {referencia.url && (
              <a href={referencia.url} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-[12px] font-semibold text-accent-blue shrink-0">
                Ver <ExternalLink size={12} />
              </a>
            )}
          </div>

          {!guion && (
            <>
              {marcas?.length > 1 && (
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-tertiary mb-1.5">Para qué marca</label>
                  <select value={marcaId} onChange={e => setMarcaId(e.target.value)}
                    className="w-full px-3 py-2 rounded-btn bg-surface-2 border border-border text-[13px] text-primary outline-none focus:border-accent-blue">
                    {marcas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-tertiary mb-1.5">
                  Tu ángulo <span className="normal-case font-normal">(opcional)</span>
                </label>
                <textarea
                  value={angulo} onChange={e => setAngulo(e.target.value)} rows={3}
                  placeholder="De qué quieres que trate tu versión. Si lo dejas vacío, se adapta al nicho de la marca."
                  className="w-full px-3 py-2 rounded-btn bg-surface-2 border border-border text-[13px] text-primary outline-none focus:border-accent-blue resize-none"
                />
              </div>

              <button onClick={generar} disabled={generando || !marcaId}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-btn bg-accent-blue text-white text-[13px] font-bold disabled:opacity-50">
                {generando ? <RefreshCw size={15} className="animate-spin" /> : <Sparkles size={15} />}
                {generando ? 'Escribiendo…' : 'Generar guión'}
              </button>

              <p className="text-[11px] text-tertiary leading-snug">
                La IA no ve el video, solo su texto y sus números. Escribe la versión de la idea;
                el encuadre y el decorado los copias tú mirando el original.
              </p>
            </>
          )}

          {guion && (
            <>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-tertiary mb-2">
                  Elige el hook — son los primeros 3 segundos
                </div>
                <div className="space-y-1.5">
                  {(guion.hooks || []).map((h, i) => (
                    <button key={i} onClick={() => setHook(i)}
                      className={clsx('w-full text-left px-3 py-2.5 rounded-btn border transition-colors',
                        hook === i
                          ? 'border-accent-blue bg-accent-blue/10'
                          : 'border-border bg-surface-2 hover:border-border-strong')}>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {hook === i && <Check size={12} className="text-accent-blue shrink-0" />}
                        <span className="text-[10px] font-bold uppercase tracking-wide text-tertiary">{h.tipo}</span>
                      </div>
                      <p className="text-[13px] text-primary leading-snug">{h.texto}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Seccion titulo="Apertura" segundos={guion.guion?.apertura?.segundos} texto={guion.guion?.apertura?.texto} />
                <Seccion titulo="Desarrollo" segundos={guion.guion?.desarrollo?.segundos} texto={guion.guion?.desarrollo?.texto} />
                <Seccion titulo="Cierre" segundos={guion.guion?.cierre?.segundos} texto={guion.guion?.cierre?.texto} />
              </div>

              {guion.queObservar?.length > 0 && (
                <div className="bg-surface-2 border border-border rounded-btn p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Eye size={13} className="text-tertiary" />
                    <span className="text-[11px] font-bold uppercase tracking-wide text-tertiary">
                      Qué mirar en el original antes de grabar
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {guion.queObservar.map((q, i) => (
                      <li key={i} className="text-[12px] text-secondary leading-snug flex gap-1.5">
                        <span className="text-tertiary">·</span> {q}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {guion.copy?.texto && (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-tertiary mb-1.5">Pie de publicación</div>
                  <div className="bg-surface-2 border border-border rounded-btn p-3">
                    <p className="text-[13px] text-primary leading-relaxed whitespace-pre-wrap">{guion.copy.texto}</p>
                    {guion.copy.hashtags?.length > 0 && (
                      <p className="text-[12px] text-accent-blue mt-2 break-words">
                        {guion.copy.hashtags.map(h => (h.startsWith('#') ? h : `#${h}`)).join(' ')}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {guion && (
          <div className="flex items-center gap-2 px-5 py-4 border-t border-border">
            <button onClick={generar} disabled={generando}
              className="flex items-center gap-1.5 px-3 py-2 rounded-btn bg-surface-2 border border-border text-[13px] font-semibold text-secondary hover:text-primary disabled:opacity-50">
              <RefreshCw size={14} className={generando ? 'animate-spin' : undefined} /> Otra versión
            </button>
            <button onClick={() => setEnTeleprompter(true)}
              className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-btn bg-accent-blue text-white text-[13px] font-bold">
              <Tv size={15} /> Teleprompter
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
