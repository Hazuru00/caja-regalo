import type { Chat, Mensaje } from './tipos'
import { PARSER_VERSION } from './parser'

const LABELS_DUENO = new Set(['tú', 'you'])

function esDueno(autor: string): boolean {
  return LABELS_DUENO.has(autor.toLowerCase())
}

export interface ResultadoFusion {
  chat: Chat
  nuevos: number
  duplicados: number
}

/**
 * Combina una exportación nueva sobre el chat existente.
 * quienZip: de quién salió el teléfono que exportó (dueño del 'Tú' del zip).
 * zonaArchivo/zonaZip: offset UTC del chat guardado y del zip nuevo
 * (los mensajes del zip se recorren para alinear las horas).
 */
export function fusionarChat(
  existente: Chat,
  nuevo: Chat,
  mapeo: { yo: string; ella: string },
  quienZip: 'yo' | 'ella',
  zonaArchivo: number,
  zonaZip: number,
): ResultadoFusion {
  const shift = (zonaArchivo - zonaZip) * 3600000

  const otros = nuevo.emisores.filter((e) => !esDueno(e))
  const mapa = new Map<string, string>()
  for (const e of nuevo.emisores) {
    if (esDueno(e)) mapa.set(e, quienZip === 'yo' ? mapeo.yo : mapeo.ella)
    else if (otros.length === 1) mapa.set(e, quienZip === 'yo' ? mapeo.ella : mapeo.yo)
  }
  const renombrar = (a: string | null) => (a === null ? null : (mapa.get(a) ?? a))

  const minuto = (ts: number) => Math.floor(ts / 60000)
  const claves = new Set<string>()
  const claveDe = (m: Mensaje, ts: number) =>
    `${minuto(ts)}|${m.autor}|${m.tipo}|${m.media ?? ''}|${m.mediaNombre}|${m.texto}`

  const mensajes: Mensaje[] = existente.mensajes.map((m) => ({ ...m }))
  for (const m of existente.mensajes) claves.add(claveDe(m, m.ts))

  let nuevos = 0
  let duplicados = 0
  for (const m of nuevo.mensajes) {
    const ts = m.ts + shift
    const copia: Mensaje = {
      ...m,
      ts,
      autor: renombrar(m.autor),
      cita: m.cita ? { autor: renombrar(m.cita.autor) ?? m.cita.autor, texto: m.cita.texto } : null,
    }
    const k = claveDe(copia, ts)
    if (claves.has(k)) {
      duplicados++
      continue
    }
    claves.add(k)
    mensajes.push(copia)
    nuevos++
  }
  mensajes.sort((a, b) => a.ts - b.ts)
  mensajes.forEach((m, i) => (m.id = i))

  const serieClaves = new Set<string>()
  const serie: Array<{ ts: number; autor: string }> = []
  const meter = (ts: number, autor: string) => {
    const k = `${minuto(ts)}|${autor}`
    if (serieClaves.has(k)) return
    serieClaves.add(k)
    serie.push({ ts, autor })
  }
  for (const p of existente.serieSegundos ?? []) meter(p.ts, p.autor)
  for (const p of nuevo.serieSegundos ?? []) meter(p.ts + shift, renombrar(p.autor) ?? p.autor)
  serie.sort((a, b) => a.ts - b.ts)

  const emisores = [...new Set(mensajes.map((m) => m.autor).filter((a): a is string => !!a))]

  const chat: Chat = {
    mensajes,
    emisores,
    fechaExport: existente.fechaExport ?? nuevo.fechaExport,
    origen: 'md',
    ...(serie.length ? { serieSegundos: serie } : {}),
    parserVersion: PARSER_VERSION,
  }
  return { chat, nuevos, duplicados }
}
