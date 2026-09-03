// Genera el resumen del perfil de empresa en dos formatos, ambos de uso interno:
//
//   buildProfileText()   → texto estructurado, para pegar como contexto del agente
//   openProfileReport()  → documento HTML en una pestaña nueva, para leer o imprimir a PDF
//
// Los dos incluyen las notas internas del catálogo. Este resumen no se le
// entrega al cliente: es el insumo con el que Flow Hub configura el CRM y
// entrena al agente.
//
// El recorrido de los campos sale de SECTIONS, así que agregar un campo al
// formulario lo hace aparecer aquí sin tocar este archivo.

import { SECTIONS, WEEKDAYS, rowHasContent } from '@/lib/companyProfileSchema'

const DIA = Object.fromEntries(WEEKDAYS.map(d => [d.id, d.label]))

const vacio = v => v === undefined || v === null || v === ''
  || (Array.isArray(v) && v.length === 0)
  || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0)

const fecha = ts => {
  const d = ts?.toDate?.() || (ts ? new Date(ts) : null)
  return d ? d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'
}

const precio = row => {
  if (row.priceType === 'consultar') return 'a consultar'
  const m = row.currency || 'MXN'
  if (row.priceType === 'rango') return `${row.price || '?'} a ${row.priceMax || '?'} ${m}`
  if (row.priceType === 'desde') return `desde ${row.price || '?'} ${m}`
  return `${row.price || '?'} ${m}`
}

const horarioDeSede = loc => WEEKDAYS
  .filter(d => loc?.[d.id]?.open)
  .map(d => {
    const x = loc[d.id]
    return `${DIA[d.id]} ${x.is24h ? '24 horas' : `${x.from || '?'} a ${x.to || '?'}`}`
  })

// ── Texto plano ─────────────────────────────────────────────────────────────

function campoATexto(field, v) {
  switch (field.type) {
    case 'table': {
      const filas = (Array.isArray(v) ? v : []).filter(r => rowHasContent(field, r))
      if (!filas.length) return null
      // El catálogo se desglosa por entrada; el resto cabe en una línea por fila.
      if (field.id === 'services') {
        return filas.map(r => {
          const partes = [
            `- ${r.name}`,
            r.category && `  Categoría: ${r.category}`,
            `  Precio: ${precio(r)}`,
            r.duration && `  Duración: ${r.duration}`,
            r.shortDescription && `  Descripción: ${r.shortDescription}`,
            r.prerequisites && `  Requisitos: ${r.prerequisites}`,
            r.internalNotes && `  Nota interna: ${r.internalNotes}`,
          ].filter(Boolean)
          return partes.join('\n')
        }).join('\n')
      }
      return filas.map(r => '- ' + field.columns
        .map(c => {
          const val = r[c.key]
          if (vacio(val)) return null
          if (c.type === 'check' || c.type === 'exclusive-check') return val ? c.label : null
          return `${c.label}: ${val}`
        })
        .filter(Boolean).join(' · ')).join('\n')
    }
    case 'group': {
      const partes = field.fields.map(sf => vacio(v?.[sf.id]) ? null : `${sf.label}: ${v[sf.id]}`).filter(Boolean)
      return partes.length ? partes.join('\n') : null
    }
    case 'category':
      return vacio(v?.main) ? null : [v.main, v.sub].filter(Boolean).join(' → ')
    case 'agerange':
      return typeof v?.min === 'number' ? `${v.min} a ${v.max} años` : null
    case 'multiselect':
      return v?.length ? v.join(', ') : null
    case 'checklist': {
      const marcados = Object.entries(v || {}).filter(([, x]) => x?.checked)
      if (!marcados.length) return null
      return marcados.map(([k, x]) => `- ${k}${x.detail ? `: ${x.detail}` : ''}`).join('\n')
    }
    case 'schedule': {
      const sedes = Object.entries(v || {}).filter(([, loc]) => horarioDeSede(loc).length)
      if (!sedes.length) return null
      return sedes.map(([nombre, loc]) => `- ${nombre}: ${horarioDeSede(loc).join(', ')}`).join('\n')
    }
    default:
      return vacio(v) ? null : String(v)
  }
}

