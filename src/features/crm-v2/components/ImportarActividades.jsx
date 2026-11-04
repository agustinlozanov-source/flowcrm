/* Cargar actividades desde un CSV.
 *
 * Existe porque el trabajo de la primera semana no nace en el CRM: nace en la
 * libreta de alguien, en una hoja de cálculo o en el sistema anterior. Sin una
 * puerta de entrada masiva, el equipo captura a mano cien renglones el primer
 * día, se cansa, y la pantalla arranca vacía y desacreditada.
 *
 * El contacto se busca por nombre o por teléfono contra los leads que ya
 * existen. Un renglón que no empata NO crea un lead nuevo: inventar contactos
 * desde un CSV mal escrito ensucia el embudo con duplicados que después nadie
 * limpia. Esos renglones se reportan y se quedan fuera.
 */
import { useMemo, useState } from 'react'
import { Upload, Check, AlertTriangle } from 'lucide-react'
import { TIPOS } from '@/hooks/useActividades'

const normalizar = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
const soloDigitos = t => String(t || '').replace(/\D/g, '')

/* Un CSV de verdad trae comas dentro de las comillas y comillas escapadas
   dobles. Partir por comas a secas corre las columnas en cuanto alguien
   escribe «Le mandé la propuesta, quedó de revisarla». */
function partirCSV(texto) {
  const filas = []
  let fila = [], campo = '', dentro = false
  const t = texto.replace(/\r\n?/g, '\n')
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (dentro) {
      if (c === '"') {
        if (t[i + 1] === '"') { campo += '"'; i++ }
        else dentro = false
      } else campo += c
    } else if (c === '"') dentro = true
    else if (c === ',' || c === ';') { fila.push(campo); campo = '' }
    else if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = '' }
    else campo += c
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila) }
  return filas.filter(f => f.some(x => String(x).trim() !== ''))
}

/** Dónde cae cada columna, por el nombre del encabezado. */
function mapearColumnas(encabezado) {
  const idx = {}
  encabezado.forEach((h, i) => {
    const n = normalizar(h)
    if (/contacto|lead|cliente|nombre/.test(n) && idx.contacto == null) idx.contacto = i
    else if (/telefono|celular|whats/.test(n) && idx.telefono == null) idx.telefono = i
    else if (/canal|tipo|actividad/.test(n) && idx.tipo == null) idx.tipo = i
    else if (/vence|fecha|cuando|dia/.test(n) && idx.fecha == null) idx.fecha = i
    else if (/que|detalle|resumen|nota|acuerdo/.test(n) && idx.resumen == null) idx.resumen = i
    else if (/responsable|dueno|asignad|vendedor/.test(n) && idx.responsable == null) idx.responsable = i
  })
  return idx
}

const tipoDe = (texto) => {
  const n = normalizar(texto)
  return TIPOS.find(t => normalizar(t.label) === n || t.id === n)?.id
    || (/whats/.test(n) ? 'whatsapp' : /llam|tel/.test(n) ? 'llamada' : /correo|mail/.test(n) ? 'correo' : /reun|junta|demo/.test(n) ? 'reunion' : 'tarea')
}

/* Se aceptan dd/mm/aaaa y aaaa-mm-dd. El formato de Estados Unidos, mm/dd,
   se deja fuera a propósito: con 03/04 no hay manera de saber cuál es, y
   adivinar mal mueve un compromiso tres semanas sin avisar. */
function fechaDe(texto) {
  const t = String(texto || '').trim()
  if (!t) return null
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/)
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 9), +(m[5] || 0))
  m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ ,]+(\d{1,2}):(\d{2}))?/)
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 9), +(m[5] || 0))
  return null
}

