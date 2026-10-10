import clsx from 'clsx'
import { Pause, Play } from 'lucide-react'

/**
 * Botón de pánico: corta al agente en una conversación para que la tome una
 * persona. La pausa es por conversación, no por lead — el mismo contacto
 * puede seguir con la IA en otro canal.
 *
 * Mientras está pausada el scoring y el avance de etapa se congelan, porque
 * lo que hace el humano no se refleja en el score y lo ensuciaría.
 */
export default function PauseAIToggle({ paused = false, onToggle, showNote = true }) {
  return (
    <div>
      <button
        className={clsx('pv2-pause', paused && 'pv2-pause--paused')}
        onClick={() => onToggle?.(!paused)}
      >
        {paused ? <Play size={14} /> : <Pause size={14} />}
        {paused ? 'Reactivar IA' : 'Pausar IA'}
      </button>
      {showNote && paused && (
        <p className="pv2-pause__note">
          El agente no responde en esta conversación. El scoring y el avance de etapa están congelados.
        </p>
      )}
    </div>
  )
}
