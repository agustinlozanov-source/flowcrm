import clsx from 'clsx'
import { Bot } from 'lucide-react'

// Paleta por iniciales: el mismo dueño siempre cae en el mismo color.
const GRADIENTS = [
  'linear-gradient(135deg, #1AAB99, #3533CD)',
  'linear-gradient(135deg, #F79009, #F04438)',
  'linear-gradient(135deg, #9E77ED, #6938EF)',
  'linear-gradient(135deg, #12B76A, #0E9F6E)',
  'linear-gradient(135deg, #2E90FA, #175CD3)',
  'linear-gradient(135deg, #F97066, #F04438)',
]

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?'
}

function gradientFor(name = '') {
  const sum = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return GRADIENTS[sum % GRADIENTS.length]
}

/**
 * Avatar del dueño del deal. `bot` cambia el tratamiento: fondo oscuro con
 * borde teal e ícono, para que Flowi nunca se confunda con una persona.
 */
export default function OwnerAvatar({ name, bot = false, size = 22 }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.45) }

  if (bot) {
    return (
      <span className="pv2-avatar pv2-avatar--bot" style={style} title={name || 'Flowi'}>
        <Bot size={Math.round(size * 0.55)} />
      </span>
    )
  }

  return (
    <span
      className={clsx('pv2-avatar')}
      style={{ ...style, background: gradientFor(name) }}
      title={name}
    >
      {initials(name)}
    </span>
  )
}
