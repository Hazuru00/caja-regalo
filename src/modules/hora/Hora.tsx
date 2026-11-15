import { useEffect, useMemo, useState } from 'react'
import { NOMBRE_ELLA, NOMBRE_MIO } from '../wa-chat/estadisticas'
import './hora.css'

interface Props {
  onVolver: () => void
}

type Tramo = [number, number]

const ZONAS: Array<[string, string]> = [
  ['Europe/Madrid', 'Madrid'],
  ['Atlantic/Canary', 'Canarias'],
  ['Europe/Lisbon', 'Lisboa'],
  ['America/Caracas', 'Caracas'],
  ['America/Bogota', 'Bogotá'],
  ['America/Lima', 'Lima'],
  ['America/Guayaquil', 'Quito'],
  ['America/La_Paz', 'La Paz'],
  ['America/Santiago', 'Santiago'],
  ['America/Argentina/Buenos_Aires', 'Buenos Aires'],
  ['America/Montevideo', 'Montevideo'],
  ['America/Asuncion', 'Asunción'],
  ['America/Mexico_City', 'México'],
  ['America/Havana', 'La Habana'],
  ['America/Santo_Domingo', 'Santo Domingo'],
  ['America/Puerto_Rico', 'San Juan'],
  ['America/Panama', 'Panamá'],
  ['America/Costa_Rica', 'San José'],
  ['America/El_Salvador', 'San Salvador'],
  ['America/Guatemala', 'Guatemala'],
  ['America/Tegucigalpa', 'Tegucigalpa'],
  ['America/Managua', 'Managua'],
  ['America/New_York', 'Nueva York'],
  ['America/Los_Angeles', 'Los Ángeles'],
]

const AW0 = 8 * 60
const AW1 = 23 * 60

interface Husos {
  yo: string
  ella: string
}

function leerHusos(): Husos {
  try {
    const crudo = localStorage.getItem('husos')
    if (crudo) {
      const p = JSON.parse(crudo) as Partial<Husos>
      if (typeof p.yo === 'string' && typeof p.ella === 'string') {
        return { yo: p.yo, ella: p.ella }
      }
    }
  } catch {
    /* sin husos guardados */
  }
  const zona = Intl.DateTimeFormat().resolvedOptions().timeZone
  return { yo: zona, ella: zona }
}

function crearFormatos(zona: string) {
  return {
    hora: new Intl.DateTimeFormat('es', {
      timeZone: zona,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }),
    seg: new Intl.DateTimeFormat('es', { timeZone: zona, second: '2-digit' }),
    fecha: new Intl.DateTimeFormat('es', {
      timeZone: zona,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }),
    hora24: new Intl.DateTimeFormat('en-GB', {
      timeZone: zona,
      hour: '2-digit',
      hourCycle: 'h23',
    }),
    dia: new Intl.DateTimeFormat('en-CA', {
      timeZone: zona,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }),
    offset: new Intl.DateTimeFormat('en-US', {
      timeZone: zona,
      timeZoneName: 'longOffset',
    }),
  }
}

function minutosOffset(fmt: ReturnType<typeof crearFormatos>, d: Date) {
  const txt =
    fmt.offset.formatToParts(d).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+00:00'
  const m = txt.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
  if (!m) return 0
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0))
}

function mod(n: number, base: number) {
  return ((n % base) + base) % base
}

