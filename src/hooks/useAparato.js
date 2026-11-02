/* El aparato comercial: el número del mes y lo que le toca a cada quien.
 *
 * Una sola fórmula, acá, porque la misma cuenta se mira desde el portal del
 * equipo, desde la dirección y —cuando llegue— desde el portal de cualquier
 * distribuidor. Si cada pantalla la recalculara, en dos meses darían distinto
 * y nadie sabría cuál creerle.
 *
 * La meta **no está escrita acá**: sale de los objetivos del CRM. Una meta
 * dentro del código es una meta que nadie puede cambiar sin desplegar, y que
 * tarde o temprano deja de coincidir con la que el equipo tiene en la cabeza.
 */
import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useGoals, QUARTERS, getCurrentQuarter, getCurrentYear } from './useGoals'
import { escucharVentas, totalizar, mesMexico } from '@/lib/ventas'

/* Cómo se reparte lo que se gana. Mientras sea una sola configuración vive
   acá; cuando haya que cambiarla sin desplegar, se muda a `flowhub_config`. */
export const REPARTO = {
  // La bolsa del bono al 100%, como fracción de la meta.
  bolsaPct: 0.10,
  // Partes iguales: los tres líderes más el equipo de contenido.
  partes: 5,
  comision: { prospeccion: 0.06, cierre: 0.06, direccion: 0.03 },
}

/* La escala. Por debajo de 80 no se bonifica; por arriba de 100 se empina,
   para que pasar la meta se sienta distinto a rozarla. */
export const ESCALA = [
  { desde: 0.80, factor: 0.50 },
  { desde: 0.90, factor: 0.75 },
  { desde: 1.00, factor: 1.00 },
  { desde: 1.10, factor: 1.30 },
  { desde: 1.20, factor: 1.70 },
  { desde: 1.30, factor: 2.00 },
]

/** El factor de la escala para un cumplimiento dado.
 *
 *  Entre dos escalones se interpola: quien va en 97% debe ver casi el premio
 *  de la meta, no el de 90%, o se desanima a tres puntos de llegar. */
export function factorDe(cumplimiento) {
  if (!(cumplimiento >= 0.80)) return 0
  if (cumplimiento >= 1.30) return 2.00
  for (let i = 0; i < ESCALA.length - 1; i++) {
    const a = ESCALA[i], b = ESCALA[i + 1]
    if (cumplimiento >= a.desde && cumplimiento < b.desde) {
      const t = (cumplimiento - a.desde) / (b.desde - a.desde)
      return a.factor + t * (b.factor - a.factor)
    }
  }
  return 2.00
}

/** Cuándo se cobra el bono de un mes: los primeros 7 días del siguiente. */
export function fechaDeCobro(periodo) {
  const [a, m] = String(periodo).split('-').map(Number)
  // `m` sin restar uno ya apunta al mes siguiente.
  return new Date(a, m, 7).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })
}

/**
 * @param mes         'YYYY-MM'; por omisión, el mes en curso en México
 * @param pipelineId  para mirar un solo embudo; null = toda la organización
 */
export function useAparato(mes, pipelineId = null) {
  const { org, user } = useAuthStore()
  const orgId = org?.id
  const periodo = mes || mesMexico()

  const { goals } = useGoals()
  const [ventas, setVentas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!orgId) { setCargando(false); return }
    setCargando(true)
    const baja = escucharVentas(orgId, [periodo], v => {
      setVentas(v); setCargando(false); setError(null)
    }, err => { setError(err); setCargando(false) }, { pipelineId })
    return baja
  }, [orgId, periodo, pipelineId])

  /** La meta del mes, tomada del objetivo trimestral del CRM.
   *
   *  El trimestre guarda su desglose mensual; si alguien no lo desglosó, se
   *  reparte en tres. Sin objetivo cargado la meta es cero, y entonces el
   *  cumplimiento no se muestra en vez de inventar un 100%. */
  const meta = useMemo(() => {
    const [anio, mm] = periodo.split('-').map(Number)
    const trimestre = Object.keys(QUARTERS).find(q => QUARTERS[q].months.includes(mm - 1))
    const goal = goals?.[`${anio}-${trimestre}`]
    if (!goal) return 0
    const delMes = goal.months?.find(g => g.monthIndex === mm - 1)
    if (delMes?.targetRevenue) return Number(delMes.targetRevenue) || 0
    return Math.round((Number(goal.targetRevenue) || 0) / 3)
  }, [goals, periodo])

  return useMemo(() => {
    const t = totalizar(ventas)
    const cumplimiento = meta > 0 ? t.venta / meta : 0
    const factor = factorDe(cumplimiento)
    const bolsa = Math.round(meta * REPARTO.bolsaPct * factor)

    return {
      periodo,
      cargando,
      error,
      /* Sin meta cargada no se muestra cumplimiento: un porcentaje contra cero
         es un número inventado, y la gente lo trataría como real. */
      hayMeta: meta > 0,
      meta,
      ...t,
      cumplimiento,
      factor,
      bolsa,
      porParte: Math.round(bolsa / REPARTO.partes),
      faltaParaBono: Math.max(0, Math.round(meta * 0.80 - t.venta)),
      faltaParaMeta: Math.max(0, Math.round(meta - t.venta)),
      comisiones: {
        prospeccion: Math.round(t.venta * REPARTO.comision.prospeccion),
        cierre: Math.round(t.venta * REPARTO.comision.cierre),
        direccion: Math.round(t.venta * REPARTO.comision.direccion),
      },
      cobra: fechaDeCobro(periodo),
      uid: user?.uid || null,
    }
  }, [ventas, meta, cargando, error, periodo, user])
}

export { getCurrentQuarter, getCurrentYear }
