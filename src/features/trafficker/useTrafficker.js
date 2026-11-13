/* Los datos de Trafficker.
 *
 * Todo cuelga de `organizations/{orgId}/trafficker_posts`, que hereda el
 * candado de las reglas de Firestore sobre el claim `orgId` del token. Los
 * posts de un cliente no los alcanza otro sin escribir una regla nueva.
 *
 * Escribir se hace desde la función de Netlify y no desde acá: publicar
 * involucra la llave de Zernio, que no puede vivir en el navegador.
 */
import { useEffect, useState, useCallback } from 'react'
import { collection, doc, onSnapshot, orderBy, query, limit } from 'firebase/firestore'
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { db, storage, auth } from '@/lib/firebase'

const TOPE = 200

/** Los posts de la organización, en vivo. */
export function usePosts(orgId) {
  const [posts, setPosts] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!orgId) { setCargando(false); return }
    const q = query(
      collection(db, 'organizations', orgId, 'trafficker_posts'),
      orderBy('creadoEn', 'desc'),
      limit(TOPE),
    )
    return onSnapshot(
      q,
      snap => {
        setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setCargando(false)
        setError(null)
      },
      err => { setError(err.message); setCargando(false) },
    )
  }, [orgId])

  return { posts, cargando, error }
}

/* Los canales que la organización ya tiene conectados.
 *
 * De acá sale el número de WhatsApp al que va a mandar la liga. Se lee en vez
 * de pedirlo: la organización lo conectó en Ajustes y el webhook lo guardó
 * ahí mismo, así que teclearlo otra vez es pedir un dato que el sistema ya
 * tiene — y una cifra de más o de menos manda a la gente a un número que no
 * existe, sin que nada falle. */
export function useCanales(orgId) {
  const [canales, setCanales] = useState({})

  useEffect(() => {
    if (!orgId) return
    return onSnapshot(
      doc(db, 'organizations', orgId, 'settings', 'integrations'),
      snap => setCanales(snap.exists() ? snap.data() : {}),
      () => setCanales({}),
    )
  }, [orgId])

  return {
    canales,
    numeroWhatsapp: canales.whatsapp?.connected ? (canales.whatsapp.assignedNumber || '') : '',
  }
}

/* Llama a la función, con el token de sesión en la cabecera.
 *
 * En la cabecera y no en la URL: una URL queda escrita en el historial del
 * navegador y en los registros de cualquier intermediario. */
export async function llamar(cuerpo) {
  const u = auth.currentUser
  if (!u) throw new Error('No hay sesión iniciada')
  const token = await u.getIdToken()
  const res = await fetch('/.netlify/functions/trafficker', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(cuerpo),
  })
  const datos = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(datos.error || `Falló con HTTP ${res.status}`)
  return datos
}

/* El archivo va a Storage y de ahí lo descarga la red social.
 *
 * Sube el navegador directo, sin pasar por una función: el tope de payload de
 * Netlify son 6 MB y un video de un reel se lo come sin despeinarse.
 *
 * Se guarda en Storage y no en el almacén de Zernio porque ese borra a los
 * siete días, y entonces el módulo mostraría posts sin imagen al rato de
 * haberlos publicado. */
export function useSubida(orgId) {
  const [progreso, setProgreso] = useState(null)

  const subir = useCallback(async (archivo) => {
    const limpio = archivo.name.replace(/[^\w.\-]/g, '_')
    const ruta = `organizations/${orgId}/trafficker/${Date.now()}-${limpio}`
    const tarea = uploadBytesResumable(storageRef(storage, ruta), archivo, { contentType: archivo.type })

    const url = await new Promise((ok, falla) => {
      tarea.on(
        'state_changed',
        s => setProgreso(s.totalBytes ? Math.round((s.bytesTransferred / s.totalBytes) * 100) : 0),
        falla,
        async () => ok(await getDownloadURL(tarea.snapshot.ref)),
      )
    })
    setProgreso(null)
    return {
      url,
      nombre: archivo.name,
      tipo: archivo.type.startsWith('video/') ? 'video' : 'imagen',
      peso: archivo.size,
    }
  }, [orgId])

  return { subir, progreso }
}
