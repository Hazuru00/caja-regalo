/** Generador del árbol: geometría procedural con semilla fija,
 * así el árbol de ustedes siempre es el mismo y solo crece. */

export interface Rama {
  x1: number
  y1: number
  x2: number
  y2: number
  w: number
  n: number
}

export interface Hoja {
  x: number
  y: number
  r: number
  c: string
  g: number
}

export interface Flor {
  x: number
  y: number
  r: number
  c: string
  g: number
}

/** manchas de follaje lejano: dan volumen a la copa */
export interface Mancha {
  x: number
  y: number
  r: number
}

export interface Arbol {
  ramas: Rama[]
  hojas: Hoja[]
  flores: Flor[]
  fondo: Mancha[]
}

/** azar con semilla: la misma escena siempre se ve igual */
export function crearRnd(semilla: number) {
  let s = semilla >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const PALETA_HOJAS = ['#57b177', '#3f9c66', '#74c98d', '#2f8f5c', '#8ad7a0']
const PALETA_HOJAS_SOL = ['#7ac98d', '#5fb87a', '#8ad7a0', '#6cc389', '#9adfae']
const PALETA_FLORES = ['#ff9ec4', '#ffb8d2', '#ffd6e6', '#f78fb3', '#ffc0a3']

function mulberry32(a: number) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function generarArbol(
  semilla: number,
  niveles: number,
  florCada: number,
  troncoSegs = 6,
  largoTronco = 30,
): Arbol {
  const rnd = mulberry32(semilla)
  const ramas: Rama[] = []
  const hojas: Hoja[] = []
  const flores: Flor[] = []
  const fondo: Mancha[] = []

  const SUELO = 126
  const NIVEL_MAX = 6

  // tronco: sube dando pequeños bandazos
  let x = 50
  let y = SUELO
  let ang = -Math.PI / 2
  const segs = troncoSegs
  for (let i = 0; i < segs; i++) {
    const nx = x + Math.cos(ang) * (largoTronco / segs)
    const ny = y + Math.sin(ang) * (largoTronco / segs)
    ramas.push({ x1: x, y1: y, x2: nx, y2: ny, w: 4.4 * (1 - (i / segs) * 0.3), n: 0 })
    x = nx
    y = ny
    ang += (rnd() - 0.5) * 0.14
  }

  const nivelMax = Math.max(2, Math.min(NIVEL_MAX, niveles))

  /** una rama: 2 tramos con curvita, y al final brotan las hijas */
  function brotar(x1: number, y1: number, a: number, largo: number, ancho: number, nivel: number) {
    const curva = (rnd() - 0.5) * 0.3
    const mx = x1 + Math.cos(a + curva * 0.5) * (largo / 2)
    const my = y1 + Math.sin(a + curva * 0.5) * (largo / 2)
    const x2 = mx + Math.cos(a + curva) * (largo / 2)
    const y2 = my + Math.sin(a + curva) * (largo / 2)
    const w2 = ancho * 0.82
    ramas.push({ x1, y1, x2: mx, y2: my, w: ancho, n: nivel })
    ramas.push({ x1: mx, y1: my, x2, y2, w: w2, n: nivel })

    if (nivel >= nivelMax) {
      const g = rnd()
      // las hojas del lado del sol (derecha) son más claras
      const paleta = x2 > 50 ? PALETA_HOJAS_SOL : PALETA_HOJAS
      hojas.push({
        x: x2,
        y: y2,
        r: 2.7 + rnd() * 2,
        c: paleta[Math.floor(rnd() * paleta.length)],
        g,
      })
      // detrás de las ramas, una mancha de follaje: da volumen
      if (rnd() < 0.55) {
        const hacia = 0.1 + rnd() * 0.22
        fondo.push({
          x: x2 + (50 - x2) * hacia + (rnd() - 0.5) * 4,
          y: y2 + (86 - y2) * hacia + (rnd() - 0.5) * 4,
          r: 3.4 + rnd() * 3.4,
        })
      }
      if (florCada > 0 && rnd() < florCada) {
        flores.push({
          x: x2,
          y: y2,
          r: 2 + rnd() * 1.2,
          c: PALETA_FLORES[Math.floor(rnd() * PALETA_FLORES.length)],
          g,
        })
      }
      return
    }

    const hijos = rnd() < 0.45 ? 3 : 2
    const disp = 0.52 + rnd() * 0.34
    // la gravedad: las ramas de fuera se van flattening / caen un poco
    const gravedad = nivel * 0.045
    for (let i = 0; i < hijos; i++) {
      const off = (i - (hijos - 1) / 2) * disp + (rnd() - 0.5) * 0.18
      brotar(
        x2,
        y2,
        a + off + gravedad,
        largo * (0.68 + rnd() * 0.16),
        w2 * 0.68,
        nivel + 1,
      )
    }
  }

  // del tronco salen varias ramas primarias en distintas direcciones
  const principales = 2 + Math.floor(rnd() * 3)
  for (let i = 0; i < principales; i++) {
    const off = (i - (principales - 1) / 2) * (0.52 + rnd() * 0.22)
    brotar(
      x - 3 + rnd() * 6,
      y + 2 - rnd() * 6,
      ang + off,
      19 + rnd() * 5,
      2.5,
      1,
    )
  }
  // y un par de ramas bajas, para que la silueta no sea una seta
  for (let i = 0; i < 2; i++) {
    const lado = rnd() < 0.5 ? -1 : 1
    brotar(
      x + lado * 1.5,
      y + 12 + rnd() * 8,
      ang + lado * (0.85 + rnd() * 0.35),
      15 + rnd() * 5,
      1.9,
      1,
    )
  }

  return { ramas, hojas, flores, fondo }
}
