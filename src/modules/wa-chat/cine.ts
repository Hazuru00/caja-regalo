import type { Chat } from './tipos'
import { ALLOW, ANCHOR, LEX, RISKY, type LexEntrada } from './cine-lex'

export interface Mencion {
  msgId: number
  autor: string | null
  ts: number
  texto: string
}

export interface Ficha {
  id: string
  canon: string
  titulo: string
  anio: number | null
  rating: number | null
  poster: string | null
  tipo: 'serie' | 'anime' | 'pelicula'
  generos: string[]
  resumen: string
  estado: string | null
  fuente: 'tvmaze' | 'wiki' | 'local'
  menciones: Mencion[]
  recomendo: string[]
}

type Riesgo = 'multi' | 'allow' | 'ok' | 'risky'
interface Anot {
  nk: string
  segs: string[]
  riesgo: Riesgo
}
interface Pre {
  canon: string
  tipo: LexEntrada[1]
  anot: Anot[]
  ord: number
}

export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

const ARTICULOS = new Set(['la', 'el', 'los', 'las', 'un', 'una', 'the', 'a', 'an'])

const SIGNAL_RE =
  /\b(pel[ií]cula|peli|peliculas|series?|anime|cap[ií]tulo|episodio|temporada|estren|recomend\w*|netflix|hbo|disney|crunchyroll|prime video|animada|animadas|kdrama|kdramas)\b/i
const RECOMEND_RE = /recomien\w*|recomend\w*/i

function levDist(a: string, b: string): number {
  if (a === b) return 0
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur.push(Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0)))
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j]
  }
  return prev[b.length]
}

function difuso(win: string[], segs: string[]): boolean {
  for (let j = 0; j < segs.length; j++) {
    const a = win[j]
    const b = segs[j]
    if (Math.min(a.length, b.length) < 4) {
      if (a !== b) return false
    } else if (levDist(a, b) > 1) {
      return false
    }
  }
  return true
}

function construirPRE(): Pre[] {
  const fusion = new Map<string, { canon: string; tipo: LexEntrada[1]; claves: string[] }>()
  for (const [canon, tipo, claves] of LEX) {
    const key = `${canon}|${tipo}`
    const prev = fusion.get(key)
    if (prev) {
      for (const c of claves) if (!prev.claves.includes(c)) prev.claves.push(c)
    } else {
      fusion.set(key, { canon, tipo, claves: [...claves] })
    }
  }
  const pre: Pre[] = []
  for (const { canon, tipo, claves } of fusion.values()) {
    const anot: Anot[] = []
    const vistos = new Set<string>()
    for (const k of [canon, ...claves]) {
      const nk = norm(k)
      if (!nk || vistos.has(nk)) continue
      vistos.add(nk)
      const segs = nk.split(' ')
      let riesgo: Riesgo
      if (segs.length > 1) riesgo = 'multi'
      else if (ALLOW.has(nk)) riesgo = 'allow'
      else if (RISKY.has(nk) || nk.length < 6) riesgo = 'risky'
      else riesgo = 'ok'
      anot.push({ nk, segs, riesgo })
    }
    pre.push({ canon, tipo, anot, ord: pre.length })
  }
  return pre
}

const PRE = construirPRE()

interface Cruce {
  p: Pre
  a: Anot
  ai: number
}
const IDX = new Map<string, Cruce[]>()
const IDX_CORE = new Map<string, Cruce[]>()
const ANOTS_FUZZY: Cruce[] = []
function addIdx(map: Map<string, Cruce[]>, key: string, c: Cruce): void {
  const prev = map.get(key)
  if (prev) prev.push(c)
  else map.set(key, [c])
}
for (const p of PRE) {
  for (let ai = 0; ai < p.anot.length; ai++) {
    const a = p.anot[ai]
    const c: Cruce = { p, a, ai }
    addIdx(IDX, a.segs[0], c)
    if (a.segs.length >= 3 && ARTICULOS.has(a.segs[0])) addIdx(IDX_CORE, a.segs[1], c)
    if (a.nk.length >= 8) ANOTS_FUZZY.push(c)
  }
}

const CLAVES_POR_CANON = new Map<string, string[]>()
for (const [canon, , claves] of LEX) {
  const prev = CLAVES_POR_CANON.get(canon)
  if (prev) for (const c of claves) if (!prev.includes(c)) prev.push(c)
  else CLAVES_POR_CANON.set(canon, [...claves])
}

const STEM_ANCLA = [...ANCHOR].map((a) => norm(a)).filter(Boolean)

function posicion(words: string[], a: Anot, sig: boolean): number {
  const segs = a.segs
  const n = segs.length
  const igual = (i: number, ref: string[]): boolean => {
    for (let j = 0; j < ref.length; j++) if (words[i + j] !== ref[j]) return false
    return true
  }
  for (let i = 0; i + n <= words.length; i++) if (igual(i, segs)) return i
  if (n >= 3 && ARTICULOS.has(segs[0])) {
    const core = segs.slice(1)
    for (let i = 0; i + core.length <= words.length; i++) if (igual(i, core)) return i
  }
  if (sig && a.nk.length >= 8) {
    for (let i = 0; i + n <= words.length; i++) {
      if (difuso(words.slice(i, i + n), segs)) return i
    }
  }
  return -1
}

