// Zona de carga (§3.1) y sección de materiales (§5.7).
//
// Los archivos van del browser directo a Firebase Storage con
// uploadBytesResumable — nunca pasan por una function. El límite de payload de
// una Netlify function es 6MB y la spec permite archivos de 25MB, así que
// subirlos por el backend no es una opción.

import { useState, useRef, useCallback } from 'react'
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import { profileStorage as storage } from '@/lib/firebaseProfile'
import {
  UploadCloud, FileText, Image as ImageIcon, FileSpreadsheet, Presentation,
  File as FileIcon, Trash2, Download, Plus, AlertCircle,
} from 'lucide-react'
import clsx from 'clsx'
import { MATERIAL_TYPES, WHEN_TO_SERVE } from '@/lib/companyProfileSchema'

export const ACCEPTED = [
  '.pdf', '.docx', '.doc', '.pptx', '.ppt', '.xlsx', '.xls',
  '.jpg', '.jpeg', '.png', '.webp', '.txt', '.md',
]
export const MAX_FILES = 50
export const MAX_SIZE = 25 * 1024 * 1024 // 25MB

const EXT_ICON = {
  pdf: FileText, doc: FileText, docx: FileText, txt: FileText, md: FileText,
  xls: FileSpreadsheet, xlsx: FileSpreadsheet,
  ppt: Presentation, pptx: Presentation,
  jpg: ImageIcon, jpeg: ImageIcon, png: ImageIcon, webp: ImageIcon,
}

