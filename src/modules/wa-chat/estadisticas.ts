import type { MediaTipo } from './tipos'
import { normalizar, STOPWORDS } from '../../lib/texto'
import type { Chat, Horario, Mapeo, Mensaje } from './tipos'
import { FRASES } from './frases'

export const MEDIA_INFO: Record<MediaTipo, { icono: string; label: string }> = {
  sticker: { icono: '🎨', label: 'Sticker' },
  voz: { icono: '🎤', label: 'Mensaje de voz · no disponible' },
  audio: { icono: '🎵', label: 'Audio · no disponible' },
  video: { icono: '🎥', label: 'Video · no disponible' },
  imagen: { icono: '📷', label: 'Imagen · no disponible' },
  gif: { icono: '🌀', label: 'GIF · no disponible' },
  documento: { icono: '📄', label: 'Documento · no disponible' },
  contacto: { icono: '👤', label: 'Contacto · no disponible' },
  ubicacion: { icono: '📍', label: 'Ubicación · no disponible' },
  album: { icono: '🖼️', label: 'Álbum · no disponible' },
}

export const NOMBRE_MIO = 'Moises'
export const NOMBRE_ELLA = 'Jania'

export const ZONAS: Array<{ off: number; label: string }> = [
  { off: -6, label: '🇲🇽 México (UTC−6)' },
  { off: -5, label: '🇨🇴 Colombia · 🇵🇪 Perú · 🇨🇺 Cuba (UTC−5)' },
  { off: -4, label: '🇻🇪 Venezuela (UTC−4)' },
  { off: -3, label: '🇦🇷 Argentina · Uruguay (UTC−3)' },
  { off: -1, label: 'Azores (UTC−1)' },
  { off: 0, label: '🇬🇧 Reino Unido (UTC)' },
  { off: 1, label: '🇵🇹 Portugal (UTC+1)' },
  { off: 2, label: '🇪🇸 España (UTC+2)' },
  { off: 3, label: '🇦🇪 Dubái (UTC+3)' },
]

export const HORARIO_DEFECTO: Horario = { archivo: -4, vista: 'archivo', porPersona: false, tu: -4, ella: 2 }

export const UMBRALES_INICIO = [30, 60, 120]

export function desfaseGlobal(h: Horario): number {
  return (h.vista === 'archivo' ? h.archivo : h.vista) - h.archivo
}

export function desfaseAutor(h: Horario, autor: string | null, mapeo: Mapeo): number {
  if (h.porPersona && autor) {
    if (autor === mapeo.yo) return h.tu - h.archivo
    if (autor === mapeo.ella) return h.ella - h.archivo
  }
  return desfaseGlobal(h)
}

export function tsHorario(ts: number, h: Horario): number {
  return ts + desfaseGlobal(h) * 3600000
}

export interface Estadisticas {
  total: number
  porAutor: Record<string, number>
  porHora: number[]
  porHoraAutor: Record<string, number[]>
  porDiaSemana: number[]
  diasActivos: number
  topDias: Array<{ ts: number; total: number; id: number }>
  mediaPorAutor: Record<string, Record<MediaTipo, number>>
  respuestaMediana: Record<string, number>
  respuestaFranja: Record<string, { manana: number; tarde: number; noche: number }>
  respuestaPercentiles: Record<string, { p10: number; p90: number }>
  respuestaTramos: Record<string, [number, number, number, number, number]>
  respuestaMeses: Array<{ ts: number; mediana: number }>
  respuestaTendencia: { inicio: number; fin: number } | null
  respuestaRecord: { rapida: { gap: number; autor: string; ts: number } | null; tardia: { gap: number; autor: string; ts: number } | null }
  eliminados: Record<string, number>
  pendientes: Record<string, number>
  palabrasTotal: Record<string, number>
  primero: number
  ultimo: number
inicia: Array<{ umbral: number; porAutor: Record<string, number> }>
  mananas: Record<string, number>
  noches: Record<string, number>
  mananasDias: Record<string, number>
  nochesDiasAutor: Record<string, number>
  propuestas: Record<string, { propuestas: number; apodos: number }>
  propuestasRefs: Array<{ id: number; ts: number; autor: string | null; texto: string }>
  hablandoMs: number
  topDiasVoz: Array<{ ts: number; total: number; id: number }>
  bloques: Array<{ ts: number; dur: number; mensajes: number; id: number }>
  meses: Array<{ ts: number; porAutor: Record<string, number> }>
  emojis: Record<string, Array<[string, number]>>
  masLargo: Record<string, { id: number; longitud: number; ts: number; texto: string }>
  charsTotal: Record<string, number>
  conTexto: Record<string, number>
  risas: Record<string, { puras: number; cadenas: number; familias: Record<string, number> }>
  preguntas: Record<string, { con: number; total: number }>
  calor: number[][]
  ejemplosCurios: Record<string, number[]>
}

