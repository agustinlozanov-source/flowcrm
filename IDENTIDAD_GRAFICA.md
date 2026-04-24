# 🎨 Identidad Gráfica — Flow Hub CRM

## Paleta de colores principal

| Nombre | Hex | Uso |
|--------|-----|-----|
| Teal institucional | `#1aab99` | Color primario, acentos, íconos activos |
| Indigo institucional | `#3533cd` | Color secundario, fondos de cabecera, CTAs |

## Degradado institucional

```css
/* Degradado principal de Flow Hub CRM */
background: linear-gradient(135deg, #1aab99, #3533cd);

/* Para texto con degradado */
background: linear-gradient(90deg, #1aab99, #3533cd);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
background-clip: text;
```

**Uso del degradado:**
- Sidebar Superadmin: badge "Superadmin" y logo
- Botones de acción principal
- Encabezados destacados
- Widget de chat de soporte (header)
- Elementos de onboarding y bienvenida

---

## Tipografía

| Rol | Fuente | Peso |
|-----|--------|------|
| Display / Títulos | Plus Jakarta Sans | 700–800 |
| Body / UI | Inter | 400–600 |
| Código / Mono | JetBrains Mono | 400 |

---

## Bordes y radios

| Elemento | Radio |
|----------|-------|
| Tarjetas grandes | `16px` |
| Botones y chips | `10px` |
| Inputs | `8px` |
| Badges / Tags | `999px` (pill) |
| Chat bubble | `18px` / `4px` en la esquina adyacente |

---

## Sombras

```css
/* Cards */
box-shadow: 0 2px 12px rgba(0,0,0,0.07);

/* Modales / dropdowns */
box-shadow: 0 8px 40px rgba(0,0,0,0.14);

/* Widget flotante (chat, FAB) */
box-shadow: 0 4px 24px rgba(26,171,153,0.35);
```

---

## Estados del color primario degradado

| Estado | Transformación |
|--------|---------------|
| Hover | `opacity: 0.9` + `scale(1.02)` |
| Active | `opacity: 0.85` + `scale(0.98)` |
| Disabled | `grayscale(100%) opacity(0.4)` |

---

## Logo

- Archivo: `/public/flowhub-logo2.png` (sobre fondo oscuro), `/public/logo.png` (sobre fondo claro)
- Altura recomendada en navbar: `32–36px`
- No distorsionar ni recolorear el logo

---

## Convenciones de íconos

- Librería: **Lucide React**
- Tamaño por defecto en nav: `16px`
- Tamaño en títulos de sección: `18–20px`
- Color: hereda del texto (`currentColor`)

---

## Variables CSS de referencia

Las variables globales están definidas en `src/styles/globals.css`:

```css
--color-primary: #1aab99;       /* Teal institucional */
--color-secondary: #3533cd;     /* Indigo institucional */
--color-gradient: linear-gradient(135deg, #1aab99, #3533cd);
```

> Última actualización: Abril 2026