function anclaCerca(words: string[], i0: number): boolean {
  const ini = Math.max(0, i0 - 8)
  const fin = Math.min(words.length, i0 + 9)
  for (let i = ini; i < fin; i++) {
    const w = words[i]
    for (const st of STEM_ANCLA) if (w.startsWith(st)) return true
  }
  return false
}

function corrobora(nq: string, nn: string): boolean {
  const qs = nq.split(' ').filter(Boolean)
  const ns = nn.split(' ').filter(Boolean)
  if (!qs.length || !ns.length) return false
  for (const t of qs) {
    if (t.length <= 2) continue
    const ok = ns.some((u) => {
      if (u === t) return true
      if (u.length < 3) return false
      if (t.length === 3) return u.includes(t) || (u.length === 3 && levDist(t, u) <= 1)
      return u.includes(t) || t.includes(u) || levDist(t, u) <= 1
    })
    if (!ok) return false
  }
  return true
}

interface Candidato {
  clave: string
  canon: string | null
  tipo: LexEntrada[1] | null
  claves: string[]
  menciones: Mencion[]
  recomendo: string[]
}

export function detectar(chat: Chat): Candidato[] {
  const lex = new Map<string, Candidato>()

  for (const m of chat.mensajes) {
    const texto = m.texto
    if (!texto || !texto.trim()) continue
    const nm = norm(texto)
    if (!nm) continue
    const words = nm.split(' ')
    const sig = SIGNAL_RE.test(texto)
    const rec = RECOMEND_RE.test(texto)

    const candidatos = new Set<Cruce>()
    for (const w of words) {
      const c1 = IDX.get(w)
      if (c1) for (const c of c1) candidatos.add(c)
      const c2 = IDX_CORE.get(w)
      if (c2) for (const c of c2) candidatos.add(c)
    }
    if (sig) for (const c of ANOTS_FUZZY) candidatos.add(c)
    if (!candidatos.size) continue
    const orden = [...candidatos].sort((x, y) => x.p.ord - y.p.ord || x.ai - y.ai)
    const aceptados = new Set<Pre>()
    for (const c of orden) {
      if (aceptados.has(c.p)) continue
      const pos = posicion(words, c.a, sig)
      if (pos < 0) continue
      if (c.a.riesgo === 'risky' && !anclaCerca(words, pos)) continue
      aceptados.add(c.p)
      const p = c.p
      let e = lex.get(p.canon)
      if (!e) {
        e = {
          clave: c.a.nk,
          canon: p.canon,
          tipo: p.tipo,
          claves: CLAVES_POR_CANON.get(p.canon) ?? [],
          menciones: [],
          recomendo: [],
        }
        lex.set(p.canon, e)
      }
      e.menciones.push({ msgId: m.id, autor: m.autor, ts: m.ts, texto })
      if (rec && m.autor && !e.recomendo.includes(m.autor)) e.recomendo.push(m.autor)
    }
  }

  return [...lex.values()]
}

interface Meta {
  id: string
  fuente: 'tvmaze' | 'wiki'
  titulo: string
  anio: number | null
  rating: number | null
  poster: string | null
  generos: string[]
  resumen: string
  estado: string | null
  tvTipo?: string | null
}

interface TvHit {
  score?: number
  show: {
    id: number
    name: string
    premiered: string | null
    rating?: { average: number | null } | null
    image?: { medium?: string; original?: string } | null
    genres?: string[]
    status?: string
    summary?: string | null
    type?: string
  }
}

async function fetchJson<T>(url: string, ms = 9000): Promise<T> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    const r = await fetch(url, { signal: ctrl.signal })
    if (!r.ok) throw new Error(String(r.status))
    return (await r.json()) as T
  } finally {
    clearTimeout(t)
  }
}

function limpiarHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function tvmaze(q: string): Promise<Meta | null> {
  const r = await fetchJson<TvHit[]>(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`)
  const nq = norm(q)
  for (const hit of r) {
    if ((hit.score ?? 0) < 0.5) break
    const s = hit.show
    if (!s || !corrobora(nq, norm(s.name))) continue
    return {
      id: `tv:${s.id}`,
      fuente: 'tvmaze',
      titulo: s.name,
      anio: s.premiered ? Number(s.premiered.slice(0, 4)) : null,
      rating: s.rating?.average ?? null,
      poster: s.image?.medium ?? s.image?.original ?? null,
      generos: s.genres ?? [],
      resumen: limpiarHtml(s.summary ?? ''),
      estado: s.status ?? null,
      tvTipo: s.type ?? null,
    }
  }
  return null
}

interface WikiBusq {
  query?: { search?: Array<{ title: string }> }
}
interface WikiPag {
  query?: {
    pages?: Record<
      string,
      { title: string; extract?: string; thumbnail?: { source?: string } }
    >
  }
}

async function wiki(intentos: string[]): Promise<Meta | null> {
  const cola = [...new Set(intentos)].filter(Boolean).slice(0, 4)
  for (const q of cola) {
    const nq = norm(q)
    const b = await fetchJson<WikiBusq>(
      `https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=3&format=json&origin=*`,
    )
    for (const hit of b.query?.search ?? []) {
      if (!corrobora(nq, norm(hit.title))) continue
      const p = await fetchJson<WikiPag>(
        `https://es.wikipedia.org/w/api.php?action=query&prop=pageimages|extracts&exintro=1&explaintext=1&exsentences=3&piprop=thumbnail&pithumbsize=500&titles=${encodeURIComponent(hit.title)}&format=json&origin=*`,
      )
      const page = Object.values(p.query?.pages ?? {})[0]
      if (!page) continue
      const anio = page.extract?.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? null
      return {
        id: `wk:${encodeURIComponent(page.title)}`,
        fuente: 'wiki',
        titulo: page.title,
        anio: anio ? Number(anio) : null,
        rating: null,
        poster: page.thumbnail?.source ?? null,
        generos: [],
        resumen: (page.extract ?? '').slice(0, 400),
        estado: null,
      }
    }
  }
  return null
}

const CACHE_KEY = 'wc-cine-meta-v2'
const CACHE_TTL = 60 * 24 * 3600 * 1000

function leerCache(): Record<string, { t: number; m: Meta | null }> {
  try {
    const crudo = localStorage.getItem(CACHE_KEY)
    if (crudo) return JSON.parse(crudo) as Record<string, { t: number; m: Meta | null }>
  } catch {
    /* sin persistencia */
  }
  return {}
}

function guardarCache(c: Record<string, { t: number; m: Meta | null }>): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c))
  } catch {
    /* sin persistencia */
  }
}

async function mapLimit<T, R>(items: T[], limite: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const res: R[] = new Array(items.length)
  let i = 0
  const trabajadores = Array.from({ length: Math.min(limite, items.length) }, async () => {
    while (i < items.length) {
      const j = i++
      res[j] = await fn(items[j])
    }
  })
  await Promise.all(trabajadores)
  return res
}

async function resolver(c: Candidato, cache: Record<string, { t: number; m: Meta | null }>):
  Promise<{ meta: Meta | null; fallo: boolean }> {
  const guardado = cache[c.clave]
  if (guardado && Date.now() - guardado.t < CACHE_TTL) return { meta: guardado.m, fallo: false }
  try {
    let meta = c.canon ? await tvmaze(c.canon) : null
    if (!meta && c.canon) meta = await wiki([c.canon])
    cache[c.clave] = { t: Date.now(), m: meta }
    return { meta, fallo: false }
  } catch {
    return { meta: null, fallo: true }
  }
}

let fichasEnVuelo: Promise<Ficha[]> | null = null

export function obtenerFichas(chat: Chat): Promise<Ficha[]> {
  if (!fichasEnVuelo) {
    fichasEnVuelo = obtenerFichasInterno(chat).finally(() => {
      fichasEnVuelo = null
    })
  }
  return fichasEnVuelo
}

async function obtenerFichasInterno(chat: Chat): Promise<Ficha[]> {
  const candidatos = detectar(chat)
  if (!candidatos.length) return []
  const cache = leerCache()
  const resultados = await mapLimit(candidatos, 12, (c) => resolver(c, cache))
  guardarCache(cache)

  const fallos = resultados.filter((r) => r.fallo).length
  if (fallos === resultados.length) throw new Error('Sin conexión con las APIs')

  const porId = new Map<string, Ficha>()
  candidatos.forEach((c, i) => {
    const meta = resultados[i].meta
    // Sin metadatos (la API falló o no lo tiene): ficha local en vez de descartar el título
    const id = meta ? meta.id : `local:${c.canon ?? c.clave}`
    const tipo: Ficha['tipo'] =
      c.tipo ?? (meta?.fuente === 'wiki' ? 'pelicula' : meta?.tvTipo === 'Animation' ? 'anime' : 'serie')
    const previo = porId.get(id)
    if (previo) {
      previo.menciones.push(...c.menciones)
      for (const a of c.recomendo) if (!previo.recomendo.includes(a)) previo.recomendo.push(a)
      return
    }
    porId.set(id, {
      id,
      canon: c.canon ?? '',
      titulo: meta ? meta.titulo : (c.canon ?? c.clave),
      anio: meta?.anio ?? null,
      rating: meta?.rating ?? null,
      poster: meta?.poster ?? null,
      tipo,
      generos: meta?.generos ?? [],
      resumen: meta?.resumen ?? '',
      estado: meta?.estado ?? null,
      fuente: meta?.fuente ?? 'local',
      menciones: c.menciones,
      recomendo: c.recomendo,
    })
  })

  return [...porId.values()].sort(
    (a, b) => b.menciones.length - a.menciones.length || a.titulo.localeCompare(b.titulo),
  )
}