function hhmm(min: number) {
  const m = Math.round(min)
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** una ventana de 15 h que puede cruzar la medianoche, partida en tramos */
function ventana(inicio: number, fin: number): Tramo[] {
  const i = mod(inicio, 1440)
  const largo = mod(fin - inicio, 1440) || 900
  return i + largo <= 1440 ? [[i, i + largo]] : [[i, 1440], [0, (i + largo) % 1440]]
}

function capitalizar(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export default function Hora({ onVolver }: Props) {
  const [husos, setHusos] = useState<Husos>(leerHusos)
  const [ahora, setAhora] = useState<Date | null>(null)

  useEffect(() => {
    const tick = () => setAhora(new Date())
    const raf = requestAnimationFrame(tick)
    const id = window.setInterval(tick, 1000)
    return () => {
      cancelAnimationFrame(raf)
      clearInterval(id)
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('husos', JSON.stringify(husos))
    } catch {
      /* sin permiso de almacenamiento */
    }
  }, [husos])

  const fmt = useMemo(
    () => ({ yo: crearFormatos(husos.yo), ella: crearFormatos(husos.ella) }),
    [husos],
  )

  const estado = (formato: ReturnType<typeof crearFormatos>, d: Date) => {
    const h = Number(formato.hora24.format(d))
    if (h >= 6 && h < 8) return { icono: '🌅', texto: 'amanece', clase: 'alba' }
    if (h >= 8 && h < 19) return { icono: '☀️', texto: 'de día', clase: 'dia' }
    if (h >= 19 && h < 21) return { icono: '🌇', texto: 'atardece', clase: 'alba' }
    return { icono: '🌙', texto: 'de noche', clase: 'noche' }
  }

  let delta = 0
  let nowMin = 0
  let bandasElla: Tramo[] = []
  const solape: Tramo[] = []

  if (ahora) {
    const offYo = minutosOffset(fmt.yo, ahora)
    const offElla = minutosOffset(fmt.ella, ahora)
    delta = offElla - offYo
    nowMin = mod(
      ahora.getUTCHours() * 60 + ahora.getUTCMinutes() + ahora.getUTCSeconds() / 60 + offYo,
      1440,
    )
    bandasElla = ventana(AW0 - delta, AW1 - delta)
    for (const [s, e] of bandasElla) {
      const a = Math.max(AW0, s)
      const b = Math.min(AW1, e)
      if (b > a) solape.push([a, b])
    }
  }

  const difTexto = (() => {
    const abs = Math.abs(delta)
    if (!ahora || abs === 0) return 'Estáis en la misma hora'
    const h = Math.floor(abs / 60)
    const m = abs % 60
    const cant = m === 0 ? `${h} h` : `${h} h ${m} min`
    return `${NOMBRE_ELLA} va ${cant} por ${delta > 0 ? 'delante' : 'detrás'}`
  })()

  const solapeTexto = solape.length
    ? solape.map(([s, e]) => `${hhmm(s)}–${hhmm(e)}`).join(' y ')
    : null

  const hoy = ahora ? fmt.yo.dia.format(ahora) : ''
  const diaElla = ahora ? fmt.ella.dia.format(ahora) : ''
  const desfaseDia = hoy && diaElla && diaElla !== hoy ? (diaElla > hoy ? 'mañana' : 'ayer') : ''

  const tarjeta = (
    nombre: string,
    zona: string,
    formato: ReturnType<typeof crearFormatos>,
    desfase: string,
    alCambiar: (z: string) => void,
  ) => {
    const e = ahora ? estado(formato, ahora) : { icono: '·', texto: '', clase: 'dia' }
    return (
      <div className={`hora-tarjeta ${e.clase}`}>
        <div className="hora-tarjeta-cab">
          <span className="hora-select">
            <select
              value={zona}
              onChange={(ev) => alCambiar(ev.target.value)}
              aria-label={`Zona horaria de ${nombre}`}
            >
              {ZONAS.map(([id, etiqueta]) => (
                <option key={id} value={id}>
                  {etiqueta}
                </option>
              ))}
              {!ZONAS.some(([id]) => id === zona) && <option value={zona}>{zona}</option>}
            </select>
            <span className="hora-flecha" aria-hidden="true" />
          </span>
          <span className="hora-icono" aria-hidden="true">
            {e.icono}
          </span>
        </div>
        <div className="hora-reloj">
          {ahora ? formato.hora.format(ahora) : '--:--'}
          {ahora && <span className="hora-seg">{formato.seg.format(ahora)}</span>}
        </div>
        <div className="hora-fecha">
          {ahora ? capitalizar(formato.fecha.format(ahora)) : ' '}
          {desfase && <span className="hora-desfase"> · {desfase}</span>}
        </div>
        <div className="hora-estado">{e.texto}</div>
      </div>
    )
  }

  return (
    <div className="hora-pantalla">
      <div className="hora-cab">
        <button className="hora-volver" onClick={onVolver} aria-label="Volver">
          ←
        </button>
        <div>
          <h1>La hora de los dos</h1>
          <p className="hora-sub">Dos cielos, la misma hora.</p>
        </div>
      </div>

      <div className="hora-tarjetas">
        {tarjeta(NOMBRE_MIO, husos.yo, fmt.yo, '', (z) => setHusos({ ...husos, yo: z }))}
        {tarjeta(NOMBRE_ELLA, husos.ella, fmt.ella, desfaseDia, (z) =>
          setHusos({ ...husos, ella: z }),
        )}
      </div>

      <p className="hora-pista">Toca la ciudad para cambiarla</p>

      <p className="hora-diferencia">{difTexto}</p>

      <section className="hora-franja">
        <h2>Cuándo estáis despiertos</h2>
        <p className="hora-nota">En tu hora. La franja dorada es cuando coincidís.</p>

        <div className="hora-fila">
          <span className="hora-etiqueta">{NOMBRE_MIO}</span>
          <div className="hora-barra">
            <span
              className="hora-banda mia"
              style={{ left: '33.33%', width: '62.5%' }}
            />
            {ahora && (
              <span className="hora-ahora" style={{ left: `${(nowMin / 1440) * 100}%` }} />
            )}
          </div>
        </div>

        <div className="hora-fila">
          <span className="hora-etiqueta">{NOMBRE_ELLA}</span>
          <div className="hora-barra">
            {bandasElla.map(([s, e], i) => (
              <span
                key={i}
                className="hora-banda suya"
                style={{
                  left: `${(s / 1440) * 100}%`,
                  width: `${((e - s) / 1440) * 100}%`,
                }}
              />
            ))}
            {ahora && (
              <span className="hora-ahora" style={{ left: `${(nowMin / 1440) * 100}%` }} />
            )}
          </div>
        </div>

        <div className="hora-eje" aria-hidden="true">
          <span className="hora-etiqueta" />
          <div className="hora-marcas">
            <span>00</span>
            <span>06</span>
            <span>12</span>
            <span>18</span>
            <span>24</span>
          </div>
        </div>

        <div className="hora-fila coincide">
          <span className="hora-etiqueta">Los dos</span>
          <div className="hora-barra">
            {solape.map(([s, e], i) => (
              <span
                key={i}
                className="hora-banda oro"
                style={{
                  left: `${(s / 1440) * 100}%`,
                  width: `${((e - s) / 1440) * 100}%`,
                }}
              />
            ))}
          </div>
        </div>

        <p className="hora-coincide">
          {solapeTexto ? `De ${solapeTexto}, tu hora.` : 'No os pilla despiertos a la vez 😴'}
        </p>
      </section>
    </div>
  )
}
