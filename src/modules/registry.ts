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
]
