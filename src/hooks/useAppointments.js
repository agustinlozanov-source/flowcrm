import { useEffect, useState, useCallback } from 'react'
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp, where
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'

// ─── CONSTANTS ───────────────────────────────────────────────────
export const APPOINTMENT_TYPES = {
  call:  { label: 'Llamada',      icon: '📞', color: '#0066ff' },
  video: { label: 'Videollamada', icon: '🎥', color: '#7c3aed' },
}

export const APPOINTMENT_STATUS = {
  pending:   { label: 'Pendiente',  color: '#f59e0b', bg: 'rgba(245,158,11,0.08)'  },
  completed: { label: 'Realizada',  color: '#00c853', bg: 'rgba(0,200,83,0.08)'   },
  cancelled: { label: 'Cancelada',  color: '#ff3b30', bg: 'rgba(255,59,48,0.08)'  },
  rescheduled:{ label: 'Reagendada',color: '#6366f1', bg: 'rgba(99,102,241,0.08)' },
}

export const APPOINTMENT_OUTCOMES = {
  secure:      { label: 'Oportunidad segura', color: '#0066ff' },
  open:        { label: 'Oportunidad abierta', color: '#6366f1' },
  discard:     { label: 'Descartado',          color: '#ff3b30' },
  rescheduled: { label: 'Reagendado',          color: '#f59e0b' },
}

export const VIDEO_PLATFORMS = [
  { value: 'meet',  label: 'Google Meet',      prefix: 'https://meet.google.com/' },
  { value: 'zoom',  label: 'Zoom',             prefix: 'https://zoom.us/j/'       },
  { value: 'teams', label: 'Microsoft Teams',  prefix: 'https://teams.microsoft.com/' },
  { value: 'custom',label: 'Enlace propio',    prefix: ''                         },
]

// ─── HOOK ─────────────────────────────────────────────────────────
export function useAppointments() {
  const { org, user } = useAuthStore()
  const orgId = org?.id
  const userId = user?.uid

  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orgId) { setLoading(false); return }
    const q = query(
      collection(db, 'organizations', orgId, 'appointments'),
      orderBy('scheduledAt', 'asc')
    )
    const unsub = onSnapshot(q, snap => {
      setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, (err) => {
      console.error('[useAppointments] onSnapshot error:', err)
      setLoading(false)
    })
    return unsub
  }, [orgId])

  // Today's appointments for the current user
  const todayAppointments = appointments.filter(a => {
    const date = a.scheduledAt?.toDate?.()
    if (!date) return false
    const today = new Date()
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear() &&
      a.status === 'pending' &&
      (a.assignedTo === userId || !a.assignedTo)
    )
  })

  // Upcoming (next 7 days, not today)
  const upcomingAppointments = appointments.filter(a => {
    const date = a.scheduledAt?.toDate?.()
    if (!date) return false
    const today = new Date()
    const in7 = new Date(); in7.setDate(in7.getDate() + 7)
    const isToday = date.toDateString() === today.toDateString()
    return !isToday && date > today && date <= in7 && a.status === 'pending'
  })

  // Create appointment
  const createAppointment = async ({
    leadId, leadName, type, scheduledAt, duration,
    platform, link, notes, assignedTo
  }) => {
    if (!orgId) return
    const ref = await addDoc(
      collection(db, 'organizations', orgId, 'appointments'),
      {
        leadId: leadId || null,
        leadName: leadName || '',
        type: type || 'call',
        scheduledAt,
        duration: duration || 15,
        platform: platform || null,
        link: link || '',
        notes: notes || '',
        assignedTo: assignedTo || userId,
        status: 'pending',
        outcome: null,
        outcomeNotes: '',
        paymentDate: null,
        discardCategory: null,
        completedAt: null,
        createdAt: serverTimestamp(),
        createdBy: userId,
      }
    )
    return ref.id
  }

  // Update appointment
  const updateAppointment = async (appointmentId, data) => {
    if (!orgId) return
    await updateDoc(
      doc(db, 'organizations', orgId, 'appointments', appointmentId),
      { ...data, updatedAt: serverTimestamp() }
    )
  }

  // Complete appointment with outcome
  const completeAppointment = async (appointmentId, {
    outcome, outcomeNotes, paymentDate, discardCategory
  }) => {
    if (!orgId) return
    await updateDoc(
      doc(db, 'organizations', orgId, 'appointments', appointmentId),
      {
        status: 'completed',
        outcome,
        outcomeNotes: outcomeNotes || '',
        paymentDate: paymentDate || null,
        discardCategory: discardCategory || null,
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    )
  }

  // Cancel appointment
  const cancelAppointment = async (appointmentId) => {
    if (!orgId) return
    await updateDoc(
      doc(db, 'organizations', orgId, 'appointments', appointmentId),
      { status: 'cancelled', updatedAt: serverTimestamp() }
    )
  }

  // Reschedule appointment
  const rescheduleAppointment = async (appointmentId, newScheduledAt) => {
    if (!orgId) return
    await updateDoc(
      doc(db, 'organizations', orgId, 'appointments', appointmentId),
      {
        status: 'rescheduled',
        scheduledAt: newScheduledAt,
        updatedAt: serverTimestamp(),
      }
    )
  }

  // Delete appointment
  const deleteAppointment = async (appointmentId) => {
    if (!orgId) return
    await deleteDoc(doc(db, 'organizations', orgId, 'appointments', appointmentId))
  }

  // Get appointments for a specific lead
  const getLeadAppointments = useCallback((leadId) => {
    return appointments.filter(a => a.leadId === leadId)
  }, [appointments])

  return {
    appointments,
    todayAppointments,
    upcomingAppointments,
    loading,
    createAppointment,
    updateAppointment,
    completeAppointment,
    cancelAppointment,
    rescheduleAppointment,
    deleteAppointment,
    getLeadAppointments,
  }
}
