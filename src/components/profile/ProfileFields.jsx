// Renderizadores de campo del Company Profile Builder.
//
// Todo se maneja por el `type` declarado en companyProfileSchema.js — este
// archivo no sabe nada de secciones concretas, solo de tipos.
//
// Nota sobre las "tablas": la spec las describe como tablas, pero el catálogo
// tiene 10 columnas y en una tabla real no se puede escribir ni en desktop.
// Cada fila se renderiza como una tarjeta con grid responsivo, que además
// resuelve el requisito móvil de §9.5 sin un layout aparte.

import { useState, useRef, useEffect } from 'react'
import {
  Check, AlertTriangle, Circle, HelpCircle, Plus, Trash2, Copy,
  ChevronUp, ChevronDown, X, Clock,
} from 'lucide-react'
import clsx from 'clsx'
import { WEEKDAYS, FIELD_STATE, emptyRow, rowHasContent } from '@/lib/companyProfileSchema'

// ── Shell común ─────────────────────────────────────────────────────────────

const STATE_ICON = {
  [FIELD_STATE.GREEN]: <Check size={13} />,
  [FIELD_STATE.YELLOW]: <AlertTriangle size={13} />,
  [FIELD_STATE.RED]: <Circle size={9} fill="currentColor" />,
}

export function FieldShell({ field, state, meta, children, anchorId }) {
  const [showHelp, setShowHelp] = useState(false)
  return (
    <div className={clsx('cpb-field', `is-${state}`)} id={anchorId}>
      <div className="cpb-field-head">
        <label className="cpb-label">
          {field.label}
          {field.required && <span className="cpb-req" title="Campo requerido"> *</span>}
        </label>
        {STATE_ICON[state] && (
          <span
            className={clsx('cpb-state-icon', `is-${state}`)}
            title={
              state === FIELD_STATE.GREEN ? `Extraído de ${meta?.source || 'tus archivos'}`
                : state === FIELD_STATE.YELLOW ? `Encontramos esto en ${meta?.source || 'tus archivos'} pero no estamos seguros. Revisa.`
                  : 'Campo requerido pendiente'
            }
          >
            {STATE_ICON[state]}
          </span>
        )}
        {field.help && (
          <button type="button" className="cpb-help-btn" onClick={() => setShowHelp(v => !v)} aria-label="Ayuda">
            <HelpCircle size={13} />
          </button>
        )}
      </div>
      {showHelp && <div className="cpb-help">{field.help}</div>}
      {children}
      {state === FIELD_STATE.YELLOW && meta && (
        <div className="cpb-extract-note is-yellow">
          Encontramos esto en <strong>{meta.source}</strong> pero no estamos seguros. Revisa y confirma.
        </div>
      )}
      {state === FIELD_STATE.GREEN && meta && (
        <div className="cpb-extract-note">Extraído de <strong>{meta.source}</strong></div>
      )}
    </div>
  )
}

// ── Primitivos ──────────────────────────────────────────────────────────────

export function TextInput({ value, onChange, onBlur, field = {}, ...rest }) {
  return (
    <input
      className="cpb-input"
      type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : field.type === 'phone' ? 'tel' : 'text'}
      value={value ?? ''}
      placeholder={field.placeholder || ''}
      onChange={e => onChange(e.target.value)}
      onBlur={onBlur}
      {...rest}
    />
  )
}

export function NumberInput({ value, onChange, onBlur, field = {} }) {
  return (
    <input
      className="cpb-input"
      type="number"
      value={value === '' || value === undefined || value === null ? '' : value}
      placeholder={field.placeholder || ''}
      min={field.min}
      max={field.max}
      onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      onBlur={onBlur}
    />
  )
}

export function TextArea({ value, onChange, onBlur, field = {} }) {
  const len = (value || '').length
  const max = field.maxLength
  return (
    <div className="cpb-textarea-wrap">
      <textarea
        className="cpb-textarea"
        value={value ?? ''}
        placeholder={field.placeholder || ''}
        maxLength={max}
        rows={field.rows || 3}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
      />
      {max && <div className={clsx('cpb-counter', len > max * 0.9 && 'is-near')}>{len}/{max}</div>}
    </div>
  )
}

