import { useState } from 'react'
import clsx from 'clsx'
import { Pause } from 'lucide-react'
import AppShellV2 from '../layout/AppShellV2'
import Topbar from '../components/Topbar'
import OwnerAvatar from '../components/OwnerAvatar'
import PauseAIToggle from '../components/PauseAIToggle'
import WhatsAppStatusBadge from '../components/WhatsAppStatusBadge'
import AIInsightCard from '../components/AIInsightCard'
import { conversations } from '../mockData'

const QUIEN = { in: null, bot: 'Flowi', human: 'Tú' }

/**
 * Inbox con el botón de pánico. La pausa es por conversación: el estado vive
 * en cada hilo, no en el lead, porque el mismo contacto puede seguir con la
 * IA en otro canal.
 */
export default function InboxV2() {
  const [convs, setConvs] = useState(conversations)
  const [activeId, setActiveId] = useState(conversations[0].id)
  const active = convs.find(c => c.id === activeId)

  const togglePause = (id, paused) =>
    setConvs(cs => cs.map(c => (c.id === id ? { ...c, paused } : c)))

  return (
    <AppShellV2 active="conversaciones">
      <Topbar
        breadcrumb="Conversaciones" title="Inbox"
        stats={[
          { label: 'Sin leer', value: String(convs.filter(c => c.unread).length) },
          { label: 'En control humano', value: String(convs.filter(c => c.paused).length), tone: 'amber' },
        ]}
        onSearch={() => {}}
      />

      <div className="pv2-inbox">
        <div className="pv2-inbox__list">
          {convs.map(c => (
            <button
              key={c.id}
              className={clsx('pv2-conv', c.id === activeId && 'pv2-conv--active')}
              onClick={() => setActiveId(c.id)}
            >
              <OwnerAvatar name={c.name} size={32} />
              <span className="pv2-conv__main">
                <span className="pv2-conv__top">
                  <span className="pv2-conv__name">{c.name}</span>
                  {/* El ícono marca las conversaciones que lleva una persona. */}
                  {c.paused && <span className="pv2-conv__paused" title="IA pausada"><Pause size={11} /></span>}
                  <span className="pv2-conv__time">{c.time}</span>
                </span>
                <span className="pv2-conv__last">{c.last}</span>
              </span>
              {c.unread && <span className="pv2-conv__unread" />}
            </button>
          ))}
        </div>

        <div className="pv2-chat">
          <div className="pv2-chat__header">
            <OwnerAvatar name={active.name} size={32} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 14 }}>{active.name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>WhatsApp · última hace {active.time}</div>
            </div>
            <WhatsAppStatusBadge status="warn" reasons={['payment']} compact />
          </div>

          <div className="pv2-chat__body">
            {active.thread.map((m, i) => (
              <div key={i} className={`pv2-msg pv2-msg--${m.who}`}>
                {QUIEN[m.who] && <div className="pv2-msg__who">{QUIEN[m.who]}</div>}
                {m.text}
              </div>
            ))}
          </div>

          <div className="pv2-chat__composer">
            <textarea
              className="pv2-chat__input"
              rows={2}
              placeholder={active.paused ? 'Escribí vos: la IA está pausada en esta conversación' : 'Escribí para tomar el control…'}
            />
          </div>
        </div>

        <aside className="pv2-chat__aside">
          <PauseAIToggle paused={active.paused} onToggle={p => togglePause(active.id, p)} />
          <div style={{ marginTop: 16 }}>
            <AIInsightCard
              text={active.paused
                ? 'Esta conversación la lleva una persona. El agente no va a responder y el scoring está congelado.'
                : 'El lead mencionó un síntoma concreto. Sugiero <strong>proponer un horario</strong> en vez de seguir preguntando.'}
              readOnly={active.paused}
              onExecute={() => {}}
            />
          </div>
        </aside>
      </div>
    </AppShellV2>
  )
}
