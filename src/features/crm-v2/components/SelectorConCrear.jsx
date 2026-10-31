import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, Plus, Check } from 'lucide-react'

/**
 * Un campo que es una lista.
 *
 * El patrón de toda la aplicación: donde el sistema pide algo que vive en una
 * lista —un contacto, un producto, una empresa— el campo se despliega, se
 * busca adentro, y si no existe se crea **desde ahí mismo**. Nunca se manda a
 * nadie a otra pantalla a dar de alta algo.
 *
 * Las dos mitades se sostienen juntas: obligar a que el registro exista sin
 * que crearlo cueste un clic solo logra que alguien escriba cualquier cosa en
 * el campo libre más cercano.
 */
export default function SelectorConCrear({
  valor,              // el item elegido, o null
  items = [],
  onElegir,
  onCrear,            // (texto) => void. Si no viene, no se ofrece crear.
  filtrar,            // (item, texto) => bool
  etiqueta,           // (item) => string
  detalle,            // (item) => string  — la segunda línea, opcional
  placeholder = 'Busca o crea',
  textoCrear = 'Crear',
  mensajeVacio = 'Nada coincide',
  autoFocus = false,
}) {
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const [marcado, setMarcado] = useState(0)
  const caja = useRef(null)
  const entrada = useRef(null)

  const encontrados = useMemo(() => {
    const t = texto.trim()
    if (!t) return items.slice(0, 50)
    return items.filter(i => filtrar(i, t)).slice(0, 50)
  }, [items, texto, filtrar])

  const puedeCrear = !!onCrear && texto.trim().length > 0 &&
    !encontrados.some(i => etiqueta(i).toLowerCase() === texto.trim().toLowerCase())

  const opciones = puedeCrear ? [...encontrados, null] : encontrados

  useEffect(() => { setMarcado(0) }, [texto, abierto])

  useEffect(() => {
    if (!abierto) return
    const fuera = e => { if (caja.current && !caja.current.contains(e.target)) setAbierto(false) }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierto])

  const elegir = (item) => {
    if (item === null) { onCrear(texto.trim()); setTexto(''); setAbierto(false); return }
    onElegir(item)
    setTexto('')
    setAbierto(false)
  }

  const teclas = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setMarcado(i => Math.min(i + 1, opciones.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setMarcado(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (opciones.length) elegir(opciones[marcado]) }
    else if (e.key === 'Escape') { e.preventDefault(); setAbierto(false) }
  }

  const abrir = () => { setAbierto(true); setTimeout(() => entrada.current?.focus(), 0) }

  return (
    <div className="pv2-selector" ref={caja}>
      {!abierto ? (
        <button type="button" className="pv2-selector__campo" onClick={abrir} autoFocus={autoFocus}>
          <span className={valor ? 'pv2-selector__valor' : 'pv2-selector__vacio'}>
            {valor ? etiqueta(valor) : placeholder}
          </span>
          <ChevronDown size={14} />
        </button>
      ) : (
        <>
          <input
            ref={entrada}
            className="pv2-selector__campo pv2-selector__campo--abierto"
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={teclas}
            placeholder={placeholder}
            autoComplete="off"
          />
          <div className="pv2-selector__lista">
            {opciones.length === 0 && (
              <p className="pv2-selector__nada">{mensajeVacio}</p>
            )}
            {opciones.map((item, i) => item === null ? (
              <button key="__crear" type="button"
                className={`pv2-selector__crear ${i === marcado ? 'is-marcado' : ''}`}
                onMouseEnter={() => setMarcado(i)}
                onClick={() => elegir(null)}>
                <Plus size={13} /> {textoCrear} «{texto.trim()}»
              </button>
            ) : (
              <button key={item.id || i} type="button"
                className={`pv2-selector__opcion ${i === marcado ? 'is-marcado' : ''}`}
                onMouseEnter={() => setMarcado(i)}
                onClick={() => elegir(item)}>
                <span className="pv2-selector__opcion-txt">
                  <span className="pv2-selector__opcion-nombre">{etiqueta(item)}</span>
                  {detalle && <span className="pv2-selector__opcion-detalle">{detalle(item)}</span>}
                </span>
                {valor?.id === item.id && <Check size={13} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
