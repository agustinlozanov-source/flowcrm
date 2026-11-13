/* Trafficker — publicar a las redes de la organización y ver qué trajo cada
 * post.
 *
 * Dos pantallas: la lista de lo publicado y el redactor. La ficha de un post
 * se abre dentro de la lista.
 *
 * La idea de fondo está escrita en src/lib/trafficker.js y vale repetirla:
 * los leads no vienen pegados al post, vienen pegados a la liga. Por eso el
 * redactor arma la liga y enseña el código, en vez de pedir que alguien la
 * pegue a mano.
 */
import { useState, useMemo, useEffect, useRef } from 'react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import {
  Plus, ChevronLeft, Megaphone, Image as ImagenIcon, Film, X, Loader2,
  Link2, Copy, ExternalLink, BarChart3, Trash2, AlertTriangle, Users,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { usePosts, useSubida, useCanales, llamar } from '@/features/trafficker/useTrafficker'
import {
  PLATAFORMAS, DESTINOS, ESTADOS, TEXTO_POR_OMISION,
  generarCodigo, ligaDeDestino, textoDeWhatsapp, problemasDelPost,
  tagsDePost, cuandoSale, contentTypeDeFormato, nombreEstado, plataforma,
  textoParaRed, redesSinLiga, mismoNumero,
} from '@/lib/trafficker'

/* ── Piezas chicas ──────────────────────────────────────────────────── */

function Pildora({ children, color }) {
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-[3px] text-[11px] font-bold"
      style={{ color: color || 'var(--text-tertiary)', borderColor: color || 'var(--border)' }}
    >
      {children}
    </span>
  )
}

function Etiqueta({ children }) {
  return (
    <label className="text-[11px] font-bold uppercase tracking-wide text-tertiary">{children}</label>
  )
}

const claseCampo =
  'w-full rounded-[8px] border border-black/[0.08] bg-surface-2 px-3 py-2 text-[13.5px] ' +
  'text-primary outline-none transition-colors placeholder-tertiary focus:border-primary/40'

function Aviso({ tono = 'ambar', children }) {
  const colores = {
    ambar: { fondo: 'rgba(245,158,11,0.09)', borde: 'rgba(245,158,11,0.35)', texto: '#8a5a00' },
    rojo: { fondo: 'rgba(217,45,32,0.08)', borde: 'rgba(217,45,32,0.3)', texto: '#9b1c14' },
  }[tono]
  return (
    <div
      className="flex gap-2 rounded-[10px] border px-3 py-2.5 text-[12.5px] leading-relaxed"
      style={{ background: colores.fondo, borderColor: colores.borde, color: colores.texto }}
    >
      <AlertTriangle size={15} className="mt-[1px] shrink-0" />
      <div>{children}</div>
    </div>
  )
}

/* ── Redactor ───────────────────────────────────────────────────────── */

