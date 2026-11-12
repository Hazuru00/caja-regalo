export type MediaTipo =
  | 'sticker'
  | 'voz'
  | 'audio'
  | 'video'
  | 'imagen'
  | 'gif'
  | 'documento'
  | 'contacto'
  | 'ubicacion'
  | 'album'

export type MsgTipo = 'texto' | 'media' | 'sistema' | 'llamada' | 'eliminado'

export interface Cita {
  autor: string
  texto: string
}

export interface Mensaje {
  id: number
  ts: number
  autor: string | null
  texto: string
  media: MediaTipo | null
  mediaNombre: string
  cita: Cita | null
  tipo: MsgTipo
}

export interface Chat {
  mensajes: Mensaje[]
  emisores: string[]
  fechaExport: string | null
  origen: 'md' | 'txt'
  serieSegundos?: Array<{ ts: number; autor: string }>
  parserVersion?: number
}

export interface Mapeo {
  yo: string
  ella: string
}

export interface Horario {
  archivo: number
  vista: number | 'archivo'
  porPersona: boolean
  tu: number
  ella: number
}
