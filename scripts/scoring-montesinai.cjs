/**
 * Carga el scoring de Monte Sinai Centro de Visión.
 *
 *   Listar pipelines y ver el scoring actual:
 *     node scripts/scoring-montesinai.cjs
 *   Escribir (hace backup del actual antes):
 *     node scripts/scoring-montesinai.cjs <pipelineId> --write
 *
 * Las credenciales se leen del entorno; no quedan en el archivo.
 */
const fs = require('fs')
const admin = require('firebase-admin')

const ORG_ID = 'AwGYGP2LnZ9wyFKYg3P9'

// Objetivo del cliente: que el prospecto AGENDE una cita. El score no mide
// cercanía a la compra — mide probabilidad de agendar. El handoff lo dispara
// la cita en sí, no llegar a 100.
const SCORING = [
  {
    id: 'cat_necesidad', label: 'Necesidad', color: '#0066ff', tope: 30,
    desc: '¿Tiene un problema de visión real y urgente?',
    subcategories: [
      {
        id: 'sub_urgencia', label: 'Urgencia clínica', tope: 18,
        signals: [
          { id: 'sig_n1', type: 'up',   weight: 12, text: 'Pérdida de visión súbita o que viene empeorando' },
          { id: 'sig_n2', type: 'up',   weight: 12, text: 'Dolor, trauma ocular o problema posoperatorio' },
          { id: 'sig_n3', type: 'up',   weight: 8,  text: 'Diagnóstico previo sin resolver (catarata, glaucoma, retina)' },
          { id: 'sig_n4', type: 'down', weight: -5, text: 'Solo quiere graduación de lentes' },
        ],
      },
      {
        id: 'sub_impacto', label: 'Impacto en su vida', tope: 12,
        signals: [
          { id: 'sig_n5', type: 'up',   weight: 8,  text: 'Ya le afecta manejar, leer o trabajar' },
          { id: 'sig_n6', type: 'up',   weight: 6,  text: 'Lo plantea como algo que no puede seguir posponiendo' },
          { id: 'sig_n7', type: 'down', weight: -8, text: 'Consulta por un tercero y no puede decidir ni agendar' },
        ],
      },
    ],
  },
  {
    id: 'cat_intencion', label: 'Intención', color: '#b45309', tope: 35,
    desc: '¿Quiere agendar una cita?',
    subcategories: [
      {
        id: 'sub_agenda', label: 'Señales de agenda', tope: 22,
        signals: [
          { id: 'sig_i1', type: 'up', weight: 12, text: 'Pregunta por horarios o disponibilidad' },
          { id: 'sig_i2', type: 'up', weight: 12, text: 'Acepta una fecha o pide la más próxima' },
          { id: 'sig_i3', type: 'up', weight: 8,  text: 'Pide hablar con alguien de la clínica' },
        ],
      },
      {
        id: 'sub_avance', label: 'Señales de avance', tope: 13,
        signals: [
          { id: 'sig_i4', type: 'up',   weight: 10, text: 'Pregunta la dirección o cómo llegar' },
          { id: 'sig_i5', type: 'up',   weight: 8,  text: 'Pregunta el costo de la consulta' },
          { id: 'sig_i6', type: 'down', weight: -8, text: 'Dice que solo está viendo o averiguando' },
          { id: 'sig_i7', type: 'down', weight: -6, text: 'Deja de responder después de preguntar el precio' },
        ],
      },
    ],
  },
  {
    id: 'cat_confianza', label: 'Confianza', color: '#6d28d9', tope: 25,
    desc: '¿Confía en la clínica y en el médico?',
    subcategories: [
      {
        id: 'sub_credibilidad', label: 'Credibilidad médica', tope: 15,
        signals: [
          { id: 'sig_c1', type: 'up', weight: 10, text: 'Menciona que se lo recomendaron' },
          { id: 'sig_c2', type: 'up', weight: 8,  text: 'Pregunta por el médico, su experiencia o especialidad' },
          { id: 'sig_c3', type: 'up', weight: 6,  text: 'Pregunta por resultados, casos o testimonios' },
        ],
      },
      {
        id: 'sub_objeciones', label: 'Objeciones abiertas', tope: 10,
        signals: [
          { id: 'sig_c4', type: 'down', weight: -6, text: 'Expresa miedo al procedimiento y no queda resuelto' },
          { id: 'sig_c5', type: 'down', weight: -5, text: 'Compara con otra clínica y no retoma' },
        ],
      },
    ],
  },
  {
    // Reemplaza a "Capacidad". Para agendar una consulta el dinero casi no
    // discrimina; lo que descalifica de verdad es la logística.
    id: 'cat_viabilidad', label: 'Viabilidad', color: '#15803d', tope: 10,
    desc: '¿Puede efectivamente asistir?',
    subcategories: [
      {
        id: 'sub_logistica', label: 'Logística', tope: 10,
        signals: [
          { id: 'sig_v1', type: 'up',   weight: 5,   text: 'Está en la ciudad o puede trasladarse' },
          { id: 'sig_v2', type: 'up',   weight: 3,   text: 'Tiene seguro o cobertura' },
          { id: 'sig_v3', type: 'up',   weight: 3,   text: 'Tiene disponibilidad en horario de clínica' },
          { id: 'sig_v4', type: 'down', weight: -10, text: 'Está fuera de la zona de atención o del país' },
        ],
      },
    ],
  },
]

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
})
const db = admin.firestore()

;(async () => {
  const [pipelineId, flag] = process.argv.slice(2)
  const orgRef = db.collection('organizations').doc(ORG_ID)

  const org = await orgRef.get()
  if (!org.exists) throw new Error(`No existe la org ${ORG_ID}`)
  console.log('Org:', org.data().name)

  const agentRef = orgRef.collection('settings').doc('agent')
  const current = (await agentRef.get()).data()?.scoring || {}

  if (!pipelineId || flag !== '--write') {
    const ps = await orgRef.collection('pipelines').get()
    console.log('\nPipelines:')
    ps.docs.forEach(d => console.log('  ', d.id, '=', d.data().name || '(sin nombre)'))
    console.log('\nScoring actual:')
    for (const [k, v] of Object.entries(current)) {
      console.log('  ', k, Array.isArray(v)
        ? v.map(c => `${c.label}(${c.tope})`).join(', ')
        : '(formato legacy objeto)')
    }
    if (!Object.keys(current).length) console.log('   (vacío)')
    console.log('\nPara escribir:  node scripts/scoring-montesinai.cjs <pipelineId> --write')
    return
  }

  const backup = `scoring-backup-${ORG_ID}-${Date.now()}.json`
  fs.writeFileSync(backup, JSON.stringify(current, null, 2))
  console.log('Backup del scoring anterior en', backup)

  await agentRef.set({ scoring: { ...current, [pipelineId]: SCORING } }, { merge: true })
  const total = SCORING.reduce((s, c) => s + c.tope, 0)
  console.log(`Escrito en pipeline ${pipelineId}: ${SCORING.length} categorías, tope total ${total}`)
})().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
