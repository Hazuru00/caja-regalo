import { startTransition, useCallback, useEffect, useMemo, useRef, useState, type TouchEvent as ReactTouchEvent } from 'react'
import { borrarChat, guardarChat, guardarMapeo, obtenerChat, obtenerMapeo } from '../../lib/db'
import { navegar } from '../../lib/router'
import type { Chat, Horario, Mapeo } from './tipos'
import Upload from './Upload'
import ChatTab from './ChatTab'
import StatsTab from './StatsTab'
import CineTab from './CineTab'
import CancionesTab from './CancionesTab'
import WordsTab from './WordsTab'
import FavTab from './FavTab'
import { alternarFavorito, cargarFavoritos, guardarFavoritos, type FavoritosEstado } from './favoritos'
import { PARSER_VERSION, parsearArchivo } from './parser'
import { fusionarChat, type ResultadoFusion } from './fusionar'
import { descargarRespaldo } from './respaldo'
import { HORARIO_DEFECTO, NOMBRE_ELLA, NOMBRE_MIO, textoNormalizadoCache } from './estadisticas'
import { normalizar } from '../../lib/texto'
import BotonTema from '../../components/BotonTema'
import './wa-chat.css'

type Pestania = 'chat' | 'stats' | 'cine' | 'canciones' | 'palabras' | 'favoritos'

function leerHorario(): Horario {
  try {
    const crudo = localStorage.getItem('wc-horario')
    if (crudo) return { ...HORARIO_DEFECTO, ...JSON.parse(crudo) }
  } catch {
    /* sin persistencia */
  }
  return HORARIO_DEFECTO
}

