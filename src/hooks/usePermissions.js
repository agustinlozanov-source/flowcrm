import { useAuthStore } from '@/store/authStore'
import { useMemo } from 'react'

// ─── PERMISSION DEFINITIONS ───────────────────────────────────────
export const PERMISSIONS = {
  can_see_all_leads:      { label: 'Ver leads de todo el equipo',              group: 'Pipeline'   },
  can_reassign_leads:     { label: 'Reasignar leads a otros vendedores',        group: 'Pipeline'   },
  can_edit_pipeline:      { label: 'Editar etapas y configuración del pipeline', group: 'Pipeline'  },
  can_discard_any_lead:   { label: 'Descartar leads de otros vendedores',       group: 'Pipeline'   },
  can_manage_products:    { label: 'Crear y editar productos del catálogo',     group: 'Catálogo'   },
  can_see_team_reports:   { label: 'Ver reportes y métricas del equipo',        group: 'Reportes'   },
  can_invite_members:     { label: 'Generar links de invitación',               group: 'Equipo'     },
  can_configure_agent:    { label: 'Editar configuración del agente IA',        group: 'Agente'     },
  can_see_full_genealogy: { label: 'Ver árbol genealógico completo',            group: 'Equipo'     },
  can_manage_team:        { label: 'Crear y editar usuarios del equipo',        group: 'Equipo'     },
  can_see_team_agenda:    { label: 'Ver agenda de todo el equipo',              group: 'Agenda'     },
  can_edit_any_lead:      { label: 'Editar información de leads ajenos',        group: 'Pipeline'   },
}

// Default permissions by role
export const DEFAULT_PERMISSIONS = {
  admin: Object.fromEntries(Object.keys(PERMISSIONS).map(k => [k, true])),
  seller: Object.fromEntries(Object.keys(PERMISSIONS).map(k => [k, false])),
}

// Groups for UI rendering
export const PERMISSION_GROUPS = [...new Set(Object.values(PERMISSIONS).map(p => p.group))]

// ─── HOOK ─────────────────────────────────────────────────────────
export function usePermissions() {
  const { role, memberData } = useAuthStore()

  const permissions = useMemo(() => {
    const isAdmin = role === 'admin'

    // Admins always get everything regardless of stored permissions
    if (isAdmin) return DEFAULT_PERMISSIONS.admin

    // If the user has no member document yet, treat as admin
    if (memberData === null || memberData === undefined) return DEFAULT_PERMISSIONS.admin

    // Sellers get their stored custom permissions, falling back to defaults
    const stored = memberData?.permissions || {}
    return {
      ...DEFAULT_PERMISSIONS.seller,
      ...stored,
    }
  }, [role, memberData])

  const can = (permission) => {
    if (role === 'admin') return true
    return permissions[permission] === true
  }

  const isAdmin = role === 'admin'
  const isSeller = role === 'seller'

  return {
    permissions,
    can,
    isAdmin,
    isSeller,
    // Shortcuts for commonly checked permissions
    canSeeAllLeads:      can('can_see_all_leads'),
    canReassignLeads:    can('can_reassign_leads'),
    canEditPipeline:     can('can_edit_pipeline'),
    canManageProducts:   can('can_manage_products'),
    canSeeTeamReports:   can('can_see_team_reports'),
    canInviteMembers:    can('can_invite_members'),
    canConfigureAgent:   can('can_configure_agent'),
    canSeeFullGenealogy: can('can_see_full_genealogy'),
    canManageTeam:       can('can_manage_team'),
    canSeeTeamAgenda:    can('can_see_team_agenda'),
    canEditAnyLead:      can('can_edit_any_lead'),
    canDiscardAnyLead:   can('can_discard_any_lead'),
  }
}
