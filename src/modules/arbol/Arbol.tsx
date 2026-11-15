import { useEffect, useMemo, useState } from 'react'
import { obtenerChat } from '../../lib/db'
import { normalizar } from '../../lib/texto'
import { regexDeFrase } from '../wa-chat/estadisticas'
import { generarArbol, crearRnd } from './arbol'
import './arbol.css'

/** Fecha en que empezaron a hablar (Instagram, 5 de julio de 2026) */
const INICIO = new Date(2026, 6, 5)

/** dos mariposas que revolotean entre las ramas */
const MARIPOSAS = [
  { x: 30, y: 60, dx: 18, dy: -12, dur: 17, delay: -2, c: '#ffb8d2' },
  { x: 68, y: 92, dx: -15, dy: -16, dur: 23, delay: -11, c: '#ffe0a8' },
]

interface Props {
  onVolver: () => void
}

interface Datos {
  dias: number
  mensajes: number
  teAmo: number
  hayChat: boolean
}

/** sube de 0 al valor cuando aparece: se siente vivo */
function useContador(valor: number) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!valor) return
    const dur = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 1100
    let raf = 0
    const t0 = performance.now()
    const paso = (t: number) => {
      const p = Math.max(0, Math.min(1, (t - t0) / dur))
      setN(Math.round(valor * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(paso)
    }
    raf = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(raf)
  }, [valor])
  return n
}

/** número que se anima solo, sin re-renderizar el árbol */
function Numero({ valor }: { valor: number }) {
  return <>{useContador(valor).toLocaleString('es')}</>
}

