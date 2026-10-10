import PipelineColumn from './PipelineColumn'

/**
 * La columna bisagra entre lo automático y lo manual. No es una etapa más:
 * lleva gradiente de marca, borde teal y barra más gruesa, y su alta rápida
 * dice "mover" en vez de "nuevo" porque acá no se crean deals, llegan.
 */
export default function HandoffColumn({ metrics = [], children, isEmpty = false, onAdd, onMenu }) {
  return (
    <PipelineColumn
      name="Handoff"
      className="pv2-col--handoff"
      metrics={metrics}
      isEmpty={isEmpty}
      emptyLabel="Nada esperando a una persona"
      onAdd={onAdd}
      onMenu={onMenu}
      addLabel="+ Mover deal aquí"
      addStyle={{ borderColor: 'rgba(26,171,153,0.4)', color: 'var(--teal)' }}
    >
      {children}
    </PipelineColumn>
  )
}
