import { useEffect, useState, useCallback } from 'react'
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp, where
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'

export function usePipeline() {
  const { org } = useAuthStore()
  const orgId = org?.id

  const [pipelines, setPipelines] = useState([])
  const [activePipelineId, setActivePipelineId] = useState(null)
  const [stages, setStages] = useState([])
  const [leads, setLeads] = useState([])
  const [loadingPipelines, setLoadingPipelines] = useState(true)
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
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setPipelines(list)
      setLoadingPipelines(false)
      // Auto-select first pipeline if none selected
      setActivePipelineId(prev => {
        if (prev && list.find(p => p.id === prev)) return prev
        return list[0]?.id || null
      })
    })
    return () => unsub()
  }, [orgId])

  // Real-time stages listener — filtered by activePipelineId
  useEffect(() => {
    if (!orgId) return
    setLoadingStages(true)
    let q
    if (activePipelineId) {
      q = query(
        collection(db, 'organizations', orgId, 'pipeline_stages'),
        where('pipelineId', '==', activePipelineId),
        orderBy('order', 'asc')
      )
    } else {
      // Legacy: stages without pipelineId (or no pipelines yet)
      q = query(
        collection(db, 'organizations', orgId, 'pipeline_stages'),
        orderBy('order', 'asc')
      )
    }
    const unsub = onSnapshot(q, (snap) => {
      setStages(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoadingStages(false)
    })
    return () => unsub()
  }, [orgId, activePipelineId])

  // Real-time leads listener — filtered by activePipelineId
  useEffect(() => {
    if (!orgId) return
    setLoadingLeads(true)
    let q
    if (activePipelineId) {
      q = query(
        collection(db, 'organizations', orgId, 'leads'),
        where('pipelineId', '==', activePipelineId),
        orderBy('createdAt', 'desc')
      )
    } else {
      q = query(
        collection(db, 'organizations', orgId, 'leads'),
        orderBy('createdAt', 'desc')
      )
    }
    const unsub = onSnapshot(q, (snap) => {
      setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoadingLeads(false)
    })
    return () => unsub()
  }, [orgId, activePipelineId])

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
        pipelineId: data.pipelineId || activePipelineId || null,
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

  // Create new stage (within active pipeline)
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

  // Create a new pipeline + its stages from builder data
  const createPipeline = useCallback(async (pipelineData) => {
    if (!orgId) return
    const { name, purpose, fuentes, canales, stages: stageList = [], agentConfig, scoreConfig, templates } = pipelineData

    // 1. Create the pipeline document
    const pipelineRef = await addDoc(
      collection(db, 'organizations', orgId, 'pipelines'),
      {
        name,
        purpose: purpose || null,
        fuentes: fuentes || [],
        canales: canales || [],
        agentConfig: agentConfig || null,
        scoreConfig: scoreConfig || null,
        templates: templates || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    )

    // 2. Create each stage linked to this pipeline
    const COLORS = ['#6366f1','#8b5cf6','#ec4899','#f97316','#eab308','#22c55e','#14b8a6','#3b82f6','#ef4444','#64748b']
    for (let i = 0; i < stageList.length; i++) {
      const s = stageList[i]
      await addDoc(
        collection(db, 'organizations', orgId, 'pipeline_stages'),
        {
          name: s.name,
          color: COLORS[i % COLORS.length],
          order: i + 1,
          pipelineId: pipelineRef.id,
          entry: s.entry || null,
          exit: s.exit || null,
          agent: s.agent || null,
          agentFreq: s.agentFreq || null,
          agentClosed: s.agentClosed || null,
          scoreCriteria: s.scoreCriteria || { up: [], down: [] },
          threshAdvance: s.threshAdvance ?? 50,
          threshBack: s.threshBack ?? 20,
          threshDrop: s.threshDrop ?? 5,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      )
    }

    return pipelineRef.id
  }, [orgId])

  // Leads grouped by stage
  const leadsByStage = stages.reduce((acc, stage) => {
    acc[stage.id] = leads.filter(l => l.stageId === stage.id)
    return acc
  }, {})

  return {
    pipelines,
    activePipelineId,
    setActivePipelineId,
    stages,
    leads,
    leadsByStage,
    loading: loadingPipelines || loadingStages || loadingLeads,
    moveLead,
    createLead,
    updateLead,
    deleteLead,
    createStage,
    createPipeline,
  }
}