export default function Arbol({ onVolver }: Props) {
  const [datos, setDatos] = useState<Datos | null>(null)

  useEffect(() => {
    let vivo = true
    obtenerChat()
      .then((chat) => {
        if (!vivo) return
        if (!chat) {
          setDatos({ dias: 0, mensajes: 0, teAmo: 0, hayChat: false })
          return
        }
        const re = regexDeFrase(['te amo', 'ti amo'])
        let teAmo = 0
        for (const m of chat.mensajes) {
          if (!m.texto) continue
          re.lastIndex = 0
          teAmo += (normalizar(m.texto).match(re) ?? []).length
        }
        const dias = Math.max(
          1,
          Math.floor((Date.now() - INICIO.getTime()) / 86400000),
        )
        setDatos({ dias, mensajes: chat.mensajes.length, teAmo, hayChat: true })
      })
      .catch(() => setDatos({ dias: 0, mensajes: 0, teAmo: 0, hayChat: false }))
    return () => {
      vivo = false
    }
  }, [])

  const arbol = useMemo(() => {
    const dias = datos?.dias ?? 0
    const mensajes = datos?.mensajes ?? 0
    const teAmo = datos?.teAmo ?? 0
    const niveles = Math.max(2, Math.min(6, 2 + Math.floor(dias / 45) + Math.floor(mensajes / 25000)))
    const florCada = Math.min(0.3, teAmo / 20000)
    const troncoSegs = Math.max(4, Math.min(10, 4 + Math.floor(dias / 40)))
    return generarArbol(20260705, niveles, florCada, troncoSegs, 24 + Math.min(12, dias / 14))
  }, [datos])

  /** hojitas y pétalos que flotan alrededor */
  const petalas = useMemo(() => {
    const rnd = crearRnd(987654321)
    const out: Array<{
      x: number
      y: number
      r: number
      c: string
      dur: number
      delay: number
      dx: number
      dy: number
    }> = []
    const cols = ['#7ec894', '#ffb3cd', '#ffe0a8', '#9adfae', '#ffc9dd']
    for (let i = 0; i < 24; i++) {
      out.push({
        x: 6 + rnd() * 88,
        y: 18 + rnd() * 70,
        r: 1.1 + rnd() * 1.5,
        c: cols[Math.floor(rnd() * cols.length)],
        dur: 7 + rnd() * 8,
        delay: rnd() * 14,
        dx: (rnd() - 0.5) * 26,
        dy: 34 + rnd() * 16,
      })
    }
    return out
  }, [])

  /** hierba al pie, cada brizna con su ritmo */
  const hierba = useMemo(() => {
    const rnd = crearRnd(424242)
    const cols = ['#4f9e6a', '#3f8c5c', '#67b57f', '#5aa873']
    return Array.from({ length: 30 }, () => {
      const x = 16 + rnd() * 68
      const h = 3 + rnd() * 6
      return {
        x,
        d: `M ${x} 126 Q ${x + (rnd() - 0.5) * 5} ${126 - h} ${x + (rnd() - 0.5) * 9} ${126 - h * 1.4}`,
        c: cols[Math.floor(rnd() * cols.length)],
        w: 0.7 + rnd() * 0.7,
        dur: 3.4 + rnd() * 2.6,
        delay: rnd() * 4,
      }
    })
  }, [])

  /** luciérnagas que vagan entre las ramas */
  const luciernagas = useMemo(() => {
    const rnd = crearRnd(778899)
    return Array.from({ length: 12 }, () => ({
      x: 14 + rnd() * 72,
      y: 22 + rnd() * 96,
      r: 1 + rnd() * 0.8,
      dx: (rnd() - 0.5) * 22,
      dy: -10 - rnd() * 22,
      dur: 8 + rnd() * 7,
      delay: -rnd() * 15,
      pdur: 1.8 + rnd() * 1.6,
      pdelay: rnd() * 3,
    }))
  }, [])

  return (
    <div className="arbol-pantalla">
      <button className="arbol-volver" onClick={onVolver} aria-label="Volver">
        ←
      </button>

      <div className="arbol-lienzo">
        <svg viewBox="-18 -6 136 140" className="arbol-svg" role="img" aria-label="Nuestro árbol">
          <defs>
            <radialGradient id="arbol-fondo-grad">
              <stop offset="0" stopColor="#3f7d59" stopOpacity="0.78" />
              <stop offset="0.55" stopColor="#3f7d59" stopOpacity="0.52" />
              <stop offset="1" stopColor="#3f7d59" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse className="arbol-suelo" cx="50" cy="126" rx="34" ry="4.5" />
          <g className="arbol-fondo">
            {arbol.fondo.map((m, i) => (
              <ellipse
                key={i}
                cx={m.x}
                cy={m.y}
                rx={m.r}
                ry={m.r * 0.82}
                fill="url(#arbol-fondo-grad)"
              />
            ))}
          </g>
          <g className="arbol-ramas">
            {arbol.ramas.map((r, i) => {
              const largo = Math.hypot(r.x2 - r.x1, r.y2 - r.y1)
              return (
                <line
                  key={i}
                  x1={r.x1}
                  y1={r.y1}
                  x2={r.x2}
                  y2={r.y2}
                  strokeWidth={r.w}
                  strokeLinecap="round"
                  pathLength={largo}
                  style={{ ['--d' as string]: `${r.n * 0.12}s` }}
                />
              )
            })}
          </g>
          <g className="arbol-hojas">
            {arbol.hojas.map((h, i) => (
              <g key={i} transform={`rotate(${Math.round(h.g * 360)} ${h.x} ${h.y})`}>
                <ellipse
                  className="arbol-hoja"
                  cx={h.x}
                  cy={h.y}
                  rx={h.r}
                  ry={h.r * 0.72}
                  fill={h.c}
                  style={{
                    ['--d' as string]: `${0.6 + h.g * 2.4}s`,
                    ['--dur' as string]: `${3.4 + h.g * 3}s`,
                    ['--delay' as string]: `${h.g * 4}s`,
                  }}
                />
              </g>
            ))}
          </g>
          <g className="arbol-flores">
            {arbol.flores.map((f, i) => (
              <g key={i} transform={`translate(${f.x} ${f.y})`}>
                <g
                  className="arbol-flor"
                  style={{
                    ['--d' as string]: `${1.2 + f.g * 2.4}s`,
                    ['--dur' as string]: `${4.2 + f.g * 3}s`,
                    ['--delay' as string]: `${f.g * 5}s`,
                  }}
                >
                  {[0, 72, 144, 216, 288].map((a) => (
                    <ellipse
                      key={a}
                      cx={0}
                      cy={-f.r * 0.75}
                      rx={f.r * 0.46}
                      ry={f.r * 0.72}
                      fill={f.c}
                      transform={`rotate(${a})`}
                    />
                  ))}
                  <circle r={f.r * 0.34} fill="#ffe9a8" />
                </g>
              </g>
            ))}
          </g>
          <g className="arbol-petalas">
            {petalas.map((p, i) => (
              <ellipse
                key={i}
                className="arbol-petalo"
                cx={p.x}
                cy={p.y}
                rx={p.r}
                ry={p.r * 0.6}
                fill={p.c}
                style={{
                  ['--dur' as string]: `${p.dur}s`,
                  ['--delay' as string]: `${p.delay}s`,
                  ['--dx' as string]: `${p.dx}px`,
                  ['--dy' as string]: `${p.dy}px`,
                }}
              />
            ))}
          </g>
          <g className="arbol-hierbas">
            {hierba.map((h, i) => (
              <path
                key={i}
                className="arbol-hierba"
                d={h.d}
                stroke={h.c}
                strokeWidth={h.w}
                style={{
                  transformOrigin: `${h.x}px 126px`,
                  ['--dur' as string]: `${h.dur}s`,
                  ['--delay' as string]: `${h.delay}s`,
                }}
              />
            ))}
          </g>
          <g className="arbol-luciernagas">
            {luciernagas.map((l, i) => (
              <g
                key={i}
                className="arbol-luciernaga"
                style={{
                  ['--dur' as string]: `${l.dur}s`,
                  ['--delay' as string]: `${l.delay}s`,
                  ['--dx' as string]: `${l.dx}px`,
                  ['--dy' as string]: `${l.dy}px`,
                }}
              >
                <g transform={`translate(${l.x} ${l.y})`}>
                  <g
                    className="arbol-luciernaga-luz"
                    style={{
                      ['--pdur' as string]: `${l.pdur}s`,
                      ['--pdelay' as string]: `${l.pdelay}s`,
                    }}
                  >
                    <circle r={l.r * 3.2} fill="#ffe9a0" opacity="0.14" />
                    <circle r={l.r * 1.7} fill="#ffe9a0" opacity="0.35" />
                    <circle r={l.r} fill="#fff8d6" />
                  </g>
                </g>
              </g>
            ))}
          </g>
          <g className="arbol-mariposas">
            {MARIPOSAS.map((m, i) => (
              <g
                key={i}
                className="arbol-mariposa"
                style={{
                  ['--dur' as string]: `${m.dur}s`,
                  ['--delay' as string]: `${m.delay}s`,
                  ['--dx' as string]: `${m.dx}px`,
                  ['--dy' as string]: `${m.dy}px`,
                }}
              >
                <g transform={`translate(${m.x} ${m.y})`}>
                  <g className="arbol-mariposa-alas">
                    <ellipse
                      cx={-1.2}
                      cy={-0.6}
                      rx={1.6}
                      ry={2.1}
                      fill={m.c}
                      transform="rotate(-26)"
                    />
                    <ellipse
                      cx={1.2}
                      cy={-0.6}
                      rx={1.6}
                      ry={2.1}
                      fill={m.c}
                      transform="rotate(26)"
                    />
                    <ellipse cx={0} cy={0.1} rx={0.24} ry={1.7} fill="#6b4e35" />
                  </g>
                </g>
              </g>
            ))}
          </g>
        </svg>
      </div>

      <div className="arbol-pie">
        <h2>Nuestro árbol</h2>
        <p className="arbol-sub">
          Plantado el 5 de julio de 2026. Crece con cada mensaje nuestro.
        </p>
        {datos?.hayChat ? (
          <div className="arbol-datos">
            <div>
              <b>
                <Numero valor={datos.dias} />
              </b>
              <span>días juntos</span>
            </div>
            <div>
              <b>
                <Numero valor={datos.mensajes} />
              </b>
              <span>mensajes</span>
            </div>
            <div>
              <b>
                <Numero valor={datos.teAmo} />
              </b>
              <span>“te amo”</span>
            </div>
          </div>
        ) : (
          <p className="arbol-sub">Sube tu chat y el árbol crecerá con nosotros.</p>
        )}
      </div>
    </div>
  )
}
