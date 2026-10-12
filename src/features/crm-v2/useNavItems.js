/* Filtra la navegación del diseño nuevo con las mismas tres reglas que usa la
 * sidebar actual, para que no muestre de más:
 *
 *   moduleId    — módulos que la organización contrató
 *   permission  — permisos del usuario
 *   featureFlag — interruptor global
 *
 * Sin esto la sidebar nueva le enseñaba a todos los clientes las catorce
 * pantallas, incluidas las que no pagaron.
 */
import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { usePermissions } from '@/hooks/usePermissions'
import { NAV_GROUPS } from './components/Sidebar'

// Las puertas de cada item, copiadas de AppLayout para que las dos sidebars
// decidan igual.
const GATES = {
  pipeline:       { moduleId: 'pipeline' },
  conversaciones: { moduleId: 'inbox' },
  reuniones:      { moduleId: 'meetings' },
  contactos:      { moduleId: 'leads' },
  catalogo:       { moduleId: 'products' },
  agente:         { moduleId: 'agent', permission: 'can_configure_agent' },
  equipo:         { moduleId: 'team' },
  importar:       { moduleId: 'import', featureFlag: 'import' },
  reportes:       { moduleId: 'analytics', permission: 'can_see_team_reports' },
  contenido:      { moduleId: 'content' },
  landing:        { moduleId: 'landing', featureFlag: 'landing' },
  referidos:      { moduleId: 'referrals', featureFlag: 'referrals' },
  metas:          { moduleId: 'goals' },
  ajustes:        {},
}

export function useNavItems() {
  const { org } = useAuthStore()
  const { can } = usePermissions()
  const [flags, setFlags] = useState({})

  useEffect(() => {
    const unsub = onSnapshot(doc(db, '_global_config', 'feature_flags'), snap => {
      if (snap.exists()) setFlags(snap.data())
    })
    return unsub
  }, [])

  const modules = org?.modules

  const visible = item => {
    const gate = GATES[item.id] || {}
    if (gate.featureFlag && flags[gate.featureFlag] === false) return false
    if (modules?.length > 0 && gate.moduleId && !modules.includes(gate.moduleId)) return false
    if (gate.permission && !can(gate.permission)) return false
    return true
  }

  return NAV_GROUPS
    .map(g => ({ ...g, items: g.items.filter(visible) }))
    .filter(g => g.items.length > 0)
}
