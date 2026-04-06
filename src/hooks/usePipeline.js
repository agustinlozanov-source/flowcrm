import { useEffect, useState } from 'react'
import {
  collection, query, orderBy, onSnapshot, where,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDocs
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'

export function usePipeline() {
  const { org } = useAuthStore()
  const orgId = org?.id

  const [pipelines, setPipelines] = useState([])
  const [activePipelineId, setActivePipelineId] = useState(null) // null = mostrar todo (legacy)
  const [allStages, setAllStages] = useState([])   // todas las stages, siempre
  const [leads, setLeads] = useState([])
  const [loadingStages, setLoadingStages] = useState(true)
  const [loadingLeads, setLoadingLeads] = useState(true)

  // Real-time pipelines listener
  useEffect(() => {
    if (!orgId) return
    const q = query(
      collection(db, 'organizations', orgId, 'pipelines'),
      orderBy('createdAt', 'asc')
    )
    const unsub = onSnapshot(q, (snap) => {
      setPipelines(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [orgId])

  // Real-time stages listener — siempre trae todas, filtramos en JS
  useEffect(() => {
    if (!orgId) return
    const q = query(
      collection(db, 'organizations', orgId, 'pipeline_stages'),
      orderBy('order', 'asc')
    )
    const unsub = onSnapshot(q, (snap) => {
      setAllStages(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoadingStages(false)
    })
    return () => unsub()
  }, [orgId])

  // Real-time leads listener — siempre trae todos, filtramos en JS
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

  // Stages filtradas según el pipeline activo
  // null → etapas huérfanas (sin pipelineId) + legacy
  // '__all__' → todas
  // 'someId' → solo las de ese pipeline
  const stages = activePipelineId === '__all__'
    ? allStages
    : activePipelineId
      ? allStages.filter(s => s.pipelineId === activePipelineId)
      : allStages.filter(s => !s.pipelineId)

  // Leads filtrados igual
  const filteredLeads = activePipelineId === '__all__'
    ? leads
    : activePipelineId
      ? leads.filter(l => l.pipelineId === activePipelineId)
      : leads.filter(l => !l.pipelineId)

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
        pipelineId: activePipelineId || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    )
  }

  // Create a new pipeline and its stages
  const createPipeline = async ({ name, purpose, stages: stageList }) => {
    if (!orgId) return
    const pipelineRef = await addDoc(
      collection(db, 'organizations', orgId, 'pipelines'),
      { name, purpose: purpose || null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
    )
    for (let i = 0; i < stageList.length; i++) {
      const s = stageList[i]
      await addDoc(
        collection(db, 'organizations', orgId, 'pipeline_stages'),
        {
          name: s.name, color: s.color || '#6366f1', order: i + 1,
          pipelineId: pipelineRef.id,
          scoreMin: s.scoreMin ?? 0,
          scoreMax: s.scoreMax ?? 100,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        }
      )
    }
    return pipelineRef.id
  }

  // Update pipeline name/purpose
  const updatePipeline = async (pipelineId, { name, purpose }) => {
    if (!orgId) return
    await updateDoc(
      doc(db, 'organizations', orgId, 'pipelines', pipelineId),
      { name, purpose: purpose || null, updatedAt: serverTimestamp() }
    )
  }

  // Update a single stage (name, color, scoreMin, scoreMax, order)
  const updateStage = async (stageId, data) => {
    if (!orgId) return
    await updateDoc(
      doc(db, 'organizations', orgId, 'pipeline_stages', stageId),
      { ...data, updatedAt: serverTimestamp() }
    )
  }

  // Delete a stage permanently
  const deleteStage = async (stageId) => {
    if (!orgId) return
    await deleteDoc(doc(db, 'organizations', orgId, 'pipeline_stages', stageId))
  }

  // Adopt orphan stages+leads into a new named pipeline
  const adoptOrphanStages = async ({ name, purpose }) => {
    if (!orgId) return
    const pipelineRef = await addDoc(
      collection(db, 'organizations', orgId, 'pipelines'),
      { name, purpose: purpose || null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
    )
    const pipelineId = pipelineRef.id
    // Stamp orphan stages
    const stagesSnap = await getDocs(collection(db, 'organizations', orgId, 'pipeline_stages'))
    for (const d of stagesSnap.docs) {
      if (!d.data().pipelineId) {
        await updateDoc(d.ref, { pipelineId, updatedAt: serverTimestamp() })
      }
    }
    // Stamp orphan leads
    const leadsSnap = await getDocs(collection(db, 'organizations', orgId, 'leads'))
    for (const d of leadsSnap.docs) {
      if (!d.data().pipelineId) {
        await updateDoc(d.ref, { pipelineId, updatedAt: serverTimestamp() })
      }
    }
    return pipelineId
  }

  // Leads grouped by stage (usando leads filtrados)
  const leadsByStage = stages.reduce((acc, stage) => {
    acc[stage.id] = filteredLeads.filter(l => l.stageId === stage.id)
    return acc
  }, {})

  return {
    pipelines,
    activePipelineId,
    setActivePipelineId,
    allStages,
    stages,
    leads: filteredLeads,
    leadsByStage,
    loading: loadingStages || loadingLeads,
    moveLead,
    createLead,
    updateLead,
    deleteLead,
    createStage,
    updateStage,
    deleteStage,
    createPipeline,
    updatePipeline,
    adoptOrphanStages,
  }
}