export function calcularEstadisticas(chat: Chat, horario: Horario, mapeo: Mapeo): Estadisticas {
  const porAutor: Record<string, number> = {}
  const porHora = new Array(24).fill(0)
  const porHoraAutor: Record<string, number[]> = {}
  const porDiaSemana = new Array(7).fill(0)
  const porDia: Record<string, { ts: number; total: number; id: number }> = {}
  const mediaPorAutor: Record<string, Record<MediaTipo, number>> = {}
  const gaps: Record<string, number[]> = {}
  const intercambios: Array<{ autor: string; gap: number; ts: number }> = []
  const eliminados: Record<string, number> = {}
  const pendientes: Record<string, number> = {}
  const palabrasTotal: Record<string, number> = {}
  const inicia: Array<{ umbral: number; porAutor: Record<string, number> }> = UMBRALES_INICIO.map((umbral) => ({
    umbral,
    porAutor: {},
  }))
  const mananas: Record<string, number> = {}
  const noches: Record<string, number> = {}
  const mananasSet: Record<string, Set<string>> = {}
  const nochesSet: Record<string, Set<string>> = {}
  const propuestas: Record<string, { propuestas: number; apodos: number }> = {}
  const propuestasRefs: Array<{ id: number; ts: number; autor: string | null; texto: string }> = []
  let hablandoMs = 0
  let prevTsHab = 0
  const vozPorDia: Record<string, { ts: number; total: number; id: number }> = {}
  const bloques: Array<{ ts: number; dur: number; mensajes: number; id: number }> = []
  const mesesMap = new Map<number, { ts: number; porAutor: Record<string, number> }>()
  const emojisMap: Record<string, Map<string, number>> = {}
  const masLargo: Record<string, { id: number; longitud: number; ts: number; texto: string }> = {}
  const charsTotal: Record<string, number> = {}
  const conTexto: Record<string, number> = {}
  const risas: Record<string, { puras: number; cadenas: number; familias: Record<string, number> }> = {}
  const preguntas: Record<string, { con: number; total: number }> = {}
  const ejemplosCurios: Record<string, number[]> = {}
  const calor: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0))
  const franjas: Record<string, Record<'manana' | 'tarde' | 'noche', number[]>> = {}
  let primero = Infinity
  let ultimo = 0
  const gMs = desfaseGlobal(horario) * 3600000

  const RE_DIAS = regexDeFrase(['buenos dias', 'buen dia', 'buenas dias'])
  const RE_NOCHE = regexDeFrase([
    'buenas noches',
    'buenas nochi',
    'buenos noches',
    'dulces suenos',
    'sena lindo',
    'sena bonito',
    'que descanses',
    'descansa bien',
    'descansa',
  ])

  let prev: { autor: string; ts: number } | null = null
  let prevIni: number | null = null
  let bloqPrev = 0
  let bloqStart = 0
  let bloqStartId = 0
  let bloqCount = 0

  const anadirFranja = (autor: string, gap: number, tsResp: number) => {
    const h = new Date(tsResp + desfaseAutor(horario, autor, mapeo) * 3600000).getHours()
    const f = franjaDe(h)
    if (!franjas[autor]) franjas[autor] = { manana: [], tarde: [], noche: [] }
    franjas[autor][f].push(gap)
  }

  if (chat.serieSegundos) {
    let prevS: { ts: number; autor: string } | null = null
    for (const p of chat.serieSegundos) {
      if (prevS && prevS.autor !== p.autor) {
        const gap = p.ts - prevS.ts
        if (gap >= 0 && gap < 24 * 3600 * 1000) {
          if (!gaps[p.autor]) gaps[p.autor] = []
          gaps[p.autor].push(gap)
          anadirFranja(p.autor, gap, p.ts)
          intercambios.push({ autor: p.autor, gap, ts: p.ts })
        }
      }
      prevS = p
    }
  }

  for (const m of chat.mensajes) {
    if (!m.ts) continue
    if (prevTsHab) {
      const gap = m.ts - prevTsHab
      if (gap > 0 && gap <= 900000) hablandoMs += gap
    }
    prevTsHab = m.ts
    const tsG = m.ts + gMs
    primero = Math.min(primero, tsG)
    ultimo = Math.max(ultimo, tsG)

    const dAct = new Date(m.ts + desfaseAutor(horario, m.autor, mapeo) * 3600000)
    porHora[dAct.getHours()]++
    calor[dAct.getDay()][dAct.getHours()]++
    const d = new Date(tsG)
    porDiaSemana[d.getDay()]++
    const claveDia = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    if (!porDia[claveDia]) {
      porDia[claveDia] = { ts: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(), total: 0, id: m.id }
    }
    porDia[claveDia].total++

    const claveMes = new Date(d.getFullYear(), d.getMonth(), 1).getTime()
    let mes = mesesMap.get(claveMes)
    if (!mes) {
      mes = { ts: claveMes, porAutor: {} }
      mesesMap.set(claveMes, mes)
    }

    if (!bloqPrev) {
      bloqStart = m.ts
      bloqStartId = m.id
      bloqCount = 1
    } else if (m.ts - bloqPrev <= 900000) {
      bloqCount++
    } else {
      const dur = bloqPrev - bloqStart
      if (dur >= 1200000 && bloqCount >= 20) bloques.push({ ts: bloqStart, dur, mensajes: bloqCount, id: bloqStartId })
      bloqStart = m.ts
      bloqStartId = m.id
      bloqCount = 1
    }
    bloqPrev = m.ts

    const norm = m.texto ? normalizar(m.texto) : ''

    if (m.autor) {
      porAutor[m.autor] = (porAutor[m.autor] ?? 0) + 1
      mes.porAutor[m.autor] = (mes.porAutor[m.autor] ?? 0) + 1

      const gapIni = prevIni === null ? Infinity : m.ts - prevIni
      for (const fila of inicia) {
        if (gapIni >= fila.umbral * 60000) fila.porAutor[m.autor] = (fila.porAutor[m.autor] ?? 0) + 1
      }

      if (!porHoraAutor[m.autor]) porHoraAutor[m.autor] = new Array(24).fill(0)
      porHoraAutor[m.autor][dAct.getHours()]++

      if (norm) {
        const toks = norm.split(' ').filter(Boolean)
        palabrasTotal[m.autor] = (palabrasTotal[m.autor] ?? 0) + toks.length

        const nDias = (norm.match(RE_DIAS) ?? []).length
        if (nDias) {
          mananas[m.autor] = (mananas[m.autor] ?? 0) + nDias
          ;(mananasSet[m.autor] ??= new Set()).add(claveDia)
        }
        const nNoches = (norm.match(RE_NOCHE) ?? []).length
        if (nNoches) {
          noches[m.autor] = (noches[m.autor] ?? 0) + nNoches
          ;(nochesSet[m.autor] ??= new Set()).add(claveDia)
        }

        let nProp = 0
        let nApodo = 0
        for (const t of toks) {
          const limpia = t.replace(/[^\p{L}\p{N}]/gu, '')
          if (esCasamiento(limpia)) nProp++
          else if (esConyuge(limpia)) nApodo++
        }
        if (nProp || nApodo) {
          const p = (propuestas[m.autor] ??= { propuestas: 0, apodos: 0 })
          p.propuestas += nProp
          p.apodos += nApodo
          if (nProp && m.texto)
            propuestasRefs.push({
              id: m.id,
              ts: m.ts,
              autor: m.autor,
              texto: m.texto.slice(0, 110) + (m.texto.length > 110 ? '…' : ''),
            })
        }

        let r = risas[m.autor]
        if (!r) {
          r = { puras: 0, cadenas: 0, familias: {} }
          risas[m.autor] = r
        }
        let pura = toks.length > 0
        for (const t of toks) {
          const limpia = t.replace(/[^\p{L}\p{N}]/gu, '')
          if (!esRisa(limpia) && !esMash(limpia)) {
            pura = false
            continue
          }
          const esCadena = (limpia.match(/j/g)?.length ?? 0) >= 5
          if (esCadena) {
            r.cadenas++
            ;(ejemplosCurios[`${m.autor}|cadena`] ??= []).push(m.id)
          }
          let fam = 'otra'
          if (limpia.startsWith('ja')) fam = 'ja'
          else if (limpia.startsWith('je')) fam = 'je'
          else if (limpia.startsWith('ji')) fam = 'ji'
          else if (limpia.startsWith('js')) fam = 'js'
          else if (esMash(limpia)) fam = 'tecleo'
          else if (/^x+d*$/.test(limpia)) fam = 'xd'
          r.familias[fam] = (r.familias[fam] ?? 0) + 1
          ;(ejemplosCurios[`${m.autor}|${fam}`] ??= []).push(m.id)
        }
        if (pura) {
          r.puras++
          ;(ejemplosCurios[`${m.autor}|pura`] ??= []).push(m.id)
        }

        charsTotal[m.autor] = (charsTotal[m.autor] ?? 0) + m.texto.length
        conTexto[m.autor] = (conTexto[m.autor] ?? 0) + 1
        const largo = m.texto.length
        const ml = masLargo[m.autor]
        if (!esEnlace(m.texto) && (!ml || largo > ml.longitud)) {
          masLargo[m.autor] = { id: m.id, longitud: largo, ts: m.ts, texto: m.texto }
        }
      }

      if (m.media === 'voz' || m.media === 'audio') {
        const e = vozPorDia[claveDia] ?? { ts: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(), total: 0, id: m.id }
        e.total++
        vozPorDia[claveDia] = e
      }

      if (m.texto.includes('?')) {
        const q = m.texto.split('?').length - 1
        const p = preguntas[m.autor] ?? { con: 0, total: 0 }
        p.con++
        p.total += q
        preguntas[m.autor] = p
        ;(ejemplosCurios[`${m.autor}|pregunta`] ??= []).push(m.id)
      }

      if (m.texto) {
        let em = emojisMap[m.autor]
        if (!em) {
          em = new Map()
          emojisMap[m.autor] = em
        }
        for (const ch of m.texto.match(/\p{Extended_Pictographic}/gu) ?? []) {
          em.set(ch, (em.get(ch) ?? 0) + 1)
        }
      }

      if (m.tipo === 'eliminado') {
        const destino = /esperando/i.test(m.texto) ? pendientes : eliminados
        destino[m.autor] = (destino[m.autor] ?? 0) + 1
      }
      if (m.media) {
        if (!mediaPorAutor[m.autor]) {
          mediaPorAutor[m.autor] = { sticker: 0, voz: 0, audio: 0, video: 0, imagen: 0, gif: 0, documento: 0, contacto: 0, ubicacion: 0, album: 0 }
        }
        mediaPorAutor[m.autor][m.media]++
      }
      if (!chat.serieSegundos && prev && prev.autor !== m.autor) {
        const gap = m.ts - prev.ts
        if (gap > 0 && gap < 24 * 3600 * 1000) {
          if (!gaps[m.autor]) gaps[m.autor] = []
          gaps[m.autor].push(gap)
          anadirFranja(m.autor, gap, m.ts)
          intercambios.push({ autor: m.autor, gap, ts: m.ts })
        }
      }
      prev = { autor: m.autor, ts: m.ts }
    }
    prevIni = m.ts
  }

  if (bloqPrev && bloqCount >= 20) {
    const dur = bloqPrev - bloqStart
    if (dur >= 1200000) bloques.push({ ts: bloqStart, dur, mensajes: bloqCount, id: bloqStartId })
  }
  bloques.sort((a, b) => b.dur - a.dur)

  const respuestaMediana: Record<string, number> = {}
  for (const [autor, lista] of Object.entries(gaps)) {
    lista.sort((a, b) => a - b)
    respuestaMediana[autor] = lista[Math.floor(lista.length / 2)]
  }

  const mediana = (l: number[]) => {
    if (!l.length) return 0
    const s = [...l].sort((a, b) => a - b)
    return s[Math.floor(s.length / 2)]
  }
  const respuestaFranja: Estadisticas['respuestaFranja'] = {}
  for (const [autor, f] of Object.entries(franjas)) {
    respuestaFranja[autor] = { manana: mediana(f.manana), tarde: mediana(f.tarde), noche: mediana(f.noche) }
  }

  const percentilDe = (sorted: number[], q: number) =>
    sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] : 0
  const respuestaPercentiles: Estadisticas['respuestaPercentiles'] = {}
  const respuestaTramos: Estadisticas['respuestaTramos'] = {}
  const LIMITES_TRAMO = [10000, 60000, 300000, 1800000]
  for (const [autor, lista] of Object.entries(gaps)) {
    const s = [...lista].sort((a, b) => a - b)
    respuestaPercentiles[autor] = { p10: percentilDe(s, 0.1), p90: percentilDe(s, 0.9) }
    const t: [number, number, number, number, number] = [0, 0, 0, 0, 0]
    for (const g of s) {
      const i = LIMITES_TRAMO.findIndex((l) => g < l)
      t[i === -1 ? 4 : i]++
    }
    respuestaTramos[autor] = t
  }

  const gapsPorMes = new Map<number, number[]>()
  for (const it of intercambios) {
    const dMes = new Date(it.ts + gMs)
    const claveMes = new Date(dMes.getFullYear(), dMes.getMonth(), 1).getTime()
    let l = gapsPorMes.get(claveMes)
    if (!l) gapsPorMes.set(claveMes, (l = []))
    l.push(it.gap)
  }
  const respuestaMeses = [...gapsPorMes.entries()]
    .filter(([, l]) => l.length >= 10)
    .sort((a, b) => a[0] - b[0])
    .map(([ts, l]) => ({ ts, mediana: mediana(l) }))
  const respuestaTendencia: Estadisticas['respuestaTendencia'] =
    respuestaMeses.length >= 2 && respuestaMeses[0].mediana > 0
      ? { inicio: respuestaMeses[0].mediana, fin: respuestaMeses[respuestaMeses.length - 1].mediana }
      : null

  let rapida: { gap: number; autor: string; ts: number } | null = null
  let tardia: { gap: number; autor: string; ts: number } | null = null
  for (const it of intercambios) {
    if (!rapida || it.gap < rapida.gap) rapida = it
    if (!tardia || it.gap > tardia.gap) tardia = it
  }

  const dias = Object.values(porDia).sort((a, b) => a.ts - b.ts)

  const emojis: Record<string, Array<[string, number]>> = {}
  for (const [autor, mapa] of Object.entries(emojisMap)) {
    emojis[autor] = [...mapa.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  }

  const ejemplos: Record<string, number[]> = {}
  for (const [clave, ids] of Object.entries(ejemplosCurios)) {
    ejemplos[clave] = ids.slice(-20)
  }

  const mananasDias: Record<string, number> = {}
  for (const [autor, s] of Object.entries(mananasSet)) mananasDias[autor] = s.size
  const nochesDiasAutor: Record<string, number> = {}
  for (const [autor, s] of Object.entries(nochesSet)) nochesDiasAutor[autor] = s.size

  return {
    total: chat.mensajes.length,
    porAutor,
    porHora,
    porHoraAutor,
    porDiaSemana,
    diasActivos: dias.length,
    topDias: Object.values(porDia)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5),
    topDiasVoz: Object.values(vozPorDia)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5),
    mediaPorAutor,
    respuestaMediana,
    respuestaFranja,
    respuestaPercentiles,
    respuestaTramos,
    respuestaMeses,
    respuestaTendencia,
    respuestaRecord: { rapida, tardia },
    eliminados,
    pendientes,
    palabrasTotal,
    primero: primero === Infinity ? 0 : primero,
    ultimo,
    inicia,
    mananas,
    noches,
    mananasDias,
    nochesDiasAutor,
    propuestas,
    propuestasRefs,
    hablandoMs,
    bloques: bloques.slice(0, 5),
    meses: [...mesesMap.values()].sort((a, b) => a.ts - b.ts),
    emojis,
    masLargo,
    charsTotal,
    conTexto,
    risas,
    preguntas,
    calor,
    ejemplosCurios: ejemplos,
  }
}

