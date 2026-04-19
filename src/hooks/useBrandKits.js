import { useEffect, useState } from 'react'
import {
  collection, doc, onSnapshot, addDoc, updateDoc,
  deleteDoc, serverTimestamp, query, orderBy
} from 'firebase/firestore'
import {
  ref, uploadBytes, getDownloadURL, deleteObject
} from 'firebase/storage'
import { db, storage } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

// ─── GOOGLE FONTS CURATED LIST ────────────────────────────────────
export const DISPLAY_FONTS = [
  { name: 'Bebas Neue',      category: 'Bold / Impact'    },
  { name: 'Oswald',          category: 'Bold / Impact'    },
  { name: 'Montserrat',      category: 'Bold / Impact'    },
  { name: 'Playfair Display',category: 'Elegante / Serif' },
  { name: 'Merriweather',    category: 'Elegante / Serif' },
  { name: 'Cormorant Garamond', category: 'Elegante / Serif' },
  { name: 'Raleway',         category: 'Moderno / Sans'   },
  { name: 'Poppins',         category: 'Moderno / Sans'   },
  { name: 'DM Sans',         category: 'Moderno / Sans'   },
  { name: 'Space Grotesk',   category: 'Técnico / Geom'   },
  { name: 'Syne',            category: 'Técnico / Geom'   },
  { name: 'Outfit',          category: 'Técnico / Geom'   },
]

export const BODY_FONTS = [
  { name: 'Inter',           category: 'Neutro'           },
  { name: 'DM Sans',         category: 'Neutro'           },
  { name: 'Nunito',          category: 'Amigable'         },
  { name: 'Lato',            category: 'Amigable'         },
  { name: 'Source Sans 3',   category: 'Legible'          },
  { name: 'Noto Sans',       category: 'Legible'          },
  { name: 'Open Sans',       category: 'Legible'          },
  { name: 'Roboto',          category: 'Técnico'          },
  { name: 'IBM Plex Sans',   category: 'Técnico'          },
]

export const VISUAL_STYLES = [
  { value: 'bold',     label: 'Bold',     desc: 'Impactante, contraste alto, textos grandes'    },
  { value: 'minimal',  label: 'Minimal',  desc: 'Limpio, espaciado, tipografía protagonista'    },
  { value: 'elegant',  label: 'Elegante', desc: 'Refinado, serif, paleta sobria'                },
  { value: 'vibrant',  label: 'Vibrante', desc: 'Colores intensos, energético, dinámico'        },
]

