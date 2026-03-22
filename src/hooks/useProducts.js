import { useEffect, useState } from 'react'
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
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

  const createProduct = async (data) => {
    if (!orgId) return
    const ref = await addDoc(
      collection(db, 'organizations', orgId, 'products'),
      {
        name: data.name || '',
        description: data.description || '',
        price: Number(data.price) || 0,
        imageUrl: data.imageUrl || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    )
    return { id: ref.id, name: data.name, price: Number(data.price), description: data.description }
  }

  const updateProduct = async (productId, data) => {
    if (!orgId) return
    await updateDoc(
      doc(db, 'organizations', orgId, 'products', productId),
      { ...data, updatedAt: serverTimestamp() }
    )
  }

  const deleteProduct = async (productId) => {
    if (!orgId) return
    await deleteDoc(doc(db, 'organizations', orgId, 'products', productId))
  }

  return {
    products,
    loading,
    createProduct,
    updateProduct,
    deleteProduct,
  }
}
