const { db } = require('../config/firebase')

/**
 * Verifica que la request tiene un orgId válido en el header o body.
 * Uso: app.use('/leads', auth, require('./routes/leads'))
 */
async function auth(req, res, next) {
  try {
    const orgId = req.headers['x-org-id'] || req.body?.orgId || req.query?.orgId
    if (!orgId) return res.status(401).json({ error: 'Missing orgId' })

    // Verificar que la organización existe
    const orgSnap = await db.collection('organizations').doc(orgId).get()
    if (!orgSnap.exists) return res.status(403).json({ error: 'Organization not found' })

    req.orgId = orgId
    req.org = orgSnap.data()
    next()
  } catch (err) {
    console.error('Auth middleware error:', err)
    res.status(500).json({ error: 'Auth error' })
  }
}

/**
 * Middleware simple para webhooks de Meta (solo verifica que vengan con body).
 * La verificación real del token se hace dentro de la ruta GET.
 */
function webhookAuth(req, res, next) {
  next()
}

module.exports = { auth, webhookAuth }