export const extOf = name => (name.split('.').pop() || '').toLowerCase()
export const fmtSize = b => (b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`)

export function FileIconFor({ name, size = 18 }) {
  const Icon = EXT_ICON[extOf(name)] || FileIcon
  return <Icon size={size} />
}

/** Recorre un DataTransfer que puede traer carpetas enteras. */
async function filesFromDataTransfer(dt) {
  const out = []
  const items = Array.from(dt.items || [])
  const entries = items.map(i => (i.webkitGetAsEntry ? i.webkitGetAsEntry() : null)).filter(Boolean)
  if (!entries.length) return Array.from(dt.files || [])

  const walk = entry => new Promise(resolve => {
    if (entry.isFile) {
      entry.file(f => { out.push(f); resolve() }, () => resolve())
    } else if (entry.isDirectory) {
      const reader = entry.createReader()
      const readBatch = () => reader.readEntries(async batch => {
        if (!batch.length) return resolve()
        await Promise.all(batch.map(walk))
        readBatch()
      }, () => resolve())
      readBatch()
    } else resolve()
  })

  await Promise.all(entries.map(walk))
  return out
}

// ── Zona de carga ───────────────────────────────────────────────────────────

export function UploadZone({ profileId, materials, onAdd, onRemove, compact = false }) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState({})
  const [errors, setErrors] = useState([])
  const inputRef = useRef(null)

  const validate = useCallback((files, currentCount) => {
    const ok = [], bad = []
    for (const f of files) {
      if (currentCount + ok.length >= MAX_FILES) { bad.push({ name: f.name, why: `Se alcanzó el máximo de ${MAX_FILES} archivos` }); continue }
      if (!ACCEPTED.includes('.' + extOf(f.name))) { bad.push({ name: f.name, why: 'Formato no soportado' }); continue }
      if (f.size > MAX_SIZE) { bad.push({ name: f.name, why: `Pesa ${fmtSize(f.size)} — el máximo es 25 MB` }); continue }
      ok.push(f)
    }
    return { ok, bad }
  }, [])

  const upload = useCallback(async files => {
    const { ok, bad } = validate(files, materials.length)
    if (bad.length) setErrors(prev => [...prev, ...bad])

    for (const file of ok) {
      const fileId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const safeName = file.name.replace(/[^\w.\-\s]/g, '_')
      const storagePath = `company-profiles/${profileId}/assets/${fileId}-${safeName}`
      const task = uploadBytesResumable(ref(storage, storagePath), file, { contentType: file.type })

      setUploading(u => ({ ...u, [fileId]: { name: file.name, pct: 0 } }))

      try {
        await new Promise((resolve, reject) => {
          task.on('state_changed',
            s => setUploading(u => ({ ...u, [fileId]: { name: file.name, pct: Math.round(s.bytesTransferred / s.totalBytes * 100) } })),
            reject,
            resolve,
          )
        })
        const url = await getDownloadURL(task.snapshot.ref)
        onAdd({
          fileId,
          originalName: file.name,
          type: file.type || extOf(file.name),
          size: file.size,
          storagePath,
          url,
          uploadedAt: Date.now(),
          processingStatus: 'pending',
          materialType: '',
          whenToServe: [],
          agentDescription: '',
          extractedFieldsCount: 0,
        })
      } catch {
        setErrors(prev => [...prev, { name: file.name, why: 'No se pudo subir. Intenta de nuevo.' }])
      } finally {
        setUploading(u => { const n = { ...u }; delete n[fileId]; return n })
      }
    }
  }, [materials.length, onAdd, profileId, validate])

  const onDrop = async e => {
    e.preventDefault()
    setDragging(false)
    const files = await filesFromDataTransfer(e.dataTransfer)
    if (files.length) upload(files)
  }

  const uploadingList = Object.entries(uploading)

  return (
    <div>
      <div
        className={clsx('cpb-dropzone', dragging && 'is-dragging', compact && 'is-compact')}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
      >
        <UploadCloud size={compact ? 24 : 40} className="cpb-drop-icon" />
        <div className="cpb-drop-title">{dragging ? 'Suelta aquí' : 'Arrastra aquí tus archivos'}</div>
        <div className="cpb-drop-sub">O haz click para seleccionarlos</div>
        <div className="cpb-drop-formats">PDF · Word · Excel · PowerPoint · Imágenes</div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED.join(',')}
          style={{ display: 'none' }}
          onChange={e => { upload(Array.from(e.target.files || [])); e.target.value = '' }}
        />
      </div>

      {uploadingList.length > 0 && (
        <div className="cpb-uploading">
          {uploadingList.map(([id, u]) => (
            <div key={id} className="cpb-uploading-row">
              <span className="cpb-uploading-name">{u.name}</span>
              <div className="cpb-uploading-track"><div className="cpb-uploading-fill" style={{ width: `${u.pct}%` }} /></div>
              <span className="cpb-uploading-pct">{u.pct}%</span>
            </div>
          ))}
        </div>
      )}

      {errors.length > 0 && (
        <div className="cpb-upload-errors">
          {errors.map((e, i) => (
            <div key={i} className="cpb-upload-error">
              <AlertCircle size={13} /> <strong>{e.name}</strong> — {e.why}
            </div>
          ))}
          <button type="button" className="cpb-mini-btn" onClick={() => setErrors([])}>Entendido</button>
        </div>
      )}

      {materials.length > 0 && (
        <div className="cpb-filegrid">
          {materials.map(m => (
            <div key={m.fileId} className="cpb-filecard">
              <div className="cpb-filecard-icon"><FileIconFor name={m.originalName} /></div>
              <div className="cpb-filecard-body">
                <div className="cpb-filecard-name" title={m.originalName}>{m.originalName}</div>
                <div className="cpb-filecard-size">{fmtSize(m.size)}</div>
              </div>
              <button type="button" className="cpb-filecard-del" onClick={() => onRemove(m)} title="Eliminar">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="cpb-drop-counter">
        {materials.length} de {MAX_FILES} archivos · máximo 25 MB cada uno
      </div>
    </div>
  )
}

export async function deleteMaterialFile(m) {
  try { await deleteObject(ref(storage, m.storagePath)) } catch { /* ya no existe */ }
}

// ── Sección 7: etiquetado de materiales ─────────────────────────────────────

export function MaterialsSection({ profileId, materials, onAdd, onRemove, onUpdate, readOnly }) {
  const [showUploader, setShowUploader] = useState(false)

  if (!materials.length) {
    return (
      <div>
        <div className="cpb-empty-note">
          Todavía no has subido archivos. Súbelos aquí y etiquétalos para que el agente sepa cuándo compartirlos.
        </div>
        {!readOnly && <div style={{ marginTop: 16 }}><UploadZone profileId={profileId} materials={materials} onAdd={onAdd} onRemove={onRemove} /></div>}
      </div>
    )
  }

  return (
    <div>
      {materials.map(m => (
        <div key={m.fileId} className="cpb-material">
          <div className="cpb-material-head">
            <span className="cpb-material-icon"><FileIconFor name={m.originalName} size={20} /></span>
            <div className="cpb-material-meta">
              <div className="cpb-material-name">{m.originalName}</div>
              <div className="cpb-material-sub">
                {fmtSize(m.size)} · {new Date(m.uploadedAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
            <div className="cpb-material-tools">
              {m.url && <a href={m.url} target="_blank" rel="noreferrer" className="cpb-mini-btn" title="Descargar"><Download size={12} /></a>}
              {!readOnly && <button type="button" className="cpb-mini-btn" onClick={() => onRemove(m)} title="Eliminar"><Trash2 size={12} /></button>}
            </div>
          </div>

          <div className="cpb-material-form">
            <div className="cpb-cell">
              <div className="cpb-sublabel">Tipo de material</div>
              <select
                className="cpb-input cpb-select"
                value={m.materialType || ''}
                disabled={readOnly}
                onChange={e => onUpdate(m.fileId, { materialType: e.target.value })}
              >
                <option value="">— Selecciona —</option>
                {MATERIAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="cpb-cell is-wide">
              <div className="cpb-sublabel">Cuándo servirlo</div>
              <div className="cpb-chips">
                {WHEN_TO_SERVE.map(w => {
                  const on = (m.whenToServe || []).includes(w)
                  return (
                    <button
                      key={w}
                      type="button"
                      disabled={readOnly}
                      className={clsx('cpb-chip', on && 'is-on')}
                      onClick={() => onUpdate(m.fileId, {
                        whenToServe: on ? m.whenToServe.filter(x => x !== w) : [...(m.whenToServe || []), w],
                      })}
                    >
                      {w}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="cpb-cell is-wide">
              <div className="cpb-sublabel">Descripción corta para el agente</div>
              <textarea
                className="cpb-textarea"
                rows={2}
                maxLength={200}
                disabled={readOnly}
                value={m.agentDescription || ''}
                placeholder="Ej: Catálogo actualizado 2026 con todos los precios de consultas y cirugías."
                onChange={e => onUpdate(m.fileId, { agentDescription: e.target.value })}
              />
              <div className="cpb-help" style={{ marginTop: 4 }}>
                Es una descripción interna: el agente la usa para decidir cuándo entregar el archivo. No la ve el cliente final.
              </div>
            </div>
          </div>
        </div>
      ))}

      {!readOnly && (
        showUploader ? (
          <div style={{ marginTop: 16 }}>
            <UploadZone profileId={profileId} materials={materials} onAdd={onAdd} onRemove={onRemove} compact />
            <button type="button" className="cpb-mini-btn" style={{ marginTop: 8 }} onClick={() => setShowUploader(false)}>Cerrar</button>
          </div>
        ) : (
          <button type="button" className="cpb-add-btn" onClick={() => setShowUploader(true)}>
            <Plus size={13} /> Agregar más materiales
          </button>
        )
      )}
    </div>
  )
}
