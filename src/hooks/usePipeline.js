import { useEffect, useState } from 'react'
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'

export function usePipeline() {
  const { org } = useAuthStore()
  const orgId = org?.id

  const [stages, setStages] = useState([])
  const [leads, setLeads] = useState([])
  const [loadingStages, setLoadingStages] = useState(true)
  const [loadingLeads, setLoadingLeads] = useState(true)

  // Real-time stages listener
  useEffect(() => {
    if (!orgId) return
    const q = query(
      collection(db, 'organizations', orgId, 'pipeline_stages'),
      orderBy('order', 'asc')
    )
    const unsub = onSnapshot(q, (snap) => {
      setStages(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoadingStages(false)
    })
    return () => unsub()
  }, [orgId])

  // Real-time leads listener
  useEffect(() => {
    if (!orgId) return
    const q = query(
      collection(db, 'organizations', orgId, 'leads'),
      orderBy('createdAt', 'desc')
    )
    const unsub = onSnapshot(q, (snap) => {
      setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoadingLeads(false)
    })
    return () => unsub()
  }, [orgId])

  // Move lead to different stage
  const moveLead = async (leadId, newStageId) => {
    if (!orgId) return
    await updateDoc(
      doc(db, 'organizations', orgId, 'leads', leadId),
      { stageId: newStageId, updatedAt: serverTimestamp() }
    )
  }

  // Create new lead
  const createLead = async (data) => {
    if (!orgId) return
    const ref = await addDoc(
      collection(db, 'organizations', orgId, 'leads'),
      {
        name: data.name,
        company: data.company || '',
        email: data.email || '',
        phone: data.phone || '',
        value: Number(data.value) || 0,
        source: data.source || 'manual',
        stageId: data.stageId,
        score: 0,
        assignedTo: null,
        notes: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    )
    return ref.id
  }

  // Update lead fields
  const updateLead = async (leadId, data) => {
    if (!orgId) return
    await updateDoc(
      doc(db, 'organizations', orgId, 'leads', leadId),
      { ...data, updatedAt: serverTimestamp() }
    )
  }

  // Delete lead
  const deleteLead = async (leadId) => {
    if (!orgId) return
    await deleteDoc(doc(db, 'organizations', orgId, 'leads', leadId))
  }

  // Create new stage
  const createStage = async (name, color) => {
    if (!orgId) return
    const maxOrder = stages.reduce((max, s) => Math.max(max, s.order ?? 0), 0)
    await addDoc(
      collection(db, 'organizations', orgId, 'pipeline_stages'),
      {
        name,
        color: color || '#6366f1',
        order: maxOrder + 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    )
  }

  // Leads grouped by stage
  const leadsByStage = stages.reduce((acc, stage) => {
    acc[stage.id] = leads.filter(l => l.stageId === stage.id)
    return acc
  }, {})

  return {
    stages,
    leads,
    leadsByStage,
    loading: loadingStages || loadingLeads,
    moveLead,
    createLead,
    updateLead,
    deleteLead,
    createStage,
  }
}
