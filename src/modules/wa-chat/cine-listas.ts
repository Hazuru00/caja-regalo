export interface CineLista {
  id: string
  nombre: string
  ts: number
}

export interface CineAnot {
  id: string
  canon: string
  coleccion: string
  ts: number
}

export interface CineListasEstado {
  colecciones: CineLista[]
  anots: CineAnot[]
}

const CLAVE = 'wc-cine-listas'

export const CINE_LISTAS_VACIO: CineListasEstado = { colecciones: [], anots: [] }

function nuevoId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function normalizar(data: unknown): CineListasEstado {
  if (!data || typeof data !== 'object') return CINE_LISTAS_VACIO
  const d = data as Partial<CineListasEstado>
  const colecciones: CineLista[] = Array.isArray(d.colecciones)
    ? d.colecciones
        .filter((c) => c && typeof c.id === 'string' && typeof c.nombre === 'string')
        .map((c) => ({ id: c.id, nombre: c.nombre, ts: typeof c.ts === 'number' ? c.ts : 0 }))
    : []
  const anots: CineAnot[] = Array.isArray(d.anots)
    ? d.anots
        .filter((a) => a && typeof a.canon === 'string' && typeof a.coleccion === 'string')
        .map((a) => ({
          id: typeof a.id === 'string' ? a.id : nuevoId(),
          canon: a.canon,
          coleccion: a.coleccion,
          ts: typeof a.ts === 'number' ? a.ts : 0,
        }))
    : []
  return { colecciones, anots }
}

export function cargarCineListas(): CineListasEstado {
  try {
    const crudo = localStorage.getItem(CLAVE)
    if (!crudo) return CINE_LISTAS_VACIO
    return normalizar(JSON.parse(crudo))
  } catch {
    return CINE_LISTAS_VACIO
  }
}

export function guardarCineListas(e: CineListasEstado): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(e))
  } catch {
    /* sin persistencia */
  }
}

export function crearColeccionCine(e: CineListasEstado, nombre: string): CineListasEstado {
  const limpio = nombre.trim()
  if (!limpio) return e
  if (e.colecciones.some((c) => c.nombre.toLowerCase() === limpio.toLowerCase())) return e
  return { ...e, colecciones: [...e.colecciones, { id: nuevoId(), nombre: limpio, ts: Date.now() }] }
}

export function borrarColeccionCine(e: CineListasEstado, id: string): CineListasEstado {
  return { ...e, colecciones: e.colecciones.filter((c) => c.id !== id) }
}

export function asignarCine(e: CineListasEstado, canon: string, coleccion: string): CineListasEstado {
  const prev = e.anots.find((a) => a.canon === canon)
  if (prev) {
    if (prev.coleccion === coleccion)
      return { ...e, anots: e.anots.filter((a) => a.id !== prev.id) }
    return {
      ...e,
      anots: e.anots.map((a) => (a.id === prev.id ? { ...a, coleccion } : a)),
    }
  }
  return { ...e, anots: [...e.anots, { id: nuevoId(), canon, coleccion, ts: Date.now() }] }
}
