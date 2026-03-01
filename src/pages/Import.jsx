import { useState, useRef } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { usePipeline } from '@/hooks/usePipeline'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { FileUp, FileText, Zap, ArrowRight, CheckCircle } from 'lucide-react'

const CRM_FIELDS = [
  { value: 'name', label: 'Nombre' },
  { value: 'company', label: 'Empresa' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Teléfono' },
  { value: 'value', label: 'Valor (USD)' },
  { value: 'source', label: 'Fuente' },
  { value: 'notes', label: 'Notas' },
  { value: 'ignore', label: 'Ignorar columna' },
]

const STEPS = ['Subir archivo', 'Mapeo IA', 'Confirmar', 'Resultado']

// Parse CSV text to array of objects
function parseCSV(text) {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const rows = lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    return headers.reduce((obj, h, i) => ({ ...obj, [h]: vals[i] || '' }), {})
  })
  return { headers, rows }
}

export default function Import() {
  const { org } = useAuthStore()
  const { stages } = usePipeline()
  const [step, setStep] = useState(0)
  const [file, setFile] = useState(null)
  const [parsed, setParsed] = useState({ headers: [], rows: [] })
  const [mapping, setMapping] = useState({})
  const [aiNotes, setAiNotes] = useState('')
  const [aiConfidence, setAiConfidence] = useState(0)
  const [analyzing, setAnalyzing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [targetStageId, setTargetStageId] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef()

  // Set default stage when stages load
  if (stages.length > 0 && !targetStageId) {
    setTargetStageId(stages[0].id)
  }

  const handleFile = async (f) => {
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      toast.error('Solo se aceptan archivos CSV o Excel')
      return
    }

    setFile(f)

    // Parse file
    if (ext === 'csv') {
      const text = await f.text()
      const result = parseCSV(text)
      if (result.headers.length === 0) {
        toast.error('El archivo está vacío o no tiene el formato correcto')
        return
      }
      setParsed(result)
      setStep(1)
      analyzeWithAI(result)
    } else {
      // For Excel, we'd need SheetJS - for now show message
      toast.error('Por ahora solo CSV. Soporte Excel próximamente.')
    }
  }

  const analyzeWithAI = async ({ headers, rows }) => {
    setAnalyzing(true)
    try {
      const sampleRows = rows.slice(0, 3)
      const res = await fetch('/.netlify/functions/map-columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headers, sampleRows }),
      })
      const data = await res.json()
      if (data.mapping) {
        setMapping(data.mapping)
        setAiConfidence(data.confidence || 0)
        setAiNotes(data.notes || '')
      }
    } catch (err) {
      console.error(err)
      toast.error('Error al analizar el archivo')
      // Set default mapping
      const defaultMapping = {}
      headers.forEach(h => { defaultMapping[h] = 'ignore' })
      setMapping(defaultMapping)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleImport = async () => {
    if (!targetStageId) { toast.error('Selecciona una etapa destino'); return }

    setImporting(true)
    let imported = 0
    let skipped = 0
    let duplicates = 0
    const seenEmails = new Set()

    try {
      for (const row of parsed.rows) {
        const lead = {}

        // Apply mapping
        Object.entries(mapping).forEach(([header, field]) => {
          if (field !== 'ignore' && row[header]) {
            lead[field] = row[header]
          }
        })

        // Skip rows without a name
        if (!lead.name || !lead.name.trim()) {
          skipped++
          continue
        }

        // Basic duplicate detection by email
        if (lead.email && seenEmails.has(lead.email.toLowerCase())) {
          duplicates++
          continue
        }
        if (lead.email) seenEmails.add(lead.email.toLowerCase())

        await addDoc(collection(db, 'organizations', org.id, 'leads'), {
          name: lead.name?.trim() || '',
          company: lead.company?.trim() || '',
          email: lead.email?.trim() || '',
          phone: lead.phone?.trim() || '',
          value: Number(lead.value?.replace(/[^0-9.]/g, '')) || 0,
          source: lead.source || 'manual',
          notes: lead.notes?.trim() || '',
          stageId: targetStageId,
          score: 0,
          assignedTo: null,
          importedFrom: file.name,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
        imported++
      }

      setImportResult({ imported, skipped, duplicates, total: parsed.rows.length })
      setStep(3)
    } catch (err) {
      console.error(err)
      toast.error('Error durante la importación')
    } finally {
      setImporting(false)
    }
  }

  const reset = () => {
    setStep(0)
    setFile(null)
    setParsed({ headers: [], rows: [] })
    setMapping({})
    setAiNotes('')
    setAiConfidence(0)
    setImportResult(null)
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* TOPBAR */}
      <div className="bg-surface border-b border-black/[0.08] px-5 h-[68px] flex items-center gap-3 flex-shrink-0">
        <h1 className="font-display font-bold text-[15px] tracking-tight">Importar contactos</h1>
        {step > 0 && (
          <button onClick={reset} className="text-xs text-secondary hover:text-primary transition-colors ml-2">
            ← Empezar de nuevo
          </button>
        )}
      </div>

      {/* STEP INDICATOR */}
      <div className="bg-surface border-b border-black/[0.08] px-6 py-3 flex items-center gap-0 flex-shrink-0">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center">
            <div className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all',
              i === step ? 'text-primary' : i < step ? 'text-green-600' : 'text-tertiary'
            )}>
              <div className={clsx(
                'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold',
                i === step ? 'bg-primary text-white' :
                  i < step ? 'bg-green-500 text-white' : 'bg-surface-2 text-tertiary border border-black/[0.1]'
              )}>
                {i < step ? '✓' : i + 1}
              </div>
              {s}
            </div>
            {i < STEPS.length - 1 && (
              <div className={clsx('w-8 h-px mx-1', i < step ? 'bg-green-300' : 'bg-black/[0.08]')} />
            )}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">

        {/* STEP 0: UPLOAD */}
        {step === 0 && (
          <div className="max-w-xl mx-auto">
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
              onClick={() => fileRef.current?.click()}
              className={clsx(
                'border-2 border-dashed rounded-[18px] p-12 text-center cursor-pointer transition-all',
                dragOver ? 'border-accent-blue bg-blue-50' : 'border-black/[0.14] hover:border-black/[0.25] hover:bg-surface-2'
              )}
            >
              <div className="w-16 h-16 rounded-[18px] bg-black/[0.02] border border-black/[0.05] flex items-center justify-center text-tertiary mb-4 mx-auto">
                <FileUp size={32} strokeWidth={1.5} />
              </div>
              <h3 className="font-display font-bold text-lg text-primary mb-2">
                Sube tu archivo
              </h3>
              <p className="text-sm text-secondary mb-1">
                Arrastra aquí o haz clic para seleccionar
              </p>
              <p className="text-xs text-tertiary">CSV soportado · Excel próximamente</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={e => handleFile(e.target.files[0])}
              />
            </div>

            {/* Tips */}
            <div className="mt-6 card p-5">
              <h4 className="font-display font-semibold text-sm mb-3">💡 Consejos para importar bien</h4>
              <ul className="flex flex-col gap-2 text-[12.5px] text-secondary">
                <li className="flex items-start gap-2"><span className="text-green-500 font-bold flex-shrink-0">✓</span> La primera fila debe tener los nombres de las columnas</li>
                <li className="flex items-start gap-2"><span className="text-green-500 font-bold flex-shrink-0">✓</span> La IA detecta automáticamente nombre, email, teléfono y más</li>
                <li className="flex items-start gap-2"><span className="text-green-500 font-bold flex-shrink-0">✓</span> Los duplicados por email se detectan automáticamente</li>
                <li className="flex items-start gap-2"><span className="text-green-500 font-bold flex-shrink-0">✓</span> Puedes corregir el mapeo antes de importar</li>
              </ul>
            </div>
          </div>
        )}

        {/* STEP 1: AI MAPPING */}
        {step === 1 && (
          <div className="max-w-2xl mx-auto flex flex-col gap-5">

            {/* File info */}
            <div className="card p-4 flex items-center gap-3">
              <FileText size={24} className="text-tertiary flex-shrink-0" />
              <div className="flex-1">
                <div className="font-semibold text-sm text-primary">{file?.name}</div>
                <div className="text-xs text-secondary">{parsed.rows.length} filas · {parsed.headers.length} columnas</div>
              </div>
              {analyzing ? (
                <div className="flex items-center gap-2 text-xs text-secondary">
                  <div className="w-4 h-4 border-2 border-black/10 border-t-accent-purple rounded-full animate-spin" />
                  Analizando con IA...
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-green-600">
                  <span>✓</span> Análisis completado — {aiConfidence}% confianza
                </div>
              )}
            </div>

            {/* AI Notes */}
            {aiNotes && !analyzing && (
              <div className="flex gap-2.5 p-3.5 bg-purple-50 border border-purple-200 rounded-[10px]">
                <Zap size={18} className="text-purple-500 flex-shrink-0" />
                <p className="text-xs text-purple-700 leading-relaxed">{aiNotes}</p>
              </div>
            )}

            {/* Mapping table */}
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-black/[0.06]">
                <span className="font-display font-bold text-sm">Mapeo de columnas</span>
                <span className="text-xs text-secondary ml-2">Corrige si algo está mal</span>
              </div>
              <div className="divide-y divide-black/[0.04]">
                {parsed.headers.map(header => {
                  const sampleVal = parsed.rows[0]?.[header] || ''
                  return (
                    <div key={header} className="flex items-center gap-4 px-5 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-primary truncate">{header}</div>
                        {sampleVal && <div className="text-[11px] text-tertiary truncate">Ej: {sampleVal}</div>}
                      </div>
                      <ArrowRight size={16} strokeWidth={1.5} className="text-tertiary flex-shrink-0" />
                      <select
                        value={mapping[header] || 'ignore'}
                        onChange={e => setMapping(m => ({ ...m, [header]: e.target.value }))}
                        className={clsx(
                          'text-[12.5px] border rounded-lg px-2.5 py-1.5 outline-none cursor-pointer min-w-[140px]',
                          mapping[header] && mapping[header] !== 'ignore'
                            ? 'border-accent-blue/30 bg-blue-50 text-accent-blue font-semibold'
                            : 'border-black/[0.1] bg-surface-2 text-secondary'
                        )}
                      >
                        {CRM_FIELDS.map(f => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={analyzing}
              className="btn-primary py-2.5 flex items-center justify-center gap-2"
            >
              Revisar preview →
            </button>
          </div>
        )}

        {/* STEP 2: CONFIRM */}
        {step === 2 && (
          <div className="max-w-3xl mx-auto flex flex-col gap-5">

            {/* Target stage */}
            <div className="card p-5">
              <h3 className="font-display font-bold text-sm mb-3">¿A qué etapa van los leads importados?</h3>
              <div className="flex flex-wrap gap-2">
                {stages.map(stage => (
                  <button
                    key={stage.id}
                    onClick={() => setTargetStageId(stage.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all"
                    style={{
                      borderColor: targetStageId === stage.id ? stage.color : 'rgba(0,0,0,0.1)',
                      background: targetStageId === stage.id ? `${stage.color}15` : 'transparent',
                      color: targetStageId === stage.id ? stage.color : '#6e6e73',
                    }}
                  >
                    <div className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
                    {stage.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview table */}
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-black/[0.06] flex items-center justify-between">
                <span className="font-display font-bold text-sm">Preview — primeros 5 registros</span>
                <span className="text-xs text-secondary">{parsed.rows.length} registros en total</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-black/[0.06]">
                      {Object.entries(mapping)
                        .filter(([, field]) => field !== 'ignore')
                        .map(([header, field]) => {
                          const f = CRM_FIELDS.find(f => f.value === field)
                          return (
                            <th key={header} className="text-left text-[10px] font-semibold uppercase tracking-wide text-tertiary px-4 py-2.5">
                              {f?.label || field}
                            </th>
                          )
                        })}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b border-black/[0.04] last:border-0">
                        {Object.entries(mapping)
                          .filter(([, field]) => field !== 'ignore')
                          .map(([header]) => (
                            <td key={header} className="px-4 py-2.5 text-[12.5px] text-primary max-w-[180px] truncate">
                              {row[header] || <span className="text-tertiary">—</span>}
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="btn-secondary flex-1">
                ← Ajustar mapeo
              </button>
              <button
                onClick={handleImport}
                disabled={importing}
                className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2"
              >
                {importing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Importando {parsed.rows.length} registros...
                  </>
                ) : `Importar ${parsed.rows.length} leads →`}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: RESULT */}
        {step === 3 && importResult && (
          <div className="max-w-md mx-auto text-center">
            <div className="card p-8">
              <div className="w-16 h-16 rounded-2xl bg-green-50 border border-green-200 flex items-center justify-center text-green-600 mb-4 mx-auto">
                <CheckCircle size={32} strokeWidth={1.5} />
              </div>
              <h2 className="font-display font-bold text-2xl tracking-tight mb-2">¡Importación completada!</h2>
              <p className="text-secondary text-sm mb-6">Tus leads ya están en el pipeline.</p>

              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-green-50 border border-green-200 rounded-[10px] p-4">
                  <div className="font-display font-bold text-2xl text-green-600">{importResult.imported}</div>
                  <div className="text-[11px] text-green-700 font-semibold mt-0.5">Importados</div>
                </div>
                <div className="bg-surface-2 border border-black/[0.08] rounded-[10px] p-4">
                  <div className="font-display font-bold text-2xl text-secondary">{importResult.skipped}</div>
                  <div className="text-[11px] text-tertiary font-semibold mt-0.5">Omitidos</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-[10px] p-4">
                  <div className="font-display font-bold text-2xl text-amber-600">{importResult.duplicates}</div>
                  <div className="text-[11px] text-amber-700 font-semibold mt-0.5">Duplicados</div>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={reset} className="btn-secondary flex-1">
                  Importar otro
                </button>
                <a href="/pipeline" className="btn-primary flex-1 flex items-center justify-center">
                  Ver pipeline →
                </a>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