export function esEnlace(t: string) {
  const s = t.trim()
  return /^(https?:\/\/|www\.)/i.test(s) || /maps\.google|goo\.gl\/maps|maps\.app\.goo\.gl/i.test(s)
}

export function esRisa(p: string): boolean {
  if (p.length >= 2 && /^x+d*$/.test(p)) return true
  return (p.match(/j/g)?.length ?? 0) >= 2
}

export function esMash(p: string): boolean {
  if (p.length < 5 || !p.includes('j')) return false
  const vocales = (p.match(/[aeiou]/g) ?? []).length
  if (vocales / p.length > 0.34) return false
  const vecinos = (p.match(/[hjknmuibg]/g) ?? []).length
  return vecinos >= 3
}

export function esAfirmacion(p: string): boolean {
  return /^[siz]{3,}$/.test(p)
}

export function esBesito(p: string): boolean {
  if (p.length < 3 || !/^[maui]+$/.test(p)) return false
  if (!p.includes('m') || !p.includes('a')) return false
  return p !== 'mama' && p !== 'mima' && p !== 'mimo'
}

const CASAMIENTO = new Set([
  'casar',
  'casarse',
  'casandose',
  'casate',
  'casemonos',
  'casemos',
  'casare',
  'casarme',
  'casarnos',
  'casaremos',
  'casarte',
  'casaria',
  'casarias',
  'casarian',
  'casamos',
  'casaron',
  'casado',
  'casada',
  'casados',
  'casadas',
  'case',
  'cases',
  'matrimonio',
  'matrimonios',
  'boda',
  'bodas',
  'propuesta',
  'propuestas',
  'anillo',
  'anillos',
])

