export interface Modulo {
  id: string
  nombre: string
  desc: string
  icono: string
}

export const modulos: Modulo[] = [
  {
    id: 'chat',
    nombre: 'Nuestro chat',
    desc: 'El chat completo de WhatsApp: burbujas, estadísticas, palabras y búsqueda.',
    icono: '💬',
  },
  {
    id: 'arbol',
    nombre: 'Nuestro árbol',
    desc: 'Un árbol que crece con nuestros mensajes y nuestros días juntos.',
    icono: '🌳',
  },
  {
    id: 'deseos',
    nombre: 'El cielo de los deseos',
    desc: 'Cada deseo se cuelga como una estrella y se queda para siempre.',
    icono: '✨',
  },
]