export default function ImportarActividades({ leads = [], members = [], onImportar, onCerrar }) {
  const [texto, setTexto] = useState('')
  const [guardando, setGuardando] = useState(false)

  const porNombre = useMemo(() => {
    const m = {}
    leads.forEach(l => { m[normalizar(l.nombre)] = l })
    return m
  }, [leads])

  const porTelefono = useMemo(() => {
    const m = {}
    leads.forEach(l => {
      const d = soloDigitos(l._lead?.phone)
      /* Por los últimos diez dígitos: la misma persona está cargada con lada,
         sin lada y con +52 según quién la haya capturado. */
      if (d.length >= 10) m[d.slice(-10)] = l
    })
    return m
  }, [leads])

  const lectura = useMemo(() => {
    const filas = partirCSV(texto)
    if (filas.length < 2) return { listas: [], sueltas: [], sinColumnas: filas.length === 1 }
    const idx = mapearColumnas(filas[0])
    if (idx.contacto == null && idx.telefono == null) return { listas: [], sueltas: [], sinColumnas: true }

    const listas = [], sueltas = []
    filas.slice(1).forEach((f, i) => {
      const nombre = String(f[idx.contacto] ?? '').trim()
      const tel = soloDigitos(f[idx.telefono])
      const lead = porNombre[normalizar(nombre)] || (tel.length >= 10 ? porTelefono[tel.slice(-10)] : null)
      const fecha = fechaDe(f[idx.fecha])
      if (!lead) { sueltas.push({ renglon: i + 2, nombre: nombre || tel || '(vacío)', motivo: 'No existe ese contacto' }); return }
      if (!fecha) { sueltas.push({ renglon: i + 2, nombre: nombre || lead.nombre, motivo: 'Fecha vacía o ilegible' }); return }
      const nomResp = normalizar(f[idx.responsable])
      const m = members.find(x => normalizar(x.name || x.email) === nomResp)
      listas.push({
        lead,
        tipo: tipoDe(f[idx.tipo]),
        dueAt: fecha,
        resumen: String(f[idx.resumen] ?? '').trim(),
        ownerUid: m?.uid || m?.id || null,
        ownerNombre: m?.name || m?.email || '',
      })
    })
    return { listas, sueltas, sinColumnas: false }
  }, [texto, porNombre, porTelefono, members])

  const confirmar = async () => {
    setGuardando(true)
    try { await onImportar(lectura.listas) } finally { setGuardando(false) }
  }

  return (
    <div className="pv2-dialog">
      <div className="pv2-dialog__backdrop" onClick={onCerrar} />
      <div className="pv2-dialog__box" style={{ maxWidth: 580 }}>
        <h2 className="pv2-dialog__title">Importar actividades</h2>
        <p className="pv2-dialog__hint">
          Pega el CSV o súbelo. Se crean como pendientes, sobre contactos que ya existen.
        </p>

        <div className="pv2-import-cols">
          <strong>Columnas que se reconocen</strong>
          <span>Contacto · Teléfono · Canal · Vence · Qué quedó · Responsable</span>
          <span className="pv2-hint" style={{ margin: 0 }}>
            Basta con el contacto (o el teléfono) y la fecha. Fechas en dd/mm/aaaa o aaaa-mm-dd.
          </span>
        </div>

        <div>
          <label className="pv2-input-label">El CSV</label>
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            className="pv2-input"
            onChange={e => {
              const f = e.target.files?.[0]
              if (!f) return
              const r = new FileReader()
              r.onload = () => setTexto(String(r.result || ''))
              r.readAsText(f, 'utf-8')
            }}
          />
          <textarea
            className="pv2-input"
            rows={5}
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder={'Contacto,Canal,Vence,Qué quedó,Responsable\nBeatriz Martínez,WhatsApp,07/11/2026,Mandarle la propuesta,Mario'}
            style={{ resize: 'vertical', marginTop: 8, fontFamily: 'ui-monospace, monospace', fontSize: 12 }}
          />
        </div>

        {texto.trim() && lectura.sinColumnas && (
          <div className="pv2-import-aviso">
            <AlertTriangle size={13} />
            No encuentro el encabezado. La primera línea tiene que traer los nombres de las columnas.
          </div>
        )}

        {(lectura.listas.length > 0 || lectura.sueltas.length > 0) && (
          <div className="pv2-import-saldo">
            <span className="pv2-import-saldo__ok">
              <Check size={13} /> {lectura.listas.length} listas para crear
            </span>
            {lectura.sueltas.length > 0 && (
              <span className="pv2-import-saldo__mal">
                <AlertTriangle size={13} /> {lectura.sueltas.length} se quedan fuera
              </span>
            )}
          </div>
        )}

        {lectura.sueltas.length > 0 && (
          <div className="pv2-import-sueltas">
            {lectura.sueltas.slice(0, 6).map(s => (
              <div key={s.renglon}>
                <b>Renglón {s.renglon}</b> · {s.nombre} — {s.motivo}
              </div>
            ))}
            {lectura.sueltas.length > 6 && <div>y {lectura.sueltas.length - 6} más.</div>}
            <p className="pv2-hint" style={{ margin: '6px 0 0' }}>
              No se crean contactos nuevos desde el CSV: un nombre mal escrito acabaría como un
              duplicado en el embudo. Carga primero el contacto y vuelve a intentar.
            </p>
          </div>
        )}

        <div className="pv2-dialog__actions">
          <button type="button" className="pv2-btn" onClick={onCerrar}>Cancelar</button>
          <button
            type="button"
            className="pv2-btn pv2-btn--primary"
            onClick={confirmar}
            disabled={guardando || !lectura.listas.length}
          >
            <Upload size={13} /> {guardando ? 'Creando…' : `Crear ${lectura.listas.length || ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
