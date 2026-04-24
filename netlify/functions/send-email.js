/**
 * send-email.js — Función central de envío de correos via Resend
 *
 * POST body:
 *   type: 'welcome_org' | 'welcome_member' | 'reset_password' | 'distributor_approved' | 'distributor_rejected' | 'custom'
 *   to:   email destino
 *   data: objeto con variables del template
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.EMAIL_FROM || 'atencion@flowhubcrm.app'
const APP_URL = 'https://app.flowhubcrm.app'

// ── Templates ──────────────────────────────────────────────────────────────

function baseLayout(content, preheader = '') {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Flow Hub CRM</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:'Inter',Arial,sans-serif;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>` : ''}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <!-- Header -->
        <tr><td style="background:#070708;border-radius:16px 16px 0 0;padding:28px 36px;text-align:center;">
          <img src="${APP_URL}/flowhub-logo2.png" alt="Flow Hub CRM" height="40" style="max-height:40px;object-fit:contain;" />
        </td></tr>
        <!-- Body -->
        <tr><td style="background:#ffffff;padding:36px 36px 28px;border-left:1px solid rgba(0,0,0,.06);border-right:1px solid rgba(0,0,0,.06);">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f9f9f9;border:1px solid rgba(0,0,0,.06);border-top:none;border-radius:0 0 16px 16px;padding:20px 36px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#8e8e93;line-height:1.6;">
            © ${new Date().getFullYear()} Flow Hub CRM · Qubit Corp.<br/>
            <a href="${APP_URL}" style="color:#0066ff;text-decoration:none;">app.flowhubcrm.app</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function btn(text, url, color = '#0066ff') {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr><td style="background:${color};border-radius:10px;padding:0;">
      <a href="${url}" style="display:inline-block;padding:13px 28px;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;font-family:'Inter',Arial,sans-serif;">${text}</a>
    </td></tr>
  </table>`
}

function heading(text) {
  return `<h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#070708;font-family:'Inter',Arial,sans-serif;letter-spacing:-0.5px;">${text}</h1>`
}

function sub(text) {
  return `<p style="margin:0 0 20px;font-size:15px;color:#3a3a3c;line-height:1.6;">${text}</p>`
}

function divider() {
  return `<hr style="border:none;border-top:1px solid rgba(0,0,0,.07);margin:24px 0;" />`
}

function infoRow(label, value) {
  return `<tr>
    <td style="padding:8px 0;font-size:13px;color:#8e8e93;font-weight:600;width:140px;">${label}</td>
    <td style="padding:8px 0;font-size:13px;color:#070708;font-weight:500;">${value}</td>
  </tr>`
}

// ── Template: Bienvenida nueva organización ─────────────────────────────────
function tplWelcomeOrg({ nombre, orgName, email, password }) {
  const content = `
    ${heading(`¡Bienvenido a Flow Hub CRM, ${nombre}! 🎉`)}
    ${sub(`Tu cuenta para <strong>${orgName}</strong> ha sido creada. Ya puedes comenzar a gestionar tus prospectos, cerrar más ventas y hacer crecer tu negocio.`)}
    ${btn('Acceder a mi cuenta', APP_URL)}
    ${divider()}
    <p style="margin:0 0 12px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#8e8e93;">Tus credenciales de acceso</p>
    <table cellpadding="0" cellspacing="0" width="100%" style="background:#f9f9f9;border:1px solid rgba(0,0,0,.07);border-radius:10px;padding:4px 16px;">
      ${infoRow('Email', email)}
      ${infoRow('Contraseña', `<code style="background:#f0f0f2;padding:2px 8px;border-radius:4px;font-family:monospace;">${password}</code>`)}
    </table>
    <p style="margin:20px 0 0;font-size:13px;color:#8e8e93;line-height:1.6;">
      Te recomendamos cambiar tu contraseña después del primer inicio de sesión.<br/>
      Si tienes dudas escríbenos a <a href="mailto:${FROM_EMAIL}" style="color:#0066ff;">${FROM_EMAIL}</a>.
    </p>
  `
  return {
    subject: `Bienvenido a Flow Hub CRM — ${orgName}`,
    html: baseLayout(content, `Tu cuenta en Flow Hub CRM está lista. Entra y comienza hoy.`),
  }
}

// ── Template: Bienvenida nuevo miembro de equipo ────────────────────────────
function tplWelcomeMember({ nombre, orgName, email, password, role }) {
  const roleLabel = role === 'admin' ? 'Administrador' : role === 'manager' ? 'Manager' : 'Vendedor'
  const content = `
    ${heading(`Hola ${nombre}, fuiste añadido al equipo 👋`)}
    ${sub(`Has sido agregado a <strong>${orgName}</strong> en Flow Hub CRM como <strong>${roleLabel}</strong>. Ya puedes ingresar con tus credenciales.`)}
    ${btn('Ingresar a Flow Hub CRM', APP_URL)}
    ${divider()}
    <p style="margin:0 0 12px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#8e8e93;">Tus datos de acceso</p>
    <table cellpadding="0" cellspacing="0" width="100%" style="background:#f9f9f9;border:1px solid rgba(0,0,0,.07);border-radius:10px;padding:4px 16px;">
      ${infoRow('Email', email)}
      ${infoRow('Contraseña inicial', `<code style="background:#f0f0f2;padding:2px 8px;border-radius:4px;font-family:monospace;">${password}</code>`)}
      ${infoRow('Organización', orgName)}
      ${infoRow('Rol asignado', roleLabel)}
    </table>
    <p style="margin:20px 0 0;font-size:13px;color:#8e8e93;line-height:1.6;">Por seguridad, cambia tu contraseña al ingresar por primera vez.</p>
  `
  return {
    subject: `Fuiste invitado a ${orgName} en Flow Hub CRM`,
    html: baseLayout(content, `Accede ahora a Flow Hub CRM con tus credenciales.`),
  }
}

// ── Template: Reset de contraseña ──────────────────────────────────────────
function tplResetPassword({ nombre, email, newPassword }) {
  const content = `
    ${heading(`Tu contraseña fue restablecida 🔑`)}
    ${sub(`Hola ${nombre || email}, tu contraseña de Flow Hub CRM ha sido actualizada por el equipo de soporte.`)}
    ${btn('Iniciar sesión ahora', APP_URL)}
    ${divider()}
    <table cellpadding="0" cellspacing="0" width="100%" style="background:#f9f9f9;border:1px solid rgba(0,0,0,.07);border-radius:10px;padding:4px 16px;">
      ${infoRow('Email', email)}
      ${infoRow('Nueva contraseña', `<code style="background:#f0f0f2;padding:2px 8px;border-radius:4px;font-family:monospace;">${newPassword}</code>`)}
    </table>
    <p style="margin:20px 0 0;font-size:13px;color:#8e8e93;line-height:1.6;">
      Si no solicitaste este cambio, contáctanos inmediatamente a <a href="mailto:${FROM_EMAIL}" style="color:#0066ff;">${FROM_EMAIL}</a>.
    </p>
  `
  return {
    subject: 'Tu contraseña de Flow Hub CRM fue restablecida',
    html: baseLayout(content, 'Tu contraseña fue actualizada. Ingresa con tus nuevas credenciales.'),
  }
}

// ── Template: Distribuidor aprobado ────────────────────────────────────────
function tplDistributorApproved({ nombre, apellido }) {
  const fullName = [nombre, apellido].filter(Boolean).join(' ')
  const content = `
    ${heading(`¡Felicidades ${nombre}, eres Distribuidor Flow Hub! 🚀`)}
    ${sub(`Tu solicitud ha sido <strong>aprobada</strong>. Ya tienes acceso al Portal de Distribuidores y a todas las herramientas para crecer tu red.`)}
    ${btn('Ir al Portal de Distribuidores', `${APP_URL}/portal-distribuidor`)}
    ${divider()}
    <p style="margin:0 0 16px;font-size:15px;color:#3a3a3c;line-height:1.6;">
      🎯 <strong>¿Qué sigue?</strong><br/>
      Dentro de tu cuenta ya tienes activado el Pipeline de Distribuidores y los productos Flow Hub en tu catálogo.<br/><br/>
      Comparte Flow Hub CRM con tus prospectos y comienza a generar comisiones desde el primer cliente.
    </p>
    <div style="background:rgba(0,102,255,.05);border:1px solid rgba(0,102,255,.15);border-radius:10px;padding:16px 20px;">
      <p style="margin:0;font-size:14px;color:#0066ff;font-weight:600;">
        💬 ¿Dudas? Escríbenos a <a href="mailto:${FROM_EMAIL}" style="color:#0066ff;">${FROM_EMAIL}</a>
      </p>
    </div>
  `
  return {
    subject: '¡Tu solicitud de Distribuidor Flow Hub fue aprobada! 🎉',
    html: baseLayout(content, '¡Bienvenido al equipo de Distribuidores Flow Hub CRM!'),
  }
}

// ── Template: Distribuidor rechazado ───────────────────────────────────────
function tplDistributorRejected({ nombre, apellido, reason }) {
  const content = `
    ${heading(`Actualización sobre tu solicitud de Distribuidor`)}
    ${sub(`Hola ${nombre}, hemos revisado tu solicitud y por el momento no podemos aprobarla.`)}
    ${reason ? `<div style="background:#fff8f0;border:1px solid rgba(255,149,0,.2);border-radius:10px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0;font-size:14px;color:#ff9500;font-weight:600;">Motivo: ${reason}</p>
    </div>` : ''}
    ${sub(`Si crees que hay un error o quieres conocer más detalles, puedes contactarnos y lo revisamos contigo.`)}
    ${btn('Contactar soporte', `mailto:${FROM_EMAIL}`, '#3a3a3c')}
    <p style="margin:20px 0 0;font-size:13px;color:#8e8e93;line-height:1.6;">
      Puedes volver a enviar tu solicitud en cualquier momento desde tu cuenta.
    </p>
  `
  return {
    subject: 'Actualización sobre tu solicitud de Distribuidor Flow Hub',
    html: baseLayout(content, 'Tenemos una actualización sobre tu solicitud de distribuidor.'),
  }
}

// ── Template: Correo personalizado ─────────────────────────────────────────
function tplCustom({ subject: subjectLine, bodyHtml, bodyText }) {
  const content = `
    ${bodyHtml || `<p style="margin:0;font-size:15px;color:#3a3a3c;line-height:1.6;">${bodyText || ''}</p>`}
  `
  return {
    subject: subjectLine || 'Mensaje de Flow Hub CRM',
    html: baseLayout(content),
  }
}

// ── Handler ────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not set')
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Email service not configured' }) }
  }

  try {
    const { type, to, data = {} } = JSON.parse(event.body || '{}')

    if (!to) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'to is required' }) }
    }

    let emailTemplate
    switch (type) {
      case 'welcome_org':        emailTemplate = tplWelcomeOrg(data);          break
      case 'welcome_member':     emailTemplate = tplWelcomeMember(data);       break
      case 'reset_password':     emailTemplate = tplResetPassword(data);       break
      case 'distributor_approved': emailTemplate = tplDistributorApproved(data); break
      case 'distributor_rejected': emailTemplate = tplDistributorRejected(data); break
      case 'custom':             emailTemplate = tplCustom(data);              break
      default:
        return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown email type: ${type}` }) }
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Flow Hub CRM <${FROM_EMAIL}>`,
        to: Array.isArray(to) ? to : [to],
        subject: emailTemplate.subject,
        html: emailTemplate.html,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('Resend error:', result)
      return { statusCode: response.status, headers, body: JSON.stringify({ error: result.message || 'Error sending email' }) }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, id: result.id }),
    }
  } catch (e) {
    console.error('send-email error:', e)
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) }
  }
}