function Redactor({ orgId, cuentas, numeroWhatsapp, onVolver, onListo }) {
  const [contenido, setContenido] = useState('')
  const [media, setMedia] = useState([])
  const [elegidas, setElegidas] = useState({})       // plataforma → { cuentaId, formato }
  const [primerComentario, setPrimerComentario] = useState('')
  const [destino, setDestino] = useState('whatsapp')
  // Viene puesto con el número que la organización ya tiene conectado. Se
  // puede cambiar: a veces el post manda a otro teléfono a propósito.
  const [numero, setNumero] = useState(numeroWhatsapp || '')
  const [paginaId, setPaginaId] = useState('')

  /* El usuario de la página conectada, para no pedirlo. Va en un efecto
   * porque las cuentas llegan de una llamada y pueden tardar más que el
   * primer dibujo de la pantalla. */
  const usuarioFb = cuentas.find(c => c.platform === 'facebook')?.usuario || ''
  useEffect(() => { if (usuarioFb && !paginaId) setPaginaId(usuarioFb) }, [usuarioFb])
  const [url, setUrl] = useState('')
  const [saludo, setSaludo] = useState(TEXTO_POR_OMISION)
  const [campana, setCampana] = useState('')
  const [tactica, setTactica] = useState('')
  const [cuando, setCuando] = useState('ahora')
  const [programadoPara, setProgramadoPara] = useState('')
  const [publicando, setPublicando] = useState(false)
  const entrada = useRef(null)

  const { subir, progreso } = useSubida(orgId)

  /* El código se genera UNA vez, al abrir el redactor, y no al publicar.
   * Así se puede enseñar la liga completa antes de que salga: quien escribe
   * ve exactamente lo que va a recibir la gente. */
  const [codigo] = useState(generarCodigo)

  const porPlataforma = useMemo(() => {
    const m = {}
    for (const c of cuentas) (m[c.platform] ||= []).push(c)
    return m
  }, [cuentas])

  const destinos = useMemo(() => (
    Object.entries(elegidas).map(([p, v]) => ({
      plataforma: p,
      cuentaId: v.cuentaId,
      formato: v.formato,
      contentType: contentTypeDeFormato(p, v.formato),
    }))
  ), [elegidas])

  const liga = useMemo(
    () => ligaDeDestino({ destino, codigo, numero, paginaId, url, saludo }),
    [destino, codigo, numero, paginaId, url, saludo],
  )

  const sinLiga = redesSinLiga(destinos, liga)

  const borrador = {
    contenido, media, destinos, destino, numero, paginaId, url, saludo,
    cuando, programadoPara, codigo,
  }
  const problemas = problemasDelPost(borrador)

  const alternar = (platId) => {
    setElegidas(prev => {
      const copia = { ...prev }
      if (copia[platId]) { delete copia[platId]; return copia }
      const cuenta = porPlataforma[platId]?.[0]
      copia[platId] = {
        cuentaId: cuenta?.id || null,
        formato: plataforma(platId).formatos[0].id,
      }
      return copia
    })
  }

  const agregarArchivos = async (e) => {
    const archivos = Array.from(e.target.files || [])
    if (entrada.current) entrada.current.value = ''
    for (const f of archivos) {
      try {
        const subido = await subir(f)
        setMedia(m => [...m, subido])
      } catch (err) {
        toast.error(`No se pudo subir ${f.name}: ${err.message}`)
      }
    }
  }

  const publicar = async () => {
    if (problemas.length) return toast.error(problemas[0])
    setPublicando(true)
    try {
      /* Cada red recibe su propio texto.
       *
       * Facebook lleva la liga pegada al final, salvo que el post la mande al
       * primer comentario: Facebook le baja el alcance a lo que lleva liga en
       * el cuerpo, y el comentario sale igual de rápido sin ese castigo.
       * Instagram no la lleva nunca, porque ahí no es clicable. */
      const vaAlComentario = Boolean(primerComentario.trim())
      const comentario = liga && vaAlComentario
        ? `${primerComentario}\n${liga}`
        : primerComentario
      const conTexto = destinos.map(d => ({
        ...d,
        customContent: textoParaRed(d.plataforma, contenido, liga, vaAlComentario),
      }))

      const saleEn = cuandoSale({ cuando, programadoPara })

      const r = await llamar({
        accion: 'publicar',
        orgId,
        contenido,
        media,
        destinos: conTexto,
        primerComentario: comentario,
        saleEn: saleEn.toISOString(),
        zonaHoraria: Intl.DateTimeFormat().resolvedOptions().timeZone,
        tags: tagsDePost({ campana, tactica, codigo }),
        codigo: liga ? codigo : null,
        liga,
        destino,
        campana,
        tactica,
      })

      toast.success(
        cuando === 'ahora'
          ? 'Publicando. En un minuto deberías verlo arriba.'
          : 'Programado.',
      )
      onListo(r.id)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setPublicando(false)
    }
  }

  const sinCuentas = cuentas.length === 0
  const destinoElegido = DESTINOS.find(d => d.id === destino)

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-5 p-6">
      <button
        onClick={onVolver}
        className="flex w-fit items-center gap-1.5 text-[13px] font-semibold text-tertiary transition-colors hover:text-primary"
      >
        <ChevronLeft size={16} /> Volver
      </button>

      {sinCuentas && (
        <Aviso>
          Esta organización todavía no tiene ninguna red conectada. Se conectan en
          <strong> Ajustes → Canales</strong>, y desde ahí vuelven acá solas.
        </Aviso>
      )}

      {/* ── Qué dice ── */}
      <section className="flex flex-col gap-3 rounded-[14px] border border-black/[0.07] bg-surface p-5">
        <Etiqueta>El post</Etiqueta>
        <textarea
          value={contenido}
          onChange={e => setContenido(e.target.value)}
          rows={5}
          placeholder="Lo que va a leer la gente."
          className={claseCampo + ' resize-y leading-relaxed'}
        />

        <div className="flex flex-wrap items-center gap-2">
          <input ref={entrada} type="file" accept="image/*,video/*" multiple onChange={agregarArchivos} className="hidden" />
          <button
            onClick={() => entrada.current?.click()}
            disabled={progreso !== null}
            className="flex items-center gap-1.5 rounded-[8px] border border-black/[0.1] px-3 py-1.5 text-[12.5px] font-semibold text-secondary transition-colors hover:text-primary disabled:opacity-50"
          >
            {progreso !== null
              ? <><Loader2 size={14} className="animate-spin" /> Subiendo {progreso}%</>
              : <><ImagenIcon size={14} /> Agregar foto o video</>}
          </button>
          {media.map((m, i) => (
            <span key={m.url} className="flex items-center gap-1.5 rounded-[8px] border border-black/[0.1] bg-surface-2 px-2.5 py-1.5 text-[12px] text-secondary">
              {m.tipo === 'video' ? <Film size={13} /> : <ImagenIcon size={13} />}
              <span className="max-w-[160px] truncate">{m.nombre}</span>
              <button onClick={() => setMedia(media.filter((_, n) => n !== i))} className="text-tertiary hover:text-primary">
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      </section>

      {/* ── Dónde sale ── */}
      <section className="flex flex-col gap-3 rounded-[14px] border border-black/[0.07] bg-surface p-5">
        <Etiqueta>Dónde sale</Etiqueta>
        <div className="flex flex-col gap-2">
          {PLATAFORMAS.map(p => {
            const disponibles = porPlataforma[p.id] || []
            const activa = Boolean(elegidas[p.id])
            return (
              <div key={p.id} className="flex flex-col gap-2 rounded-[10px] border border-black/[0.08] px-3 py-2.5">
                <label className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={activa}
                    disabled={!disponibles.length}
                    onChange={() => alternar(p.id)}
                    className="h-4 w-4 accent-[#0066ff]"
                  />
                  <span className="text-[13.5px] font-semibold text-primary">{p.nombre}</span>
                  {!disponibles.length && <span className="text-[12px] text-tertiary">— sin conectar</span>}
                </label>

                {activa && (
                  <div className="flex flex-wrap items-center gap-2 pl-7">
                    {disponibles.length > 1 && (
                      <select
                        value={elegidas[p.id].cuentaId || ''}
                        onChange={e => setElegidas(v => ({ ...v, [p.id]: { ...v[p.id], cuentaId: e.target.value } }))}
                        className={claseCampo + ' w-auto'}
                      >
                        {disponibles.map(c => <option key={c.id} value={c.id}>{c.nombre || c.usuario}</option>)}
                      </select>
                    )}
                    <select
                      value={elegidas[p.id].formato}
                      onChange={e => setElegidas(v => ({ ...v, [p.id]: { ...v[p.id], formato: e.target.value } }))}
                      className={claseCampo + ' w-auto'}
                    >
                      {p.formatos.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                    </select>
                    {p.formatos.find(f => f.id === elegidas[p.id].formato)?.pista && (
                      <span className="text-[11.5px] text-tertiary">
                        {p.formatos.find(f => f.id === elegidas[p.id].formato).pista}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* ── La liga ── */}
      <section className="flex flex-col gap-3 rounded-[14px] border border-black/[0.07] bg-surface p-5">
        <div className="flex items-center gap-2">
          <Link2 size={15} className="text-tertiary" />
          <Etiqueta>A dónde mandas a la gente</Etiqueta>
        </div>
        <p className="text-[12.5px] leading-relaxed text-tertiary">
          De acá sale la trazabilidad. El módulo arma la liga con un código adentro, y
          cuando alguien escriba por ahí, su lead va a llegar con este post anotado.
        </p>

        <div className="flex flex-col gap-2">
          {DESTINOS.map(d => (
            <label key={d.id} className="flex cursor-pointer items-start gap-2.5 rounded-[10px] border border-black/[0.08] px-3 py-2.5">
              <input
                type="radio"
                checked={destino === d.id}
                onChange={() => setDestino(d.id)}
                className="mt-[3px] h-4 w-4 accent-[#0066ff]"
              />
              <span>
                <span className="text-[13.5px] font-semibold text-primary">{d.nombre}</span>
                <span className="block text-[12px] leading-relaxed text-tertiary">{d.detalle}</span>
              </span>
            </label>
          ))}
        </div>

        {destinoElegido?.pide === 'numero' && (
          <div className="flex flex-col gap-2">
            {!numeroWhatsapp && (
              <Aviso>
                Esta organización no tiene WhatsApp conectado, así que el número hay que
                escribirlo a mano. Conectándolo en <strong>Ajustes → Canales</strong> viene solo.
              </Aviso>
            )}
            <input value={numero} onChange={e => setNumero(e.target.value)} placeholder="Número con lada, por ejemplo +52 868 123 4567" className={claseCampo} />
            <input value={saludo} onChange={e => setSaludo(e.target.value)} placeholder={TEXTO_POR_OMISION} className={claseCampo} />
            <p className="text-[11.5px] text-tertiary">
              Le va a llegar escrito: «{textoDeWhatsapp(saludo, codigo)}»
            </p>

            {/* El aviso que decide si este post sirve de algo para el CRM. */}
            {numero.trim() && numeroWhatsapp && !mismoNumero(numero, numeroWhatsapp) && (
              <Aviso tono="rojo">
                Ese no es el WhatsApp que tiene conectado la organización. Los mensajes van
                a llegar a ese teléfono y nada más: <strong>no se va a crear el lead en el CRM,
                el agente no va a contestar, y este post va a quedar en cero leads para
                siempre.</strong> Sirve si lo que quieres es que te escriban al celular; para
                medirlo, tiene que ser el número conectado.
              </Aviso>
            )}

            {numero.trim() && !numeroWhatsapp && (
              <Aviso>
                Sin WhatsApp conectado, los mensajes de este post van a llegar al teléfono
                directo, sin pasar por el CRM: no se crea el lead y el agente no contesta.
              </Aviso>
            )}
          </div>
        )}
        {destinoElegido?.pide === 'pagina' && (
          <input value={paginaId} onChange={e => setPaginaId(e.target.value)} placeholder="Nombre de usuario o id de la página" className={claseCampo} />
        )}
        {destinoElegido?.pide === 'url' && (
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="flowhubcrm.app/tu-pagina" className={claseCampo} />
        )}

        {liga && (
          <div className="flex items-center gap-2 rounded-[10px] border border-black/[0.08] bg-surface-2 px-3 py-2">
            <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-secondary">{liga}</span>
            <Pildora color="#0066ff">{codigo}</Pildora>
            <button onClick={() => { navigator.clipboard.writeText(liga); toast.success('Copiada') }} className="text-tertiary hover:text-primary">
              <Copy size={14} />
            </button>
          </div>
        )}

        {sinLiga.length > 0 && (
          <Aviso>
            En {sinLiga.join(' y ')} la liga del pie de foto no es clicable, así que
            no se pega: el post sale limpio, pero por ahí no van a entrar leads.
            Para medir Instagram, la liga tiene que ir en la bio o en una historia.
          </Aviso>
        )}

        {destino === 'ninguno' && (
          <Aviso>
            Sin liga el post sale igual, pero sus leads no se van a poder contar.
            Si lo publicas así, la ficha va a quedar en cero para siempre.
          </Aviso>
        )}

        {liga && (
          <div className="flex flex-col gap-2">
            <Etiqueta>Primer comentario</Etiqueta>
            <input
              value={primerComentario}
              onChange={e => setPrimerComentario(e.target.value)}
              placeholder="Déjalo vacío para que la liga vaya en el post."
              className={claseCampo}
            />
            <p className="text-[11.5px] leading-relaxed text-tertiary">
              Facebook le baja el alcance a lo que lleva liga en el cuerpo. Si escribes acá,
              la liga se va al primer comentario, que sale al mismo tiempo.
            </p>
          </div>
        )}
      </section>

      {/* ── Campaña y cuándo ── */}
      <section className="flex flex-col gap-3 rounded-[14px] border border-black/[0.07] bg-surface p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Etiqueta>Campaña</Etiqueta>
            <input value={campana} onChange={e => setCampana(e.target.value)} placeholder="Opcional" className={claseCampo} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Etiqueta>Táctica</Etiqueta>
            <input value={tactica} onChange={e => setTactica(e.target.value)} placeholder="Opcional" className={claseCampo} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Etiqueta>Cuándo</Etiqueta>
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-primary">
            <input type="radio" checked={cuando === 'ahora'} onChange={() => setCuando('ahora')} className="h-4 w-4 accent-[#0066ff]" />
            Ahora
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-primary">
            <input type="radio" checked={cuando === 'despues'} onChange={() => setCuando('despues')} className="h-4 w-4 accent-[#0066ff]" />
            Programar
          </label>
          {cuando === 'despues' && (
            <input
              type="datetime-local"
              value={programadoPara}
              onChange={e => setProgramadoPara(e.target.value)}
              className={claseCampo + ' w-auto'}
            />
          )}
        </div>
        {cuando === 'ahora' && (
          <p className="text-[11.5px] leading-relaxed text-tertiary">
            Sale en aproximadamente un minuto. Ese minuto es lo que hace que un video pesado
            no se caiga a medio camino.
          </p>
        )}
      </section>

      {problemas.length > 0 && (
        <Aviso tono="rojo">
          <ul className="flex list-disc flex-col gap-1 pl-4">
            {problemas.map(p => <li key={p}>{p}</li>)}
          </ul>
        </Aviso>
      )}

      <button
        onClick={publicar}
        disabled={publicando || problemas.length > 0 || progreso !== null}
        className="flex items-center justify-center gap-2 rounded-[10px] bg-[#0066ff] px-5 py-3 text-[14px] font-bold text-white transition-opacity disabled:opacity-40"
      >
        {publicando ? <><Loader2 size={16} className="animate-spin" /> Mandando</> : (cuando === 'ahora' ? 'Publicar' : 'Programar')}
      </button>
    </div>
  )
}

/* ── Ficha de un post ───────────────────────────────────────────────── */

function Ficha({ orgId, post, onCerrar }) {
  const [cargando, setCargando] = useState(false)
  const estado = ESTADOS[post.estado]

  const pedirNumeros = async () => {
    setCargando(true)
    try {
      await llamar({ accion: 'metricas', orgId, id: post.id })
      toast.success('Números actualizados')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setCargando(false)
    }
  }

  const cancelar = async () => {
    if (!confirm('¿Cancelar este post antes de que salga?')) return
    try {
      await llamar({ accion: 'cancelar', orgId, id: post.id })
      toast.success('Cancelado')
    } catch (e) {
      toast.error(e.message)
    }
  }

  const n = post.numeros || {}
  const reciente = post.publicadoEn?.toDate
    ? (Date.now() - post.publicadoEn.toDate().getTime()) < 6 * 3600_000
    : false

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-5 p-6">
      <button onClick={onCerrar} className="flex w-fit items-center gap-1.5 text-[13px] font-semibold text-tertiary transition-colors hover:text-primary">
        <ChevronLeft size={16} /> Volver
      </button>

      <div className="flex flex-col gap-4 rounded-[14px] border border-black/[0.07] bg-surface p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Pildora color={estado?.color}>{nombreEstado(post.estado)}</Pildora>
          {post.codigo && <Pildora color="#0066ff">{post.codigo}</Pildora>}
          {post.campana && <Pildora>{post.campana}</Pildora>}
          {post.tactica && <Pildora>{post.tactica}</Pildora>}
        </div>

        <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-primary">{post.contenido}</p>

        {post.error && <Aviso tono="rojo">{post.error}</Aviso>}

        {Object.entries(post.resultados || {}).map(([red, r]) => (
          <div key={red} className="flex items-center gap-2 text-[12.5px] text-secondary">
            <span className="font-semibold capitalize">{red}:</span>
            <span>{r.estado || '—'}</span>
            {r.url && (
              <a href={r.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[#0066ff] hover:underline">
                ver <ExternalLink size={12} />
              </a>
            )}
            {r.error && <span className="text-[#9b1c14]">{r.error}</span>}
          </div>
        ))}
      </div>

      {/* Leads, que es la razón de todo esto */}
      <div className="flex flex-col gap-3 rounded-[14px] border border-black/[0.07] bg-surface p-5">
        <div className="flex items-center gap-2">
          <Users size={15} className="text-tertiary" />
          <Etiqueta>Lo que trajo</Etiqueta>
        </div>
        <div className="text-[34px] font-bold leading-none text-primary">{post.leads || 0}</div>
        <p className="text-[12.5px] leading-relaxed text-tertiary">
          {post.codigo
            ? <>Leads que llegaron con el código <strong>{post.codigo}</strong>. Cada uno está en el CRM con este post anotado.</>
            : 'Este post salió sin liga, así que no hay forma de contar sus leads.'}
        </p>
      </div>

      {/* Números de la plataforma */}
      <div className="flex flex-col gap-3 rounded-[14px] border border-black/[0.07] bg-surface p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 size={15} className="text-tertiary" />
            <Etiqueta>Números de la red</Etiqueta>
          </div>
          <button
            onClick={pedirNumeros}
            disabled={cargando || !post.zernioPostId}
            className="flex items-center gap-1.5 rounded-[8px] border border-black/[0.1] px-3 py-1.5 text-[12.5px] font-semibold text-secondary transition-colors hover:text-primary disabled:opacity-40"
          >
            {cargando ? <Loader2 size={13} className="animate-spin" /> : null} Actualizar
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            ['Alcance', n.alcance], ['Interacciones', n.interacciones], ['Clics', n.clics],
            ['Comentarios', post.comentarios ?? n.comentarios], ['Compartidos', n.compartidos], ['Likes', n.likes],
          ].map(([etiqueta, valor]) => (
            <div key={etiqueta} className="rounded-[10px] border border-black/[0.08] bg-surface-2 px-3 py-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wide text-tertiary">{etiqueta}</div>
              <div className="text-[18px] font-bold text-primary">{valor ?? '—'}</div>
            </div>
          ))}
        </div>

        {reciente && (
          <p className="text-[11.5px] leading-relaxed text-tertiary">
            Meta publica estos números con retraso. Un post de hace un rato llega en ceros
            y se va llenando en las horas siguientes.
          </p>
        )}
      </div>

      {['programado', 'publicando'].includes(post.estado) && (
        <button
          onClick={cancelar}
          className="flex w-fit items-center gap-1.5 text-[13px] font-semibold text-[#9b1c14] hover:underline"
        >
          <Trash2 size={14} /> Cancelar antes de que salga
        </button>
      )}
    </div>
  )
}

/* ── Lista ──────────────────────────────────────────────────────────── */

function Fila({ post, onAbrir }) {
  const estado = ESTADOS[post.estado]
  const cuando = post.saleEn?.toDate ? post.saleEn.toDate() : null
  return (
    <button
      onClick={onAbrir}
      className="flex w-full items-start gap-3 rounded-[12px] border border-black/[0.07] bg-surface p-4 text-left transition-colors hover:border-black/20"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Pildora color={estado?.color}>{nombreEstado(post.estado)}</Pildora>
          {post.codigo && <Pildora color="#0066ff">{post.codigo}</Pildora>}
          {(post.destinos || []).map(d => (
            <span key={d.plataforma} className="text-[11.5px] capitalize text-tertiary">{d.plataforma}</span>
          ))}
        </div>
        <div className="line-clamp-2 text-[13.5px] leading-relaxed text-primary">
          {post.contenido || '(sin texto)'}
        </div>
        {cuando && (
          <div className="text-[11.5px] text-tertiary">
            {cuando.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
          </div>
        )}
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[22px] font-bold leading-none text-primary">{post.leads || 0}</div>
        <div className="text-[10.5px] font-bold uppercase tracking-wide text-tertiary">leads</div>
      </div>
    </button>
  )
}

/* ── Pantalla ───────────────────────────────────────────────────────── */

export default function Trafficker() {
  const { org } = useAuthStore()
  const orgId = org?.id

  const { posts, cargando, error } = usePosts(orgId)
  const { numeroWhatsapp } = useCanales(orgId)
  const [vista, setVista] = useState('lista')
  const [abierto, setAbierto] = useState(null)
  const [cuentas, setCuentas] = useState([])
  const [cuentasError, setCuentasError] = useState(null)

  useEffect(() => {
    if (!orgId) return
    llamar({ accion: 'cuentas', orgId })
      .then(r => setCuentas(r.cuentas || []))
      .catch(e => setCuentasError(e.message))
  }, [orgId])

  const post = posts.find(p => p.id === abierto)

  if (vista === 'redactor') {
    return (
      <Redactor
        orgId={orgId}
        cuentas={cuentas}
        numeroWhatsapp={numeroWhatsapp}
        onVolver={() => setVista('lista')}
        onListo={(id) => { setAbierto(id); setVista('ficha') }}
      />
    )
  }

  if (vista === 'ficha' && post) {
    return <Ficha orgId={orgId} post={post} onCerrar={() => { setVista('lista'); setAbierto(null) }} />
  }

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-5 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Megaphone size={20} className="text-tertiary" />
          <h1 className="text-[22px] font-bold text-primary">Trafficker</h1>
        </div>
        <button
          onClick={() => setVista('redactor')}
          className="flex items-center gap-1.5 rounded-[10px] bg-[#0066ff] px-4 py-2 text-[13.5px] font-bold text-white"
        >
          <Plus size={15} /> Nuevo post
        </button>
      </div>

      {cuentasError && <Aviso>No se pudieron leer las redes conectadas: {cuentasError}</Aviso>}
      {error && <Aviso tono="rojo">{error}</Aviso>}

      {cargando && <div className="flex justify-center py-10 text-tertiary"><Loader2 className="animate-spin" /></div>}

      {!cargando && posts.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-[14px] border border-dashed border-black/[0.12] py-14 text-center">
          <Megaphone size={26} className="text-tertiary" />
          <div className="text-[14px] font-semibold text-primary">Todavía no hay posts</div>
          <p className="max-w-[420px] text-[12.5px] leading-relaxed text-tertiary">
            Escribe uno y publícalo a Facebook o Instagram. Cada post lleva su liga con un
            código adentro, y acá vas a ver cuántos leads trajo.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {posts.map(p => (
          <Fila key={p.id} post={p} onAbrir={() => { setAbierto(p.id); setVista('ficha') }} />
        ))}
      </div>
    </div>
  )
}
