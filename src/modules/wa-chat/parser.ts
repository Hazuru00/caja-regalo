import type { Cita, Chat, MediaTipo, Mensaje } from './tipos'

export const PARSER_VERSION = 2

const MESES: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
}

const MEDIA_MD: Record<string, MediaTipo> = {
  sticker: 'sticker',
  'mensaje de voz': 'voz',
  audio: 'audio',
  video: 'video',
  'mensaje de video': 'video',
  imagen: 'imagen',
  gif: 'gif',
  documento: 'documento',
  contacto: 'contacto',
  'mensaje de album': 'album',
  'ubicación': 'ubicacion',
  ubicacion: 'ubicacion',
}

const MEDIA_TXT: Array<[RegExp, MediaTipo]> = [
  [/sticker/i, 'sticker'],
  [/mensaje de voz/i, 'voz'],
  [/audio/i, 'audio'],
  [/video/i, 'video'],
  [/imagen/i, 'imagen'],
  [/gif/i, 'gif'],
  [/documento/i, 'documento'],
  [/contacto/i, 'contacto'],
  [/ubicaci/i, 'ubicacion'],
]

function decodificar(bytes: Uint8Array) {
  const utf8 = new TextDecoder('utf-8').decode(bytes)
  if (utf8.includes('�') && utf8.split('�').length / utf8.length > 0.001) {
    try {
      return new TextDecoder('windows-1252').decode(bytes)
    } catch {
      return utf8
    }
  }
  return utf8
}

async function leerArchivo(file: File): Promise<{ texto: string; origen: 'md' | 'txt'; textoTxt: string | null }> {
  if (file.name.toLowerCase().endsWith('.zip')) {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(file)
    const entradas = Object.values(zip.files).filter((f) => !f.dir)
    const md = entradas.find((f) => f.name.toLowerCase().endsWith('.md'))
    const txt = entradas.find((f) => f.name.toLowerCase().endsWith('.txt'))
    const entrada = md ?? txt
    if (!entrada) throw new Error('El zip no contiene ningún archivo .md o .txt de chat.')
    const bytes = await entrada.async('uint8array')
    const textoTxt = md && txt ? decodificar(await txt.async('uint8array')) : null
    return { texto: decodificar(bytes), origen: md ? 'md' : 'txt', textoTxt }
  }
  if (/\.(txt|md)$/i.test(file.name)) {
    const bytes = new Uint8Array(await file.arrayBuffer())
    return { texto: decodificar(bytes), origen: /\.md$/i.test(file.name) ? 'md' : 'txt', textoTxt: null }
  }
  throw new Error('Sube el .zip de la exportación de WhatsApp (o el .txt/.md suelto).')
}

const RE_FECHA_MD = /^## (\d{1,2}) de (\w+) de (\d{4})/
const RE_HDR_MD = /^\[(\d{1,2}):(\d{2})\s*(a\. m\.|p\. m\.)\]\s*\*\*(.+?):\*\*(.*)$/
const RE_SIS_MD = /^\[(\d{1,2}):(\d{2})\s*(a\. m\.|p\. m\.)\]\s*__(.+)__$/
const RE_MEDIA_MD = /^\[([^\]]+)\](?:\s+(.*))?$/
const RE_CITA_MD = /^> _?(.+?):\s*(.*)_$/
const RE_CITA_APERTURA_MD = /^> _?(.+?):\s*(.*)$/

const RE_LINEA_TXT = /^\[(\d{1,2})\/(\d{1,2})\/(\d{2}),\s(\d{1,2}):(\d{2}):(\d{2})\s([AP]M)\]\s?(.*)$/

function esPlaceholder(texto: string): boolean {
  const t = texto.trim().replace(/^_+|_+$/g, '')
  return /^(Se elimin[oó] este mensaje|Eliminaste este mensaje|Esperando el mensaje)/i.test(t)
}

function mediaDeMd(etiqueta: string): MediaTipo | null {
  return MEDIA_MD[etiqueta.toLowerCase()] ?? null
}

function mediaDeTxt(texto: string): MediaTipo | null {
  for (const [re, tipo] of MEDIA_TXT) {
    if (re.test(texto)) return tipo
  }
  return null
}

