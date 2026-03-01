// ─────────────────────────────────────────────
// LANDING PAGE TEMPLATES — Full conversion pages
// ─────────────────────────────────────────────

export const FORM_FIELDS = [
  { value: 'name',    label: 'Nombre completo',    required: true },
  { value: 'email',   label: 'Correo electrónico', required: true },
  { value: 'phone',   label: 'Teléfono / WhatsApp', required: false },
  { value: 'company', label: 'Empresa',             required: false },
  { value: 'message', label: 'Mensaje',             required: false },
]

export const TEMPLATES = [
  {
    id: 'obsidian',
    name: 'Obsidian',
    category: 'Consultoría premium',
    type: 'service',
    thumbnail: '⬛',
    description: 'Oscuro, elegante, alto valor percibido',
    defaults: {
      logoText: 'TU MARCA',
      badgeText: 'Solo 3 lugares disponibles',
      headline: 'Consultoría estratégica para líderes que quieren resultados reales',
      subheadline: 'No vendemos horas. Vendemos transformación. Trabajamos con directores y CEOs que están listos para el siguiente nivel.',
      ctaText: 'Solicitar consulta privada',
      formFields: ['name', 'email', 'company'],
      accentColor: '#c9a84c',
      bgColor: '#0c0c0e',
      textColor: '#f0ede8',
      benefits: [
        { icon: '◈', title: 'Diagnóstico en 72h', desc: 'Identificamos exactamente dónde está el dinero que estás dejando en la mesa' },
        { icon: '◈', title: 'Estrategia a medida', desc: 'Sin templates. Sin fórmulas genéricas. Solo lo que funciona para tu negocio específico' },
        { icon: '◈', title: 'Ejecución con garantía', desc: 'Nos mantenemos hasta ver los resultados. No desaparecemos después de la consulta' },
      ],
      testimonials: [
        { name: 'Carlos M.', role: 'CEO, Grupo Vertex', text: 'En 90 días triplicamos nuestro ticket promedio. Lo que parecía imposible ahora es nuestro nuevo estándar.' },
        { name: 'Ana R.', role: 'Directora Comercial', text: 'Por primera vez en 10 años tengo claridad total sobre hacia dónde va la empresa.' },
      ],
      guarantee: 'Si en la primera sesión no identificamos al menos 3 oportunidades de crecimiento concretas, te devolvemos tu inversión.',
    }
  },
  {
    id: 'solar',
    name: 'Solar',
    category: 'Agencia digital',
    type: 'service',
    thumbnail: '🟡',
    description: 'Energético, moderno, para agencias digitales',
    defaults: {
      logoText: 'TU AGENCIA',
      badgeText: '🚀 Resultados desde el mes 1',
      headline: 'Más clientes. Más rápido. Sin adivinar.',
      subheadline: 'Diseñamos y ejecutamos tu sistema completo de captación digital. Tú te enfocas en tu negocio. Nosotros en hacer que crezca.',
      ctaText: 'Quiero más clientes →',
      formFields: ['name', 'email', 'phone'],
      accentColor: '#f5c518',
      bgColor: '#0f0f0f',
      textColor: '#ffffff',
      benefits: [
        { icon: '01', title: 'Auditoría gratuita', desc: 'Analizamos tu presencia digital y te decimos exactamente qué está fallando' },
        { icon: '02', title: 'Sistema de captación', desc: 'Ads + landing + automatización. El sistema completo que convierte extraños en clientes' },
        { icon: '03', title: 'Optimización continua', desc: 'Cada semana mejoramos. Cada mes más resultados. Sin excusas.' },
      ],
      testimonials: [
        { name: 'Miguel T.', role: 'Dueño, Clínica Dental', text: 'Pasé de 5 a 40 consultas mensuales en 60 días. No lo creía posible.' },
        { name: 'Laura F.', role: 'Fundadora, Estudio Pilates', text: 'Llenamos el estudio en el primer mes. Ahora tenemos lista de espera.' },
      ],
      guarantee: 'Si no ves mejora en 60 días, seguimos trabajando gratis hasta que los veas.',
    }
  },
  {
    id: 'ivory',
    name: 'Ivory',
    category: 'Coaching & Personal Brand',
    type: 'service',
    thumbnail: '⬜',
    description: 'Limpio, humano, para coaches y mentores',
    defaults: {
      logoText: 'TU NOMBRE',
      badgeText: 'Sesión estratégica gratuita',
      headline: 'Diseña la vida y el negocio que realmente quieres',
      subheadline: 'Trabajé con +200 emprendedores para pasar del caos a la claridad. Este puede ser tu primer paso.',
      ctaText: 'Reservar mi sesión gratuita',
      formFields: ['name', 'email', 'phone'],
      accentColor: '#1a1a1a',
      bgColor: '#fafaf8',
      textColor: '#1a1a1a',
      benefits: [
        { icon: '→', title: 'Claridad en 60 minutos', desc: 'Saldrás de la sesión con el mapa exacto de tus próximos pasos' },
        { icon: '→', title: 'Sin juicios, sin ventas', desc: 'Una conversación honesta sobre dónde estás y a dónde quieres ir' },
        { icon: '→', title: 'Actionable, no teórico', desc: 'Todo lo que hablo es aplicable desde mañana. Nada de filosofía vacía' },
      ],
      testimonials: [
        { name: 'Sofía L.', role: 'Emprendedora', text: 'Llevaba 2 años dando vueltas. En una sesión encontré la dirección que necesitaba.' },
        { name: 'Roberto P.', role: 'Consultor independiente', text: 'Dupliqué mis tarifas con confianza después de trabajar mi posicionamiento.' },
      ],
      guarantee: 'Si la sesión no te genera al menos una perspectiva nueva que valga tu tiempo, no te pido nada a cambio.',
    }
  },
  {
    id: 'crimson',
    name: 'Crimson',
    category: 'Oferta con urgencia',
    type: 'service',
    thumbnail: '🔴',
    description: 'Alta urgencia, deadline, máxima conversión',
    defaults: {
      logoText: 'TU MARCA',
      badgeText: '⏳ Cierra en 48 horas',
      headline: 'Última oportunidad: accede a nuestra mentoría antes de que cierre',
      subheadline: 'Solo 8 lugares. Precio especial solo hasta el viernes. Después vuelve al precio regular o cerramos para siempre.',
      ctaText: 'Quiero mi lugar ahora',
      formFields: ['name', 'email', 'phone'],
      accentColor: '#dc2626',
      bgColor: '#fff7f7',
      textColor: '#1a0a0a',
      benefits: [
        { icon: '✓', title: '8 semanas de mentoría', desc: 'Sesiones grupales en vivo + acceso a comunidad privada de por vida' },
        { icon: '✓', title: 'Templates y herramientas', desc: 'Todo el arsenal que usamos con clientes de pago, tuyo desde el día 1' },
        { icon: '✓', title: 'Garantía total', desc: 'Si en 30 días no ves valor, te devolvemos el 100%. Sin preguntas.' },
      ],
      testimonials: [
        { name: 'Diego A.', role: 'Participante edición anterior', text: 'El mejor dinero que he invertido en mi negocio. ROI desde la semana 2.' },
        { name: 'Valeria M.', role: 'Participante edición anterior', text: 'Cerré mi primer cliente de $5K durante el programa. Esto funciona.' },
      ],
      guarantee: '30 días de garantía total. Si no ves resultados, te devolvemos cada peso. Sin preguntas ni letras pequeñas.',
    }
  },
  {
    id: 'atlas',
    name: 'Atlas',
    category: 'B2B / Servicios empresariales',
    type: 'service',
    thumbnail: '🔷',
    description: 'Profesional, corporativo, para B2B y empresas',
    defaults: {
      logoText: 'TU EMPRESA',
      badgeText: 'Más de 50 empresas confían en nosotros',
      headline: 'Optimizamos las operaciones de empresas que quieren escalar sin caos',
      subheadline: 'Implementamos sistemas de gestión, automatización y estrategia comercial para empresas medianas que crecen más rápido de lo que sus procesos pueden sostener.',
      ctaText: 'Solicitar diagnóstico empresarial',
      formFields: ['name', 'company', 'email', 'phone'],
      accentColor: '#1e40af',
      bgColor: '#f8faff',
      textColor: '#0f172a',
      benefits: [
        { icon: '01', title: 'Diagnóstico en 5 días', desc: 'Mapeamos todos tus procesos y encontramos los cuellos de botella que te cuestan dinero' },
        { icon: '02', title: 'Implementación guiada', desc: 'No solo recomendamos. Nos quedamos hasta que los sistemas están funcionando' },
        { icon: '03', title: 'Equipo dedicado', desc: 'Un consultor senior y su equipo asignados exclusivamente a tu empresa' },
      ],
      testimonials: [
        { name: 'Ing. Ricardo V.', role: 'Director General, Constructora Vega', text: 'Redujimos costos operativos 32% en el primer trimestre de implementación.' },
        { name: 'Lic. Patricia N.', role: 'CFO, Grupo Comercial Norte', text: 'Por primera vez tenemos visibilidad total de las operaciones en tiempo real.' },
      ],
      guarantee: 'Compromiso de entrega: si no cumplimos los hitos acordados, continuamos sin costo adicional.',
    }
  },
  {
    id: 'sage',
    name: 'Sage',
    category: 'Salud & Bienestar',
    type: 'service',
    thumbnail: '🌿',
    description: 'Orgánico, tranquilo, para wellness y salud',
    defaults: {
      logoText: 'TU MARCA',
      badgeText: '🌿 Primeras 10 plazas con descuento',
      headline: 'Recupera tu energía, tu peso y tu bienestar en 90 días',
      subheadline: 'Un programa personalizado que trabaja con tu cuerpo, no en tu contra. Sin dietas imposibles. Sin rutinas que no puedes mantener.',
      ctaText: 'Quiero empezar mi transformación',
      formFields: ['name', 'email', 'phone'],
      accentColor: '#2d6a4f',
      bgColor: '#f0f7f4',
      textColor: '#1b2d24',
      benefits: [
        { icon: '🌱', title: 'Plan 100% personalizado', desc: 'Tu genética, tu estilo de vida, tus gustos. Un plan que puedes mantener para siempre' },
        { icon: '🌱', title: 'Soporte continuo', desc: 'WhatsApp directo. No estás solo en ningún momento del proceso' },
        { icon: '🌱', title: 'Resultados sostenibles', desc: 'No rebotes. Aprendemos a cambiar hábitos, no a seguir dietas temporales' },
      ],
      testimonials: [
        { name: 'Gabriela S.', role: 'Mamá de 3 hijos', text: 'Bajé 18kg en 4 meses y lo más importante: no los volví a subir. Cambió mi vida.' },
        { name: 'Fernando R.', role: 'Ejecutivo de 45 años', text: 'Tenía 0 energía. Hoy corro 5km sin problema. No puedo creer el cambio.' },
      ],
      guarantee: 'Si sigues el programa y no ves resultados en 60 días, te devuelvo el 100% de tu inversión.',
    }
  },
  {
    id: 'chrome',
    name: 'Chrome',
    category: 'Producto SaaS / Tech',
    type: 'product',
    thumbnail: '⚡',
    description: 'Moderno, técnico, para software y apps',
    defaults: {
      logoText: 'TU PRODUCTO',
      badgeText: '⚡ Beta gratuita disponible',
      headline: 'El software que hace en 10 minutos lo que antes te tomaba un día',
      subheadline: 'Automatiza tus tareas repetitivas, centraliza tu información y toma decisiones con datos reales. Todo desde un solo lugar.',
      ctaText: 'Empezar gratis — sin tarjeta',
      formFields: ['name', 'email'],
      accentColor: '#6366f1',
      bgColor: '#020617',
      textColor: '#f8fafc',
      benefits: [
        { icon: '⚡', title: 'Setup en 5 minutos', desc: 'Sin instalación. Sin IT. Sin configuraciones complicadas. Solo entra y empieza.' },
        { icon: '⚡', title: 'Integraciones nativas', desc: 'Se conecta con las herramientas que ya usas. Nada que aprender de cero.' },
        { icon: '⚡', title: 'IA que trabaja por ti', desc: 'El sistema aprende de tus datos y te sugiere las mejores acciones automáticamente.' },
      ],
      testimonials: [
        { name: 'Jimena O.', role: 'Ops Manager, Startup Series A', text: 'Eliminamos 15 horas semanales de trabajo manual en el primer mes.' },
        { name: 'Samuel K.', role: 'Founder, E-commerce', text: 'Mis ventas subieron 40% porque ahora puedo enfocarme en lo que importa.' },
      ],
      guarantee: '14 días de prueba gratuita. Sin tarjeta de crédito. Cancela cuando quieras.',
    }
  },
  {
    id: 'market',
    name: 'Market',
    category: 'Producto físico / E-commerce',
    type: 'product',
    thumbnail: '🛍️',
    description: 'Visual, comercial, para productos físicos',
    defaults: {
      logoText: 'TU MARCA',
      badgeText: '🔥 Agotándose rápido',
      headline: 'El producto que miles ya están usando para transformar su rutina diaria',
      subheadline: 'Diseñado para durar. Probado por expertos. Amado por quienes lo usan. Descubre por qué se está convirtiendo en el favorito del mercado.',
      ctaText: 'Quiero el mío ahora →',
      formFields: ['name', 'email', 'phone'],
      accentColor: '#ea580c',
      bgColor: '#ffffff',
      textColor: '#0c0a09',
      benefits: [
        { icon: '★', title: 'Calidad premium', desc: 'Materiales de primera selección. Construido para durar años, no meses.' },
        { icon: '★', title: 'Garantía de satisfacción', desc: '30 días para probarlo. Si no te encanta, te devolvemos tu dinero completo.' },
        { icon: '★', title: 'Envío express', desc: 'Recíbelo en 2-3 días hábiles con seguimiento en tiempo real.' },
      ],
      testimonials: [
        { name: 'María J. ⭐⭐⭐⭐⭐', role: 'Compradora verificada', text: 'Superó mis expectativas completamente. Ya pedí uno para regalar.' },
        { name: 'Luis P. ⭐⭐⭐⭐⭐', role: 'Comprador verificado', text: 'La calidad es impresionante para el precio. Llegó antes de lo esperado.' },
      ],
      guarantee: '30 días de garantía total. No te gusta, te devolvemos el 100%. Sin formularios, sin complicaciones.',
    }
  },
  {
    id: 'summit',
    name: 'Summit',
    category: 'Evento presencial',
    type: 'event',
    thumbnail: '🎪',
    description: 'Impactante, para eventos, workshops y masterclasses',
    defaults: {
      logoText: 'TU EVENTO',
      badgeText: '📍 Ciudad de México — 15 de Abril',
      headline: 'El evento que cambia la trayectoria de tu negocio en un fin de semana',
      subheadline: '2 días intensivos. 8 speakers de élite. 200 emprendedores y directivos. Las conversaciones y conexiones que necesitas para tu próximo gran salto.',
      ctaText: 'Reservar mi lugar ahora',
      formFields: ['name', 'email', 'phone', 'company'],
      accentColor: '#7c3aed',
      bgColor: '#0d0d1a',
      textColor: '#ffffff',
      benefits: [
        { icon: '🎯', title: '8 speakers confirmados', desc: 'Los mejores exponentes de negocios, marketing y liderazgo de Latinoamérica' },
        { icon: '🎯', title: 'Networking curado', desc: 'No es un evento masivo. Seleccionamos a los asistentes para garantizar conexiones de calidad' },
        { icon: '🎯', title: 'Materiales incluidos', desc: 'Todo el contenido grabado, plantillas y acceso a la comunidad privada post-evento' },
      ],
      testimonials: [
        { name: 'Andrés M.', role: 'Asistente edición 2024', text: 'Cerré una alianza de $200K con alguien que conocí en el networking del primer día.' },
        { name: 'Patricia V.', role: 'Asistente edición 2024', text: 'El mejor ROI de cualquier inversión en educación que he hecho en mi vida.' },
      ],
      guarantee: 'Si en el almuerzo del primer día no estás satisfecho, te devolvemos el costo completo del boleto.',
    }
  },
  {
    id: 'pulse',
    name: 'Pulse',
    category: 'Webinar / Evento online',
    type: 'event',
    thumbnail: '🎙️',
    description: 'Dinámico, para webinars y masterclasses online',
    defaults: {
      logoText: 'TU NOMBRE',
      badgeText: '🎙️ Masterclass GRATIS — Jueves 8pm',
      headline: 'Aprende en 90 minutos lo que a mí me tomó 5 años descubrir',
      subheadline: 'Una clase magistral en vivo donde te revelo el sistema exacto que uso con mis clientes para generar resultados en 30 días o menos.',
      ctaText: 'Registrarme gratis →',
      formFields: ['name', 'email'],
      accentColor: '#06b6d4',
      bgColor: '#0a0f1e',
      textColor: '#f0f9ff',
      benefits: [
        { icon: '▶', title: 'En vivo e interactivo', desc: 'Puedes preguntar en tiempo real. No es una grabación pregrabada.' },
        { icon: '▶', title: 'Contenido exclusivo', desc: 'Material que no está en ningún curso, YouTube ni redes sociales.' },
        { icon: '▶', title: 'Grabación disponible 48h', desc: 'Si no puedes en vivo, recibes el acceso por 48 horas después del evento.' },
      ],
      testimonials: [
        { name: 'Camila R.', role: 'Asistente a la última edición', text: 'Implementé una sola cosa de la masterclass y en una semana ya vi resultados.' },
        { name: 'Jorge H.', role: 'Asistente a la última edición', text: 'Mejor que cursos que he pagado miles de pesos. Y fue gratis. Increíble.' },
      ],
      guarantee: 'Completamente gratuito. Sin tarjeta. Sin trampa. Solo regístrate y aparece el jueves.',
    }
  },
]

