import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { Chat, Horario, Mapeo } from './tipos'
import { detectarCanciones, metaDe, type Cancion, type CancionMeta } from './canciones'
import { desfaseGlobal, fechaCorta, NOMBRE_ELLA, NOMBRE_MIO } from './estadisticas'

interface Props {
  chat: Chat
  mapeo: Mapeo
  horario: Horario
  onIrA: (id: number) => void
}

type Estado = 'cargando' | 'listo' | 'vacio' | 'error'

const CancionesTab = memo(function CancionesTab({ chat, mapeo, horario, onIrA }: Props) {
  const canciones = useMemo(() => detectarCanciones(chat), [chat])
  const [abierta, setAbierta] = useState<string | null>(null)
  const [metas, setMetas] = useState<Record<string, CancionMeta[]>>({})
  const [estados, setEstados] = useState<Record<string, Estado>>({})
  const [sonando, setSonando] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const gMs = desfaseGlobal(horario) * 3600000

  const abiertaCanc = useMemo(
    () => canciones.find((c) => c.id === abierta) ?? null,
    [canciones, abierta],
  )

  useEffect(() => {
    if (!abiertaCanc || metas[abiertaCanc.id] || estados[abiertaCanc.id]) return
    setEstados((s) => ({ ...s, [abiertaCanc.id]: 'cargando' }))
    metaDe(abiertaCanc)
      .then((m) => {
        setMetas((x) => ({ ...x, [abiertaCanc.id]: m }))
        setEstados((s) => ({ ...s, [abiertaCanc.id]: m.length ? 'listo' : 'vacio' }))
      })
      .catch(() => {
        setEstados((s) => ({ ...s, [abiertaCanc.id]: 'error' }))
      })
  }, [abiertaCanc, metas, estados])

  useEffect(() => {
    const a = audioRef.current
    return () => {
      a?.pause()
    }
  }, [])

  const parar = () => {
    audioRef.current?.pause()
    setSonando(null)
  }

  const cerrar = () => {
    parar()
    setAbierta(null)
  }

  const reproducir = (url: string) => {
    const a = audioRef.current
    if (!a) return
    if (sonando === url) {
      a.pause()
      setSonando(null)
      return
    }
    a.src = url
    void a.play().catch(() => setSonando(null))
    setSonando(url)
  }

  const reintentar = (c: Cancion) => {
    setEstados((s) => {
      const n = { ...s }
      delete n[c.id]
      return n
    })
  }

  const etiquetaAutor = (a: string | null) =>
    a === null ? '—' : a === mapeo.yo ? NOMBRE_MIO : a === mapeo.ella ? NOMBRE_ELLA : a

  const conteoPorAutor = (c: Cancion) => {
    const mapa = new Map<string, number>()
    for (const m of c.menciones) {
      const etiqueta = etiquetaAutor(m.autor)
      mapa.set(etiqueta, (mapa.get(etiqueta) ?? 0) + 1)
    }
    return [...mapa.entries()].sort((a, b) => b[1] - a[1])
  }

  const cancionesSolo = canciones.filter((c) => c.tipo === 'cancion')
  const artistasSolo = canciones.filter((c) => c.tipo === 'artista')
  const totalMenciones = canciones.reduce((n, c) => n + c.menciones.length, 0)
  const estado = abiertaCanc ? estados[abiertaCanc.id] : undefined
  const metasAbiertas = abiertaCanc ? metas[abiertaCanc.id] ?? [] : []

  return (
    <div className="wc-cine wc-canc">
      {canciones.length === 0 && (
        <div className="wc-fav-vacio">No se detectaron canciones ni artistas en el chat.</div>
      )}
      {canciones.length > 0 && (
        <>
          <div className="wc-cine-resumen">
            {cancionesSolo.length} canciones · {artistasSolo.length} artistas · {totalMenciones} menciones
          </div>
          <div className="wc-cine-grid">
            {canciones.map((c) => (
              <article className="wc-cine-card" key={c.id}>
                <button
                  className="wc-cine-card-abrir"
                  onClick={() => setAbierta(c.id)}
                  aria-label={`Ver ${c.titulo}`}
                >
                  <div className="wc-cine-card-titulo">{c.titulo}</div>
                  <div className="wc-canc-artista">{c.artista ?? (c.tipo === 'artista' ? 'Artista' : 'Sin artista')}</div>
                  <div className="wc-cine-card-autores">
                    {conteoPorAutor(c).map(([nombre, n]) => (
                      <span
                        key={nombre}
                        className={nombre === NOMBRE_ELLA ? 'wc-cine-chip suya' : 'wc-cine-chip'}
                      >
                        {nombre} ×{n}
                      </span>
                    ))}
                  </div>
                </button>
              </article>
            ))}
          </div>
        </>
      )}

      {abiertaCanc && (
        <>
          <div className="wc-fav-sheet-backdrop" onPointerDown={cerrar} />
          <div className="wc-fav-sheet" role="dialog" aria-label={abiertaCanc.titulo}>
            <div className="wc-fav-sheet-grab" />
            <div className="wc-fav-sheet-top">
              <span className="wc-fav-sheet-meta">
                {abiertaCanc.tipo === 'artista' ? 'Artista' : 'Canción'}
                {abiertaCanc.artista && abiertaCanc.tipo === 'cancion' && ` · ${abiertaCanc.artista}`}
              </span>
              <button className="wc-nav-btn" onClick={cerrar} aria-label="Cerrar">
                ✕
              </button>
            </div>
            <div className="wc-cine-sheet-cab">
              <div>
                <h2 className="wc-cine-sheet-titulo">{abiertaCanc.titulo}</h2>
              </div>
            </div>

            {estado === 'cargando' && <div className="wc-canc-estado">Buscando en iTunes…</div>}
            {estado === 'vacio' && (
              <div className="wc-canc-estado">Sin resultados en iTunes para «{abiertaCanc.titulo}».</div>
            )}
            {estado === 'error' && (
              <div className="wc-canc-estado">
                No se pudo buscar en iTunes.{' '}
                <button className="boton-secundario" onClick={() => reintentar(abiertaCanc)}>
                  Reintentar
                </button>
              </div>
            )}
            {estado === 'listo' && (
              <div className="wc-canc-metas">
                {metasAbiertas.map((m, i) => (
                  <div className="wc-canc-meta" key={i}>
                    {m.artwork ? (
                      <img className="wc-canc-portada" src={m.artwork} alt="" loading="lazy" />
                    ) : (
                      <div className="wc-canc-portada-fallback">{m.trackName[0]?.toUpperCase()}</div>
                    )}
                    <div className="wc-canc-meta-txt">
                      <div className="wc-canc-meta-titulo">{m.trackName}</div>
                      <div className="wc-canc-meta-artista">
                        {m.artistName}
                        {m.anio != null && ` · ${m.anio}`}
                      </div>
                    </div>
                    {m.preview && (
                      <button
                        className="wc-canc-play"
                        onClick={() => reproducir(m.preview!)}
                        aria-label={sonando === m.preview ? `Pausar ${m.trackName}` : `Reproducir ${m.trackName}`}
                      >
                        {sonando === m.preview ? '❚❚' : '▶'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="wc-cine-menciones">
              <h3>Menciones ({abiertaCanc.menciones.length})</h3>
              {abiertaCanc.menciones.map((m) => (
                <button
                  key={m.msgId}
                  className="wc-cine-mencion"
                  onClick={() => {
                    onIrA(m.msgId)
                    cerrar()
                  }}
                >
                  <span
                    className={
                      etiquetaAutor(m.autor) === NOMBRE_ELLA ? 'wc-cine-chip suya' : 'wc-cine-chip'
                    }
                  >
                    {etiquetaAutor(m.autor)}
                  </span>
                  <span className="wc-cine-mencion-fecha">{fechaCorta(m.ts + gMs)}</span>
                  <span className="wc-cine-mencion-texto">{m.texto.slice(0, 90)}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <audio ref={audioRef} onEnded={() => setSonando(null)} />
    </div>
  )
})

export default CancionesTab