export function buildProfileText(profile) {
  const data = profile.data || {}
  const materials = profile.materials || []
  const out = []

  out.push(`PERFIL DE EMPRESA — ${profile.companyName || 'Sin nombre'}`)
  out.push(`Contacto: ${[profile.clientName, profile.clientEmail].filter(Boolean).join(' · ')}`)
  out.push(profile.status === 'submitted'
    ? `Enviado el ${fecha(profile.submittedAt)}`
    : `BORRADOR — sin enviar (última edición: ${fecha(profile.updatedAt)})`)
  out.push('')
  out.push('Documento de uso interno. Incluye notas internas que no se comparten con el cliente final.')

  for (const s of SECTIONS) {
    if (s.isMaterials) continue
    const sec = data[s.key] || {}
    const bloques = s.fields
      .map(f => {
        const texto = campoATexto(f, sec[f.id])
        if (!texto) return null
        // Una lista de un solo elemento no lleva salto de línea, pero pegada a
        // la etiqueta queda como "Sedes: - Nombre de sede: ...", con el guion
        // suelto a media frase.
        const esBloque = texto.includes('\n') || texto.startsWith('-')
        return esBloque ? `${f.label}:\n${texto}` : `${f.label}: ${texto}`
      })
      .filter(Boolean)

    if (!bloques.length) continue
    out.push('')
    out.push(`## ${s.num}. ${s.title.toUpperCase()}`)
    out.push('')
    out.push(bloques.join('\n'))
  }

  if (materials.length) {
    out.push('')
    out.push('## 7. MATERIALES PARA CONVERSACIONES')
    out.push('')
    for (const m of materials) {
      out.push(`- ${m.originalName}`)
      if (m.materialType) out.push(`  Tipo: ${m.materialType}`)
      if (m.whenToServe?.length) out.push(`  Cuándo servirlo: ${m.whenToServe.join(' · ')}`)
      if (m.agentDescription) out.push(`  Descripción: ${m.agentDescription}`)
    }
  }

  return out.join('\n')
}

// ── HTML ────────────────────────────────────────────────────────────────────

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

const parrafos = t => esc(t).split('\n').map(l => {
  const sangria = l.startsWith('  ')
  return `<div class="${sangria ? 'sub' : ''}">${l.trim() || '&nbsp;'}</div>`
}).join('')

function campoAHtml(field, v) {
  // El catálogo se lee mucho mejor como tabla que como lista.
  if (field.id === 'services') {
    const filas = (Array.isArray(v) ? v : []).filter(r => rowHasContent(field, r))
    if (!filas.length) return null
    return `<table class="cat">
      <thead><tr><th>Servicio</th><th>Categoría</th><th>Precio</th><th>Duración</th><th>Notas</th></tr></thead>
      <tbody>${filas.map(r => `<tr>
        <td><strong>${esc(r.name)}</strong>${r.shortDescription ? `<div class="muted">${esc(r.shortDescription)}</div>` : ''}</td>
        <td>${esc(r.category)}</td>
        <td class="nowrap">${esc(precio(r))}</td>
        <td class="nowrap">${esc(r.duration)}</td>
        <td>${r.prerequisites ? `<div>${esc(r.prerequisites)}</div>` : ''}${r.internalNotes ? `<div class="interna">Interna: ${esc(r.internalNotes)}</div>` : ''}</td>
      </tr>`).join('')}</tbody></table>`
  }
  const texto = campoATexto(field, v)
  return texto ? parrafos(texto) : null
}

