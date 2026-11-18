import { useEffect, useState, useCallback } from 'react'
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp, where, getDoc
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { crearActividad } from '@/hooks/useActividades'
import { useAuthStore } from '@/store/authStore'

// ─── CONSTANTS ───────────────────────────────────────────────────
export const APPOINTMENT_TYPES = {
  call:       { label: 'Llamada',      color: '#0066ff', cta: 'Iniciar llamada' },
  video:      { label: 'Videollamada', color: '#7c3aed', cta: 'Entrar a la videollamada' },
  // La cita presencial no genera link: el lead viene a la sede. Por eso lleva
  // sus propios campos (sede y requisitos previos) y su propio CTA.
  presencial: { label: 'Presencial',   color: '#00875a', cta: 'Marcar asistencia' },
}

export const APPOINTMENT_STATUS = {
  pending:   { label: 'Pendiente',  color: '#f59e0b', bg: 'rgba(245,158,11,0.08)'  },
  completed: { label: 'Asistió',    color: '#00c853', bg: 'rgba(0,200,83,0.08)'   },
  // Faltar no es lo mismo que cancelar: cancelar avisa, no presentarse no.
  no_show:   { label: 'No asistió', color: '#ff9500', bg: 'rgba(255,149,0,0.10)'  },
  cancelled: { label: 'Cancelada',  color: '#ff3b30', bg: 'rgba(255,59,48,0.08)'  },
  rescheduled:{ label: 'Reagendada',color: '#6366f1', bg: 'rgba(99,102,241,0.08)' },
}

