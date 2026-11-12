import type { Chat } from './tipos'
import { norm, type Mencion } from './cine'

export interface EntradaCancion {
  id: string
  titulo: string
  artista: string | null
  tipo: 'cancion' | 'artista'
  claves: string[]
  risky?: boolean
  videoIds?: string[]
}

export interface Cancion extends EntradaCancion {
  menciones: Mencion[]
}

const ENTRADAS: EntradaCancion[] = [
  { id: 'starlight', titulo: 'Starlight', artista: 'Muse', tipo: 'cancion', claves: ['starlight'] },
  { id: 'invincible', titulo: 'Invincible', artista: 'Muse', tipo: 'cancion', claves: ['invincible'], risky: true },
  { id: 'showbiz', titulo: 'Showbiz', artista: 'Muse', tipo: 'cancion', claves: ['showbiz', 'showbizz'] },
  { id: 'follow-me', titulo: 'Follow Me', artista: 'Muse', tipo: 'cancion', claves: ['follow me'], videoIds: ['YMe9gMjO21A'] },
  { id: 'snuff', titulo: 'Snuff', artista: 'Slipknot', tipo: 'cancion', claves: ['snuff'] },
  { id: 'anytime-anywhere', titulo: 'Anytime Anywhere', artista: 'milet', tipo: 'cancion', claves: ['anytime anywhere'] },
  { id: 'warmness', titulo: 'Warmness on the Soul', artista: 'Avenged Sevenfold', tipo: 'cancion', claves: ['warmness on the soul'], videoIds: ['whCBgo5QXcQ'] },
   { id: 'eclipsis', titulo: 'Eclipsis', artista: 'Esperón', tipo: 'cancion', claves: ['eclipsis'], videoIds: ['6MTptExfQNk'] },
  { id: 'be-somebody', titulo: 'Be Somebody', artista: 'Thousand Foot Krutch', tipo: 'cancion', claves: ['be somebody'], videoIds: ['33MnSYLvtOrbj5zwfioEiH'] },
  { id: 'luciernagas', titulo: 'Luciérnagas', artista: 'Milo j & Silvio Rodríguez', tipo: 'cancion', claves: ['luciernagas'] },
  { id: 'morocha', titulo: 'Morocha', artista: null, tipo: 'cancion', claves: ['morocha'], risky: true },
  { id: 'miracle', titulo: 'Miracle Musical', artista: null, tipo: 'artista', claves: ['miracle musical', 'miracle the musical'] },
  { id: 'milo-j', titulo: 'Milo J', artista: null, tipo: 'artista', claves: ['milo'], risky: true },
]

const ANCLA_MUS = /canci|canta|letra|escuch|dedic|suena|musi|album|banda|sonid|soundtrack|concierto/i
const ENLACE = /youtu\.be|youtube\.com|spotify\.com|rave\.link/i

const ANOTS = ENTRADAS.map((e) => ({ e, nks: e.claves.map(norm).filter(Boolean), vids: e.videoIds ?? [] }))

export function detectarCanciones(chat: Chat): Cancion[] {
  const encontradas = new Map<string, Cancion>()
  for (const m of chat.mensajes) {
    const texto = m.texto
    if (!texto || !texto.trim()) continue
    const nm = norm(texto)
    if (!nm) continue
    const ancla = ANCLA_MUS.test(nm) || ENLACE.test(texto)

    const porId = new Map<string, { e: EntradaCancion; nk: string | null }>()
    for (const { e, nks } of ANOTS) {
      for (const nk of nks) {
        if (` ${nm} `.includes(` ${nk} `)) {
          porId.set(e.id, { e, nk })
          break
        }
      }
      if (!porId.has(e.id)) {
        for (const vid of e.videoIds ?? []) {
          if (texto.includes(vid)) {
            porId.set(e.id, { e, nk: null })
            break
          }
        }
      }
    }
    if (porId.size === 0) continue
    const multicitado = porId.size >= 2

    for (const { e } of porId.values()) {
      if (e.risky && !ancla && !multicitado) continue
      let c = encontradas.get(e.id)
      if (!c) {
        c = { ...e, menciones: [] }
        encontradas.set(e.id, c)
      }
      c.menciones.push({ msgId: m.id, autor: m.autor, ts: m.ts, texto })
    }
  }
  return ENTRADAS.filter((e) => encontradas.has(e.id)).map((e) => encontradas.get(e.id)!)
}

export interface CancionMeta {
  trackName: string
  artistName: string
  artwork: string | null
  preview: string | null
  anio: number | null
}

interface ItunesResult {
  trackName?: string
  artistName?: string
  artworkUrl100?: string
  previewUrl?: string
  releaseDate?: string
}

const CACHE_KEY = 'wc-can-meta-v1'
const TTL = 60 * 86400e3
const enVuelo = new Map<string, Promise<CancionMeta[]>>()

type Cache = Record<string, { m: CancionMeta[]; ts: number }>

function leerCache(): Cache {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Cache
  } catch {
    return {}
  }
}

function guardarCache(c: Cache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c))
  } catch {
    /* lleno: se omite la caché */
  }
}

export async function metaDe(c: Cancion): Promise<CancionMeta[]> {
  const cache = leerCache()
  const hit = cache[c.id]
  if (hit && Date.now() - hit.ts < TTL) return hit.m
  const enCurso = enVuelo.get(c.id)
  if (enCurso) return enCurso

  const term = c.tipo === 'artista' ? c.titulo : `${c.artista ?? ''} ${c.titulo}`.trim()
  const p = (async () => {
    try {
      const r = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=5`,
      )
      if (!r.ok) throw new Error(String(r.status))
      const j = (await r.json()) as { results?: ItunesResult[] }
      let m: CancionMeta[] = (j.results ?? []).flatMap((x) =>
        x.trackName
          ? [
              {
                trackName: x.trackName,
                artistName: x.artistName ?? '',
                artwork: x.artworkUrl100
                  ? x.artworkUrl100.replace('/100x100bb', '/400x400bb')
                  : null,
                preview: x.previewUrl ?? null,
                anio: x.releaseDate ? Number(x.releaseDate.slice(0, 4)) : null,
              },
            ]
          : [],
      )
      if (c.tipo === 'cancion') {
        const t = norm(c.titulo)
        m = m.filter((x) => norm(x.trackName).includes(t) || t.includes(norm(x.trackName)))
      }
      const actual = leerCache()
      actual[c.id] = { m, ts: Date.now() }
      guardarCache(actual)
      return m
    } finally {
      enVuelo.delete(c.id)
    }
  })()
  enVuelo.set(c.id, p)
  return p
}
