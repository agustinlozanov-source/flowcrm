import { useState } from 'react'
import { X, GitBranch, Pencil, GripVertical, Trash2 } from 'lucide-react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const PURPOSES = [
  { value: 'adquisicion',  label: 'Adquisición',  desc: 'Convertir prospectos nuevos en clientes' },
  { value: 'retencion',    label: 'Retención',    desc: 'Mantener y reactivar clientes existentes' },
  { value: 'distribucion', label: 'Distribución', desc: 'Gestión de canales y socios comerciales' },
]

const STAGE_COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#f97316',
  '#eab308','#22c55e','#14b8a6','#3b82f6','#ef4444','#64748b',
]

const clamp = v => Math.max(0, Math.min(100, Number(v) || 0))

function SortableStageRow({ stage, index, total, onChange, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.45 : 1 }}
      className="flex items-center gap-2 bg-surface border border-black/[0.08] rounded-[10px] px-2.5 py-2 shadow-sm"
    >
      <button {...attributes} {...listeners} className="flex-shrink-0 text-tertiary/40 hover:text-tertiary cursor-grab active:cursor-grabbing touch-none p-0.5">
        <GripVertical size={13} />
      </button>
      <div className="relative flex-shrink-0">
        <div className="w-[18px] h-[18px] rounded-full" style={{ background: stage.color }} />
        <select className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" value={stage.color} onChange={e => onChange('color', e.target.value)}>
          {STAGE_COLORS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <input
        value={stage.name}
        onChange={e => onChange('name', e.target.value)}
        placeholder={`Etapa ${index + 1}`}
        className="flex-1 min-w-0 bg-transparent text-[13px] text-primary placeholder-tertiary outline-none"
      />
      <div className="flex items-center gap-1 flex-shrink-0">
        <span className="text-[10px] font-semibold text-tertiary uppercase tracking-wide">Score</span>
        <input
          type="number" min={0} max={100} value={stage.scoreMin}
          onChange={e => onChange('scoreMin', clamp(e.target.value))}
          className="w-10 text-center bg-surface-2 border border-black/[0.08] rounded-[5px] py-[3px] text-[12px] outline-none focus:border-primary/40 text-primary"
        />
        <span className="text-[11px] text-tertiary">–</span>
        <input
          type="number" min={0} max={100} value={stage.scoreMax}
          onChange={e => onChange('scoreMax', clamp(e.target.value))}
          className="w-10 text-center bg-surface-2 border border-black/[0.08] rounded-[5px] py-[3px] text-[12px] outline-none focus:border-primary/40 text-primary"
        />
      </div>
      <button
        onClick={onRemove}
        className={`flex-shrink-0 p-1 rounded-[5px] text-tertiary hover:text-red-500 hover:bg-red-50 transition-colors ${total <= 1 ? 'opacity-0 pointer-events-none' : ''}`}
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}

