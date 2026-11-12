import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { ReactNode } from 'react'
import type { Chat, Horario, Mapeo, Mensaje } from './tipos'
import { etiquetaDia, horaCorta, normalizar, quitarAcentos } from '../../lib/texto'
import { desfaseGlobal, MEDIA_INFO, NOMBRE_ELLA, NOMBRE_MIO } from './estadisticas'
import type { FavoritosEstado } from './favoritos'

const LIMITE_LISTA = 500
const PASO_VENTANA = 400
const INICIAL = 250

type ModoBusqueda = 'tal-cual' | 'contiene' | 'similar'

function litBusqueda(s: string) {
  return quitarAcentos(s.toLowerCase())
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function levDist(a: string, b: string): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > 1) return 2
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]
}

function coincideBusqueda(blob: string, consulta: string, modo: ModoBusqueda): boolean {
  if (modo === 'contiene') return normalizar(blob).includes(normalizar(consulta))
  const q = litBusqueda(consulta)
  if (!q) return true
  if (modo === 'tal-cual') return ` ${litBusqueda(blob)} `.includes(` ${q} `)
  const bToks = litBusqueda(blob).split(' ').map(normalizar)
  const bSet = new Set(bToks)
  for (const t of q.split(' ').map(normalizar)) {
    if (bSet.has(t)) continue
    if (t.length < 5) return false
    const ok = bToks.some(
      (u) => u[0] === t[0] && Math.abs(u.length - t.length) <= 1 && levDist(t, u) <= 1,
    )
    if (!ok) return false
  }
  return true
}

interface Props {
  chat: Chat
  mapeo: Mapeo
  objetivo: { id: number; clave: number } | null
  horario: Horario
  favoritos: FavoritosEstado
  onAlternarFav: (msgId: number) => void
}

