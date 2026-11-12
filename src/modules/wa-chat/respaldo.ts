import type { Chat, MediaTipo } from './tipos'

const MESES_MD = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

const MD_LABEL: Record<MediaTipo, string> = {
  sticker: 'Sticker',
  voz: 'Mensaje de voz',
  audio: 'Audio',
  video: 'Video',
  imagen: 'Imagen',
  gif: 'GIF',
  documento: 'Documento',
  contacto: 'Contacto',
  ubicacion: 'Ubicación',
  album: 'Mensaje de album',
}

function horaMd(ts: number): string {
  const d = new Date(ts)
  let h = d.getHours()
  const pm = h >= 12
  h = h % 12 || 12
  const m = d.getMinutes().toString().padStart(2, '0')
  return `[${h}:${m} ${pm ? 'p. m.' : 'a. m.'}]`
}

/** Genera un .md con el mismo formato que entiende nuestro parser (re-importable). */
export function generarRespaldoMd(chat: Chat): string {
  const lineas: string[] = []
  let diaActual = ''
  for (const m of chat.mensajes) {
    const d = new Date(m.ts)
    const dia = `${d.getDate()} de ${MESES_MD[d.getMonth()]} de ${d.getFullYear()}`
    if (dia !== diaActual) {
      if (lineas.length) lineas.push('')
      lineas.push(`## ${dia}`)
      lineas.push('')
      diaActual = dia
    }
    const h = horaMd(m.ts)
    if (m.tipo === 'sistema' || m.tipo === 'llamada') {
      lineas.push(`${h} __${m.texto.replace(/\n/g, ' ')}__`)
      continue
    }
    const autor = m.autor ?? ''
    if (m.tipo === 'media' && m.media) {
      lineas.push(`${h} **${autor}:** [${MD_LABEL[m.media]}]${m.mediaNombre ? ' ' + m.mediaNombre : ''}`)
      if (m.cita) lineas.push(`> _${m.cita.autor}: ${m.cita.texto.replace(/\n/g, ' ')}_`)
      continue
    }
    lineas.push(`${h} **${autor}:**`)
    if (m.cita) {
      const partes = m.cita.texto.split('\n')
      if (partes.length === 1) {
        lineas.push(`> _${m.cita.autor}: ${m.cita.texto}_`)
      } else {
        lineas.push(`> _${m.cita.autor}: ${partes[0]}`)
        for (let i = 1; i < partes.length - 1; i++) lineas.push(partes[i])
        lineas.push(`${partes[partes.length - 1]}_`)
      }
    }
    const cuerpo = m.tipo === 'eliminado' ? `_${m.texto.replace(/\n/g, ' ')}_` : m.texto
    if (cuerpo) {
      for (const l of cuerpo.split('\n')) lineas.push(l)
    }
  }
  return lineas.join('\n') + '\n'
}

export function descargarRespaldo(chat: Chat) {
  const md = generarRespaldoMd(chat)
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'chat-respaldo.md'
  a.click()
  URL.revokeObjectURL(url)
}