function armarMd(texto: string): Chat {
  const lineas = texto.split(/\r?\n/)
  const mensajes: Mensaje[] = []
  const emisores = new Set<string>()
  let anio = 2026
  let mes = 0
  let dia = 1
  let actual: Mensaje | null = null
  let citaPendiente: { autor: string; texto: string } | null = null

  const cerrar = () => {
    if (actual) {
      if (citaPendiente) {
        actual.cita = { autor: citaPendiente.autor, texto: citaPendiente.texto.trim() } satisfies Cita
        citaPendiente = null
      }
      actual.texto = actual.texto.trim()
      mensajes.push(actual)
      actual = null
    }
    citaPendiente = null
  }

  const tsDe = (h: number, m: number, pm: boolean) => {
    const hora12 = h % 12 + (pm ? 12 : 0)
    return new Date(anio, mes, dia, hora12, m, 0).getTime()
  }

  for (const linea of lineas) {
    const f = RE_FECHA_MD.exec(linea)
    if (f) {
      cerrar()
      dia = Number(f[1])
      mes = MESES[f[2].toLowerCase()] ?? 0
      anio = Number(f[3])
      continue
    }

    const h = RE_HDR_MD.exec(linea)
    if (h) {
      cerrar()
      const ts = tsDe(Number(h[1]), Number(h[2]), h[3].startsWith('p'))
      const autor = h[4]
      const resto = h[5].trim()
      actual = {
        id: mensajes.length,
        ts,
        autor,
        texto: '',
        media: null,
        mediaNombre: '',
        cita: null,
        tipo: 'texto',
      }
      if (autor) emisores.add(autor)
      if (resto) {
        const m = RE_MEDIA_MD.exec(resto)
        if (m && mediaDeMd(m[1])) {
          actual.media = mediaDeMd(m[1])
          actual.mediaNombre = (m[2] ?? '').trim()
          actual.tipo = 'media'
        } else if (esPlaceholder(resto)) {
          actual.tipo = 'eliminado'
          actual.texto = resto.replace(/^_+|_+$/g, '')
        } else {
          actual.texto = resto
        }
      }
      continue
    }

    const s = RE_SIS_MD.exec(linea)
    if (s) {
      cerrar()
      const cuerpo = s[4].replace(/^__|__$/g, '')
      const esLlamada = /\[llamada\]/i.test(cuerpo)
      mensajes.push({
        id: mensajes.length,
        ts: tsDe(Number(s[1]), Number(s[2]), s[3].startsWith('p')),
        autor: null,
        texto: cuerpo,
        media: null,
        mediaNombre: '',
        cita: null,
        tipo: esLlamada ? 'llamada' : 'sistema',
      })
      continue
    }

    if (!actual) {
      const m = RE_MEDIA_MD.exec(linea.trim())
      if (linea.trim() && m && mediaDeMd(m[1])) {
        mensajes.push({
          id: mensajes.length,
          ts: new Date(anio, mes, dia, 12, 0).getTime(),
          autor: null,
          texto: '',
          media: mediaDeMd(m[1]),
          mediaNombre: (m[2] ?? '').trim(),
          cita: null,
          tipo: 'media',
        })
      }
      continue
    }

    if (citaPendiente) {
      const t = linea.trim()
      const fin = t.endsWith('_')
      if (citaPendiente.texto) citaPendiente.texto += '\n'
      citaPendiente.texto += fin ? t.slice(0, -1) : t
      if (fin) {
        if (actual) actual.cita = { autor: citaPendiente.autor, texto: citaPendiente.texto.trim() } satisfies Cita
        citaPendiente = null
      }
      continue
    }

    if (!linea.trim()) continue
    if (/^-{3,}$|^\*{3,}$|^_{3,}$/.test(linea.trim())) continue

    const c = RE_CITA_MD.exec(linea.trim())
    if (c) {
      actual.cita = { autor: c[1], texto: c[2].replace(/^_|_$/g, '') } satisfies Cita
      continue
    }
    const ca = RE_CITA_APERTURA_MD.exec(linea.trim())
    if (ca && !linea.trim().endsWith('_')) {
      citaPendiente = { autor: ca[1], texto: ca[2].replace(/^_/, '') }
      continue
    }

    const m = RE_MEDIA_MD.exec(linea.trim())
    if (m && mediaDeMd(m[1]) && !actual.media && !actual.texto) {
      actual.media = mediaDeMd(m[1])
      actual.mediaNombre = (m[2] ?? '').trim()
      actual.tipo = 'media'
      continue
    }

    if (esPlaceholder(linea) && !actual.texto && !actual.media) {
      actual.tipo = 'eliminado'
      actual.texto = linea.trim().replace(/^_+|_+$/g, '')
      continue
    }

    actual.texto += (actual.texto ? '\n' : '') + linea
  }
  cerrar()

  return { mensajes, emisores: [...emisores], fechaExport: null, origen: 'md' }
}