export function esCasamiento(p: string): boolean {
  return CASAMIENTO.has(p)
}

const CONYUGE = new Set([
  'esposa',
  'esposo',
  'esposas',
  'esposos',
  'esposita',
  'esposito',
  'espositas',
  'espositos',
  'prometida',
  'prometido',
  'prometidas',
  'prometidos',
])

export function esConyuge(p: string): boolean {
  return CONYUGE.has(p)
}

export function contarPalabras(chat: Chat, autor: string | null) {
  const conteo = new Map<string, number>()
  for (const m of chat.mensajes) {
    if (m.tipo === 'sistema' || m.tipo === 'llamada' || m.tipo === 'eliminado') continue
    if (autor && m.autor !== autor) continue
    if (!m.texto) continue
    for (const palabra of normalizar(m.texto).split(' ')) {
      const limpia = palabra.replace(/[^\p{L}\p{N}]/gu, '')
      let clave = limpia
      if (esRisa(limpia) || esMash(limpia)) clave = 'risas'
      else if (esAfirmacion(limpia)) clave = 'afirmaciones'
      else if (limpia.length < 3 || STOPWORDS.has(limpia)) continue
      conteo.set(clave, (conteo.get(clave) ?? 0) + 1)
    }
  }
  return [...conteo.entries()].sort((a, b) => b[1] - a[1])
}