// Las que todavía tienen que ocurrir. Es la definición que usan la agenda del
// agente, el filtro de Reuniones y la ficha del lead.
export const ESTADOS_EN_PIE = ['pending', 'scheduled', 'rescheduled']

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

  /* Pasa el lead a Handoff, igual que cuando el agente agenda.
   *
   * Solo lo mueve si está en Calentamiento. Uno que ya está en Handoff se
   * queda donde está, y uno que ya pasó a Cierre no se regresa: tener una
   * oportunidad abierta y faltar a una cita no deshace la oportunidad.
   *
   * Deja escrito por qué se movió. Sin eso, la pregunta «¿cómo llegó este
   * lead aquí?» no tiene respuesta en la ficha. */
  const llevarAHandoff = async (leadId, { motivo, mensaje, asignado }) => {
    const leadRef = doc(db, 'organizations', orgId, 'leads', leadId)
    const snap = await getDoc(leadRef)
    if (!snap.exists()) return null
    const lead = { id: snap.id, ...snap.data() }
    if (lead.discarded) return lead

    const enCalentamiento = !lead.systemStage || lead.systemStage === 'cold'
    if (!enCalentamiento) return lead

    const responsable = lead.assignedTo || asignado || userId || null
    await updateDoc(leadRef, {
      systemStage: 'handoff',
      systemStageAt: serverTimestamp(),
      stageId: null,
      handoffAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...(lead.assignedTo ? {} : { assignedTo: responsable, assignedAt: serverTimestamp() }),
    })
    await addDoc(collection(leadRef, 'interactions'), {
      type: 'handoff',
      content: motivo,
      createdAt: serverTimestamp(),
      createdBy: userId || null,
    })
    if (responsable) {
      await addDoc(collection(db, 'organizations', orgId, 'alerts'), {
        type: 'handoff_assigned',
        leadId,
        leadName: lead.name || '',
        assignedTo: responsable,
        message: mensaje,
        seen: false,
        createdAt: serverTimestamp(),
      })
    }
    return { ...lead, assignedTo: responsable }
  }

  // Create appointment
  const createAppointment = async ({
    leadId, leadName, type, scheduledAt, duration,
    platform, link, notes, assignedTo, location, requirements
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
        // Solo aplican a las presenciales; en el resto quedan vacías.
        location: location || '',
        requirements: requirements || '',
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

    /* Agendar a mano lleva a Handoff, igual que cuando agenda el agente.
     *
     * Antes solo lo hacía el agente. En una clínica, donde recepción agenda,
     * el paciente con cita se quedaba en Calentamiento con todo su score,
     * como si nadie lo hubiera atendido. Que la cita la ponga una persona o el
     * agente no cambia que la conversión ya ocurrió.
     *
     * En un try aparte: si esto falla, la cita igual tiene que quedar. */
    if (leadId) {
      try {
        await llevarAHandoff(leadId, {
          motivo: 'Pasó a Handoff: se le agendó una cita',
          mensaje: `${leadName || 'Un contacto'} tiene una cita agendada`,
          asignado: assignedTo,
        })
      } catch (e) {
        console.error('[citas] la cita quedó, pero no se pudo pasar a Handoff:', e)
      }
    }
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

  /* Asistencia, que es lo primero que hay que registrar de una cita y hasta
   * ahora solo se podía marcar pasando por el cockpit de llamada — pensado
   * para llamadas, no para alguien que vino a la sede.
   *
   * No se mezcla con el resultado comercial: que haya venido no dice todavía
   * si compró. Eso se resuelve cerrando oportunidades. */
  const marcarAsistencia = async (appointmentId, asistio) => {
    if (!orgId) return
    await updateDoc(
      doc(db, 'organizations', orgId, 'appointments', appointmentId),
      {
        status: asistio ? 'completed' : 'no_show',
        attended: asistio,
        attendedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    )
    if (!asistio) await seguirNoShow(appointmentId)
  }

  /* Quien faltó a su cita necesita una llamada, no volver a empezar.
   *
   * Antes marcar «no asistió» solo cambiaba la cita: el lead se quedaba donde
   * estuviera, y si alguien lo regresaba a Calentamiento para volver a
   * trabajarlo, se quedaba ahí con 100 puntos y sin que nadie lo llamara.
   *
   * Ahora vuelve a Handoff —si estaba en Calentamiento— y su responsable
   * recibe una llamada pendiente para hoy. El score no se toca: sigue igual
   * de calificado que cuando agendó. */
  const seguirNoShow = async (appointmentId) => {
    /* De la lista viva si está; si no, de la base. Marcar la falta desde una
     * pantalla que no cargó todas las citas no puede saltarse el seguimiento. */
    let cita = appointments.find(a => a.id === appointmentId)
    if (!cita) {
      const s = await getDoc(doc(db, 'organizations', orgId, 'appointments', appointmentId))
      cita = s.exists() ? { id: s.id, ...s.data() } : null
    }
    if (!cita?.leadId) return
    try {
      const lead = await llevarAHandoff(cita.leadId, {
        motivo: 'Regresó a Handoff: no asistió a su cita',
        mensaje: `${cita.leadName || 'Un contacto'} no asistió a su cita: hay que llamarle para reagendar`,
        asignado: cita.assignedTo,
      })
      if (!lead || lead.discarded) return

      const responsable = lead.assignedTo || cita.assignedTo || userId || null
      /* El nombre del responsable se lee de su ficha de miembro. Sin pasarlo,
       * la tarea quedaría a nombre de quien marcó la falta aunque se le
       * asigne a otra persona. */
      let ownerNombre = ''
      if (responsable) {
        const m = await getDoc(doc(db, 'organizations', orgId, 'members', responsable))
        ownerNombre = m.data()?.name || m.data()?.email || ''
      }
      await crearActividad(orgId, cita.leadId, {
        tipo: 'llamada',
        estado: 'pendiente',
        dueAt: new Date(),
        resumen: 'No asistió a su cita. Llamar para reagendar.',
        pipelineId: lead.pipelineId || null,
        leadNombre: [lead.name, lead.lastName].filter(Boolean).join(' ') || cita.leadName || '',
        ownerUid: responsable,
        ownerNombre,
      }, { uid: userId || null, nombre: user?.displayName || user?.email || '' })
    } catch (e) {
      console.error('[citas] se marcó la falta, pero no se pudo crear el seguimiento:', e)
    }
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
    marcarAsistencia,
    cancelAppointment,
    rescheduleAppointment,
    deleteAppointment,
    getLeadAppointments,
  }
}
