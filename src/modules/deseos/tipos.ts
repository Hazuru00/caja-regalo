export interface Deseo {
  id: string
  texto: string
  autor: 'yo' | 'ella'
  ts: number
  /** posición en el cielo, en % */
  x: number
  y: number
  /** tamaño de la estrella */
  tam: number
}
