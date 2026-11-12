import { memo, useMemo, useState } from 'react'
import type { Chat, Horario, Mapeo, Mensaje } from './tipos'
import { contarPalabras, desfaseGlobal, esAfirmacion, esRisa, fechaCorta, regexDeFrase } from './estadisticas'
import { FRASES } from './frases'
import { horaCorta } from '../../lib/texto'

const PASO_REFERENCIAS = 80
const PASO_PALABRAS = 60
const MAX_PALABRAS = 300

interface Props {
  chat: Chat
  mapeo: Mapeo
  normTextos: string[]
  onIrA: (id: number) => void
  horario: Horario
}

const WordsTab = memo(function WordsTab({ chat, mapeo, normTextos, onIrA, horario }: Props) {
  const [abierta, setAbierta] = useState<{ tipo: 'frase' | 'palabra'; clave: string } | null>(null)
  const [extraPalabras, setExtraPalabras] = useState(0)
  const [extraRefs, setExtraRefs] = useState(0)
  const [ordenRefs, setOrdenRefs] = useState<'recientes' | 'antiguos' | 'usados'>('recientes')
  const gMs = desfaseGlobal(horario) * 3600000

  function alternar(nueva: { tipo: 'frase' | 'palabra'; clave: string } | null) {
    setExtraRefs(0)
    setAbierta((prev) => (prev && nueva && prev.tipo === nueva.tipo && prev.clave === nueva.clave ? null : nueva))
  }

  function cambiarOrden(nuevo: 'recientes' | 'antiguos' | 'usados') {
    setOrdenRefs(nuevo)
    setExtraRefs(0)
  }

  const conteosFrases = useMemo(() => {
    return FRASES.map((f) => {
      const re = regexDeFrase(f.variantes)
      let total = 0
      let yo = 0
      let ella = 0
      const ids: number[] = []
      for (let i = 0; i < chat.mensajes.length; i++) {
        const m = chat.mensajes[i]
        if (!m.autor || !normTextos[i]) continue
        re.lastIndex = 0
        const n = (normTextos[i].match(re) ?? []).length
        if (n > 0) {
          total += n
          if (m.autor === mapeo.yo) yo += n
          if (m.autor === mapeo.ella) ella += n
          ids.push(m.id)
        }
      }
      return { f, total, yo, ella, ids }
    }).filter((x) => x.total > 0)
  }, [chat, normTextos, mapeo])

  const topPalabrasCompleto = useMemo(() => contarPalabras(chat, null), [chat])
  const topYo = useMemo(() => contarPalabras(chat, mapeo.yo), [chat, mapeo.yo])
  const topElla = useMemo(() => contarPalabras(chat, mapeo.ella), [chat, mapeo.ella])

  const limitePalabras = Math.min(PASO_PALABRAS + extraPalabras * PASO_PALABRAS, MAX_PALABRAS)
  const topPalabras = topPalabrasCompleto.slice(0, limitePalabras)
  const hayMasPalabras = topPalabrasCompleto.length > topPalabras.length

  const referencias = useMemo(() => {
    if (!abierta) return null
    let contar: (norm: string) => number
    if (abierta.tipo === 'frase') {
      const f = FRASES.find((x) => x.id === abierta.clave)
      if (!f) return null
      const re = regexDeFrase(f.variantes)
      contar = (n) => {
        re.lastIndex = 0
        return (n.match(re) ?? []).length
      }
    } else if (abierta.clave === 'risas' || abierta.clave === 'afirmaciones') {
      const clasificar = abierta.clave === 'risas' ? esRisa : esAfirmacion
      const clave = abierta.clave
      contar = (n) =>
        n.split(' ').filter((t) => {
          const lim = t.replace(/[^\p{L}\p{N}]/gu, '')
          return lim === clave || clasificar(lim)
        }).length
    } else {
      const p = abierta.clave.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(`(?<![\\p{L}])${p}(?![\\p{L}])`, 'gu')
      contar = (n) => {
        re.lastIndex = 0
        return (n.match(re) ?? []).length
      }
    }
    const limite = PASO_REFERENCIAS + extraRefs * PASO_REFERENCIAS
    const res: { m: Mensaje; n: number }[] = []
    if (ordenRefs === 'usados') {
      for (let i = 0; i < chat.mensajes.length; i++) {
        const n = contar(normTextos[i])
        if (n > 0) res.push({ m: chat.mensajes[i], n })
      }
      res.sort((a, b) => b.n - a.n || b.m.ts - a.m.ts)
    } else {
      const paso = ordenRefs === 'recientes' ? -1 : 1
      const inicio = paso === -1 ? chat.mensajes.length - 1 : 0
      const fin = paso === -1 ? -1 : chat.mensajes.length
      for (let i = inicio; i !== fin && res.length <= limite; i += paso) {
        const n = contar(normTextos[i])
        if (n > 0) res.push({ m: chat.mensajes[i], n })
      }
    }
    return { lista: res.slice(0, limite), hayMas: res.length > limite }
  }, [abierta, chat, normTextos, extraRefs, ordenRefs])

  const maxFrase = Math.max(...conteosFrases.map((c) => c.total), 1)

  return (
    <div className="wc-words">
      <section className="wc-tarjeta">
        <h3>Frases favoritas</h3>
        <p className="wc-suave">Con todas sus variantes: TE AMO, teee amoo, ti amo, love…</p>
        <div className="wc-frases">
          {conteosFrases.map(({ f, total, yo, ella }) => {
            const activa = abierta?.tipo === 'frase' && abierta.clave === f.id
            return (
              <button key={f.id} className={`wc-frase ${activa ? 'activa' : ''}`} onClick={() => alternar({ tipo: 'frase', clave: f.id })}>
                <div className="wc-frase-top">
                  <span className="wc-frase-label">“{f.label}”</span>
                  <span className="wc-frase-total">{total.toLocaleString('es')}×</span>
                </div>
                <div className="wc-barra">
                  <div className="wc-barra-fill" style={{ width: `${(total / maxFrase) * 100}%` }} />
                </div>
                <div className="wc-frase-quien">
                  Moises {yo.toLocaleString('es')} · Jania {ella.toLocaleString('es')}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <section className="wc-tarjeta">
        <h3>Palabras más dichas</h3>
        <div className="wc-palabras">
          {topPalabras.map(([palabra, n]) => {
            const activa = abierta?.tipo === 'palabra' && abierta.clave === palabra
            return (
              <button key={palabra} className={`wc-palabra ${activa ? 'activa' : ''}`} onClick={() => alternar({ tipo: 'palabra', clave: palabra })} title={`${n} veces`}>
                {palabra} <span>{n}</span>
              </button>
            )
          })}
        </div>
        {hayMasPalabras && (
          <button type="button" className="wc-ver-mas" onClick={() => setExtraPalabras((e) => e + 1)}>
            Ver más palabras (hasta {Math.min(limitePalabras + PASO_PALABRAS, MAX_PALABRAS).toLocaleString('es')} de{' '}
            {topPalabrasCompleto.length.toLocaleString('es')})
          </button>
        )}
        <div className="wc-top-duo">
          <div>
            <h4>Lo que más dice Moises</h4>
            <ol>
              {topYo.slice(0, 10).map(([p, n]) => (
                <li key={p}>
                  <button
                    className={`wc-palabra-mini ${abierta?.tipo === 'palabra' && abierta.clave === p ? 'activa' : ''}`}
                    onClick={() => alternar({ tipo: 'palabra', clave: p })}
                  >
                    {p} <span>{n}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h4>Lo que más dice Jania</h4>
            <ol>
              {topElla.slice(0, 10).map(([p, n]) => (
                <li key={p}>
                  <button
                    className={`wc-palabra-mini ${abierta?.tipo === 'palabra' && abierta.clave === p ? 'activa' : ''}`}
                    onClick={() => alternar({ tipo: 'palabra', clave: p })}
                  >
                    {p} <span>{n}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {abierta && referencias && (
        <section className="wc-tarjeta wc-referencias">
          <div className="wc-ref-cabecera">
            <h3>
              {abierta.tipo === 'frase' ? `“${FRASES.find((f) => f.id === abierta.clave)?.label}”` : `“${abierta.clave}”`} —
              referencias
            </h3>
            <div className="wc-ref-orden" role="group" aria-label="Ordenar referencias">
              <button type="button" className={ordenRefs === 'recientes' ? 'activo' : ''} onClick={() => cambiarOrden('recientes')}>
                Recientes
              </button>
              <button type="button" className={ordenRefs === 'antiguos' ? 'activo' : ''} onClick={() => cambiarOrden('antiguos')}>
                Antiguos
              </button>
              <button type="button" className={ordenRefs === 'usados' ? 'activo' : ''} onClick={() => cambiarOrden('usados')}>
                Más usados
              </button>
            </div>
            <button className="boton-secundario" onClick={() => alternar(null)}>
              ✕ Cerrar
            </button>
          </div>
          {referencias.lista.length === 0 && <p className="wc-suave">Sin mensajes con esa palabra.</p>}
          {referencias.lista.map(({ m, n }) => (
            <button key={m.id} className="wc-ref-msg" onClick={() => onIrA(m.id)}>
              <div className="wc-ref-meta">
                <b>{m.autor === mapeo.yo ? 'Moises' : m.autor === mapeo.ella ? 'Jania' : m.autor ?? 'Sistema'}</b>
                {m.ts > 0 && (
                  <>
                    · {fechaCorta(m.ts + gMs)} · {horaCorta(m.ts + gMs)}
                  </>
                )}
                {n > 1 && <span className="wc-ref-veces">{n}×</span>}
              </div>
              <div className="wc-ref-texto">{m.texto || '📎 Archivo'}</div>
            </button>
          ))}
          {referencias.hayMas && (
            <button type="button" className="wc-ver-mas" onClick={() => setExtraRefs((e) => e + 1)}>
              Ver más referencias (+{PASO_REFERENCIAS})
            </button>
          )}
        </section>
      )}
    </div>
  )
})

export default WordsTab
