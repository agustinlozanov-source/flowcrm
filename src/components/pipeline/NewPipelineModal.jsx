import { useState } from 'react'
import { X, Plus, Trash2, GitBranch } from 'lucide-react'

const PURPOSES = [
  { value: 'adquisicion', label: 'Adquisición', desc: 'Convertir prospectos nuevos en clientes' },
  { value: 'retencion',   label: 'Retención',   desc: 'Mantener y reactivar clientes existentes' },
  { value: 'distribucion', label: 'Distribución', desc: 'Gestión de canales y socios comerciales' },
]

const STAGE_COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#f97316',
  '#eab308','#22c55e','#14b8a6','#3b82f6','#ef4444','#64748b',
]

const DEFAULT_STAGES = [
  { name: 'Nuevo', color: '#6366f1' },
  { name: 'En contacto', color: '#3b82f6' },
  { name: 'Calificado', color: '#22c55e' },
  { name: 'Cerrado', color: '#eab308' },
]

export default function NewPipelineModal({ onCreate, onClose }) {
  const [name, setName] = useState('')
  const [purpose, setPurpose] = useState('adquisicion')
  const [stages, setStages] = useState(DEFAULT_STAGES)
  const [saving, setSaving] = useState(false)

  const updateStage = (i, field, val) =>
    setStages(s => s.map((st, idx) => idx === i ? { ...st, [field]: val } : st))

  const addStage = () =>
    setStages(s => [...s, { name: '', color: STAGE_COLORS[s.length % STAGE_COLORS.length] }])

  const removeStage = (i) =>
    setStages(s => s.filter((_, idx) => idx !== i))

  const handleSubmit = async () => {
    if (!name.trim()) return
    if (stages.some(s => !s.name.trim())) return
    setSaving(true)
    try {
      await onCreate({ name: name.trim(), purpose, stages })
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
              <GitBranch size={14} className="text-primary" />
            </div>
            <span className="font-display font-bold text-[15px]">Nuevo pipeline</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-[6px] hover:bg-surface-2 text-tertiary hover:text-primary transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

          {/* Nombre */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wide text-tertiary">Nombre del pipeline</label>
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
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wide text-tertiary">
                Etapas <span className="text-tertiary font-normal normal-case tracking-normal">({stages.length})</span>
              </label>
            </div>

            <div className="flex flex-col gap-2">
              {stages.map((stage, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[11px] text-tertiary w-4 text-right flex-shrink-0">{i + 1}</span>

                  {/* Color picker */}
                  <div className="relative flex-shrink-0">
                    <div
                      className="w-6 h-6 rounded-full cursor-pointer ring-2 ring-offset-1 ring-offset-surface"
                      style={{ background: stage.color, ringColor: stage.color }}
                    />
                    <select
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      value={stage.color}
                      onChange={e => updateStage(i, 'color', e.target.value)}
                    >
                      {STAGE_COLORS.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <input
                    value={stage.name}
                    onChange={e => updateStage(i, 'name', e.target.value)}
                    placeholder={`Etapa ${i + 1}`}
                    className="flex-1 bg-surface-2 border border-black/[0.08] rounded-[8px] px-3 py-1.5 text-[13px] text-primary placeholder-tertiary outline-none focus:border-primary/40 transition-colors"
                  />

                  {stages.length > 1 && (
                    <button
                      onClick={() => removeStage(i)}
                      className="p-1.5 rounded-[6px] text-tertiary hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={addStage}
              className="mt-1 flex items-center gap-1.5 text-[12px] text-tertiary hover:text-primary transition-colors py-1"
            >
              <Plus size={13} strokeWidth={2.5} />
              Agregar etapa
            </button>
          </div>

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
            disabled={!name.trim() || stages.some(s => !s.name.trim()) || saving}
            className="btn-primary text-[13px] py-2 px-4 disabled:opacity-40 flex items-center gap-1.5"
          >
            {saving ? 'Creando...' : (
              <><GitBranch size={13} /> Crear pipeline</>
            )}
          </button>
        </div>

      </div>
    </div>
  )
}
