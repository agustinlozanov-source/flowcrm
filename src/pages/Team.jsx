import { useState, useRef, useEffect, useCallback } from 'react'
import { useTeam } from '@/hooks/useTeam'
import { usePermissions, PERMISSIONS, PERMISSION_GROUPS, DEFAULT_PERMISSIONS } from '@/hooks/usePermissions'
import { useAuthStore } from '@/store/authStore'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import {
  Users, GitBranch, Plus, X, Pencil, Trash2, Search,
  Copy, Check, Link2, Shield, ChevronDown, ChevronRight,
  ToggleLeft, ToggleRight, ZoomIn, ZoomOut, Maximize2,
  AlertTriangle, Star, TrendingUp, Package, Clock,
  UserCheck, UserX, Mail, Send
} from 'lucide-react'

// ─── CONSTANTS ───────────────────────────────────────────────────
const ROLE_CONFIG = {
  admin:  { label: 'Admin',    color: '#7c3aed', bg: 'rgba(124,58,237,0.1)'  },
  seller: { label: 'Vendedor', color: '#0066ff', bg: 'rgba(0,102,255,0.1)'   },
}

const TYPE_CONFIG = {
  prospectador: { label: 'Prospectador' },
  cerrador:     { label: 'Cerrador'     },
  ambos:        { label: 'Prospectador + Cerrador' },
}