export function textoNormalizadoCache(chat: Chat) {
  return chat.mensajes.map((m) => normalizar(m.texto))
}

export function regexDeFrase(variantes: string[]) {
  const partes = variantes.map((v) => {
    const escapada = normalizar(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return escapada
  })
  return new RegExp(`(?<![\\p{L}])(${partes.join('|')})(?![\\p{L}])`, 'gu')
}

export function minutosATexto(ms: number) {
  if (ms < 60000) return `${Math.max(1, Math.round(ms / 1000))} s`
  const min = Math.round(ms / 60000)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const resto = min % 60
  return resto ? `${h} h ${resto} min` : `${h} h`
}

export function fechaCorta(ts: number) {
  const d = new Date(ts)
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
}

export function franjaDe(h: number): 'manana' | 'tarde' | 'noche' {
  if (h >= 6 && h < 12) return 'manana'
  if (h >= 12 && h < 19) return 'tarde'
  return 'noche'
}

function inicioSemana(ts: number) {
  const d = new Date(ts)
  const dia = d.getDay()
  const offset = dia === 0 ? 6 : dia - 1
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset).getTime()
}

export function semanasDe(mensajes: Mensaje[], gMs: number) {
  const mapa = new Map<number, { ts: number; total: number; id: number; porAutor: Record<string, number> }>()
  for (const m of mensajes) {
    if (!m.ts) continue
    const lunes = inicioSemana(m.ts + gMs)
    let s = mapa.get(lunes)
    if (!s) {
      s = { ts: lunes, total: 0, id: m.id, porAutor: {} }
      mapa.set(lunes, s)
    }
    s.total++
    if (m.autor) s.porAutor[m.autor] = (s.porAutor[m.autor] ?? 0) + 1
  }
  return [...mapa.values()].sort((a, b) => a.ts - b.ts)
}

