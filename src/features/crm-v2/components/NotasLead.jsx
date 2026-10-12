import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

/** Notas del lead. Se guardan a mano y no al tipear: son notas de trabajo, y
 *  guardar en cada tecla llena el historial de escrituras sin motivo. */
export default function NotasLead({ lead, onSave }) {
  const [texto, setTexto] = useState(lead?.notes || '')
  const [guardando, setGuardando] = useState(false)
  useEffect(() => { setTexto(lead?.notes || '') }, [lead?.id, lead?.notes])

  const sucio = texto !== (lead?.notes || '')

  const guardar = async () => {
    setGuardando(true)
    try { await onSave(texto); toast.success('Notas guardadas') }
    catch { toast.error('No se pudieron guardar') }
    finally { setGuardando(false) }
  }

  return (
    <div>
      <textarea
        className="pv2-input"
        style={{ minHeight: 160, resize: 'vertical', lineHeight: 1.6 }}
        value={texto}
        onChange={e => setTexto(e.target.value)}
        placeholder="Lo que haya que recordar de este contacto…"
      />
      {sucio && (
        <div className="pv2-dialog__actions">
          <button className="pv2-btn" onClick={() => setTexto(lead?.notes || '')}>Descartar</button>
          <button className="pv2-btn pv2-btn--primary" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar notas'}
          </button>
        </div>
      )}
    </div>
  )
}
