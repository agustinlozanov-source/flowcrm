/* La bolsa: códigos de descuento y cortesías.
 *
 * Dos listas que viven en la organización y se cargan de antemano, a propósito.
 *
 * Un descuento a mano siempre está disponible: el cerrador da su 10% y cierra.
 * Lo que no puede hacer a media venta es **acuñar un código**, porque un código
 * no es un descuento: es una táctica con nombre, reutilizable, que después se
 * mide. Si cualquiera puede crear uno, en tres semanas hay catorce y ninguno
 * significa nada. Por eso crear requiere permiso de dirección y aplicar no.
 *
 * Las cortesías son lo que se regala para cerrar —una herramienta, horas de
 * consultoría, un lugar en un taller—. Cada una lleva su **precio de lista**,
 * que es lo que la vuelve medible: sin precio, regalar algo no cuesta nada en
 * el papel y no se puede saber cuánto lleva consumido la bolsa.
 */
import { useEffect, useState } from 'react'
import {
  collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'

const ref = (orgId, nombre) => collection(db, 'organizations', orgId, nombre)

/** Lo que vale un descuento sobre un precio, venga como porcentaje o como monto. */
export function montoDescuento(precioLista, tipo, valor) {
  const base = Number(precioLista) || 0
  const v = Number(valor) || 0
  if (!v) return 0
  const monto = tipo === 'monto' ? v : base * (v / 100)
  // Nunca más que el precio: un descuento no puede dejar la venta en negativo.
  return Math.max(0, Math.min(monto, base))
}

export function useBolsa() {
  const { org } = useAuthStore()
  const orgId = org?.id

  const [codigos, setCodigos] = useState([])
  const [cortesias, setCortesias] = useState([])

  useEffect(() => {
    if (!orgId) return
    /* Solo los vigentes: un código apagado no se ofrece, pero las ventas que
       ya lo usaron lo conservan. */
    const qc = query(ref(orgId, 'discount_codes'), where('activo', '==', true))
    const uc = onSnapshot(qc,
      s => setCodigos(s.docs.map(d => ({ id: d.id, ...d.data() }))),
      e => console.error('[useBolsa] códigos:', e))
    return uc
  }, [orgId])

  useEffect(() => {
    if (!orgId) return
    const qt = query(ref(orgId, 'courtesies'), orderBy('name', 'asc'))
    const ut = onSnapshot(qt,
      s => setCortesias(s.docs.map(d => ({ id: d.id, ...d.data() }))),
      e => console.error('[useBolsa] cortesías:', e))
    return ut
  }, [orgId])

  /** Crear un código es una decisión de dirección, no del cerrador. */
  const crearCodigo = async ({ code, label, tipo = 'porcentaje', valor }) => {
    if (!orgId || !code) return null
    const d = await addDoc(ref(orgId, 'discount_codes'), {
      code: String(code).trim().toUpperCase(),
      label: label || String(code).trim(),
      tipo,
      valor: Number(valor) || 0,
      activo: true,
      createdAt: serverTimestamp(),
    })
    return d.id
  }

  const crearCortesia = async ({ name, listPrice }) => {
    if (!orgId || !name) return null
    const d = await addDoc(ref(orgId, 'courtesies'), {
      name: String(name).trim(),
      listPrice: Number(listPrice) || 0,
      createdAt: serverTimestamp(),
    })
    return d.id
  }

  return { codigos, cortesias, crearCodigo, crearCortesia }
}