export default function WaChat({ onVolver }: { onVolver: () => void }) {
  const [chat, setChat] = useState<Chat | null>(null)
  const [mapeo, setMapeo] = useState<Mapeo | null>(null)
  const [cargando, setCargando] = useState(true)
  const [tab, setTab] = useState<Pestania>('chat')
  const [tabsVistas, setTabsVistas] = useState<Pestania[]>(['chat'])
  const [objetivo, setObjetivo] = useState<{ id: number; clave: number } | null>(null)
  const [horario, setHorario] = useState<Horario>(leerHorario)
  const [favoritos, setFavoritos] = useState<FavoritosEstado>(cargarFavoritos)

  const onFavoritos = useCallback((f: FavoritosEstado) => {
    setFavoritos(f)
    guardarFavoritos(f)
  }, [])

  const alternarFav = useCallback(
    (msgId: number) => setFavoritos((f) => {
      const nuevo = alternarFavorito(f, msgId)
      guardarFavoritos(nuevo)
      return nuevo
    }),
    [],
  )

  const [dlgBorrar, setDlgBorrar] = useState(false)
  const [dlgAnadir, setDlgAnadir] = useState(false)

  const [zipCrudo, setZipCrudo] = useState<Chat | null>(null)
  const [quienZip, setQuienZip] = useState<'yo' | 'ella'>('yo')
  const [errorZip, setErrorZip] = useState('')
  const [leyendoZip, setLeyendoZip] = useState(false)
  const inputFileRef = useRef<HTMLInputElement>(null)

  const cambiarHorario = useCallback((h: Horario) => {
    setHorario(h)
    try {
      localStorage.setItem('wc-horario', JSON.stringify(h))
    } catch {
      /* sin persistencia */
    }
  }, [])

  useEffect(() => {
    Promise.all([obtenerChat(), obtenerMapeo()]).then(async ([c, m]) => {
      if (c && (c.parserVersion ?? 0) < PARSER_VERSION) {
        await borrarChat()
        setChat(null)
        setMapeo(null)
        setCargando(false)
        return
      }
      setChat(c ?? null)
      setMapeo(c && m ? m : null)
      setCargando(false)
    })
  }, [])

  const normTextos = useMemo(() => (chat ? textoNormalizadoCache(chat) : null), [chat])

  useEffect(() => {
    if (!chat || !mapeo || !normTextos) return
    const win = window as unknown as {
      requestIdleCallback?: (cb: () => void) => number
      cancelIdleCallback?: (id: number) => void
    }
    if (win.requestIdleCallback) {
      const id = win.requestIdleCallback(() =>
        setTabsVistas((v) => (v.includes('stats') ? v : [...v, 'stats', 'palabras', 'favoritos'])),
      )
      return () => win.cancelIdleCallback?.(id)
    }
    const t = window.setTimeout(
      () => setTabsVistas((v) => (v.includes('stats') ? v : [...v, 'stats', 'palabras', 'favoritos'])),
      300,
    )
    return () => clearTimeout(t)
  }, [chat, mapeo, normTextos])

  const fusion: ResultadoFusion | null = useMemo(() => {
    if (!chat || !mapeo || !zipCrudo) return null
    const zonaZip = quienZip === 'yo' ? horario.tu : horario.ella
    return fusionarChat(chat, zipCrudo, mapeo, quienZip, horario.archivo, zonaZip)
  }, [chat, mapeo, zipCrudo, quienZip, horario])

  async function alConfirmar(nuevoChat: Chat, nuevoMapeo: Mapeo) {
    await guardarChat(nuevoChat)
    await guardarMapeo(nuevoMapeo)
    setChat(nuevoChat)
    setMapeo(nuevoMapeo)
  }

  async function borrarConRespaldo() {
    if (chat) descargarRespaldo(chat)
    await borrarChat()
    setChat(null)
    setMapeo(null)
    setTab('chat')
    setDlgBorrar(false)
  }

  const cambiarTab = useCallback((p: Pestania) => {
    startTransition(() => {
      setTab(p)
      setTabsVistas((v) => (v.includes(p) ? v : [...v, p]))
    })
  }, [])

  const irA = useCallback((id: number) => {
    startTransition(() => {
      setTab('chat')
      setTabsVistas((v) => (v.includes('chat') ? v : [...v, 'chat']))
      setObjetivo({ id, clave: Date.now() })
    })
  }, [])

  const ordenTabs: Pestania[] = ['chat', 'stats', 'cine', 'canciones', 'palabras', 'favoritos']
  const tactoRef = useRef({ x: 0, y: 0, eje: '' as '' | 'h' | 'v', valido: true })
  const ultimaDeslizRef = useRef(0)

  const alTactoInicio = (e: ReactTouchEvent) => {
    const t = e.target as HTMLElement
    const enZonaX = !!t.closest('.wc-calor-scroll, .wc-muestra')
    tactoRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, eje: '', valido: !enZonaX }
  }

  const alTactoMover = (e: ReactTouchEvent) => {
    const st = tactoRef.current
    if (!st.valido || st.eje) return
    const dx = Math.abs(e.touches[0].clientX - st.x)
    const dy = Math.abs(e.touches[0].clientY - st.y)
    if (dx > 14 && dx > dy * 1.3) st.eje = 'h'
    else if (dy > 14) st.eje = 'v'
  }

  const alTactoFin = (e: ReactTouchEvent) => {
    const st = tactoRef.current
    if (st.valido && st.eje === 'h') {
      const dx = e.changedTouches[0].clientX - st.x
      if (Math.abs(dx) >= 60) {
        const j = ordenTabs.indexOf(tab) + (dx < 0 ? 1 : -1)
        if (j >= 0 && j < ordenTabs.length) {
          ultimaDeslizRef.current = Date.now()
          cambiarTab(ordenTabs[j])
        }
      }
    }
    st.eje = ''
  }

  async function leerZipFusion(file: File) {
    if (!chat || !mapeo) return
    setErrorZip('')
    setLeyendoZip(true)
    setZipCrudo(null)
    try {
      const nuevo = await parsearArchivo(file)
      const otros = nuevo.emisores.filter((e) => e.toLowerCase() !== 'tú' && e.toLowerCase() !== 'you')
      const adivinanza: 'yo' | 'ella' =
        otros.length === 1 && normalizar(otros[0]) === normalizar(mapeo.yo) ? 'ella' : 'yo'
      setQuienZip(adivinanza)
      setZipCrudo(nuevo)
    } catch (e) {
      setErrorZip(e instanceof Error ? e.message : 'No se pudo leer el archivo.')
    } finally {
      setLeyendoZip(false)
    }
  }

  async function confirmarFusion() {
    if (!fusion) return
    await guardarChat(fusion.chat)
    setChat(fusion.chat)
    cerrarAnadir()
  }

  function cerrarAnadir() {
    setDlgAnadir(false)
    setZipCrudo(null)
    setErrorZip('')
  }

  return (
    <>
      <header className="app-barra wc-app-barra">
        <button className="wc-volver" onClick={onVolver} aria-label="Volver">
          ←
        </button>
        <div>
          <h1>
            {NOMBRE_ELLA} & {NOMBRE_MIO}
          </h1>
          <div className="sub">{chat ? `${chat.mensajes.length.toLocaleString('es')} mensajes` : 'Nuestro chat'}</div>
        </div>
        <BotonTema className="wc-tema" />
      </header>

      {chat && mapeo && normTextos && (
        <nav className="wc-tabs">
          <button className={tab === 'chat' ? 'activo' : ''} onClick={() => cambiarTab('chat')}>
            💬 Chat
          </button>
          <button className={tab === 'stats' ? 'activo' : ''} onClick={() => cambiarTab('stats')}>
            📊 Estadísticas
          </button>
          <button className={tab === 'cine' ? 'activo' : ''} onClick={() => cambiarTab('cine')}>
            🎬 Cine
          </button>
          <button className={tab === 'canciones' ? 'activo' : ''} onClick={() => cambiarTab('canciones')}>
            🎵 Canciones
          </button>
          <button className={tab === 'palabras' ? 'activo' : ''} onClick={() => cambiarTab('palabras')}>
            🔤 Palabras
          </button>
          <button className={tab === 'favoritos' ? 'activo' : ''} onClick={() => cambiarTab('favoritos')}>
            ⭐ Favoritos{favoritos.entradas.length > 0 ? ` (${favoritos.entradas.length})` : ''}
          </button>
        </nav>
      )}

      <main
        className="app-contenido wc-contenido"
        onTouchStart={alTactoInicio}
        onTouchMove={alTactoMover}
        onTouchEnd={alTactoFin}
        onClickCapture={(e) => {
          if (Date.now() - ultimaDeslizRef.current < 350) {
            e.stopPropagation()
            e.preventDefault()
          }
        }}
      >
        {cargando && <div className="wc-centro">Un momento…</div>}
        {!cargando && (!chat || !mapeo) && <Upload onConfirmar={alConfirmar} />}
        {chat && mapeo && normTextos && (
          <>
            {tabsVistas.includes('chat') && (
              <div className="wc-tab-panel" hidden={tab !== 'chat'}>
                <ChatTab
                  chat={chat}
                  mapeo={mapeo}
                  objetivo={objetivo}
                  horario={horario}
                  favoritos={favoritos}
                  onAlternarFav={alternarFav}
                />
              </div>
            )}
            {tabsVistas.includes('stats') && (
              <div className="wc-tab-panel" hidden={tab !== 'stats'}>
                <StatsTab chat={chat} mapeo={mapeo} horario={horario} onHorario={cambiarHorario} normTextos={normTextos} onIrA={irA} />
              </div>
            )}
            {tabsVistas.includes('cine') && (
              <div className="wc-tab-panel" hidden={tab !== 'cine'}>
                <CineTab chat={chat} mapeo={mapeo} horario={horario} onIrA={irA} />
              </div>
            )}
            {tabsVistas.includes('canciones') && (
              <div className="wc-tab-panel" hidden={tab !== 'canciones'}>
                <CancionesTab chat={chat} mapeo={mapeo} horario={horario} onIrA={irA} />
              </div>
            )}
            {tabsVistas.includes('palabras') && (
              <div className="wc-tab-panel" hidden={tab !== 'palabras'}>
                <WordsTab chat={chat} mapeo={mapeo} normTextos={normTextos} onIrA={irA} horario={horario} />
              </div>
            )}
            {tabsVistas.includes('favoritos') && (
              <div className="wc-tab-panel" hidden={tab !== 'favoritos'}>
                <FavTab
                  chat={chat}
                  mapeo={mapeo}
                  horario={horario}
                  favoritos={favoritos}
                  onFavoritos={onFavoritos}
                  onIrA={irA}
                  onHorario={cambiarHorario}
                />
              </div>
            )}
            <div className="wc-pie">
              <button className="boton-secundario" onClick={() => setDlgAnadir(true)}>
                ➕ Añadir exportación
              </button>
              <button className="boton-secundario" onClick={() => setDlgBorrar(true)}>
                🗑️ Borrar chat
              </button>
              <button className="boton-secundario" onClick={() => navegar('/')}>
                🏠 Inicio
              </button>
            </div>

            {dlgBorrar && (
              <div className="wc-dialogo-fondo" onClick={(e) => e.target === e.currentTarget && setDlgBorrar(false)}>
                <div className="wc-dialogo" role="dialog" aria-modal="true" aria-label="Borrar el chat">
                  <h2>⚠️ Borrar el chat</h2>
                  <p>
                    Se borrará el chat guardado en este dispositivo ({chat.mensajes.length.toLocaleString('es')} mensajes) y el
                    mapeo de nombres. <b>No se puede deshacer</b>, pero antes te descargamos un <b>respaldo</b> que puedes volver
                    a subir cuando quieras.
                  </p>
                  <div className="wc-dialogo-acciones">
                    <button className="wc-boton" onClick={borrarConRespaldo}>
                      💾 Descargar respaldo y borrar
                    </button>
                    <button className="boton-secundario" onClick={() => setDlgBorrar(false)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {dlgAnadir && (
              <div className="wc-dialogo-fondo" onClick={(e) => e.target === e.currentTarget && cerrarAnadir()}>
                <div className="wc-dialogo" role="dialog" aria-modal="true" aria-label="Añadir exportación">
                  <h2>➕ Añadir exportación</h2>
                  <p>
                    Sube otro .zip del <b>mismo chat</b> (una exportación más reciente, o la que salió del otro teléfono). Los
                    mensajes repetidos se ignoran; solo se añade lo que falte.
                  </p>
                  <input
                    ref={inputFileRef}
                    type="file"
                    accept=".zip,.txt,.md"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) leerZipFusion(file)
                      e.target.value = ''
                    }}
                  />
                  <div className="wc-dialogo-acciones">
                    <button className="wc-boton" onClick={() => inputFileRef.current?.click()} disabled={leyendoZip}>
                      {leyendoZip ? 'Leyendo…' : zipCrudo ? 'Cambiar archivo' : 'Elegir archivo'}
                    </button>
                  </div>
                  {errorZip && <div className="wc-error">{errorZip}</div>}
                  {fusion && (
                    <>
                      <p className="wc-suave">¿De quién era el teléfono que exportó este zip?</p>
                      <div className="wc-dialogo-acciones">
                        <button
                          className={quienZip === 'yo' ? 'wc-chip-btn activo' : 'wc-chip-btn'}
                          onClick={() => setQuienZip('yo')}
                        >
                          {NOMBRE_MIO} (yo)
                        </button>
                        <button
                          className={quienZip === 'ella' ? 'wc-chip-btn activo' : 'wc-chip-btn'}
                          onClick={() => setQuienZip('ella')}
                        >
                          {NOMBRE_ELLA}
                        </button>
                      </div>
                      <p className="wc-fusion-resumen">
                        {fusion.nuevos > 0 ? (
                          <>
                            ✨ Se añadirán <b>{fusion.nuevos.toLocaleString('es')} mensajes nuevos</b>
                            {fusion.duplicados > 0 && <> · {fusion.duplicados.toLocaleString('es')} repetidos se ignoran</>}
                          </>
                        ) : (
                          <>No hay mensajes nuevos: tu chat ya tiene todo lo de esta exportación.</>
                        )}
                      </p>
                      <div className="wc-dialogo-acciones">
                        <button className="wc-boton" onClick={confirmarFusion} disabled={fusion.nuevos === 0}>
                          Combinar
                        </button>
                        <button className="boton-secundario" onClick={cerrarAnadir}>
                          Cancelar
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </>
  )
}