export function buildProfileReportHTML(profile) {
  const data = profile.data || {}
  const materials = profile.materials || []
  const origen = typeof window !== 'undefined' ? window.location.origin : ''

  const secciones = SECTIONS.filter(s => !s.isMaterials).map(s => {
    const sec = data[s.key] || {}
    const campos = s.fields.map(f => {
      const html = campoAHtml(f, sec[f.id])
      return html ? `<div class="campo"><div class="etiqueta">${esc(f.label)}</div><div class="valor">${html}</div></div>` : null
    }).filter(Boolean)
    if (!campos.length) return ''
    return `<section><h2><span class="num">${s.num}</span>${esc(s.title)}</h2>${campos.join('')}</section>`
  }).join('')

  const seccionMateriales = materials.length ? `<section><h2><span class="num">7</span>Materiales para conversaciones</h2>
    ${materials.map(m => `<div class="campo">
      <div class="etiqueta">${esc(m.originalName)}</div>
      <div class="valor">
        ${m.materialType ? `<div>Tipo: ${esc(m.materialType)}</div>` : '<div class="muted">Sin etiquetar</div>'}
        ${m.whenToServe?.length ? `<div>Cuándo servirlo: ${esc(m.whenToServe.join(' · '))}</div>` : ''}
        ${m.agentDescription ? `<div class="muted">${esc(m.agentDescription)}</div>` : ''}
      </div></div>`).join('')}
  </section>` : ''

  const estado = profile.status === 'submitted'
    ? `Enviado el ${fecha(profile.submittedAt)}`
    : `Borrador sin enviar · última edición ${fecha(profile.updatedAt)}`

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8" />
<title>Perfil de empresa — ${esc(profile.companyName)}</title>
<style>
  @page { margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Inter', -apple-system, system-ui, sans-serif;
    color: #16181d; background: #fff; margin: 0;
    padding: 32px 28px 60px; max-width: 900px; margin: 0 auto;
    font-size: 13.5px; line-height: 1.6;
  }
  header { border-bottom: 2px solid #16181d; padding-bottom: 16px; margin-bottom: 8px; }
  header img { height: 26px; margin-bottom: 14px; }
  h1 { font-size: 24px; margin: 0 0 4px; letter-spacing: -0.4px; }
  .meta { font-size: 12.5px; color: #62676f; }
  .aviso {
    margin: 18px 0 26px; padding: 9px 13px; border-radius: 7px;
    background: #fff6e5; border: 1px solid #f0d9a8; color: #7a5a12; font-size: 12px;
  }
  section { margin-bottom: 26px; page-break-inside: avoid; }
  h2 {
    font-size: 15px; margin: 0 0 12px; padding-bottom: 7px;
    border-bottom: 1px solid #e4e6ea; display: flex; align-items: center; gap: 9px;
  }
  .num {
    width: 20px; height: 20px; border-radius: 5px; background: #16181d; color: #fff;
    font-size: 11px; display: inline-flex; align-items: center; justify-content: center;
  }
  .campo { display: flex; gap: 16px; padding: 5px 0; page-break-inside: avoid; }
  .etiqueta { width: 190px; flex-shrink: 0; color: #62676f; font-size: 12.5px; }
  .valor { flex: 1; min-width: 0; }
  .valor .sub { padding-left: 14px; color: #4a4f57; }
  .muted { color: #62676f; font-size: 12.5px; }
  .interna { color: #7a5a12; font-size: 12px; margin-top: 3px; }
  .nowrap { white-space: nowrap; }
  table.cat { width: 100%; border-collapse: collapse; font-size: 12.5px; margin-top: 4px; }
  table.cat th {
    text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: .5px;
    color: #62676f; border-bottom: 1px solid #d8dbe0; padding: 5px 8px 5px 0; font-weight: 600;
  }
  table.cat td { padding: 7px 8px 7px 0; border-bottom: 1px solid #eef0f2; vertical-align: top; }
  footer { margin-top: 40px; padding-top: 14px; border-top: 1px solid #e4e6ea; font-size: 11.5px; color: #62676f; }
  @media print { body { padding: 0; } .noprint { display: none; } }
  .noprint {
    position: fixed; top: 14px; right: 14px; display: flex; gap: 8px;
  }
  .noprint button {
    padding: 8px 16px; border-radius: 8px; border: 1px solid #d8dbe0; background: #fff;
    font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
  }
  .noprint button.primario { background: #3533cd; color: #fff; border-color: #3533cd; }
</style></head>
<body>
  <div class="noprint">
    <button class="primario" onclick="window.print()">Guardar como PDF</button>
  </div>

  <header>
    <img src="${origen}/logo.png" alt="Flow Hub" />
    <h1>${esc(profile.companyName) || 'Perfil de empresa'}</h1>
    <div class="meta">
      ${esc([profile.clientName, profile.clientEmail].filter(Boolean).join(' · '))}<br />
      ${esc(estado)} · ${materials.length} ${materials.length === 1 ? 'archivo' : 'archivos'}
    </div>
  </header>

  <div class="aviso">
    Documento de uso interno. Incluye notas internas del catálogo que no se comparten con el cliente final.
  </div>

  ${secciones}
  ${seccionMateriales}

  <footer>Flow Hub Tecnología e Inteligencia Comercial S.A. de C.V. · Generado el ${fecha(new Date())}</footer>
</body></html>`
}

/** Abre el resumen en una pestaña nueva. Devuelve false si el navegador la bloqueó. */
export function openProfileReport(profile) {
  const win = window.open('', '_blank')
  if (!win) return false
  win.document.write(buildProfileReportHTML(profile))
  win.document.close()
  return true
}
