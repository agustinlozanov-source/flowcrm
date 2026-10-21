/* Marcas personales de la organización.
 *
 * Una organización aquí es una cuenta de "grow operator": adentro conviven
 * varias marcas personales, cada una con su dueño. Quien tiene
 * can_see_all_brands las ve todas; el resto ve nada más las suyas.
 *
 * El filtro vive en este hook y no en cada pantalla para que no se escape por
 * ningún lado. Ojo: esto es alcance de interfaz, no aislamiento real — el día
 * que entren clientes de verdad hay que respaldarlo en las reglas de
 * Firestore, igual que el resto de la aplicación.
 */
import { useState, useEffect, useMemo } from 'react'
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { usePermissions } from '@/hooks/usePermissions'

/** Una marca recién creada todavía no tiene Instagram detrás. */
export const SIN_CONECTAR = 'sin_conectar'
export const CONECTADA = 'conectada'
export const CON_PROBLEMA = 'con_problema'

/** El token largo de Instagram dura 60 días. Avisamos antes de que muera,
 *  porque el día que caduca la marca deja de actualizar sin decir nada. */
export const DIAS_DE_VIDA_DEL_TOKEN = 60
const AVISAR_CUANDO_FALTEN = 7

export function estadoDeConexion(marca) {
  if (!marca?.ig?.userId) return SIN_CONECTAR
  if (marca.ig.error) return CON_PROBLEMA
  if (diasParaCaducar(marca) !== null && diasParaCaducar(marca) <= 0) return CON_PROBLEMA
  return CONECTADA
}

export function diasParaCaducar(marca) {
  const desde = marca?.ig?.tokenRenovadoEn || marca?.ig?.conectadaEn
  if (!desde) return null
  const ms = desde.toMillis ? desde.toMillis() : new Date(desde).getTime()
  if (!ms) return null
  const vence = ms + DIAS_DE_VIDA_DEL_TOKEN * 86400000
  return Math.ceil((vence - Date.now()) / 86400000)
}

export function hayQueAvisarDelToken(marca) {
  const dias = diasParaCaducar(marca)
  return dias !== null && dias <= AVISAR_CUANDO_FALTEN
}

export function useBrands() {
  const { org, user } = useAuthStore()
  const { can } = usePermissions()
  const orgId = org?.id
  const userId = user?.uid
  const veTodas = can('can_see_all_brands')
  const puedeEditar = can('can_manage_brands')

  const [todas, setTodas] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!orgId) { setCargando(false); return }
    const unsub = onSnapshot(
      query(collection(db, 'organizations', orgId, 'brands'), orderBy('createdAt', 'asc')),
      snap => {
        setTodas(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setCargando(false)
      },
      err => {
        console.error('[useBrands] onSnapshot error:', err)
        setCargando(false)
      }
    )
    return unsub
  }, [orgId])

  // Lo que este usuario tiene derecho a ver. Un socio entra y ve su marca;
  // el grow operator las ve todas.
  const marcas = useMemo(() => {
    if (veTodas) return todas
    return todas.filter(m => m.ownerUserId === userId)
  }, [todas, veTodas, userId])

  const crear = async (datos) => {
    if (!orgId) return null
    const ref = await addDoc(collection(db, 'organizations', orgId, 'brands'), {
      nombre: datos.nombre?.trim() || '',
      handle: limpiarHandle(datos.handle),
      nicho: datos.nicho?.trim() || '',
      pipelineId: datos.pipelineId || null,
      ownerUserId: datos.ownerUserId || userId,
      activa: true,
      // El consumo del escáner se mide por marca: el grow operator necesita
      // poder repartir el cupo diario entre sus clientes.
      uso: { escaneos: 0, escaneosMes: 0 },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return ref.id
  }

  const actualizar = async (marcaId, cambios) => {
    if (!orgId) return
    await updateDoc(doc(db, 'organizations', orgId, 'brands', marcaId), {
      ...cambios,
      ...(cambios.handle !== undefined ? { handle: limpiarHandle(cambios.handle) } : {}),
      updatedAt: serverTimestamp(),
    })
  }

  const eliminar = async (marcaId) => {
    if (!orgId) return
    await deleteDoc(doc(db, 'organizations', orgId, 'brands', marcaId))
  }

  return {
    marcas,
    cargando,
    veTodas,
    puedeEditar,
    crear,
    actualizar,
    eliminar,
  }
}

/** Acepta "@pepe", "pepe" o la URL del perfil y se queda con el usuario. */
export function limpiarHandle(valor) {
  if (!valor) return ''
  return String(valor)
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/[/?].*$/, '')
    .replace(/^@/, '')
    .toLowerCase()
}
