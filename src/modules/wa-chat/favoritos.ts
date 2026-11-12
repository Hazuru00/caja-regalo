import type { Horario } from './tipos'
import { cargarTema, type Tema } from '../../lib/tema'

export interface FavEntrada {
  id: string
  msgId: number
  coleccion: string | null
  nota: string
  ts: number
}

export interface FavColeccion {
  id: string
  nombre: string
  ts: number
}

export interface FavoritosEstado {
  colecciones: FavColeccion[]
  entradas: FavEntrada[]
}

const CLAVE = 'wc-favoritos'

export const FAV_VACIO: FavoritosEstado = { colecciones: [], entradas: [] }

function nuevoId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function normalizarFavoritos(data: unknown): FavoritosEstado {
  if (!data || typeof data !== 'object') return FAV_VACIO
  const d = data as Partial<FavoritosEstado>
  const colecciones: FavColeccion[] = Array.isArray(d.colecciones)
    ? d.colecciones
        .filter((c) => c && typeof c.id === 'string' && typeof c.nombre === 'string')
        .map((c) => ({ id: c.id, nombre: c.nombre, ts: typeof c.ts === 'number' ? c.ts : 0 }))
    : []
  const entradas: FavEntrada[] = Array.isArray(d.entradas)
    ? d.entradas
        .filter((e) => e && typeof e.id === 'string' && typeof e.msgId === 'number')
        .map((e) => ({
          id: e.id,
          msgId: e.msgId,
          coleccion: typeof e.coleccion === 'string' ? e.coleccion : null,
          nota: typeof e.nota === 'string' ? e.nota : '',
          ts: typeof e.ts === 'number' ? e.ts : 0,
        }))
    : []
  return { colecciones, entradas }
}

export function cargarFavoritos(): FavoritosEstado {
  try {
    const crudo = localStorage.getItem(CLAVE)
    if (!crudo) return FAV_VACIO
    return normalizarFavoritos(JSON.parse(crudo))
  } catch {
    return FAV_VACIO
  }
}

export function guardarFavoritos(f: FavoritosEstado) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(f))
  } catch {
    /* sin persistencia */
  }
}

export function alternarFavorito(f: FavoritosEstado, msgId: number): FavoritosEstado {
  if (f.entradas.some((e) => e.msgId === msgId))
    return { ...f, entradas: f.entradas.filter((e) => e.msgId !== msgId) }
  return { ...f, entradas: [...f.entradas, { id: nuevoId(), msgId, coleccion: null, nota: '', ts: Date.now() }] }
}

export function ponerNota(f: FavoritosEstado, entradaId: string, nota: string): FavoritosEstado {
  return { ...f, entradas: f.entradas.map((e) => (e.id === entradaId ? { ...e, nota } : e)) }
}

export function moverColeccion(f: FavoritosEstado, entradaId: string, coleccion: string | null): FavoritosEstado {
  return { ...f, entradas: f.entradas.map((e) => (e.id === entradaId ? { ...e, coleccion } : e)) }
}

export function crearColeccion(f: FavoritosEstado, nombre: string): FavoritosEstado {
  const limpio = nombre.trim()
  if (!limpio) return f
  return { ...f, colecciones: [...f.colecciones, { id: nuevoId(), nombre: limpio, ts: Date.now() }] }
}

export function borrarColeccion(f: FavoritosEstado, id: string): FavoritosEstado {
  return {
    colecciones: f.colecciones.filter((c) => c.id !== id),
    entradas: f.entradas.map((e) => (e.coleccion === id ? { ...e, coleccion: null } : e)),
  }
}

export function borrarEntrada(f: FavoritosEstado, entradaId: string): FavoritosEstado {
  return { ...f, entradas: f.entradas.filter((e) => e.id !== entradaId) }
}

export interface BackupDatos {
  v: number
  tema: Tema
  horario: Horario | null
  favoritos: FavoritosEstado
}

export function normalizarHorario(data: unknown): Horario | null {
  if (!data || typeof data !== 'object') return null
  const x = data as Record<string, unknown>
  if (typeof x.archivo !== 'number') return null
  return {
    archivo: x.archivo,
    vista: typeof x.vista === 'number' ? x.vista : 'archivo',
    porPersona: !!x.porPersona,
    tu: typeof x.tu === 'number' ? x.tu : x.archivo,
    ella: typeof x.ella === 'number' ? x.ella : x.archivo,
  }
}

export function exportarBackup(favoritos: FavoritosEstado, horario: Horario) {
  const datos: BackupDatos = { v: 1, tema: cargarTema(), horario, favoritos }
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const d = new Date()
  const dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  a.href = url
  a.download = `caja-regalo-backup-${dia}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function leerBackup(texto: string): BackupDatos {
  let data: unknown
  try {
    data = JSON.parse(texto)
  } catch {
    throw new Error('No es un archivo JSON válido.')
  }
  if (!data || typeof data !== 'object') throw new Error('No parece un backup.')
  const d = data as Partial<BackupDatos>
  if (!d.favoritos && !d.horario && !d.tema) throw new Error('El archivo no tiene datos del backup.')
  return {
    v: typeof d.v === 'number' ? d.v : 1,
    tema: d.tema === 'oscuro' ? 'oscuro' : 'claro',
    horario: normalizarHorario(d.horario),
    favoritos: d.favoritos ? normalizarFavoritos(d.favoritos) : FAV_VACIO,
  }
}
