export function quitarAcentos(texto: string) {
  return texto.normalize('NFD').replace(/\p{M}/gu, '')
}

export function normalizar(texto: string) {
  return quitarAcentos(texto.toLowerCase())
    .replace(/([a-z])\1+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

export const STOPWORDS = new Set(
  `de la que el en y a los del se las por un para con no una su al lo como más pero sus le ya o este sí porque esta entre cuando muy sin sobre también me hasta hay donde quien desde todo nos durante todos uno les ni contra otros ese eso ante ellos e esto mí antes algunos qué unos yo otro otras otra él tanto esa estos mucho quienes nada muchos cual poco ella estar estas algunas algo nosotros mi mis tú te ti tu tus ellas nosotras vosotros vosotras os mío mía míos mías tuyo tuya tuyos tuyos suyo suya suyos suyas nuestro nuestra nuestros nuestras vuestro vuestra vuestros vuestras ese esa esos esas este esta estos estas ese eso aquel aquella aquellos aquello aquí aquí allí entonces desde porque aunque nunca siempre jamás cada menos algo tan solo sólo haber ha han he hemos has hay había eran era fui fuiste fue fuimos fuisteis fueron ser es son sido siendo soy eres somos sois están está estás estamos estáis estuve estuviste estuvo estuvimos estuvisteis estuvieron tener tiene tienen tengo tenemos tenéis tenía tenían tendré tendrá tendremos tendrán tenía tendríamos habría habrían haya hayan había habían
también todo todos toda todas cada cual cuáles quien quienes qué cómo cuándo dónde cuánto cuánta cuántos cuántas
http https www com net org html
jajaja jajajaja jeje jiji jajaja`.split(/\s+/),
)

export function horaCorta(ts: number) {
  const d = new Date(ts)
  let h = d.getHours()
  const m = d.getMinutes().toString().padStart(2, '0')
  const ampm = h >= 12 ? 'p. m.' : 'a. m.'
  h = h % 12 || 12
  return `${h}:${m} ${ampm}`
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function etiquetaDia(ts: number) {
  const d = new Date(ts)
  const hoy = new Date()
  const ayer = new Date(hoy)
  ayer.setDate(hoy.getDate() - 1)
  const mismaFecha = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (mismaFecha(d, hoy)) return 'HOY'
  if (mismaFecha(d, ayer)) return 'AYER'
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`
}