// ── RENDER FULL HTML PAGE ──
export function renderLandingHTML(config) {
  const {
    logoText = 'Tu Marca',
    badgeText = '',
    headline = '',
    subheadline = '',
    ctaText = 'Contáctanos',
    formFields = ['name', 'email'],
    accentColor = '#0066ff',
    bgColor = '#ffffff',
    textColor = '#0a0a0a',
    benefits = [],
    testimonials = [],
    guarantee = '',
    orgId = '',
    pageId = '',
  } = config

  const isDark = isColorDark(bgColor)
  const mutedColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)'
  const cardBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const inputBorder = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'

  const formFieldsHTML = formFields.map(field => {
    const f = FORM_FIELDS.find(x => x.value === field)
    if (!f) return ''
    if (field === 'message') {
      return `<textarea name="${field}" placeholder="${f.label}" rows="3" style="width:100%;padding:14px 16px;border-radius:10px;border:1px solid ${inputBorder};background:${inputBg};color:${textColor};font-size:14px;font-family:inherit;resize:none;outline:none;box-sizing:border-box;"></textarea>`
    }
    return `<input type="${field === 'email' ? 'email' : 'text'}" name="${field}" placeholder="${f.label}" ${f.required ? 'required' : ''} style="width:100%;padding:14px 16px;border-radius:10px;border:1px solid ${inputBorder};background:${inputBg};color:${textColor};font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;">`
  }).join('')

  const benefitsHTML = benefits.map(b => `
    <div style="display:flex;gap:16px;align-items:flex-start;">
      <div style="width:40px;height:40px;border-radius:10px;background:${accentColor}18;border:1px solid ${accentColor}30;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;color:${accentColor};font-weight:700;">${b.icon}</div>
      <div>
        <div style="font-weight:700;font-size:15px;margin-bottom:4px;color:${textColor};">${b.title}</div>
        <div style="font-size:13.5px;line-height:1.6;color:${mutedColor};">${b.desc}</div>
      </div>
    </div>
  `).join('')

  const testimonialsHTML = testimonials.map(t => `
    <div style="background:${cardBg};border:1px solid ${cardBorder};border-radius:14px;padding:24px;">
      <div style="font-size:22px;color:${accentColor};margin-bottom:12px;">❝</div>
      <p style="font-size:14px;line-height:1.7;color:${textColor};margin:0 0 16px;">${t.text}</p>
      <div style="font-weight:700;font-size:13px;color:${textColor};">${t.name}</div>
      <div style="font-size:12px;color:${mutedColor};">${t.role}</div>
    </div>
  `).join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headline}</title>
  <link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&display=swap" rel="stylesheet">
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Sora',system-ui,sans-serif;background:${bgColor};color:${textColor};line-height:1.6;-webkit-font-smoothing:antialiased;}
    ::placeholder{color:${mutedColor};}
    input:focus,textarea:focus{outline:2px solid ${accentColor};outline-offset:0;}
    @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
    .fu{animation:fadeUp 0.6s ease both}
    .fu2{animation:fadeUp 0.6s 0.15s ease both}
    .fu3{animation:fadeUp 0.6s 0.3s ease both}
    .btn:hover{opacity:0.88;transform:translateY(-1px)}
    .btn{transition:all 0.2s ease;cursor:pointer;}
    @media(max-width:640px){.hg{flex-direction:column!important}.bg{grid-template-columns:1fr!important}.tg{grid-template-columns:1fr!important}}
  </style>
