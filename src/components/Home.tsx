import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { modulos } from '../modules/registry'
import { navegar } from '../lib/router'
import BotonTema from './BotonTema'

const FASE_LUNA = Math.floor(Date.now() / 86400000) % 3

export default function Home({ onBloquear }: { onBloquear: () => void }) {
  const [eclipse, setEclipse] = useState(false)
  const [eclipseSaliendo, setEclipseSaliendo] = useState(false)
  const [bloqueoTema, setBloqueoTema] = useState(false)
  const cieloRef = useRef<HTMLDivElement>(null)
  const estrellaRef = useRef<HTMLSpanElement>(null)
  const reposoRef = useRef({ x: 0, y: 0 })

  useLayoutEffect(() => {
    let gen = 0
    const ajustar = () => {
      const el = cieloRef.current
      if (!el) return
      // Sin transición mientras se aplican las vars: el read de clientWidth
      // fuerza un recalc con los fallbacks CSS y dispararía la animación.
      const brazos = el.querySelectorAll<HTMLElement>('.cielo-brazo')
      brazos.forEach((b) => {
        b.style.transition = 'none'
      })
      const w = el.clientWidth
      const h = el.clientHeight
      const px = 0.6 * w
      const py = 1.45 * h
      // En móvil el cielo es estrecho: el astro se va a la esquina superior
      // para no caer encima del regalo de la portada.
      const estrecho = w < 520
      const rx = estrecho ? w - 92 : Math.min(0.9 * w - 56, w - 130)
      const ry = estrecho ? 92 : 126
      const dx = rx - px
      const dy = py - ry
      const r = Math.hypot(dx, dy)
      const aRepo = (Math.atan2(dx, dy) * 180) / Math.PI
      const aSolOc = aRepo + 55
      const aLunaOc = (Math.asin(Math.max(-1, Math.min(1, (-80 - px) / r))) * 180) / Math.PI - 4
      reposoRef.current = { x: rx, y: ry }
      el.style.setProperty('--px', `${px}px`)
      el.style.setProperty('--py', `${py}px`)
      el.style.setProperty('--r', `${r}px`)
      el.style.setProperty('--a-reposo', `${aRepo}deg`)
      el.style.setProperty('--a-sol-oculto', `${aSolOc}deg`)
      el.style.setProperty('--a-luna-oculto', `${aLunaOc}deg`)
      el.style.setProperty('--rx', `${rx}px`)
      el.style.setProperty('--ry', `${ry}px`)
      const g = ++gen
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (g !== gen) return
          brazos.forEach((b) => {
            b.style.transition = ''
          })
        })
      )
    }
    ajustar()
    window.addEventListener('resize', ajustar)
    return () => {
      window.removeEventListener('resize', ajustar)
      gen++
    }
  }, [])

  useEffect(() => {
    if (!eclipse) return
    // 4.5 s de totalidad y luego la sombra sigue de largo
    const t1 = setTimeout(() => setEclipseSaliendo(true), 4500)
    const t2 = setTimeout(() => {
      setEclipse(false)
      setEclipseSaliendo(false)
    }, 5600)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [eclipse])

  useEffect(() => {
    if (!bloqueoTema) return
    // 4.5s de eclipse + 0.6s de salida: el candado cubre toda la coreografía
    const t = setTimeout(() => setBloqueoTema(false), 5100)
    return () => clearTimeout(t)
  }, [bloqueoTema])

  function alCielo(e: ReactMouseEvent<HTMLElement>) {
    const t = e.target as HTMLElement
    if (t.closest('button')) return
    const dx = e.clientX - reposoRef.current.x
    const dy = e.clientY - reposoRef.current.y
    if (Math.hypot(dx, dy) < 66 && !eclipse && !bloqueoTema) {
      setEclipse(true)
      setBloqueoTema(true)
      return
    }
    const el = estrellaRef.current
    if (el) {
      el.style.animation = 'none'
      void el.offsetWidth
      el.style.animation = ''
    }
  }

  return (
    <>
      <div className={`home-cielo ${eclipse ? 'con-eclipse' : ''}`} ref={cieloRef} aria-hidden="true">
        <span className="cielo-brazo cielo-brazo-sol">
          <span className="cielo-astro cielo-sol" />
        </span>
        <span className="cielo-brazo cielo-brazo-luna">
          <span className={`cielo-astro cielo-luna fase-${FASE_LUNA}`} />
        </span>
        <span className={`home-eclipse ${eclipse ? 'activo' : ''} ${eclipseSaliendo ? 'saliendo' : ''}`} />
      </div>
      <header className="app-barra home-barra">
        <div>
          <h1>Caja regalo</h1>
          <div className="sub">Jania & Moises 💛</div>
        </div>
        <BotonTema bloqueado={bloqueoTema} />
      </header>
      <main className="app-contenido home-contenido" onClick={alCielo}>
        <div className="home-estrellas" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <span className="home-disparo" ref={estrellaRef} />
        </div>
        <div className="home-portada">
          <div className="corazon">🎁</div>
          <h1>Nuestra caja</h1>
          <p>Cosas bonitas, todas en un solo lugar.</p>
        </div>
        <div className="tarjetas">
          {modulos.map((m) => (
            <button key={m.id} className="tarjeta" onClick={() => navegar(`/${m.id}`)}>
              <span className="icono">{m.icono}</span>
              <h2>{m.nombre}</h2>
              <p>{m.desc}</p>
            </button>
          ))}
        </div>
        <div className="pie">
          <button className="boton-secundario" onClick={onBloquear}>
            🔒 Bloquear
          </button>
        </div>
      </main>
    </>
  )
}