// ─── MEMBER MODAL ─────────────────────────────────────────────────
function MemberModal({ member, members, onClose, onSave }) {
  const isEdit = !!member
  const [form, setForm] = useState({
    name:          member?.name          || '',
    email:         member?.email         || '',
    role:          member?.role          || 'seller',
    type:          member?.type          || 'ambos',
    parentId:      member?.parentId      || '',
    inRoundRobin:  member?.inRoundRobin  ?? true,
    permissions:   member?.permissions   || DEFAULT_PERMISSIONS.seller,
  })
  const [activeSection, setActiveSection] = useState('info')
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleRoleChange = (role) => {
    setForm(f => ({
      ...f,
      role,
      permissions: DEFAULT_PERMISSIONS[role],
    }))
  }

  const togglePermission = (key) => {
    setForm(f => ({
      ...f,
      permissions: { ...f.permissions, [key]: !f.permissions[key] }
    }))
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error('El nombre es requerido'); return }
    if (!isEdit && !form.email.trim()) { toast.error('El email es requerido'); return }
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } catch { toast.error('Error al guardar') }
    finally { setSaving(false) }
  }

  const permsByGroup = PERMISSION_GROUPS.reduce((acc, group) => {
    acc[group] = Object.entries(PERMISSIONS).filter(([, v]) => v.group === group)
    return acc
  }, {})

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-[18px] shadow-[0_24px_80px_rgba(0,0,0,0.18)] w-full max-w-lg border border-black/[0.08] flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-black/[0.06] flex-shrink-0">
          <div>
            <h2 className="font-display font-bold text-lg tracking-tight">
              {isEdit ? 'Editar miembro' : 'Nuevo miembro'}
            </h2>
            <p className="text-xs text-secondary mt-0.5">
              {isEdit ? member.name : 'Agregar al equipo manualmente'}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-tertiary hover:bg-surface-2">
            <X size={15} />
          </button>
        </div>

        {/* Section tabs */}
        <div className="flex border-b border-black/[0.06] px-6 flex-shrink-0">
          {[
            { id: 'info',        label: 'Información' },
            { id: 'permissions', label: 'Permisos'    },
          ].map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              className={clsx('px-1 py-3 mr-5 text-[12.5px] font-semibold border-b-2 transition-all',
                activeSection === s.id ? 'border-primary text-primary' : 'border-transparent text-secondary hover:text-primary')}>
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">

          {/* INFO SECTION */}
          {activeSection === 'info' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">Nombre *</label>
                  <input value={form.name} onChange={e => set('name', e.target.value)}
                    placeholder="Carlos Ramírez" className="input" autoFocus />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">
                    Email {!isEdit && '*'}
                  </label>
                  <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                    placeholder="carlos@empresa.com" className="input" disabled={isEdit} />
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="text-[11px] font-semibold text-secondary uppercase tracking-wide block mb-2">Rol</label>
                <div className="flex gap-2">
                  {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
                    <button key={key} type="button" onClick={() => handleRoleChange(key)}
                      className={clsx('flex-1 py-2.5 rounded-[10px] border text-[13px] font-semibold transition-all',
                        form.role === key
                          ? 'border-primary bg-primary/[0.06] text-primary'
                          : 'border-black/[0.1] text-secondary hover:border-black/[0.2]')}>
                      {cfg.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-tertiary mt-1.5">
                  {form.role === 'admin'
                    ? 'Acceso total — ve todos los leads y puede configurar todo'
                    : 'Solo ve sus propios leads — permisos configurables individualmente'}
                </p>
              </div>

              {/* Type */}
              <div>
                <label className="text-[11px] font-semibold text-secondary uppercase tracking-wide block mb-2">Tipo de vendedor</label>
                <div className="flex flex-col gap-1.5">
                  {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                    <button key={key} type="button" onClick={() => set('type', key)}
                      className={clsx('flex items-center gap-2.5 px-3 py-2 rounded-[8px] border text-left transition-all',
                        form.type === key
                          ? 'border-primary/40 bg-primary/[0.04] text-primary'
                          : 'border-black/[0.08] text-secondary hover:border-black/[0.16]')}>
                      <div className={clsx('w-3 h-3 rounded-full border-2 flex-shrink-0',
                        form.type === key ? 'border-primary bg-primary' : 'border-black/20')} />
                      <span className="text-[12.5px] font-semibold">{cfg.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Parent */}
              <div>
                <label className="text-[11px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">
                  Reporta a (genealogía)
                </label>
                <select value={form.parentId} onChange={e => set('parentId', e.target.value)} className="input">
                  <option value="">Raíz — sin superior</option>
                  {members.filter(m => m.id !== member?.id).map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({ROLE_CONFIG[m.role]?.label})</option>
                  ))}
                </select>
              </div>

              {/* Round Robin */}
              <div className="flex items-center justify-between p-3 bg-surface-2 rounded-[10px]">
                <div>
                  <p className="text-[12.5px] font-semibold text-primary">Incluir en Round Robin</p>
                  <p className="text-[11px] text-secondary">Recibe leads nuevos automáticamente</p>
                </div>
                <button onClick={() => set('inRoundRobin', !form.inRoundRobin)}
                  className={clsx('w-11 h-6 rounded-full transition-all relative flex-shrink-0',
                    form.inRoundRobin ? 'bg-accent-blue' : 'bg-black/20')}>
                  <div className={clsx('absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all',
                    form.inRoundRobin ? 'left-5' : 'left-0.5')} />
                </button>
              </div>
            </>
          )}

          {/* PERMISSIONS SECTION */}
          {activeSection === 'permissions' && (
            <>
              {form.role === 'admin' ? (
                <div className="flex items-start gap-3 p-4 bg-purple-50 border border-purple-200 rounded-[12px]">
                  <Shield size={16} className="text-purple-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[12.5px] text-purple-800 font-semibold mb-0.5">Acceso total de administrador</p>
                    <p className="text-[11.5px] text-purple-700 leading-relaxed">
                      Los administradores tienen todos los permisos activos y no se pueden restringir individualmente.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-[10px]">
                    <Shield size={13} className="text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="text-[11.5px] text-blue-700 leading-relaxed">
                      Por defecto los vendedores solo ven sus propios leads. Activa permisos adicionales según su rol en el equipo.
                    </p>
                  </div>

                  {PERMISSION_GROUPS.map(group => (
                    <div key={group}>
                      <p className="text-[10px] font-bold text-tertiary uppercase tracking-widest mb-2">{group}</p>
                      <div className="flex flex-col gap-1.5">
                        {Object.entries(PERMISSIONS)
                          .filter(([, v]) => v.group === group)
                          .map(([key, def]) => (
                            <div key={key}
                              className="flex items-center justify-between px-3 py-2.5 rounded-[8px] border border-black/[0.06] bg-surface">
                              <span className="text-[12.5px] text-primary">{def.label}</span>
                              <button onClick={() => togglePermission(key)}
                                className={clsx('w-10 h-5 rounded-full transition-all relative flex-shrink-0 ml-4',
                                  form.permissions[key] ? 'bg-accent-blue' : 'bg-black/20')}>
                                <div className={clsx('absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all',
                                  form.permissions[key] ? 'left-5' : 'left-0.5')} />
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 py-4 border-t border-black/[0.06] flex-shrink-0">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving}
            className="btn-primary flex-1 flex items-center justify-center gap-2">
            {saving
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : isEdit ? 'Guardar cambios' : 'Crear miembro'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── INVITE MODAL ─────────────────────────────────────────────────
function InviteModal({ onClose, onCreate, members }) {
  const [parentId, setParentId] = useState('')
  const [invite, setInvite] = useState(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const result = await onCreate(parentId)
      setInvite(result)
    } catch { toast.error('Error al generar invitación') }
    finally { setLoading(false) }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(invite.link)
    setCopied(true)
    toast.success('Link copiado')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-[18px] shadow-[0_24px_80px_rgba(0,0,0,0.18)] w-full max-w-md border border-black/[0.08] p-6">

        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-display font-bold text-[15px]">Generar invitación</h2>
            <p className="text-xs text-secondary mt-0.5">El link expira en 7 días</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-tertiary hover:bg-surface-2">
            <X size={15} />
          </button>
        </div>

        {!invite ? (
          <>
            <div className="mb-4">
              <label className="text-[11px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">
                El nuevo miembro reportará a
              </label>
              <select value={parentId} onChange={e => setParentId(e.target.value)} className="input">
                <option value="">Raíz — sin superior</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({ROLE_CONFIG[m.role]?.label})</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleGenerate} disabled={loading}
                className="btn-primary flex-1 flex items-center justify-center gap-2">
                {loading
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><Link2 size={14} /> Generar link</>}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-[10px] mb-4">
              <Check size={14} className="text-green-600 flex-shrink-0" />
              <p className="text-[12.5px] text-green-700 font-semibold">Link generado exitosamente</p>
            </div>

            <div className="mb-3">
              <label className="text-[10px] font-bold text-secondary uppercase tracking-wide block mb-1.5">Código</label>
              <div className="font-mono font-bold text-2xl text-primary tracking-widest text-center py-3 bg-surface-2 rounded-[10px]">
                {invite.code}
              </div>
            </div>

            <div className="mb-4">
              <label className="text-[10px] font-bold text-secondary uppercase tracking-wide block mb-1.5">Link de invitación</label>
              <div className="flex items-center gap-2 p-3 bg-surface-2 rounded-[10px] border border-black/[0.08]">
                <span className="text-[11px] text-secondary font-mono flex-1 truncate">{invite.link}</span>
                <button onClick={handleCopy}
                  className={clsx('flex items-center gap-1 px-2.5 py-1.5 rounded-[7px] text-[11px] font-bold transition-all flex-shrink-0',
                    copied ? 'bg-green-500 text-white' : 'bg-primary text-white hover:bg-primary/90')}>
                  {copied ? <><Check size={11} /> Copiado</> : <><Copy size={11} /> Copiar</>}
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <a href={`https://wa.me/?text=Te invito a unirte a mi equipo en Flow CRM. Regístrate aquí: ${invite.link}`}
                target="_blank" rel="noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[10px] border border-green-300 text-green-600 text-[12.5px] font-semibold hover:bg-green-50 transition-colors">
                WhatsApp
              </a>
              <a href={`mailto:?subject=Invitación a Flow CRM&body=Te invito a unirte a mi equipo. Regístrate aquí: ${invite.link}`}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[10px] border border-black/[0.1] text-secondary text-[12.5px] font-semibold hover:border-black/[0.2] transition-colors">
                <Mail size={13} /> Email
              </a>
              <button onClick={onClose} className="btn-secondary flex-1 text-[12.5px]">Cerrar</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── MEMBER CARD (for table) ──────────────────────────────────────
function MemberRow({ member, currentUserId, onEdit, onToggle, onDelete, onInvite }) {
  const role = ROLE_CONFIG[member.role] || ROLE_CONFIG.seller
  const isCurrentUser = member.id === currentUserId
  const joinedDate = member.createdAt?.toDate
    ? format(member.createdAt.toDate(), "d MMM yyyy", { locale: es })
    : '—'

  return (
    <tr className="border-b border-black/[0.04] hover:bg-surface-2 transition-colors">
      {/* Avatar + name */}
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
            style={{ background: role.color }}>
            {member.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-[13px] text-primary">{member.name}</span>
              {isCurrentUser && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-surface-2 text-tertiary">Tú</span>
              )}
            </div>
            <div className="text-[11px] text-tertiary">{member.email}</div>
          </div>
        </div>
      </td>

      {/* Role */}
      <td className="px-5 py-3.5">
        <span className="text-[11px] font-bold px-2 py-1 rounded-full"
          style={{ background: role.bg, color: role.color }}>
          {role.label}
        </span>
      </td>

      {/* Type */}
      <td className="px-5 py-3.5 text-[12px] text-secondary">
        {TYPE_CONFIG[member.type]?.label || '—'}
      </td>

      {/* Stats */}
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3 text-[11.5px]">
          <span className="text-secondary flex items-center gap-1">
            <Users size={11} className="text-tertiary" />
            {member.stats?.activeLeads || 0} activos
          </span>
          <span className="text-green-600 flex items-center gap-1">
            <Check size={11} />
            {member.stats?.closedThisMonth || 0} cierres
          </span>
        </div>
      </td>

      {/* Status */}
      <td className="px-5 py-3.5">
        <span className={clsx('text-[11px] font-bold px-2 py-1 rounded-full',
          member.active ? 'bg-green-50 text-green-600' : 'bg-surface-2 text-tertiary')}>
          {member.active ? 'Activo' : 'Inactivo'}
        </span>
      </td>

      {/* Joined */}
      <td className="px-5 py-3.5 text-[12px] text-tertiary">{joinedDate}</td>

      {/* Actions */}
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-1">
          <button onClick={() => onEdit(member)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-tertiary hover:bg-surface-2 hover:text-primary transition-colors"
            title="Editar">
            <Pencil size={12} />
          </button>
          <button onClick={() => onInvite(member)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-tertiary hover:bg-surface-2 hover:text-blue-500 transition-colors"
            title="Generar invitación">
            <Link2 size={12} />
          </button>
          {!isCurrentUser && (
            <>
              <button onClick={() => onToggle(member)}
                className={clsx('w-7 h-7 rounded-lg flex items-center justify-center transition-colors',
                  member.active
                    ? 'text-tertiary hover:bg-amber-50 hover:text-amber-500'
                    : 'text-tertiary hover:bg-green-50 hover:text-green-500')}
                title={member.active ? 'Desactivar' : 'Activar'}>
                {member.active ? <UserX size={12} /> : <UserCheck size={12} />}
              </button>
              <button onClick={() => onDelete(member)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-tertiary hover:bg-red-50 hover:text-red-500 transition-colors"
                title="Eliminar">
                <Trash2 size={12} />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

// ─── ORG CHART NODE ───────────────────────────────────────────────
function OrgNode({ node, depth = 0, onNodeClick }) {
  const [expanded, setExpanded] = useState(true)
  const role = ROLE_CONFIG[node.role] || ROLE_CONFIG.seller
  const hasChildren = node.children?.length > 0
  const initials = node.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="flex flex-col items-center">
      {/* Node card */}
      <div
        onClick={() => onNodeClick(node)}
        className="relative cursor-pointer group"
        style={{ width: 200 }}
      >
        <div className={clsx(
          'rounded-[14px] border-2 p-4 transition-all hover:shadow-card-md bg-surface',
          'border-black/[0.08] hover:border-primary/30'
        )}>
          {/* Color top bar */}
          <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[12px]"
            style={{ background: role.color }} />

          {/* Avatar */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0"
              style={{ background: role.color }}>
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display font-bold text-[12.5px] text-primary truncate">{node.name}</div>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: role.bg, color: role.color }}>
                {role.label}
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-2 text-[10.5px]">
            <span className="text-secondary flex items-center gap-0.5">
              <Users size={9} /> {node.stats?.activeLeads || 0}
            </span>
            <span className="text-green-600 flex items-center gap-0.5">
              <TrendingUp size={9} /> {node.stats?.closedThisMonth || 0}
            </span>
            {!node.active && (
              <span className="text-tertiary text-[9px] font-bold">Inactivo</span>
            )}
          </div>

          {/* Expand/collapse if has children */}
          {hasChildren && (
            <button
              onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
              className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-surface border-2 border-black/[0.12] flex items-center justify-center text-tertiary hover:text-primary transition-colors z-10">
              {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            </button>
          )}
        </div>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div className="flex flex-col items-center mt-6">
          {/* Connector line down */}
          <div className="w-px h-6 bg-black/[0.12]" />

          {/* Horizontal connector if multiple children */}
          {node.children.length > 1 && (
            <div className="relative flex items-start justify-center"
              style={{ width: node.children.length * 220 }}>
              <div className="absolute top-0 left-[10%] right-[10%] h-px bg-black/[0.12]" />
              <div className="flex gap-5">
                {node.children.map(child => (
                  <div key={child.id} className="flex flex-col items-center">
                    <div className="w-px h-6 bg-black/[0.12]" />
                    <OrgNode node={child} depth={depth + 1} onNodeClick={onNodeClick} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Single child */}
          {node.children.length === 1 && (
            <OrgNode node={node.children[0]} depth={depth + 1} onNodeClick={onNodeClick} />
          )}
        </div>
      )}
    </div>
  )
}

// ─── ORG CHART ────────────────────────────────────────────────────
function OrgChart({ tree, onNodeClick }) {
  const containerRef = useRef(null)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  const handleMouseDown = (e) => {
    if (e.target.closest('[data-node]')) return
    setIsDragging(true)
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
  }

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
  }, [isDragging, dragStart])

  const handleMouseUp = () => setIsDragging(false)

  const zoomIn = () => setScale(s => Math.min(s + 0.1, 2))
  const zoomOut = () => setScale(s => Math.max(s - 0.1, 0.3))
  const fitView = () => { setScale(0.8); setPosition({ x: 0, y: 20 }) }

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove])

  if (tree.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <GitBranch size={32} className="text-tertiary mx-auto mb-3" strokeWidth={1.5} />
          <p className="font-display font-bold text-base text-primary">Sin genealogía</p>
          <p className="text-sm text-secondary mt-1">Agrega miembros para ver el árbol</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-[radial-gradient(circle,_rgba(0,0,0,0.04)_1px,_transparent_1px)] bg-[size:24px_24px] cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}>

      {/* Tree content */}
      <div style={{
        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
        transformOrigin: 'top center',
        position: 'absolute',
        top: 40,
        left: '50%',
        translateX: '-50%',
        transition: isDragging ? 'none' : 'transform 0.1s ease',
      }}>
        <div className="flex gap-8 justify-center">
          {tree.map(root => (
            <OrgNode key={root.id} node={root} depth={0} onNodeClick={onNodeClick} />
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-1.5 z-10">
        <button onClick={zoomIn}
          className="w-8 h-8 rounded-lg bg-surface border border-black/[0.1] flex items-center justify-center text-secondary hover:text-primary hover:border-black/[0.2] transition-all shadow-sm">
          <ZoomIn size={14} />
        </button>
        <button onClick={zoomOut}
          className="w-8 h-8 rounded-lg bg-surface border border-black/[0.1] flex items-center justify-center text-secondary hover:text-primary hover:border-black/[0.2] transition-all shadow-sm">
          <ZoomOut size={14} />
        </button>
        <button onClick={fitView}
          className="w-8 h-8 rounded-lg bg-surface border border-black/[0.1] flex items-center justify-center text-secondary hover:text-primary hover:border-black/[0.2] transition-all shadow-sm">
          <Maximize2 size={14} />
        </button>
      </div>

      {/* Scale indicator */}
      <div className="absolute bottom-4 right-4 text-[10px] font-bold text-tertiary bg-surface border border-black/[0.08] px-2 py-1 rounded-lg">
        {Math.round(scale * 100)}%
      </div>
    </div>
  )
}

// ─── NODE DETAIL PANEL ────────────────────────────────────────────
function NodeDetailPanel({ node, onClose, onEdit }) {
  const role = ROLE_CONFIG[node.role] || ROLE_CONFIG.seller

  return (
    <div className="absolute right-4 top-4 w-72 bg-surface rounded-[16px] border border-black/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.12)] z-20 overflow-hidden">
      <div className="h-1" style={{ background: role.color }} />
      <div className="p-4">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0"
            style={{ background: role.color }}>
            {node.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-[14px] text-primary">{node.name}</div>
            <div className="text-[11px] text-secondary">{node.email}</div>
          </div>
          <button onClick={onClose} className="text-tertiary hover:text-primary flex-shrink-0">
            <X size={14} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: 'Leads activos', value: node.stats?.activeLeads || 0, color: 'text-primary' },
            { label: 'Cierres mes', value: node.stats?.closedThisMonth || 0, color: 'text-green-600' },
            { label: 'Total cierres', value: node.stats?.closedTotal || 0, color: 'text-blue-600' },
          ].map(s => (
            <div key={s.label} className="text-center p-2 bg-surface-2 rounded-[8px]">
              <div className={clsx('font-display font-bold text-lg', s.color)}>{s.value}</div>
              <div className="text-[9px] text-tertiary">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1.5 text-[11.5px] mb-4">
          <div className="flex items-center justify-between">
            <span className="text-tertiary">Rol</span>
            <span className="font-semibold px-2 py-0.5 rounded-full text-[10px]"
              style={{ background: role.bg, color: role.color }}>{role.label}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-tertiary">Tipo</span>
            <span className="text-primary font-semibold">{TYPE_CONFIG[node.type]?.label || '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-tertiary">Nivel</span>
            <span className="text-primary font-semibold">Nivel {node.level || 0}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-tertiary">Estado</span>
            <span className={clsx('font-semibold', node.active ? 'text-green-600' : 'text-tertiary')}>
              {node.active ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          {node.children?.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-tertiary">Equipo directo</span>
              <span className="text-primary font-semibold">{node.children.length} personas</span>
            </div>
          )}
        </div>

        <button onClick={() => onEdit(node)}
          className="w-full btn-secondary text-[12.5px] py-2 flex items-center justify-center gap-1.5">
          <Pencil size={13} /> Editar miembro
        </button>
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────
export default function Team() {
  const { user } = useAuthStore()
  const { can, isAdmin, canManageTeam, canSeeFullGenealogy, canInviteMembers } = usePermissions()
  const {
    members, invites, loading, teamStats,
    fullTree, myTree,
    createMember, updateMember, updateMemberPermissions,
    toggleMemberActive, deleteMember,
    createInvite, revokeInvite,
  } = useTeam()

  const [activeTab, setActiveTab] = useState('members')
  const [search, setSearch] = useState('')
  const [showMemberModal, setShowMemberModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [editMember, setEditMember] = useState(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [inviteForMember, setInviteForMember] = useState(null)

  const tree = canSeeFullGenealogy ? fullTree : myTree

  const filteredMembers = members.filter(m => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q)
  })

  const handleSaveMember = async (form) => {
    if (editMember) {
      await updateMember(editMember.id, {
        name: form.name,
        role: form.role,
        type: form.type,
        parentId: form.parentId || null,
        inRoundRobin: form.inRoundRobin,
      })
      await updateMemberPermissions(editMember.id, form.permissions)
      toast.success('Miembro actualizado')
    } else {
      await createMember(form)
      toast.success('Miembro creado')
    }
  }

  const handleToggle = async (member) => {
    await toggleMemberActive(member.id, !member.active)
    toast.success(member.active ? 'Miembro desactivado' : 'Miembro activado')
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    await deleteMember(confirmDelete.id)
    toast.success('Miembro eliminado')
    setConfirmDelete(null)
  }

  const handleCreateInvite = async (parentId) => {
    const result = await createInvite(parentId)
    return result
  }

  const openEdit = (member) => {
    setEditMember(member)
    setShowMemberModal(true)
  }

  const openInviteForMember = (member) => {
    setInviteForMember(member)
    setShowInviteModal(true)
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-black/10 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* TOPBAR */}
      <div className="bg-surface border-b border-black/[0.08] px-5 h-[68px] flex items-center gap-3 flex-shrink-0">
        <h1 className="font-display font-bold text-[15px] tracking-tight">Equipo</h1>

        {/* Stats */}
        <div className="flex items-center gap-2 ml-1">
          <span className="text-[11px] font-semibold bg-surface-2 border border-black/[0.08] px-2.5 py-1 rounded-full text-secondary">
            {teamStats.active} activos
          </span>
          {teamStats.totalClosedThisMonth > 0 && (
            <span className="text-[11px] font-semibold bg-green-50 text-green-600 px-2.5 py-1 rounded-full">
              {teamStats.totalClosedThisMonth} cierres este mes
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {activeTab === 'members' && (
            <div className="flex items-center gap-2 bg-surface-2 border border-black/[0.08] rounded-[8px] px-3 py-1.5 w-44">
              <Search size={13} className="text-tertiary flex-shrink-0" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar miembro..."
                className="bg-transparent text-[12.5px] text-primary placeholder-tertiary flex-1 outline-none" />
            </div>
          )}
          {(canInviteMembers || members.length === 0) && (
            <button onClick={() => { setInviteForMember(null); setShowInviteModal(true) }}
              className="btn-secondary text-[12.5px] py-1.5 px-3 flex items-center gap-1.5">
              <Link2 size={13} /> Invitar
            </button>
          )}
          {(canManageTeam || members.length === 0) && (
            <button onClick={() => { setEditMember(null); setShowMemberModal(true) }}
              className="btn-primary text-[12.5px] py-1.5 px-3.5 flex items-center gap-1.5">
              <Plus size={14} strokeWidth={3} color="white" /> Nuevo miembro
            </button>
          )}
        </div>
      </div>

      {/* TABS */}
      <div className="flex border-b border-black/[0.08] px-5 bg-surface flex-shrink-0">
        {[
          { id: 'members',   icon: Users,      label: 'Miembros'   },
          { id: 'genealogy', icon: GitBranch,  label: 'Genealogía' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={clsx('flex items-center gap-2 px-1 py-3.5 mr-6 text-[13px] font-semibold border-b-2 transition-all',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-secondary hover:text-primary')}>
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-hidden">

        {/* MEMBERS TAB */}
        {activeTab === 'members' && (
          <div className="h-full overflow-auto">
            {filteredMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <Users size={32} className="text-tertiary" strokeWidth={1.5} />
                <p className="font-display font-bold text-lg text-primary">Sin miembros</p>
                <p className="text-sm text-secondary">Crea el primer miembro de tu equipo</p>
                {(canManageTeam || members.length === 0) && (
                  <button onClick={() => setShowMemberModal(true)} className="btn-primary text-sm py-2 px-4 mt-1">
                    Nuevo miembro
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full">
                <thead className="sticky top-0 bg-surface border-b border-black/[0.08] z-10">
                  <tr>
                    {['Miembro', 'Rol', 'Tipo', 'Actividad', 'Estado', 'Se unió', 'Acciones'].map(h => (
                      <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-wide text-tertiary px-5 py-3 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map(member => (
                    <MemberRow
                      key={member.id}
                      member={member}
                      currentUserId={user?.uid}
                      onEdit={openEdit}
                      onToggle={handleToggle}
                      onDelete={setConfirmDelete}
                      onInvite={openInviteForMember}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* GENEALOGY TAB */}
        {activeTab === 'genealogy' && (
          <div className="h-full relative">
            <OrgChart
              tree={tree}
              onNodeClick={(node) => setSelectedNode(prev => prev?.id === node.id ? null : node)}
            />
            {selectedNode && (
              <NodeDetailPanel
                node={selectedNode}
                onClose={() => setSelectedNode(null)}
                onEdit={(node) => { setSelectedNode(null); openEdit(node) }}
              />
            )}
            {!canSeeFullGenealogy && (
              <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 bg-surface border border-black/[0.08] rounded-[10px] text-[11.5px] text-secondary shadow-sm">
                <Shield size={12} className="text-tertiary" />
                Mostrando solo tu rama del equipo
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODALS */}
      {showMemberModal && (
        <MemberModal
          member={editMember}
          members={members}
          onClose={() => { setShowMemberModal(false); setEditMember(null) }}
          onSave={handleSaveMember}
        />
      )}

      {showInviteModal && (
        <InviteModal
          members={members}
          onClose={() => { setShowInviteModal(false); setInviteForMember(null) }}
          onCreate={handleCreateInvite}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-surface rounded-[18px] w-full max-w-sm border border-black/[0.08] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} className="text-red-500" />
              <h3 className="font-display font-bold text-[15px]">¿Eliminar miembro?</h3>
            </div>
            <p className="text-[13px] text-secondary mb-5">
              <strong className="text-primary">{confirmDelete.name}</strong> será eliminado del equipo. Sus leads permanecen en el sistema.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleDelete}
                className="flex-1 py-2 px-4 rounded-[10px] bg-red-500 hover:bg-red-600 text-white text-[13px] font-semibold transition-colors">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