</head>
<body>
  <nav style="padding:20px 32px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid ${cardBorder};position:sticky;top:0;background:${bgColor};z-index:100;">
    <div style="font-weight:800;font-size:17px;letter-spacing:-0.5px;">${logoText}</div>
    ${badgeText ? `<div style="font-size:12px;font-weight:700;background:${accentColor}18;color:${accentColor};border:1px solid ${accentColor}30;padding:6px 14px;border-radius:100px;">${badgeText}</div>` : ''}
    <a href="#form" class="btn" style="background:${accentColor};color:white;font-weight:700;font-size:13px;padding:10px 20px;border-radius:8px;text-decoration:none;">${ctaText}</a>
  </nav>

  <section style="max-width:1100px;margin:0 auto;padding:80px 32px 60px;" class="fu">
    <div class="hg" style="display:flex;gap:64px;align-items:center;">
      <div style="flex:1.2;">
        <h1 style="font-size:clamp(32px,4vw,52px);font-weight:800;line-height:1.1;letter-spacing:-1.5px;margin-bottom:20px;">${headline}</h1>
        <p style="font-size:17px;line-height:1.7;color:${mutedColor};margin-bottom:32px;">${subheadline}</p>
        <a href="#form" class="btn" style="display:inline-flex;align-items:center;gap:8px;background:${accentColor};color:white;font-weight:700;font-size:15px;padding:16px 32px;border-radius:12px;text-decoration:none;">${ctaText} <span>→</span></a>
        <p style="margin-top:14px;font-size:12px;color:${mutedColor};">Sin compromiso. Sin spam. Tu información está segura.</p>
      </div>
      <div id="form" style="flex:0.8;background:${cardBg};border:1px solid ${cardBorder};border-radius:20px;padding:36px;">
        <h3 style="font-weight:700;font-size:18px;margin-bottom:6px;">${ctaText}</h3>
        <p style="font-size:13px;color:${mutedColor};margin-bottom:24px;">Completa el formulario y nos ponemos en contacto pronto.</p>
        <form id="leadForm" style="display:flex;flex-direction:column;gap:12px;">
          ${formFieldsHTML}
          <button type="submit" class="btn" style="width:100%;padding:16px;background:${accentColor};color:white;font-weight:700;font-size:15px;border:none;border-radius:10px;margin-top:4px;">${ctaText}</button>
          <p style="text-align:center;font-size:11px;color:${mutedColor};">🔒 Tus datos están seguros. No spam, nunca.</p>
        </form>
        <div id="successMsg" style="display:none;text-align:center;padding:24px;">
          <div style="font-size:40px;margin-bottom:12px;">🎉</div>
          <div style="font-weight:700;font-size:18px;margin-bottom:8px;">¡Listo! Te contactamos pronto.</div>
          <div style="font-size:14px;color:${mutedColor};">Revisa tu correo en los próximos minutos.</div>
        </div>
      </div>
    </div>
  </section>

  ${benefits.length > 0 ? `
  <section style="background:${cardBg};border-top:1px solid ${cardBorder};border-bottom:1px solid ${cardBorder};padding:72px 32px;" class="fu2">
    <div style="max-width:900px;margin:0 auto;">
      <div style="text-align:center;margin-bottom:48px;">
        <div style="font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:${accentColor};margin-bottom:12px;">Por qué elegirnos</div>
        <h2 style="font-size:clamp(24px,3vw,36px);font-weight:800;letter-spacing:-0.5px;">Lo que incluye trabajar con nosotros</h2>
      </div>
      <div class="bg" style="display:grid;grid-template-columns:repeat(${Math.min(benefits.length, 3)},1fr);gap:32px;">${benefitsHTML}</div>
    </div>
  </section>` : ''}

  ${testimonials.length > 0 ? `
  <section style="padding:72px 32px;" class="fu3">
    <div style="max-width:900px;margin:0 auto;">
      <div style="text-align:center;margin-bottom:48px;">
        <div style="font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:${accentColor};margin-bottom:12px;">Lo que dicen nuestros clientes</div>
        <h2 style="font-size:clamp(24px,3vw,36px);font-weight:800;letter-spacing:-0.5px;">Resultados reales de personas reales</h2>
      </div>
      <div class="tg" style="display:grid;grid-template-columns:repeat(${Math.min(testimonials.length, 2)},1fr);gap:24px;">${testimonialsHTML}</div>
    </div>
  </section>` : ''}

  ${guarantee ? `
  <section style="padding:0 32px 72px;">
    <div style="max-width:700px;margin:0 auto;background:${accentColor}0d;border:2px solid ${accentColor}30;border-radius:20px;padding:40px;text-align:center;">
      <div style="font-size:40px;margin-bottom:16px;">🛡️</div>
      <h3 style="font-weight:800;font-size:20px;margin-bottom:12px;">Nuestra garantía</h3>
      <p style="font-size:15px;line-height:1.7;color:${mutedColor};">${guarantee}</p>
    </div>
  </section>` : ''}

  <section style="background:${accentColor};padding:80px 32px;text-align:center;">
    <div style="max-width:600px;margin:0 auto;">
      <h2 style="font-size:clamp(28px,4vw,42px);font-weight:800;color:white;letter-spacing:-1px;margin-bottom:16px;">¿Listo para empezar?</h2>
      <p style="font-size:16px;color:rgba(255,255,255,0.8);margin-bottom:32px;">No lo dejes para mañana. El mejor momento es ahora.</p>
      <a href="#form" class="btn" style="display:inline-flex;align-items:center;gap:8px;background:white;color:${accentColor};font-weight:800;font-size:15px;padding:18px 40px;border-radius:12px;text-decoration:none;">${ctaText} →</a>
    </div>
  </section>

  <footer style="padding:24px 32px;text-align:center;border-top:1px solid ${cardBorder};">
    <p style="font-size:12px;color:${mutedColor};">${logoText} · Todos los derechos reservados</p>
  </footer>

  <script>
    document.getElementById('leadForm')?.addEventListener('submit',async function(e){
      e.preventDefault();
      const btn=this.querySelector('button[type="submit"]');
      btn.textContent='Enviando...';btn.disabled=true;
      const formData={};
      new FormData(this).forEach((v,k)=>{formData[k]=v;});
      try{
        const res=await fetch('/.netlify/functions/submit-lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orgId:'${orgId}',pageId:'${pageId}',formData,source:'web'})});
        if(res.ok){document.getElementById('leadForm').style.display='none';document.getElementById('successMsg').style.display='block';}
        else throw new Error();
      }catch(err){btn.textContent='${ctaText}';btn.disabled=false;alert('Ocurrió un error. Por favor intenta de nuevo.');}
    });
  </script>
</body>
</html>`
}

function isColorDark(hex) {
  const h = hex.replace('#','')
  const r=parseInt(h.substr(0,2),16),g=parseInt(h.substr(2,2),16),b=parseInt(h.substr(4,2),16)
  return (r*299+g*587+b*114)/1000 < 128
}