export const EMOJIS_CARIÑO = new Set(['🥰', '😘', '😗', '😙', '❤', '💕', '💖', '💗', '💘', '💋', '🥺', '🫂', '😍', '😻', '💞', '♥'])

export function frasePorSemana(chat: Chat, normTextos: string[], gMs: number) {
  const regexes = FRASES.map((f) => ({ label: f.label, re: regexDeFrase(f.variantes) }))
  const buckets = new Map<number, { ts: number; conteos: Record<string, number>; emojis: number; stickers: number; besitos: number }>()
  for (let i = 0; i < chat.mensajes.length; i++) {
    const m = chat.mensajes[i]
    if (!m.ts || !m.autor) continue
    const norm = normTextos[i]
    const lunes = inicioSemana(m.ts + gMs)
    let b = buckets.get(lunes)
    if (!b) {
      b = { ts: lunes, conteos: {}, emojis: 0, stickers: 0, besitos: 0 }
      buckets.set(lunes, b)
    }
    if (m.media === 'sticker') b.stickers++
    if (norm) {
      for (const { label, re } of regexes) {
        const n = (norm.match(re) ?? []).length
        if (n) b.conteos[label] = (b.conteos[label] ?? 0) + n
      }
      for (const t of norm.split(' ')) {
        if (esBesito(t.replace(/[^\p{L}]/gu, ''))) b.besitos++
      }
    }
    if (m.texto) {
      for (const ch of m.texto.match(/\p{Extended_Pictographic}/gu) ?? []) {
        if (EMOJIS_CARIÑO.has(ch)) b.emojis++
      }
    }
  }
  return [...buckets.values()]
    .sort((a, b) => a.ts - b.ts)
    .map((b) => {
      const opciones: Array<[string, number]> = Object.entries(b.conteos)
      if (b.stickers > 0) opciones.push(['Stickers 🎨', b.stickers])
      if (b.besitos > 0) opciones.push(['Besitos 💋', b.besitos])
      if (b.emojis > 0) opciones.push(['Emojis tiernos 🥰', b.emojis])
      const orden = opciones.sort((a, z) => z[1] - a[1])
      const mejor = orden[0]
      return {
        ts: b.ts,
        ganadora: mejor ? { label: mejor[0], n: mejor[1] } : null,
        top: orden.slice(0, 3).map(([label, n]) => ({ label, n })),
      }
    })
}
