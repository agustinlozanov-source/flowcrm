import { useEffect, useState } from 'react'
import {
  collection, doc, onSnapshot, setDoc, updateDoc,
  serverTimestamp, query, where, getDocs
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'

// ─── HELPERS ─────────────────────────────────────────────────────

export const QUARTERS = {
  Q1: { label: 'Q1', months: [0, 1, 2],  name: 'Enero – Marzo'      },
  Q2: { label: 'Q2', months: [3, 4, 5],  name: 'Abril – Junio'      },
  Q3: { label: 'Q3', months: [6, 7, 8],  name: 'Julio – Septiembre' },
  Q4: { label: 'Q4', months: [9, 10, 11], name: 'Octubre – Diciembre' },
}

export function getCurrentQuarter() {
  const month = new Date().getMonth()
  if (month <= 2)  return 'Q1'
  if (month <= 5)  return 'Q2'
  if (month <= 8)  return 'Q3'
  return 'Q4'
}

export function getCurrentYear() {
  return new Date().getFullYear()
}

// Calculate days elapsed in current quarter
function getDaysElapsedInQuarter(quarter, year) {
  const q = QUARTERS[quarter]
  const startMonth = q.months[0]
  const startDate = new Date(year, startMonth, 1)
  const today = new Date()
  const diff = today - startDate
  return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

// Total working days in a quarter (~65)
function getTotalWorkingDaysInQuarter() {
  return 65
}

// ─── HOOK ─────────────────────────────────────────────────────────
export function useGoals() {
  const { org } = useAuthStore()
  const orgId = org?.id

  const [goals, setGoals] = useState({}) // { "2026-Q1": {...}, "2026-Q2": {...} }
  const [loading, setLoading] = useState(true)
  const [closedRevenue, setClosedRevenue] = useState(0) // real revenue from leads

  const currentQuarter = getCurrentQuarter()
  const currentYear = getCurrentYear()
  const currentKey = `${currentYear}-${currentQuarter}`

  // Real-time goals listener
  useEffect(() => {
    if (!orgId) return
    const unsub = onSnapshot(
      collection(db, 'organizations', orgId, 'goals'),
      snap => {
        const data = {}
        snap.docs.forEach(d => { data[d.id] = { id: d.id, ...d.data() } })
        setGoals(data)
        setLoading(false)
      }
    )
    return unsub
  }, [orgId])

  // Load real closed revenue from leads for current quarter
  useEffect(() => {
    if (!orgId) return
    loadClosedRevenue()
  }, [orgId, currentQuarter, currentYear])

  const loadClosedRevenue = async () => {
    if (!orgId) return
    try {
      const q = QUARTERS[currentQuarter]
      const startDate = new Date(currentYear, q.months[0], 1)
      const endDate = new Date(currentYear, q.months[2] + 1, 0)

      const snap = await getDocs(
        query(
          collection(db, 'organizations', orgId, 'leads'),
          where('systemStage', '==', 'closed'),
          where('closedAt', '>=', startDate),
          where('closedAt', '<=', endDate)
        )
      )

      const total = snap.docs.reduce((sum, d) => {
        return sum + (d.data().productValue || 0)
      }, 0)
      setClosedRevenue(total)
    } catch (err) {
      console.error('Error loading revenue:', err)
    }
  }

  // ── COMPUTED ───────────────────────────────────────────────────

  const currentGoal = goals[currentKey] || null

  const computedMetrics = (goal) => {
    if (!goal) return null
    const target = goal.targetRevenue || 0
    const elapsed = getDaysElapsedInQuarter(currentQuarter, currentYear)
    const totalDays = getTotalWorkingDaysInQuarter()
    const remaining = Math.max(0, totalDays - elapsed)

    const monthlyTarget = Math.round(target / 3)
    const weeklyTarget  = Math.round(monthlyTarget / 4)
    const dailyTarget   = Math.round(weeklyTarget / 5)

    const currentPace = elapsed > 0 ? Math.round(closedRevenue / elapsed) : 0
    const projectedTotal = currentPace * totalDays
    const progressPct = target > 0 ? Math.min(100, Math.round((closedRevenue / target) * 100)) : 0
    const onTrack = currentPace >= dailyTarget

    const revenueNeeded = Math.max(0, target - closedRevenue)
    const dailyNeeded = remaining > 0 ? Math.round(revenueNeeded / remaining) : 0

    return {
      target,
      achieved: closedRevenue,
      progressPct,
      monthlyTarget,
      weeklyTarget,
      dailyTarget,
      currentPace,
      dailyNeeded,
      projectedTotal,
      onTrack,
      remaining,
      elapsed,
    }
  }

  // ── OPERATIONS ─────────────────────────────────────────────────

  const saveGoal = async (quarter, year, data) => {
    if (!orgId) return
    const key = `${year}-${quarter}`
    await setDoc(
      doc(db, 'organizations', orgId, 'goals', key),
      {
        quarter,
        year,
        ...data,
        updatedAt: serverTimestamp(),
        createdAt: goals[key]?.createdAt || serverTimestamp(),
      },
      { merge: true }
    )
  }

  const updateRock = async (quarter, year, rocks) => {
    if (!orgId) return
    const key = `${year}-${quarter}`
    await updateDoc(
      doc(db, 'organizations', orgId, 'goals', key),
      { rocks, updatedAt: serverTimestamp() }
    )
  }

  const toggleRock = async (quarter, year, rockIndex) => {
    if (!orgId) return
    const key = `${year}-${quarter}`
    const goal = goals[key]
    if (!goal) return
    const rocks = [...(goal.rocks || [])]
    rocks[rockIndex] = { ...rocks[rockIndex], done: !rocks[rockIndex].done }
    await updateDoc(
      doc(db, 'organizations', orgId, 'goals', key),
      { rocks, updatedAt: serverTimestamp() }
    )
  }

  return {
    goals,
    loading,
    currentGoal,
    currentQuarter,
    currentYear,
    currentKey,
    closedRevenue,
    computedMetrics,
    saveGoal,
    updateRock,
    toggleRock,
    QUARTERS,
  }
}
