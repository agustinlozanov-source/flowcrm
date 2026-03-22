import { useEffect, useState } from 'react'
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'

export function useProducts() {
  const { org } = useAuthStore()
  const orgId = org?.id

  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orgId) return
    const q = query(
      collection(db, 'organizations', orgId, 'products'),
      orderBy('createdAt', 'desc')
    )
    const unsub = onSnapshot(q, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return () => unsub()
  }, [orgId])

  const uploadImage = async (file, productId) => {
    const ext = file.name.split('.').pop()
    const storageRef = ref(storage, `organizations/${orgId}/products/${productId}.${ext}`)
    await uploadBytes(storageRef, file)
    return await getDownloadURL(storageRef)
  }

  const createProduct = async (data, imageFile = null) => {
    if (!orgId) return
    const docRef = await addDoc(
      collection(db, 'organizations', orgId, 'products'),
      {
        name: data.name || '',
        description: data.description || '',
        price: Number(data.price) || 0,
        currency: data.currency || 'USD',
        type: data.type || 'service',
        category: data.category || '',
        sku: data.sku || '',
        status: data.status ?? 'active',
        imageUrl: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    )
    let imageUrl = ''
    if (imageFile) {
      imageUrl = await uploadImage(imageFile, docRef.id)
      await updateDoc(docRef, { imageUrl })
    }
    return { id: docRef.id, name: data.name, price: Number(data.price), imageUrl }
  }

  const updateProduct = async (productId, data, imageFile = null) => {
    if (!orgId) return
    const docRef = doc(db, 'organizations', orgId, 'products', productId)
    const updateData = { ...data, updatedAt: serverTimestamp() }
    if (imageFile) {
      updateData.imageUrl = await uploadImage(imageFile, productId)
    }
    await updateDoc(docRef, updateData)
  }

  const deleteProduct = async (productId, imageUrl) => {
    if (!orgId) return
    if (imageUrl) {
      try { await deleteObject(ref(storage, imageUrl)) } catch {}
    }
    await deleteDoc(doc(db, 'organizations', orgId, 'products', productId))
  }

  const categories = [...new Set(products.map(p => p.category).filter(Boolean))].sort()

  return { products, loading, categories, createProduct, updateProduct, deleteProduct }
}
