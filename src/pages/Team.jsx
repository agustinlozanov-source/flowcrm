import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { Users, Plus, Trash2, Mail, Lock, User, Shield, Crown, X } from 'lucide-react'

function AddMemberModal({ orgId, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password.length < 6) return toast.error('La contraseña debe tener al menos 6 caracteres')
    setLoading(true)
    try {
      const res = await fetch('/.netlify/functions/manage-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', orgId, ...form }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`Usuario ${form.email} creado`)
      onCreated()
      onClose()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md border border-black/[0.08]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.08]">
          <h2 className="font-display font-bold text-[15px]">Agregar miembro del equipo</h2>
          <button onClick={onClose} className="text-tertiary hover:text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-secondary flex items-center gap-1.5">
              <User size={12} /> Nombre completo
            </label>
            <input
              required
              value={form.name}
              onChange={set('name')}
              placeholder="Ej. Carlos López"
              className="input"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-secondary flex items-center gap-1.5">
              <Mail size={12} /> Email
            </label>
            <input
              required
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="socio@empresa.com"
              className="input"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-secondary flex items-center gap-1.5">
              <Lock size={12} /> Contraseña temporal
            </label>
            <input
              required
              type="password"
              value={form.password}
              onChange={set('password')}
              placeholder="Mínimo 6 caracteres"
              className="input"
            />
            <p className="text-[11px] text-tertiary">El usuario puede cambiarla después desde su perfil.</p>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-[12px] text-blue-700">
            Este usuario tendrá acceso completo al CRM, agente IA e inbox de tu organización.
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={loading} className="btn btn-primary flex-1">
              {loading ? 'Creando...' : 'Crear usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Team() {
  const { org, user } = useAuthStore()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [deletingUid, setDeletingUid] = useState(null)

  const fetchMembers = async () => {
    if (!org?.id) return
    setLoading(true)
    try {
      const res = await fetch('/.netlify/functions/manage-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list', orgId: org.id }),
      })
      const data = await res.json()
      setMembers(data.members || [])
    } catch {
      toast.error('Error cargando equipo')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchMembers() }, [org?.id])

  const handleDelete = async (uid, email) => {
    if (!confirm(`¿Eliminar a ${email}? Esta acción no se puede deshacer.`)) return
    setDeletingUid(uid)
    try {
      const res = await fetch('/.netlify/functions/manage-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', orgId: org.id, uid }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Usuario eliminado')
      fetchMembers()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setDeletingUid(null)
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display font-bold text-xl text-primary">Equipo</h1>
            <p className="text-sm text-secondary mt-0.5">Gestiona los usuarios con acceso a {org?.name}</p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn btn-primary flex items-center gap-2">
            <Plus size={15} /> Agregar miembro
          </button>
        </div>

        {/* Members list */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-black/10 border-t-primary rounded-full animate-spin" />
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-12">
              <Users size={32} className="text-tertiary mx-auto mb-3" />
              <p className="text-sm text-secondary font-semibold">Sin miembros aún</p>
              <p className="text-xs text-tertiary mt-1">Agrega tu primer compañero de equipo</p>
            </div>
          ) : (
            <div>
              {members.map((member, i) => {
                const isOwner = org?.ownerId === member.uid
                const isMe = user?.uid === member.uid
                return (
                  <div key={member.uid} className={clsx(
                    'flex items-center gap-3 px-5 py-3.5',
                    i > 0 && 'border-t border-black/[0.06]'
                  )}>
                    <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <span className="text-[13px] font-bold text-white">
                        {member.name?.[0]?.toUpperCase() || member.email?.[0]?.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[13.5px] text-primary truncate">{member.name}</span>
                        {isOwner && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                            <Crown size={9} /> Owner
                          </span>
                        )}
                        {!isOwner && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-secondary bg-surface-2 px-2 py-0.5 rounded-full">
                            <Shield size={9} /> Miembro
                          </span>
                        )}
                        {isMe && (
                          <span className="text-[10px] text-tertiary">(tú)</span>
                        )}
                      </div>
                      <div className="text-[12px] text-tertiary truncate">{member.email}</div>
                    </div>
                    {!isOwner && !isMe && (
                      <button
                        onClick={() => handleDelete(member.uid, member.email)}
                        disabled={deletingUid === member.uid}
                        className="text-tertiary hover:text-red-500 transition-colors disabled:opacity-40 p-1.5 rounded-lg hover:bg-red-50"
                      >
                        {deletingUid === member.uid
                          ? <div className="w-4 h-4 border border-current/30 border-t-current rounded-full animate-spin" />
                          : <Trash2 size={15} />
                        }
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Info box */}
        <div className="mt-4 bg-surface-2 border border-black/[0.08] rounded-xl px-4 py-3 text-[12px] text-secondary">
          Los miembros del equipo tienen acceso completo al CRM, inbox, agente IA y configuraciones de la organización.
        </div>
      </div>

      {showModal && (
        <AddMemberModal
          orgId={org?.id}
          onClose={() => setShowModal(false)}
          onCreated={fetchMembers}
        />
      )}
    </div>
  )
}