function armarTxt(texto: string): Chat {
  const lineas = texto.split(/\r?\n/)
  const mensajes: Mensaje[] = []
  const emisores = new Set<string>()

  const crudos: Array<{ a?: number; b?: number; c?: number; hora: number; min: number; seg: number; ampm: string; resto: string }> = []
  for (const linea of lineas) {
    const m = RE_LINEA_TXT.exec(linea)
    if (m) {
      crudos.push({
        a: Number(m[1]),
        b: Number(m[2]),
        c: Number(m[3]),
        hora: Number(m[4]),
        min: Number(m[5]),
        seg: Number(m[6]),
        ampm: m[7],
        resto: m[8],
      })
    } else if (linea.trim()) {
      const prev = crudos[crudos.length - 1]
      if (prev) {
        prev.resto += '\n' + linea
      } else {
        mensajes.push({
          id: mensajes.length,
          ts: 0,
          autor: null,
          texto: linea,
          media: null,
          mediaNombre: '',
          cita: null,
          tipo: 'sistema',
        })
      }
    }
  }

  let diaPrimero = false
  for (const c of crudos) {
    if (c.a && c.a > 12) {
      diaPrimero = true
      break
    }
    if (c.b && c.b > 12) break
  }

  for (const c of crudos) {
    const dia = (diaPrimero ? c.a : c.b) ?? 1
    const mes = ((diaPrimero ? c.b : c.a) ?? 1) - 1
    const anio = 2000 + (c.c ?? 0)
    const hora12 = c.hora % 12 + (c.ampm.toUpperCase().startsWith('P') ? 12 : 0)
    const ts = new Date(anio, mes, dia, hora12, c.min, c.seg).getTime()

    const esSistema = /^- /.test(c.resto) || !/^[^:[]+?: /.test(c.resto)
    if (esSistema) {
      const cuerpo = c.resto.replace(/^- /, '')
      const esLlamada = /llamada/i.test(cuerpo)
      mensajes.push({
        id: mensajes.length,
        ts,
        autor: null,
        texto: cuerpo,
        media: null,
        mediaNombre: '',
        cita: null,
        tipo: esLlamada ? 'llamada' : 'sistema',
      })
      continue
    }

    const sep = /^[^:[]+?: /.exec(c.resto)
    const autor = sep ? sep[0].slice(0, -2) : ''
    let contenido = sep ? c.resto.slice(sep[0].length) : c.resto
    if (autor) emisores.add(autor)

    let media: MediaTipo | null = null
    let mediaNombre = ''
    let placeholder = false
    if (esPlaceholder(contenido)) {
      placeholder = true
      contenido = contenido.trim()
    } else {
      const mt = /^<([^>]+)>/.exec(contenido)
      if (mt) {
        const etiqueta = mt[1]
        if (/omitido/.test(etiqueta)) {
          media = mediaDeTxt(etiqueta)
          mediaNombre = contenido.slice(mt[0].length).trim()
          contenido = ''
        }
      }
    }

    mensajes.push({
      id: mensajes.length,
      ts,
      autor,
      texto: contenido.trim(),
      media,
      mediaNombre,
      cita: null,
      tipo: placeholder ? 'eliminado' : media ? 'media' : 'texto',
    })
  }

  mensajes.sort((x, y) => x.ts - y.ts)
  mensajes.forEach((m, i) => (m.id = i))

  return { mensajes, emisores: [...emisores], fechaExport: null, origen: 'txt' }
}

function serieSegundosDeTxt(texto: string): Array<{ ts: number; autor: string }> {
  const crudos: Array<{ a: number; b: number; c: number; hora: number; min: number; seg: number; ampm: string; resto: string }> = []
  for (const linea of texto.split(/\r?\n/)) {
    const m = RE_LINEA_TXT.exec(linea)
    if (m) {
      crudos.push({
        a: Number(m[1]),
        b: Number(m[2]),
        c: Number(m[3]),
        hora: Number(m[4]),
        min: Number(m[5]),
        seg: Number(m[6]),
        ampm: m[7],
        resto: m[8],
      })
    }
  }
  let diaPrimero = false
  for (const c of crudos) {
    if (c.a > 12) {
      diaPrimero = true
      break
    }
    if (c.b > 12) break
  }
  const serie: Array<{ ts: number; autor: string }> = []
  for (const c of crudos) {
    if (/^- /.test(c.resto) || !/^[^:[]+?: /.test(c.resto)) continue
    const sep = /^[^:[]+?: /.exec(c.resto)
    if (!sep) continue
    const dia = diaPrimero ? c.a : c.b
    const mes = (diaPrimero ? c.b : c.a) - 1
    const hora12 = c.hora % 12 + (c.ampm.toUpperCase().startsWith('P') ? 12 : 0)
    serie.push({
      ts: new Date(2000 + c.c, mes, dia, hora12, c.min, c.seg).getTime(),
      autor: sep[0].slice(0, -2),
    })
  }
  return serie
}

export async function parsearArchivo(file: File): Promise<Chat> {
  const { texto, origen, textoTxt } = await leerArchivo(file)
  const chat = origen === 'md' ? armarMd(texto) : armarTxt(texto)
  if (chat.mensajes.length === 0) {
    throw new Error('No se encontraron mensajes en el archivo.')
  }
  if (textoTxt) {
    const serie = serieSegundosDeTxt(textoTxt)
    if (serie.length > 0) chat.serieSegundos = serie
  }
  chat.parserVersion = PARSER_VERSION
  return chat
}
