# FlowCRM

CRM + Agentes IA para agencias y empresas. Construido con React + Vite + Firebase.

---

## Stack

- **Frontend:** React 18 + Vite 5
- **Styling:** Tailwind CSS 3 (design system FlowCRM incluido)
- **Base de datos:** Firebase Firestore (multi-tenant)
- **Auth:** Firebase Authentication (Email/Password)
- **Storage:** Firebase Storage
- **Estado global:** Zustand
- **Routing:** React Router v6
- **Drag & Drop:** dnd-kit (para el kanban)

---

## Requisitos previos

- Node.js 18+ instalado
- Cuenta en Firebase con proyecto `flowcrm-5cf0a` configurado
- Firestore en modo prueba (nam5)

---

## Instalación y arranque

```bash
# 1. Instalar dependencias
npm install

# 2. Correr en desarrollo
npm run dev
```

La app corre en `http://localhost:5173`

---

## Estructura del proyecto

```
flowcrm/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   └── ProtectedRoute.jsx     # Rutas protegidas con auth
│   │   └── layout/
│   │       └── AppLayout.jsx          # Sidebar + topbar principal
│   ├── hooks/
│   │   └── useAuth.js                 # Hook que escucha Firebase Auth
│   ├── lib/
│   │   └── firebase.js                # Configuración Firebase
│   ├── pages/
│   │   ├── Login.jsx                  # Login con email/password
│   │   ├── Register.jsx               # Registro de org + usuario admin
│   │   ├── Pipeline.jsx               # Pipeline (kanban viene después)
│   │   ├── Superadmin.jsx             # Panel global de todas las orgs
│   │   └── Placeholders.jsx           # Módulos en construcción
│   ├── store/
│   │   └── authStore.js               # Estado global con Zustand
│   ├── styles/
│   │   └── globals.css                # Design system + Tailwind
│   ├── App.jsx                        # Router principal
│   └── main.jsx                       # Entry point
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

---

## Estructura de datos en Firestore

```
/organizations/{orgId}
  - name: string
  - plan: "starter" | "pro" | "distributor"
  - ownerId: string (uid del usuario que creó la org)
  - referralCode: string
  - referredBy: string | null
  - membersCount: number
  - leadsCount: number
  - createdAt: timestamp

/users/{userId}
  - name: string
  - email: string
  - orgId: string (referencia a su organización)
  - role: "admin" | "seller" | "viewer" | "superadmin"
  - createdAt: timestamp

/organizations/{orgId}/leads/{leadId}     ← próximo módulo
/organizations/{orgId}/deals/{dealId}     ← próximo módulo
/organizations/{orgId}/content/{id}       ← Content Studio
```

---

## Flujo de autenticación

1. Usuario entra a `/register` → crea cuenta Firebase Auth + documentos en Firestore
2. Al iniciar sesión, `useAuth.js` carga el perfil del usuario y su organización
3. Zustand guarda `user`, `org` y `role` disponibles en toda la app
4. `ProtectedRoute` redirige a `/login` si no hay sesión activa

---

## Acceso al Superadmin

Ve directamente a `/superadmin` mientras estás autenticado.
Muestra todas las organizaciones registradas en Firestore.

> En producción, el acceso se restringe por `role === 'superadmin'` en Firestore.
> Para hacer a un usuario superadmin, edita manualmente su documento en Firestore:
> `users/{uid}` → `role: "superadmin"`

---

## Variables de entorno (producción)

Cuando salgas de desarrollo, mueve las credenciales de Firebase a un archivo `.env`:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Y actualiza `src/lib/firebase.js` para leer `import.meta.env.VITE_FIREBASE_*`

---

## Próximos módulos (orden de construcción)

- [ ] **Pipeline Kanban** — drag & drop conectado a Firestore en tiempo real
- [ ] **Ficha de lead** — historial, score, acciones
- [ ] **Agente IA** — webhooks + lógica de calificación automática
- [ ] **Integraciones** — Meta, WhatsApp, LinkedIn
- [ ] **Analytics** — métricas y dashboards
- [ ] **Content Studio** — radar de noticias + teleprompter
- [ ] **Referidos** — programa de comisiones
- [ ] **Reglas de seguridad** — Firestore rules completas antes de producción

---

## Despliegue

```bash
# Build de producción
npm run build

# El output queda en /dist — sube esa carpeta a tu hosting (Antigravity, Vercel, etc.)
```

Para Firebase Hosting:
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```