const ChatTab = memo(function ChatTab({ chat, mapeo, objetivo, horario, favoritos, onAlternarFav }: Props) {
  const mensajes = chat.mensajes
  const gMs = desfaseGlobal(horario) * 3600000
  const favSet = useMemo(() => new Set(favoritos.entradas.map((e) => e.msgId)), [favoritos])
  const [ventana, setVentana] = useState(INICIAL)
  const [busqueda, setBusqueda] = useState('')
  const [busquedaDif, setBusquedaDif] = useState('')
  const [modoBusqueda, setModoBusqueda] = useState<ModoBusqueda>('contiene')
  const [filtroAutor, setFiltroAutor] = useState<'todos' | 'yo' | 'ella'>('todos')
  const [filtroTipo, setFiltroTipo] = useState<
    'todos' | 'texto' | 'media' | 'sticker' | 'voz' | 'imagen' | 'video' | 'cita' | 'sistema' | 'eliminado'
  >('todos')
  const [filtroContenido, setFiltroContenido] = useState<'todo' | 'enlace' | 'numero' | 'pregunta' | 'largo'>('todo')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')
  const [panelFiltros, setPanelFiltros] = useState(false)
  const [destello, setDestello] = useState<number | null>(null)
  const [indice, setIndice] = useState(0)
  const [claveFiltro, setClaveFiltro] = useState('')
  const [contexto, setContexto] = useState<{ inicio: number; fin: number } | null>(null)
  const [menuLp, setMenuLp] = useState<{ id: number; x: number; y: number } | null>(null)
  const [flashFav, setFlashFav] = useState<string | null>(null)
  const contRef = useRef<HTMLDivElement>(null)
  const altoPrevioRef = useRef(0)
  const creciendoRef = useRef(false)
  const claveObjetivoRef = useRef(0)
  const montadoRef = useRef(false)
  const lpTimerRef = useRef<number | null>(null)
  const lpXYRef = useRef({ x: 0, y: 0 })
  const lpFiredRef = useRef(false)

  useEffect(() => {
    const t = setTimeout(() => setBusquedaDif(busqueda.trim()), 220)
    return () => clearTimeout(t)
  }, [busqueda])

  const hayFiltro =
    busquedaDif !== '' ||
    filtroAutor !== 'todos' ||
    filtroTipo !== 'todos' ||
    filtroContenido !== 'todo' ||
    filtroDesde !== '' ||
    filtroHasta !== ''

  const claveActual = `${busquedaDif}\u0000${modoBusqueda}\u0000${filtroAutor}\u0000${filtroTipo}\u0000${filtroContenido}\u0000${filtroDesde}\u0000${filtroHasta}`
  if (claveActual !== claveFiltro) {
    setClaveFiltro(claveActual)
    setIndice(0)
  }

  const rangoChat = useMemo(() => {
    let min = Infinity
    let max = -Infinity
    for (const m of mensajes) {
      if (!m.ts) continue
      if (m.ts < min) min = m.ts
      if (m.ts > max) max = m.ts
    }
    if (!isFinite(min)) return { desde: '', hasta: '' }
    const d = new Date(min + gMs)
    const h = new Date(max + gMs)
    const iso = (x: Date) =>
      `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
    return { desde: iso(d), hasta: iso(h) }
  }, [mensajes, gMs])

  const filtrados = useMemo(() => {
    if (!hayFiltro) return null
    const tsDesde = filtroDesde ? new Date(`${filtroDesde}T00:00:00`).getTime() - gMs : -Infinity
    const tsHasta = filtroHasta ? new Date(`${filtroHasta}T23:59:59.999`).getTime() - gMs : Infinity
    const res: number[] = []
    for (const m of mensajes) {
      if (filtroAutor === 'yo' && m.autor !== mapeo.yo) continue
      if (filtroAutor === 'ella' && m.autor !== mapeo.ella) continue
      if (filtroTipo === 'texto' && m.tipo !== 'texto') continue
      if (filtroTipo === 'media' && m.tipo !== 'media') continue
      if (filtroTipo === 'sticker' && m.media !== 'sticker') continue
      if (filtroTipo === 'voz' && m.media !== 'voz') continue
      if (filtroTipo === 'imagen' && m.media !== 'imagen') continue
      if (filtroTipo === 'video' && m.media !== 'video') continue
      if (filtroTipo === 'cita' && !m.cita) continue
      if (filtroTipo === 'sistema' && m.tipo !== 'sistema' && m.tipo !== 'llamada') continue
      if (filtroTipo === 'eliminado' && m.tipo !== 'eliminado') continue
      if (filtroContenido === 'enlace' && !/https?:\/\//.test(m.texto + m.mediaNombre)) continue
      if (filtroContenido === 'numero' && !/\d/.test(m.texto)) continue
      if (filtroContenido === 'pregunta' && !m.texto.includes('?')) continue
      if (filtroContenido === 'largo' && m.texto.length < 200) continue
      if ((filtroDesde || filtroHasta) && (!m.ts || m.ts < tsDesde || m.ts > tsHasta)) continue
      if (
        busquedaDif &&
        !coincideBusqueda(
          `${m.texto}\n${m.mediaNombre}\n${m.cita?.texto ?? ''}\n${m.media ? MEDIA_INFO[m.media].label : ''}\n${m.autor ?? ''}`,
          busquedaDif,
          modoBusqueda,
        )
      )
        continue
      res.push(m.id)
    }
    return res
  }, [hayFiltro, busquedaDif, modoBusqueda, filtroAutor, filtroTipo, filtroContenido, filtroDesde, filtroHasta, mensajes, mapeo, gMs])

  const objetivoNuevo = objetivo && objetivo.clave !== claveObjetivoRef.current ? objetivo : null

  const visibles = useMemo(() => {
    if (!filtrados) {
      if (objetivoNuevo) return mensajes.slice(Math.max(0, objetivoNuevo.id - 100), Math.min(mensajes.length, objetivoNuevo.id + 101))
      if (contexto) return mensajes.slice(contexto.inicio, contexto.fin)
      return mensajes.slice(-ventana)
    }
    if (filtrados.length <= LIMITE_LISTA) return filtrados.map((id) => mensajes[id])
    const inicio = Math.max(0, Math.min(indice - 100, filtrados.length - LIMITE_LISTA))
    return filtrados.slice(inicio, inicio + LIMITE_LISTA).map((id) => mensajes[id])
  }, [filtrados, mensajes, ventana, contexto, indice, objetivoNuevo])

  const mapaCitas = useMemo(() => {
    const mapa = new Map<number, number>()
    for (const m of mensajes) {
      if (!m.cita) continue
      const citaTxt = m.cita.texto.trim()
      const limite = Math.max(0, m.id - 400)
      let found = -1
      if (citaTxt) {
        for (let j = m.id - 1; j >= limite; j--) {
          const cand = mensajes[j]
          if (cand.autor !== m.cita.autor || !cand.texto) continue
          const t = cand.texto.trim()
          if (t === citaTxt || t.startsWith(citaTxt) || citaTxt.startsWith(t)) {
            found = j
            break
          }
        }
      }
      if (found < 0) {
        for (let j = m.id - 1; j >= limite; j--) {
          const cand = mensajes[j]
          if (cand.autor === m.cita.autor && cand.media) {
            found = j
            break
          }
        }
      }
      if (found >= 0) mapa.set(m.id, found)
    }
    return mapa
  }, [mensajes])

  function saltarA(id: number) {
    setBusqueda('')
    setBusquedaDif('')
    setFiltroAutor('todos')
    setFiltroTipo('todos')
    setFiltroContenido('todo')
    setFiltroDesde('')
    setFiltroHasta('')
    setContexto({ inicio: Math.max(0, id - 100), fin: Math.min(mensajes.length, id + 101) })
    let intentos = 0
    const intentar = () => {
      const el = document.getElementById(`msg-${id}`)
      if (el) {
        el.scrollIntoView({ block: 'center' })
        setDestello(id)
        setTimeout(() => setDestello((d) => (d === id ? null : d)), 1600)
      } else if (intentos++ < 40) {
        setTimeout(intentar, 50)
      }
    }
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(intentar, 30)))
  }

  function verTodo() {
    const inicio = contexto?.inicio ?? 0
    setContexto(null)
    setVentana((v) => Math.min(Math.max(v, mensajes.length - inicio + 20), mensajes.length))
  }

  useEffect(() => {
    if (!filtrados || filtrados.length === 0) return
    const id = filtrados[Math.min(indice, filtrados.length - 1)]
    const pulsar = () => {
      document.getElementById(`msg-${id}`)?.scrollIntoView({ block: 'center' })
      setDestello(id)
      setTimeout(() => setDestello((d) => (d === id ? null : d)), 1400)
    }
    requestAnimationFrame(() => requestAnimationFrame(pulsar))
  }, [indice, filtrados])

  useLayoutEffect(() => {
    const cont = contRef.current
    if (cont && creciendoRef.current) {
      cont.scrollTop += cont.scrollHeight - altoPrevioRef.current
      creciendoRef.current = false
    }
    if (cont && !montadoRef.current) {
      montadoRef.current = true
      cont.scrollTop = cont.scrollHeight
    }
  }, [visibles])

  function cargarMas() {
    const cont = contRef.current
    if (cont) {
      altoPrevioRef.current = cont.scrollHeight
      creciendoRef.current = true
    }
    setVentana((v) => Math.min(v + PASO_VENTANA, mensajes.length))
  }

  function alScroll() {
    const cont = contRef.current
    if (!cont) return
    if (contexto) {
      if (cont.scrollTop < 80 && contexto.inicio > 0) {
        altoPrevioRef.current = cont.scrollHeight
        creciendoRef.current = true
        setContexto((c) => (c ? { inicio: Math.max(0, c.inicio - PASO_VENTANA), fin: c.fin } : c))
      }
      return
    }
    if (filtrados) return
    if (cont.scrollTop < 80 && ventana < mensajes.length) cargarMas()
  }

  useLayoutEffect(() => {
    if (!objetivo || objetivo.clave === claveObjetivoRef.current) return
    claveObjetivoRef.current = objetivo.clave
    setBusqueda('')
    setFiltroAutor('todos')
    setFiltroTipo('todos')
    setFiltroContenido('todo')
    setFiltroDesde('')
    setFiltroHasta('')
    setContexto({ inicio: Math.max(0, objetivo.id - 100), fin: Math.min(mensajes.length, objetivo.id + 101) })
    const pulsar = () => {
      const el = document.getElementById(`msg-${objetivo.id}`)
      el?.scrollIntoView({ block: 'center' })
      setDestello(objetivo.id)
      setTimeout(() => setDestello((d) => (d === objetivo.id ? null : d)), 1600)
    }
    requestAnimationFrame(() => requestAnimationFrame(pulsar))
  }, [objetivo, mensajes.length])

  const totalCoincidencias = filtrados ? filtrados.length : 0

  function irA(delta: number) {
    if (!filtrados || filtrados.length === 0) return
    setIndice((i) => (i + delta + filtrados.length) % filtrados.length)
  }

  function alternarFav(id: number, esFav: boolean) {
    onAlternarFav(id)
    setFlashFav(esFav ? 'Quitado de favoritos' : 'Guardado en favoritos ⭐')
    window.setTimeout(() => setFlashFav(null), 1400)
  }

  function limpiarLp() {
    if (lpTimerRef.current) {
      clearTimeout(lpTimerRef.current)
      lpTimerRef.current = null
    }
  }

  function alPointerDown(e: ReactPointerEvent, id: number) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    lpXYRef.current = { x: e.clientX, y: e.clientY }
    lpFiredRef.current = false
    limpiarLp()
    lpTimerRef.current = window.setTimeout(() => {
      lpTimerRef.current = null
      lpFiredRef.current = true
      navigator.vibrate?.(10)
      setMenuLp({
        id,
        x: Math.max(8, Math.min(e.clientX, window.innerWidth - 230)),
        y: Math.max(8, Math.min(e.clientY, window.innerHeight - 170)),
      })
    }, 480)
  }

  function alPointerMove(e: ReactPointerEvent) {
    if (!lpTimerRef.current) return
    const dx = e.clientX - lpXYRef.current.x
    const dy = e.clientY - lpXYRef.current.y
    if (dx * dx + dy * dy > 144) limpiarLp()
  }

  return (
    <div className="wc-chat-wrap">
      <div className="wc-filtros">
        <input
          type="search"
          placeholder="Buscar en el chat…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              irA(e.shiftKey ? -1 : 1)
            }
          }}
        />
        <div className="wc-filtros-modo" role="group" aria-label="Modo de búsqueda">
          <button
            type="button"
            className={modoBusqueda === 'tal-cual' ? 'activa' : ''}
            aria-pressed={modoBusqueda === 'tal-cual'}
            title="La frase exacta, palabra por palabra (no encuentra 'amorcito' al buscar 'amor')"
            onClick={() => setModoBusqueda('tal-cual')}
          >
            Tal cual
          </button>
          <button
            type="button"
            className={modoBusqueda === 'contiene' ? 'activa' : ''}
            aria-pressed={modoBusqueda === 'contiene'}
            title="Que contenga esas letras (subcadena: 'casa' encuentra 'casada')"
            onClick={() => setModoBusqueda('contiene')}
          >
            Contiene
          </button>
          <button
            type="button"
            className={modoBusqueda === 'similar' ? 'activa' : ''}
            aria-pressed={modoBusqueda === 'similar'}
            title="Palabras parecidas: tildes, letras repetidas (muuuy = muy) y errores de dedo en palabras largas"
            onClick={() => setModoBusqueda('similar')}
          >
            Similar
          </button>
        </div>
        <button type="button" className="wc-filtros-toggle" onClick={() => setPanelFiltros((v) => !v)} aria-expanded={panelFiltros}>
          ⚙ Filtros
          {hayFiltro && <span className="wc-filtros-dot" />}
        </button>
        <div className={panelFiltros ? 'wc-filtros-panel abierto' : 'wc-filtros-panel'}>
          <select value={filtroAutor} onChange={(e) => setFiltroAutor(e.target.value as typeof filtroAutor)}>
            <option value="todos">Tú y Jania</option>
            <option value="yo">Solo Moises</option>
            <option value="ella">Solo Jania</option>
          </select>
          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value as typeof filtroTipo)}>
            <option value="todos">Todo</option>
            <option value="texto">Textos</option>
            <option value="media">Stickers y medios</option>
            <option value="sticker">Stickers</option>
            <option value="voz">Notas de voz</option>
            <option value="imagen">Fotos</option>
            <option value="video">Videos</option>
            <option value="cita">Respuestas a mensajes</option>
            <option value="sistema">Llamadas y sistema</option>
            <option value="eliminado">Eliminados y pendientes</option>
          </select>
          <select
            value={filtroContenido}
            onChange={(e) => setFiltroContenido(e.target.value as typeof filtroContenido)}
            title="Filtrar por contenido del mensaje"
          >
            <option value="todo">Cualquier texto</option>
            <option value="enlace">Con enlaces</option>
            <option value="numero">Con números</option>
            <option value="pregunta">Con preguntas</option>
            <option value="largo">Mensajes largos (+200)</option>
          </select>
          <input
            type="date"
            value={filtroDesde}
            min={rangoChat.desde}
            max={filtroHasta || rangoChat.hasta}
            onChange={(e) => setFiltroDesde(e.target.value)}
            title="Desde fecha"
            aria-label="Desde fecha"
          />
          <input
            type="date"
            value={filtroHasta}
            min={filtroDesde || rangoChat.desde}
            max={rangoChat.hasta}
            onChange={(e) => setFiltroHasta(e.target.value)}
            title="Hasta fecha"
            aria-label="Hasta fecha"
          />
          {hayFiltro && (
            <button
              type="button"
              className="wc-limpiar"
              onClick={() => {
                setBusqueda('')
                setBusquedaDif('')
                setFiltroAutor('todos')
                setFiltroTipo('todos')
                setFiltroContenido('todo')
                setFiltroDesde('')
                setFiltroHasta('')
              }}
            >
              ✕ Limpiar
            </button>
          )}
        </div>
      </div>

      {filtrados && (
        <div className="wc-resultados-barra">
          <button
            type="button"
            className="wc-nav-btn"
            onClick={() => irA(-1)}
            disabled={totalCoincidencias < 2}
            aria-label="Resultado anterior"
          >
            ↑
          </button>
          <button
            type="button"
            className="wc-nav-btn"
            onClick={() => irA(1)}
            disabled={totalCoincidencias < 2}
            aria-label="Resultado siguiente"
          >
            ↓
          </button>
          <span className="wc-nav-contador">
            {totalCoincidencias === 0 ? '0' : `${Math.min(indice, totalCoincidencias - 1) + 1} / ${totalCoincidencias.toLocaleString('es')}`}
          </span>
          <span>
            resultado{totalCoincidencias === 1 ? '' : 's'}
            {totalCoincidencias > LIMITE_LISTA && ` · mostrando los primeros ${LIMITE_LISTA}`}
          </span>
        </div>
      )}

      {contexto && !filtrados && (
        <div className="wc-resultados-barra">
          <span>Viendo un mensaje en su contexto</span>
          <button type="button" className="wc-nav-btn" onClick={verTodo} aria-label="Ver todo el chat" title="Ver todo el chat">
            ↗
          </button>
        </div>
      )}

      <div className="wc-chat" ref={contRef} onScroll={alScroll}>
        <div className="wc-mensajes">
          {visibles.length === 0 && <div className="wc-centro wc-suave">Nada por aquí con esos filtros.</div>}
          {visibles.map((m, i) => {
            const previo = i > 0 ? visibles[i - 1] : null
            const nuevaFecha = !previo || diaDe(previo.ts + gMs) !== diaDe(m.ts + gMs)
            const mismoAutor = !!previo && !nuevaFecha && previo.autor === m.autor && !!m.autor
            const lpOk = !!m.autor && m.tipo !== 'sistema' && m.tipo !== 'llamada'
            return (
              <div
                key={m.id}
                className={filtrados ? 'wc-ctx' : undefined}
                title={filtrados ? 'Ver en la conversación original' : undefined}
                onClick={(e) => {
                  if (lpFiredRef.current) {
                    lpFiredRef.current = false
                    return
                  }
                  if (!filtrados) return
                  if ((e.target as HTMLElement).closest('a, button')) return
                  saltarA(m.id)
                }}
                onPointerDown={lpOk ? (e) => alPointerDown(e, m.id) : undefined}
                onPointerMove={lpOk ? alPointerMove : undefined}
                onPointerUp={lpOk ? limpiarLp : undefined}
                onPointerCancel={lpOk ? limpiarLp : undefined}
                onPointerLeave={lpOk ? limpiarLp : undefined}
                onContextMenu={
                  lpOk
                    ? (e) => {
                        e.preventDefault()
                        setMenuLp({
                          id: m.id,
                          x: Math.max(8, Math.min(e.clientX, window.innerWidth - 230)),
                          y: Math.max(8, Math.min(e.clientY, window.innerHeight - 170)),
                        })
                      }
                    : undefined
                }
              >
                {nuevaFecha && m.ts > 0 && <div className="wc-fecha">{etiquetaDia(m.ts + gMs)}</div>}
                <Burbuja
                  m={m}
                  mapeo={mapeo}
                  sinNombre={mismoAutor}
                  destello={destello === m.id}
                  citaDestino={mapaCitas.get(m.id)}
                  onCitar={saltarA}
                  gMs={gMs}
                  fav={favSet.has(m.id)}
                  onAlternarFav={alternarFav}
                />
              </div>
            )
          })}
          {!filtrados && !contexto && ventana < mensajes.length && (
            <div className="wc-centro">
              <button type="button" className="wc-cargar-mas" onClick={cargarMas}>
                ⬆ Cargar más ({(mensajes.length - ventana).toLocaleString('es')})
              </button>
            </div>
          )}
        </div>
      </div>

      {flashFav && <div className="wc-fav-toast">{flashFav}</div>}

      {menuLp && (
        <>
          <div className="wc-lp-backdrop" onPointerDown={() => setMenuLp(null)} />
          <div className="wc-lp-menu" style={{ left: menuLp.x, top: menuLp.y }} role="menu">
            <p className="wc-lp-preview">{textoPreview(mensajes[menuLp.id])}</p>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                alternarFav(menuLp.id, favSet.has(menuLp.id))
                setMenuLp(null)
              }}
            >
              {favSet.has(menuLp.id) ? '☆ Quitar de favoritos' : '⭐ Guardar en favoritos'}
            </button>
            <button type="button" role="menuitem" className="wc-lp-cancelar" onClick={() => setMenuLp(null)}>
              Cancelar
            </button>
          </div>
        </>
      )}
    </div>
  )
})

export default ChatTab

function diaDe(ts: number) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function textoPreview(m: Mensaje | undefined) {
  if (!m) return ''
  if (m.texto) return m.texto.slice(0, 90)
  if (m.media) return `${MEDIA_INFO[m.media].icono} ${MEDIA_INFO[m.media].label}`
  return m.texto
}

const URL_RE = /https?:\/\/[^\s<>"')]+/g

function conLinks(texto: string) {
  const partes = texto.split(URL_RE)
  const urls = texto.match(URL_RE) ?? []
  return partes.flatMap((p, i) => {
    const pedazos: ReactNode[] = [<span key={`t${i}`}>{p}</span>]
    if (urls[i]) {
      pedazos.push(
        <a key={`u${i}`} href={urls[i]} target="_blank" rel="noreferrer noopener">
          {urls[i]}
        </a>,
      )
    }
    return pedazos
  })
}

const Burbuja = memo(function Burbuja({
  m,
  mapeo,
  sinNombre,
  destello,
  citaDestino,
  onCitar,
  gMs,
  fav,
  onAlternarFav,
}: {
  m: Mensaje
  mapeo: Mapeo
  sinNombre: boolean
  destello: boolean
  citaDestino: number | undefined
  onCitar: (id: number) => void
  gMs: number
  fav: boolean
  onAlternarFav: (id: number, esFav: boolean) => void
}) {
  if (m.tipo === 'sistema' || m.tipo === 'llamada' || !m.autor) {
    return (
      <div className={`wc-sistema ${destello ? 'destello' : ''}`} id={`msg-${m.id}`}>
        {m.tipo === 'llamada' ? `📞 ${m.texto}` : m.texto}
        {m.ts > 0 && <span className="wc-hora-sis">{horaCorta(m.ts + gMs)}</span>}
      </div>
    )
  }

  const esMia = m.autor === mapeo.yo
  const nombre = esMia ? NOMBRE_MIO : NOMBRE_ELLA

  if (m.tipo === 'eliminado') {
    const pendiente = /esperando/i.test(m.texto)
    return (
      <div className={`wc-msg ${esMia ? 'mia' : 'suya'} ${destello ? 'destello' : ''}`} id={`msg-${m.id}`}>
        <div className="wc-burbuja wc-burbuja-eliminada">
          {!esMia && !sinNombre && <div className="wc-nombre">{nombre}</div>}
          <div className="wc-texto wc-texto-eliminado">
            {pendiente ? '⏳ Mensaje pendiente · no disponible' : '🚫 Mensaje eliminado'}
          </div>
          <div className="wc-meta">{m.ts > 0 && horaCorta(m.ts + gMs)}</div>
        </div>
      </div>
    )
  }

  return (
    <div className={`wc-msg ${esMia ? 'mia' : 'suya'} ${destello ? 'destello' : ''}`} id={`msg-${m.id}`}>
      <div className="wc-burbuja">
        {!esMia && !sinNombre && <div className="wc-nombre">{nombre}</div>}
        {m.cita &&
          (citaDestino !== undefined ? (
            <button
              type="button"
              className="wc-cita wc-cita-btn"
              onClick={(e) => {
                e.stopPropagation()
                onCitar(citaDestino)
              }}
            >
              <div className="wc-cita-autor">
                {m.cita.autor === mapeo.yo ? NOMBRE_MIO : m.cita.autor === mapeo.ella ? NOMBRE_ELLA : m.cita.autor}
              </div>
              <div className="wc-cita-texto">{m.cita.texto || '📎 Archivo'}</div>
            </button>
          ) : (
            <div className="wc-cita">
              <div className="wc-cita-autor">
                {m.cita.autor === mapeo.yo ? NOMBRE_MIO : m.cita.autor === mapeo.ella ? NOMBRE_ELLA : m.cita.autor}
              </div>
              <div className="wc-cita-texto">{m.cita.texto || '📎 Archivo'}</div>
            </div>
          ))}
        {m.media && (
          <div className="wc-media">
            <span className="wc-media-icono">{MEDIA_INFO[m.media].icono}</span>
            <span>{MEDIA_INFO[m.media].label}</span>
            {m.mediaNombre && <div className="wc-media-nombre">{m.mediaNombre}</div>}
          </div>
        )}
        {m.texto && <div className="wc-texto">{conLinks(m.texto)}</div>}
        <div className="wc-meta">
          {m.ts > 0 && horaCorta(m.ts + gMs)}
          <button
            type="button"
            className={fav ? 'wc-fav-estrella activo' : 'wc-fav-estrella'}
            onClick={(e) => {
              e.stopPropagation()
              onAlternarFav(m.id, fav)
            }}
            aria-label={fav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
          >
            ★
          </button>
          {esMia && <span className="wc-checks">✓✓</span>}
        </div>
      </div>
    </div>
  )
})