// mode: 'edit' (pipeline existente) | 'adopt' (etapas huérfanas sin pipeline)
export default function EditPipelineModal({ mode = 'edit', pipeline, stages = [], onSave, onClose }) {
  const isAdopt = mode === 'adopt'
  const originalIds = stages.map(s => s.id)

  const [name, setName] = useState(pipeline?.name || '')
  const [purpose, setPurpose] = useState(pipeline?.purpose || 'adquisicion')
  const [stageEdits, setStageEdits] = useState(
    stages.map(s => ({
      id: s.id,
      name: s.name,
      color: s.color || '#6366f1',
      scoreMin: s.scoreMin ?? 0,
      scoreMax: s.scoreMax ?? 100,
    }))
  )
  const [saving, setSaving] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const updateStage = (id, field, val) =>
    setStageEdits(s => s.map(st => st.id === id ? { ...st, [field]: val } : st))

  const removeStage = (id) =>
    setStageEdits(s => s.filter(st => st.id !== id))

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    setStageEdits(prev => {
      const from = prev.findIndex(s => s.id === active.id)
      const to   = prev.findIndex(s => s.id === over.id)
      return arrayMove(prev, from, to)
    })
  }

  const handleSubmit = async () => {
    if (!name.trim()) return
    setSaving(true)
    const deletedIds = originalIds.filter(id => !stageEdits.find(s => s.id === id))
    try {
      await onSave({ name: name.trim(), purpose, stageEdits, deletedIds })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-surface border border-black/[0.08] rounded-[16px] shadow-2xl w-full max-w-[520px] max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.08] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[8px] bg-primary/[0.08] flex items-center justify-center">
              {isAdopt ? <GitBranch size={14} className="text-primary" /> : <Pencil size={14} className="text-primary" />}
            </div>
            <div>
              <span className="font-display font-bold text-[15px]">
                {isAdopt ? 'Configurar pipeline existente' : 'Editar pipeline'}
              </span>
              {!isAdopt && pipeline?.name && (
                <span className="ml-2 text-[11px] text-tertiary">{pipeline.name}</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-[6px] hover:bg-surface-2 text-tertiary hover:text-primary transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

          {isAdopt && (
            <div className="bg-amber-50 border border-amber-200 rounded-[10px] px-4 py-3 text-[12.5px] text-amber-800 leading-relaxed">
              Tienes etapas y leads sin pipeline asignado. Dale un nombre a este pipeline y quedará configurado correctamente.
            </div>
          )}

          {/* Nombre */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wide text-tertiary">Nombre</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="Ej: Nuevos clientes, Reactivación..."
              className="w-full bg-surface-2 border border-black/[0.08] rounded-[8px] px-3 py-2 text-[13.5px] text-primary placeholder-tertiary outline-none focus:border-primary/40 transition-colors"
            />
          </div>

          {/* Propósito */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wide text-tertiary">Propósito</label>
            <div className="flex flex-col gap-2">
              {PURPOSES.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPurpose(p.value)}
                  className={`flex items-start gap-3 px-3.5 py-2.5 rounded-[10px] border text-left transition-all ${
                    purpose === p.value
                      ? 'border-primary/40 bg-primary/[0.05]'
                      : 'border-black/[0.08] hover:border-black/20 bg-transparent'
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded-full border-2 mt-0.5 flex-shrink-0 transition-colors ${
                    purpose === p.value ? 'border-primary bg-primary' : 'border-black/20'
                  }`} />
                  <div>
                    <div className="text-[13px] font-semibold text-primary">{p.label}</div>
                    <div className="text-[11.5px] text-tertiary mt-0.5">{p.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Etapas */}
          {stageEdits.length > 0 && (
            <div className="flex flex-col gap-2">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-tertiary">Etapas ({stageEdits.length})</label>
                <p className="text-[11px] text-tertiary mt-0.5">El agente asigna leads a la etapa cuyo rango de score coincida. Arrastra para reordenar.</p>
              </div>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={stageEdits.map(s => s.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-1.5">
                    {stageEdits.map((stage, i) => (
                      <SortableStageRow
                        key={stage.id}
                        stage={stage}
                        index={i}
                        total={stageEdits.length}
                        onChange={(field, val) => updateStage(stage.id, field, val)}
                        onRemove={() => removeStage(stage.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-black/[0.08] flex-shrink-0">
          <button
            onClick={onClose}
            className="text-[13px] px-4 py-2 rounded-[8px] border border-black/[0.08] text-secondary hover:bg-surface-2 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || saving}
            className="btn-primary text-[13px] py-2 px-4 disabled:opacity-40 flex items-center gap-1.5"
          >
            {saving
              ? 'Guardando...'
              : isAdopt
                ? <><GitBranch size={13} /> Configurar pipeline</>
                : <><Pencil size={13} /> Guardar cambios</>
            }
          </button>
        </div>

      </div>
    </div>
  )
}