export function SelectInput({ value, onChange, onBlur, field = {}, options }) {
  const opts = options || field.options || []
  return (
    <select className="cpb-input cpb-select" value={value ?? ''} onChange={e => onChange(e.target.value)} onBlur={onBlur}>
      <option value="">— Selecciona —</option>
      {opts.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

// ── Categoría (select + subcategoría libre) ─────────────────────────────────

export function CategoryField({ value, onChange, onBlur, field }) {
  const v = value || { main: '', sub: '' }
  const [search, setSearch] = useState('')
  const opts = field.options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
  return (
    <div className="cpb-grid-2">
      <div>
        <input
          className="cpb-input cpb-input-sm"
          placeholder="Buscar categoría..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="cpb-input cpb-select"
          style={{ marginTop: 6 }}
          size={search ? Math.min(opts.length + 1, 6) : undefined}
          value={v.main}
          onChange={e => { onChange({ ...v, main: e.target.value }); setSearch('') }}
          onBlur={onBlur}
        >
          <option value="">— Selecciona —</option>
          {opts.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      <div>
        <div className="cpb-sublabel">Subcategoría</div>
        <input
          className="cpb-input"
          placeholder={field.subPlaceholder}
          value={v.sub || ''}
          onChange={e => onChange({ ...v, sub: e.target.value })}
          onBlur={onBlur}
        />
      </div>
    </div>
  )
}

// ── Grupo de sub-campos ─────────────────────────────────────────────────────

export function GroupField({ value, onChange, onBlur, field }) {
  const v = value || {}
  return (
    <div className="cpb-grid-2">
      {field.fields.map(sf => (
        <div key={sf.id}>
          <div className="cpb-sublabel">
            {sf.label}{sf.required && <span className="cpb-req"> *</span>}
          </div>
          <TextInput
            field={sf}
            value={v[sf.id]}
            onChange={x => onChange({ ...v, [sf.id]: x })}
            onBlur={onBlur}
          />
        </div>
      ))}
    </div>
  )
}

// ── Multi-select ────────────────────────────────────────────────────────────

export function MultiSelect({ value, onChange, field }) {
  const sel = Array.isArray(value) ? value : []
  const toggle = o => onChange(sel.includes(o) ? sel.filter(x => x !== o) : [...sel, o])
  const otherValue = sel.find(s => s.startsWith('otro: '))
  return (
    <div>
      <div className="cpb-chips">
        {field.options.map(o => (
          <button
            key={o}
            type="button"
            className={clsx('cpb-chip', sel.includes(o) && 'is-on')}
            onClick={() => toggle(o)}
          >
            {sel.includes(o) && <Check size={11} />}{o}
          </button>
        ))}
      </div>
      {field.allowOther && sel.includes('otro') && (
        <input
          className="cpb-input"
          style={{ marginTop: 8 }}
          placeholder="Especifica cuál"
          value={otherValue ? otherValue.slice(6) : ''}
          onChange={e => {
            const rest = sel.filter(s => !s.startsWith('otro: '))
            onChange(e.target.value ? [...rest, `otro: ${e.target.value}`] : rest)
          }}
        />
      )}
    </div>
  )
}

// ── Rango de edad ───────────────────────────────────────────────────────────

export function AgeRange({ value, onChange }) {
  // Arranca sin definir: si arrancara en un rango por defecto, el campo se
  // vería contestado sin que el cliente lo hubiera tocado.
  const isSet = typeof value?.min === 'number' && typeof value?.max === 'number'
  const v = isSet ? value : { min: 25, max: 55 }
  const set = (k, n) => {
    const next = { ...v, [k]: n }
    if (next.min > next.max) { if (k === 'min') next.max = next.min; else next.min = next.max }
    onChange(next)
  }
  const pctMin = (v.min / 100) * 100
  const pctMax = (v.max / 100) * 100
  return (
    <div className="cpb-agerange">
      <div className="cpb-age-display">
        {isSet
          ? <><strong>{v.min}</strong> a <strong>{v.max}</strong> años</>
          : <span className="cpb-age-unset">Sin definir — mueve los controles para fijar tu rango</span>}
      </div>
      <div className="cpb-age-track">
        <div className="cpb-age-fill" style={{ left: `${pctMin}%`, width: `${pctMax - pctMin}%` }} />
      </div>
      <div className="cpb-age-inputs">
        <label>
          <span>Mínima</span>
          <input type="range" min={0} max={100} value={v.min} onChange={e => set('min', Number(e.target.value))} />
        </label>
        <label>
          <span>Máxima</span>
          <input type="range" min={0} max={100} value={v.max} onChange={e => set('max', Number(e.target.value))} />
        </label>
      </div>
    </div>
  )
}

// ── Checklist con detalle por ítem ──────────────────────────────────────────

export function Checklist({ value, onChange, onBlur, field }) {
  const v = value || {}
  const checkedCount = Object.values(v).filter(x => x?.checked).length
  const toggle = o => {
    const cur = v[o]?.checked
    onChange({ ...v, [o]: { ...(v[o] || {}), checked: !cur } })
  }
  return (
    <div className="cpb-checklist">
      <div className={clsx('cpb-checklist-count', checkedCount < (field.minChecked || 0) && 'is-short')}>
        {checkedCount} de {field.minChecked} mínimos marcados
      </div>
      {field.options.map(o => {
        const on = v[o]?.checked
        return (
          <div key={o} className={clsx('cpb-check-item', on && 'is-on')}>
            <button type="button" className="cpb-check-row" onClick={() => toggle(o)}>
              <span className={clsx('cpb-checkbox', on && 'is-on')}>{on && <Check size={11} />}</span>
              <span>{o}</span>
            </button>
            {on && (
              <div className="cpb-check-detail">
                <div className="cpb-sublabel">{field.detailLabel}</div>
                <TextArea
                  field={{ maxLength: field.detailMaxLength, rows: 2, placeholder: 'Sé concreto — esto es lo que el agente va a usar como argumento' }}
                  value={v[o]?.detail}
                  onChange={x => onChange({ ...v, [o]: { ...v[o], detail: x } })}
                  onBlur={onBlur}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Matriz de horarios por sede ─────────────────────────────────────────────

export function ScheduleMatrix({ value, onChange, onBlur, locations }) {
  const v = value || {}
  const locs = (locations || []).filter(l => l?.name || l?.city)

  if (!locs.length) {
    return <div className="cpb-empty-note"><Clock size={13} /> Agrega al menos una sede arriba para definir sus horarios.</div>
  }

  const setDay = (locKey, dayId, patch) => {
    const loc = v[locKey] || {}
    onChange({ ...v, [locKey]: { ...loc, [dayId]: { ...(loc[dayId] || {}), ...patch } } })
  }

  const copyToAll = (locKey, dayId) => {
    const src = v[locKey]?.[dayId]
    if (!src) return
    const loc = { ...(v[locKey] || {}) }
    for (const d of WEEKDAYS) loc[d.id] = { ...src }
    onChange({ ...v, [locKey]: loc })
    onBlur?.()
  }

  return (
    <div className="cpb-schedule">
      {locs.map((loc, i) => {
        const key = loc.name || `sede-${i}`
        const lv = v[key] || {}
        return (
          <div key={key} className="cpb-sched-loc">
            <div className="cpb-sched-loc-name">{loc.name || `Sede ${i + 1}`}{loc.city ? ` · ${loc.city}` : ''}</div>
            {WEEKDAYS.map(d => {
              const dv = lv[d.id] || {}
              return (
                <div key={d.id} className={clsx('cpb-sched-day', dv.open && 'is-open')}>
                  <button
                    type="button"
                    className="cpb-sched-toggle"
                    onClick={() => { setDay(key, d.id, { open: !dv.open }); onBlur?.() }}
                  >
                    <span className={clsx('cpb-checkbox', dv.open && 'is-on')}>{dv.open && <Check size={10} />}</span>
                    <span className="cpb-sched-dayname">{d.label}</span>
                  </button>
                  {dv.open ? (
                    <div className="cpb-sched-times">
                      <label className="cpb-sched-24">
                        <input type="checkbox" checked={!!dv.is24h} onChange={e => { setDay(key, d.id, { is24h: e.target.checked }); onBlur?.() }} />
                        24h
                      </label>
                      {!dv.is24h && (
                        <>
                          <input className="cpb-input cpb-time" type="time" value={dv.from || ''} onChange={e => setDay(key, d.id, { from: e.target.value })} onBlur={onBlur} />
                          <span className="cpb-sched-sep">a</span>
                          <input className="cpb-input cpb-time" type="time" value={dv.to || ''} onChange={e => setDay(key, d.id, { to: e.target.value })} onBlur={onBlur} />
                        </>
                      )}
                      <button type="button" className="cpb-mini-btn" onClick={() => copyToAll(key, d.id)} title="Aplicar este horario a todos los días">
                        <Copy size={11} /> a todos
                      </button>
                    </div>
                  ) : (
                    <span className="cpb-sched-closed">Cerrado</span>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ── Tabla dinámica (filas como tarjetas) ────────────────────────────────────

function cellVisible(col, row) {
  if (col.showWhen) {
    const [k, val] = Object.entries(col.showWhen)[0]
    if (row[k] !== val) return false
  }
  if (col.hideWhen) {
    const [k, val] = Object.entries(col.hideWhen)[0]
    if (row[k] === val) return false
  }
  return true
}

export function DynamicTable({ value, onChange, onBlur, field, suggestions = [] }) {
  const rows = Array.isArray(value) ? value : []
  const [compact, setCompact] = useState(false)
  const [importing, setImporting] = useState(false)

  const setRow = (i, patch) => {
    const next = rows.map((r, j) => (j === i ? { ...r, ...patch } : r))
    onChange(next)
  }
  const setCell = (i, key, val, col) => {
    if (col?.type === 'exclusive-check' && val) {
      onChange(rows.map((r, j) => ({ ...r, [key]: j === i })))
      return
    }
    setRow(i, { [key]: val })
  }
  const addRow = () => { onChange([...rows, emptyRow(field)]); onBlur?.() }
  const dupRow = i => { const n = [...rows]; n.splice(i + 1, 0, { ...rows[i] }); onChange(n); onBlur?.() }
  const delRow = i => { onChange(rows.filter((_, j) => j !== i)); onBlur?.() }
  const moveRow = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= rows.length) return
    const n = [...rows]
    ;[n[i], n[j]] = [n[j], n[i]]
    onChange(n)
    onBlur?.()
  }

  const atMax = field.maxRows && rows.length >= field.maxRows
  const filled = rows.filter(r => rowHasContent(field, r)).length

  return (
    <div className="cpb-table">
      <div className="cpb-table-bar">
        <span className="cpb-table-count">
          {filled} {filled === 1 ? 'entrada' : 'entradas'}
          {field.minRows > 1 && filled < field.minRows && <span className="cpb-short"> · faltan {field.minRows - filled}</span>}
          {field.maxRows && <span className="cpb-dim"> · máximo {field.maxRows}</span>}
        </span>
        <div className="cpb-table-actions">
          {field.compactable && rows.length > 3 && (
            <button type="button" className="cpb-mini-btn" onClick={() => setCompact(c => !c)}>
              {compact ? 'Vista completa' : 'Vista compacta'}
            </button>
          )}
          {field.importable && (
            <button type="button" className="cpb-mini-btn" onClick={() => setImporting(v => !v)}>
              Importar desde archivo
            </button>
          )}
        </div>
      </div>

      {importing && (
        <PasteImport
          field={field}
          onImport={newRows => { onChange([...rows.filter(r => rowHasContent(field, r)), ...newRows]); setImporting(false); onBlur?.() }}
          onCancel={() => setImporting(false)}
        />
      )}

      {compact ? (
        <div className="cpb-compact-list">
          {rows.map((r, i) => (
            <div key={i} className="cpb-compact-row">
              <span className="cpb-compact-name">{r[field.compactColumns[0]] || <em>Sin nombre</em>}</span>
              <span className="cpb-compact-val">{r[field.compactColumns[1]] || '—'}</span>
            </div>
          ))}
        </div>
      ) : (
        rows.map((row, i) => (
          <div key={i} className="cpb-row-card">
            <div className="cpb-row-head">
              <span className="cpb-row-num">{i + 1}</span>
              <div className="cpb-row-tools">
                <button type="button" onClick={() => moveRow(i, -1)} disabled={i === 0} title="Subir"><ChevronUp size={13} /></button>
                <button type="button" onClick={() => moveRow(i, 1)} disabled={i === rows.length - 1} title="Bajar"><ChevronDown size={13} /></button>
                <button type="button" onClick={() => dupRow(i)} title="Duplicar"><Copy size={13} /></button>
                <button
                  type="button"
                  onClick={() => delRow(i)}
                  disabled={rows.length <= (field.minRows || 0)}
                  title={rows.length <= (field.minRows || 0) ? `Se requieren al menos ${field.minRows}` : 'Eliminar'}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            <div className="cpb-row-grid">
              {field.columns.filter(c => cellVisible(c, row)).map(col => (
                <div
                  key={col.key}
                  className={clsx('cpb-cell', (col.type === 'textarea' || col.wide) && 'is-wide')}
                >
                  <div className="cpb-sublabel">
                    {col.label}
                    {col.required && <span className="cpb-req"> *</span>}
                    {col.internal && <span className="cpb-internal-tag">interno</span>}
                  </div>
                  <Cell
                    col={col}
                    value={row[col.key]}
                    suggestions={col.type === 'suggest' ? suggestions : undefined}
                    onChange={v => setCell(i, col.key, v, col)}
                    onBlur={onBlur}
                  />
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {!atMax && (
        <button type="button" className="cpb-add-btn" onClick={addRow}>
          <Plus size={13} /> {field.addLabel || '+ Agregar'}
        </button>
      )}
    </div>
  )
}

function Cell({ col, value, onChange, onBlur, suggestions }) {
  if (col.type === 'textarea') return <TextArea field={col} value={value} onChange={onChange} onBlur={onBlur} />
  if (col.type === 'number') return <NumberInput field={col} value={value} onChange={onChange} onBlur={onBlur} />
  if (col.type === 'select') return <SelectInput field={col} value={value} onChange={onChange} onBlur={onBlur} />
  if (col.type === 'check' || col.type === 'exclusive-check') {
    return (
      <button type="button" className={clsx('cpb-checkbox-btn', value && 'is-on')} onClick={() => { onChange(!value); onBlur?.() }}>
        <span className={clsx('cpb-checkbox', value && 'is-on')}>{value && <Check size={11} />}</span>
        {value ? 'Sí' : 'No'}
      </button>
    )
  }
  if (col.type === 'suggest') {
    const listId = `sug-${col.key}`
    return (
      <>
        <input className="cpb-input" list={listId} value={value ?? ''} placeholder={col.placeholder || ''} onChange={e => onChange(e.target.value)} onBlur={onBlur} />
        <datalist id={listId}>{(suggestions || []).map(s => <option key={s} value={s} />)}</datalist>
      </>
    )
  }
  return <TextInput field={col} value={value} onChange={onChange} onBlur={onBlur} />
}

// ── Importar pegando desde Excel / CSV ──────────────────────────────────────

function PasteImport({ field, onImport, onCancel }) {
  const [text, setText] = useState('')
  const cols = field.columns.filter(c => c.type !== 'check' && c.type !== 'exclusive-check')
  const parse = () => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    const rows = lines.map(line => {
      const cells = line.includes('\t') ? line.split('\t') : line.split(',')
      const r = emptyRow(field)
      cols.forEach((c, i) => {
        const raw = (cells[i] || '').trim()
        if (!raw) return
        r[c.key] = c.type === 'number' ? (Number(raw.replace(/[^0-9.]/g, '')) || '') : raw
      })
      return r
    }).filter(r => rowHasContent(field, r))
    if (rows.length) onImport(rows)
  }
  return (
    <div className="cpb-import">
      <div className="cpb-import-head">
        <strong>Pega tu tabla</strong>
        <button type="button" onClick={onCancel}><X size={13} /></button>
      </div>
      <div className="cpb-import-hint">
        Copia las filas desde Excel o Google Sheets y pégalas aquí. Una fila por línea, en este orden:
        <div className="cpb-import-cols">{cols.map(c => c.label).join(' · ')}</div>
      </div>
      <textarea
        className="cpb-textarea"
        rows={5}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={'Consulta general\tConsultas\tRevisión completa de vista\tfijo\t900'}
      />
      <button type="button" className="cpb-btn-primary cpb-btn-sm" onClick={parse} disabled={!text.trim()}>
        Importar filas
      </button>
    </div>
  )
}

// ── Dispatcher ──────────────────────────────────────────────────────────────

export function FieldRenderer({ field, value, onChange, onBlur, ctx = {} }) {
  const common = { value, onChange, onBlur, field }
  switch (field.type) {
    case 'textarea': return <TextArea {...common} />
    case 'number': return <NumberInput {...common} />
    case 'select': return <SelectInput {...common} />
    case 'multiselect': return <MultiSelect {...common} />
    case 'category': return <CategoryField {...common} />
    case 'group': return <GroupField {...common} />
    case 'checklist': return <Checklist {...common} />
    case 'agerange': return <AgeRange {...common} />
    case 'schedule': return <ScheduleMatrix {...common} locations={ctx.locations} />
    case 'table': return <DynamicTable {...common} suggestions={ctx.suggestions?.[field.id]} />
    default: return <TextInput {...common} />
  }
}

// ── Auto-save: dispara onSave al blur y cada 3s mientras se escribe (§7.1) ──

export function useAutoSave(save, delay = 3000) {
  const timer = useRef(null)
  const saveRef = useRef(save)
  useEffect(() => { saveRef.current = save })
  useEffect(() => () => clearTimeout(timer.current), [])

  const schedule = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => saveRef.current(), delay)
  }
  const flush = () => {
    clearTimeout(timer.current)
    saveRef.current()
  }
  return { schedule, flush }
}
