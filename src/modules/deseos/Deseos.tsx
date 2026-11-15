import { useEffect, useState, type CSSProperties } from 'react'
import { guardarDeseos, obtenerDeseos } from '../../lib/db'
import { NOMBRE_ELLA, NOMBRE_MIO } from '../wa-chat/estadisticas'
import type { Deseo } from './tipos'
import './deseos.css'

interface Props {
  onVolver: () => void
}

type Hoja = null | { modo: 'nuevo' } | { modo: 'ver'; deseo: Deseo }

/** polvo de estrellas, generado una sola vez */
const POLVO = Array.from({ length: 42 }, () => ({
  x: Math.random() * 100,
  y: Math.random() * 100,
  r: 0.8 + Math.random() * 1.6,
  o: 0.2 + Math.random() * 0.5,
  dur: 2.6 + Math.random() * 4,
  delay: Math.random() * 5,
}))

function nombre(d: Deseo) {
  return d.autor === 'yo' ? NOMBRE_MIO : NOMBRE_ELLA
}

function fecha(ts: number) {
  return new Date(ts).toLocaleDateString('es', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** busca un hueco libre, lejos de las estrellas que ya están colgadas */
function colocar(deseos: Deseo[]) {
  let mejor = { x: 50, y: 45 }
  let mejorDist = -1
  for (let i = 0; i < 40; i++) {
    const x = 9 + Math.random() * 82
    const y = 8 + Math.random() * 76
    let d = Infinity
    for (const o of deseos) {
      d = Math.min(d, Math.hypot(o.x - x, (o.y - y) * 1.25))
    }
    if (d > mejorDist) {
      mejorDist = d
      mejor = { x, y }
    }
  }
  return mejor
}

export default function Deseos({ onVolver }: Props) {
  const [deseos, setDeseos] = useState<Deseo[]>([])
  const [cargando, setCargando] = useState(true)
  const [hoja, setHoja] = useState<Hoja>(null)
  const [texto, setTexto] = useState('')
  const [autor, setAutor] = useState<'yo' | 'ella'>('yo')

  useEffect(() => {
    let vivo = true
    obtenerDeseos()
      .then((guardados) => {
        if (vivo) setDeseos(guardados ?? [])
      })
      .catch(() => {
        if (vivo) setDeseos([])
      })
      .finally(() => {
        if (vivo) setCargando(false)
      })
    return () => {
      vivo = false
    }
  }, [])

  useEffect(() => {
    if (!hoja) return
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHoja(null)
    }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [hoja])

  function abrirNuevo() {
    setTexto('')
    setAutor('yo')
    setHoja({ modo: 'nuevo' })
  }

  async function colgar() {
    const limpio = texto.trim()
    if (!limpio) return
    const sitio = colocar(deseos)
    const nuevo: Deseo = {
      id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      texto: limpio,
      autor,
      ts: Date.now(),
      x: sitio.x,
      y: sitio.y,
      tam: 0.85 + Math.random() * 0.4,
    }
    const siguiente = [...deseos, nuevo]
    setDeseos(siguiente)
    setHoja(null)
    await guardarDeseos(siguiente)
  }

  return (
    <div className="deseos-pantalla" onClick={(e) => e.stopPropagation()}>
      <div className="deseos-cab">
        <button className="deseos-volver" onClick={onVolver} aria-label="Volver">
          ←
        </button>
        <div>
          <h1>El cielo de los deseos</h1>
          <p className="deseos-sub">
            {deseos.length === 0
              ? 'Todavía no hay estrellas'
              : `${deseos.length} ${deseos.length === 1 ? 'deseo colgado' : 'deseos colgados'}`}
          </p>
        </div>
      </div>

      <div className="deseos-cielo" onClick={abrirNuevo}>
        <div className="deseos-polvo" aria-hidden="true">
          {POLVO.map((p, i) => (
            <i
              key={i}
              style={
                {
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  width: p.r,
                  height: p.r,
                  '--o': p.o,
                  '--dur': `${p.dur}s`,
                  '--delay': `${p.delay}s`,
                } as CSSProperties
              }
            />
          ))}
        </div>
        {deseos.length > 1 && (
          <svg
            className="deseos-lineas"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polyline
              points={deseos.map((d) => `${d.x},${d.y}`).join(' ')}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}
        {deseos.map((d) => (
          <button
            key={d.id}
            className={`deseo-estrella deseo-${d.autor}`}
            style={
              {
                left: `${d.x}%`,
                top: `${d.y}%`,
                '--tam': d.tam,
                '--dur': `${3.4 + d.tam}s`,
                '--delay': `${(d.x % 10) * 0.28}s`,
              } as CSSProperties
            }
            onClick={(e) => {
              e.stopPropagation()
              setHoja({ modo: 'ver', deseo: d })
            }}
            aria-label={`Deseo de ${nombre(d)}: ${d.texto}`}
          >
            <span className="deseo-halo" />
            <span className="deseo-punto" />
          </button>
        ))}

        {!cargando && deseos.length === 0 && (
          <span className="deseos-vacio">
            Toca el cielo
            <br />y pide un deseo
          </span>
        )}
      </div>

      <div className="deseos-acciones">
        <button className="deseos-prim" onClick={abrirNuevo}>
          ✨ Pedir un deseo
        </button>
        <p className="deseos-pie">
          Cada deseo se cuelga como una estrella y se queda aquí guardado.
        </p>
      </div>

      {hoja && (
        <div className="deseos-fondo" onClick={() => setHoja(null)}>
          <div
            className="deseos-hoja"
            role="dialog"
            aria-modal="true"
            aria-label={hoja.modo === 'nuevo' ? 'Pedir un deseo' : 'Tu deseo'}
            onClick={(e) => e.stopPropagation()}
          >
            {hoja.modo === 'nuevo' ? (
              <>
                <h2>Pide un deseo</h2>
                <p className="deseos-nota">
                  Lo que escribas se queda en el cielo, para siempre.
                </p>
                <textarea
                  className="deseos-texto"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  maxLength={180}
                  rows={3}
                  autoFocus
                  placeholder="Que se cumpla…"
                />
                <div className="deseos-firmas">
                  <button
                    className={autor === 'yo' ? 'activo' : ''}
                    onClick={() => setAutor('yo')}
                  >
                    {NOMBRE_MIO}
                  </button>
                  <button
                    className={autor === 'ella' ? 'activo' : ''}
                    onClick={() => setAutor('ella')}
                  >
                    {NOMBRE_ELLA}
                  </button>
                </div>
                <div className="deseos-botones">
                  <button className="deseos-sec" onClick={() => setHoja(null)}>
                    Ahora no
                  </button>
                  <button className="deseos-prim" onClick={colgar} disabled={!texto.trim()}>
                    Colgar en el cielo
                  </button>
                </div>
              </>
            ) : (
              <>
                <span className="deseos-ver-estrella" aria-hidden="true">
                  ✦
                </span>
                <p className="deseos-ver-texto">{hoja.deseo.texto}</p>
                <p className="deseos-ver-firma">
                  {nombre(hoja.deseo)} · {fecha(hoja.deseo.ts)}
                </p>
                <div className="deseos-botones">
                  <button className="deseos-sec" onClick={() => setHoja(null)}>
                    Cerrar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