// Load Google Font dynamically
export function loadGoogleFont(fontName) {
  if (!fontName) return
  const id = `gfont-${fontName.replace(/\s+/g, '-').toLowerCase()}`
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@400;600;700;800;900&display=swap`
  document.head.appendChild(link)
}

// ─── DEFAULT KIT ──────────────────────────────────────────────────
export const DEFAULT_KIT = {
  name: 'Mi marca',
  logoUrl: null,
  primaryColor: '#0a0a0a',
  secondaryColor: '#ffffff',
  accentColor: '#f59e0b',
  fontDisplay: 'Oswald',
  fontBody: 'Inter',
  customFontDisplayUrl: null,
  customFontBodyUrl: null,
  visualStyle: 'bold',
  isDefault: true,
}

// ─── HOOK ─────────────────────────────────────────────────────────
export function useBrandKits() {
  const { org } = useAuthStore()
  const orgId = org?.id

  const [kits, setKits] = useState([])
  const [loading, setLoading] = useState(true)

  // Real-time listener
  useEffect(() => {
    if (!orgId) { setLoading(false); return }
    const unsub = onSnapshot(
      query(
        collection(db, 'organizations', orgId, 'brandKits'),
        orderBy('createdAt', 'asc')
      ),
      snap => {
        setKits(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      (err) => {
        console.error('[useBrandKits] onSnapshot error:', err)
        setLoading(false)
      }
    )
    return unsub
  }, [orgId])

  const defaultKit = kits.find(k => k.isDefault) || kits[0] || null

  // ── FILE UPLOAD ────────────────────────────────────────────────

  const uploadLogo = async (kitId, file) => {
    if (!orgId || !file) return null
    const ext = file.name.split('.').pop()
    const path = `organizations/${orgId}/brandKits/${kitId}/logo.${ext}`
    const storageRef = ref(storage, path)
    await uploadBytes(storageRef, file)
    return getDownloadURL(storageRef)
  }

  const uploadCustomFont = async (kitId, file, type) => {
    if (!orgId || !file) return null
    const ext = file.name.split('.').pop()
    const path = `organizations/${orgId}/brandKits/${kitId}/font-${type}.${ext}`
    const storageRef = ref(storage, path)
    await uploadBytes(storageRef, file)
    return getDownloadURL(storageRef)
  }

  const deleteFile = async (url) => {
    if (!url) return
    try {
      const storageRef = ref(storage, url)
      await deleteObject(storageRef)
    } catch { /* ignore if file doesn't exist */ }
  }

  // ── CRUD ───────────────────────────────────────────────────────

  const createKit = async (data = {}) => {
    if (!orgId) return
    const isFirst = kits.length === 0
    const ref = await addDoc(
      collection(db, 'organizations', orgId, 'brandKits'),
      {
        ...DEFAULT_KIT,
        ...data,
        isDefault: isFirst,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    )
    return ref.id
  }

  const updateKit = async (kitId, data) => {
    if (!orgId) return
    await updateDoc(
      doc(db, 'organizations', orgId, 'brandKits', kitId),
      { ...data, updatedAt: serverTimestamp() }
    )
  }

  const deleteKit = async (kitId) => {
    if (!orgId) return
    if (kits.length === 1) { toast.error('Necesitas al menos un Brand Kit'); return }
    const kit = kits.find(k => k.id === kitId)
    if (kit?.logoUrl) await deleteFile(kit.logoUrl)
    if (kit?.customFontDisplayUrl) await deleteFile(kit.customFontDisplayUrl)
    if (kit?.customFontBodyUrl) await deleteFile(kit.customFontBodyUrl)
    await deleteDoc(doc(db, 'organizations', orgId, 'brandKits', kitId))
    // If deleted kit was default, make first remaining kit default
    if (kit?.isDefault) {
      const remaining = kits.filter(k => k.id !== kitId)
      if (remaining.length > 0) {
        await updateDoc(
          doc(db, 'organizations', orgId, 'brandKits', remaining[0].id),
          { isDefault: true }
        )
      }
    }
  }

  const setDefaultKit = async (kitId) => {
    if (!orgId) return
    // Remove default from all kits
    await Promise.all(
      kits.filter(k => k.isDefault).map(k =>
        updateDoc(doc(db, 'organizations', orgId, 'brandKits', k.id), { isDefault: false })
      )
    )
    // Set new default
    await updateDoc(
      doc(db, 'organizations', orgId, 'brandKits', kitId),
      { isDefault: true }
    )
  }

  const saveKitWithFiles = async (kitId, formData, logoFile, fontDisplayFile, fontBodyFile) => {
    if (!orgId) return

    let updates = { ...formData }

    if (logoFile) {
      const url = await uploadLogo(kitId, logoFile)
      if (url) updates.logoUrl = url
    }

    if (fontDisplayFile) {
      const url = await uploadCustomFont(kitId, fontDisplayFile, 'display')
      if (url) updates.customFontDisplayUrl = url
    }

    if (fontBodyFile) {
      const url = await uploadCustomFont(kitId, fontBodyFile, 'body')
      if (url) updates.customFontBodyUrl = url
    }

    await updateKit(kitId, updates)
  }

  return {
    kits,
    loading,
    defaultKit,
    createKit,
    updateKit,
    deleteKit,
    setDefaultKit,
    saveKitWithFiles,
    uploadLogo,
    uploadCustomFont,
    DISPLAY_FONTS,
    BODY_FONTS,
    VISUAL_STYLES,
    loadGoogleFont,
  }
}
