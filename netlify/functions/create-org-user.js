const admin = require('firebase-admin')

// ── Email helper ──────────────────────────────────────────────────────────
async function sendEmail(type, to, data) {
  try {
    const baseUrl = process.env.URL || 'https://app.flowhubcrm.app'
    const res = await fetch(`${baseUrl}/.netlify/functions/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, to, data }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[send-email] error:', err)
    }
  } catch (e) {
    console.error('[send-email] fetch failed:', e.message)
  }
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

const db = admin.firestore()

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { email, password, nombre, apellido, orgData, existingOrgId, memberMode, memberData } = JSON.parse(event.body)

    if (!email || !password) {
      return { statusCode: 400, body: JSON.stringify({ error: 'email y password son requeridos' }) }
    }
    if (!memberMode && !existingOrgId && !orgData) {
      return { statusCode: 400, body: JSON.stringify({ error: 'orgData o existingOrgId son requeridos' }) }
    }

    // 1. Create (or fetch) user in Firebase Auth using Admin SDK (does NOT sign in)
    let uid
    try {
      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: [nombre, apellido].filter(Boolean).join(' ') || email.split('@')[0],
      })
      uid = userRecord.uid
    } catch (e) {
      if (e.code === 'auth/email-already-exists') {
        // User already exists in Auth — fetch their UID and update password
        const existing = await admin.auth().getUserByEmail(email)
        uid = existing.uid
        await admin.auth().updateUser(uid, { password })
      } else {
        throw e
      }
    }

    let orgId

    if (memberMode) {
      // ── MEMBER MODE: add an internal team member to an existing org ──
      orgId = memberData.orgId
      if (!orgId) return { statusCode: 400, body: JSON.stringify({ error: 'orgId requerido en memberData' }) }

      // Create global users doc
      await db.collection('users').doc(uid).set({
        email,
        nombre: memberData.nombre || nombre || '',
        apellido: memberData.apellido || apellido || '',
        orgId,
        role: memberData.role || 'seller',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      // Create member doc with the Auth UID as the document ID
      await db.collection('organizations').doc(orgId).collection('members').doc(uid).set({
        name: memberData.name || [nombre, apellido].filter(Boolean).join(' ') || email.split('@')[0],
        email,
        role: memberData.role || 'seller',
        type: memberData.type || 'ambos',
        parentId: memberData.parentId || null,
        level: memberData.level ?? 1,
        active: true,
        inRoundRobin: memberData.inRoundRobin ?? true,
        inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
        permissions: memberData.permissions || {},
        isInternal: true, // marks as direct-added team member, NOT a distributor
        stats: { activeLeads: 0, closedThisMonth: 0, closedTotal: 0, conversionRate: 0, lastUpdated: null },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      // Enviar correo de bienvenida al nuevo miembro
      const orgSnap = await db.collection('organizations').doc(orgId).get()
      const orgName = orgSnap.exists ? (orgSnap.data().name || 'tu organización') : 'tu organización'
      await sendEmail('welcome_member', email, {
        nombre: memberData.nombre || nombre || email.split('@')[0],
        orgName,
        email,
        password: memberData.initialPassword || '(La contraseña fue configurada por tu administrador)',
        role: memberData.role || 'seller',
      })

    } else if (existingOrgId) {
      // ── REPAIR MODE: org already exists, just wire up the Auth user ──
      orgId = existingOrgId

      // Read the org to get latest data
      const orgSnap = await db.collection('organizations').doc(orgId).get()
      if (!orgSnap.exists) {
        return { statusCode: 404, body: JSON.stringify({ error: 'Organización no encontrada' }) }
      }
      const orgDoc = orgSnap.data()

      // Update org with ownerId
      await db.collection('organizations').doc(orgId).update({
        ownerId: uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      // Create/overwrite global user document
      await db.collection('users').doc(uid).set({
        email,
        nombre: orgDoc.ownerNombre || nombre || '',
        apellido: orgDoc.ownerApellido || apellido || '',
        orgId,
        role: 'admin',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      // Create/overwrite member document
      await db.collection('organizations').doc(orgId).collection('members').doc(uid).set({
        name: [orgDoc.ownerNombre, orgDoc.ownerApellido].filter(Boolean).join(' ') || email.split('@')[0],
        email,
        role: 'admin',
        type: 'ambos',
        parentId: null,
        level: 0,
        active: true,
        inRoundRobin: false,
        inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
        permissions: Object.fromEntries([
          'can_see_all_leads', 'can_reassign_leads', 'can_edit_pipeline', 'can_discard_any_lead',
          'can_manage_products', 'can_see_team_reports', 'can_invite_members', 'can_configure_agent',
          'can_see_full_genealogy', 'can_manage_team', 'can_see_team_agenda', 'can_edit_any_lead',
        ].map(k => [k, true])),
        stats: { activeLeads: 0, closedThisMonth: 0, closedTotal: 0, conversionRate: 0, lastUpdated: null },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })

    } else {
      // ── CREATE MODE: new org ──
      const orgRef = db.collection('organizations').doc()
      await orgRef.set({
        ...orgData,
        ownerId: uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      orgId = orgRef.id

      await db.collection('users').doc(uid).set({
        email,
        nombre: nombre || '',
        apellido: apellido || '',
        orgId,
        role: 'admin',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      await db.collection('organizations').doc(orgId).collection('members').doc(uid).set({
        name: [nombre, apellido].filter(Boolean).join(' ') || email.split('@')[0],
        email,
        role: 'admin',
        type: 'ambos',
        parentId: null,
        level: 0,
        active: true,
        inRoundRobin: false,
        inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
        permissions: Object.fromEntries([
          'can_see_all_leads', 'can_reassign_leads', 'can_edit_pipeline', 'can_discard_any_lead',
          'can_manage_products', 'can_see_team_reports', 'can_invite_members', 'can_configure_agent',
          'can_see_full_genealogy', 'can_manage_team', 'can_see_team_agenda', 'can_edit_any_lead',
        ].map(k => [k, true])),
        stats: { activeLeads: 0, closedThisMonth: 0, closedTotal: 0, conversionRate: 0, lastUpdated: null },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      // Enviar correo de bienvenida al admin de la nueva org
      await sendEmail('welcome_org', email, {
        nombre: nombre || email.split('@')[0],
        orgName: orgData.name || 'tu organización',
        email,
        password,
      })
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ uid, orgId }),
    }
  } catch (e) {
    console.error('create-org-user error:', e)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message }),
    }
  }
}
