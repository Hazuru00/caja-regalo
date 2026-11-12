import { memo, useEffect, useMemo, useState } from 'react'
import type { Chat, Horario, Mapeo } from './tipos'
import { obtenerFichas, norm, type Ficha } from './cine'
import {
  asignarCine,
  cargarCineListas,
  crearColeccionCine,
  guardarCineListas,
  type CineAnot,
  type CineListasEstado,
} from './cine-listas'
import { desfaseGlobal, fechaCorta, NOMBRE_ELLA, NOMBRE_MIO } from './estadisticas'

interface Props {
  chat: Chat
  mapeo: Mapeo
  horario: Horario
  onIrA: (id: number) => void
}

const TIPO_LABEL: Record<Ficha['tipo'], string> = {
  serie: 'Serie',
  anime: 'Anime',
  pelicula: 'Película',
}

const CineTab = memo(function CineTab({ chat, mapeo, horario, onIrA }: Props) {
  const [fichas, setFichas] = useState<Ficha[] | null>(null)
  const [fase, setFase] = useState<'buscando' | 'listo' | 'error'>('buscando')
  const [abierta, setAbierta] = useState<string | null>(null)
  const [intento, setIntento] = useState(0)
  const [listas, setListas] = useState<CineListasEstado>(cargarCineListas)
  const [filtro, setFiltro] = useState<string | null>(null)
  const [dlgAdd, setDlgAdd] = useState(false)
  const [busca, setBusca] = useState('')
  const [nueva, setNueva] = useState('')
  const gMs = desfaseGlobal(horario) * 3600000

  const updListas = (f: (e: CineListasEstado) => CineListasEstado) => {
    setListas((prev) => {
      const n = f(prev)
      guardarCineListas(n)
      return n
    })
  }

  const anotPorCanon = useMemo(() => {
    const m = new Map<string, CineAnot>()
    for (const a of listas.anots) m.set(a.canon, a)
    return m
  }, [listas.anots])

  const nombreLista = (id: string) => listas.colecciones.find((c) => c.id === id)?.nombre ?? '?'

  useEffect(() => {
    let vivo = true
    setFase('buscando')
    obtenerFichas(chat)
      .then((f) => {
        if (!vivo) return
        setFichas(f)
        setFase('listo')
      })
      .catch(() => {
        if (!vivo) return
        setFase('error')
      })
    return () => {
      vivo = false
    }
  }, [chat, intento])

  const etiquetaAutor = (a: string | null) =>
    a === null ? '—' : a === mapeo.yo ? NOMBRE_MIO : a === mapeo.ella ? NOMBRE_ELLA : a

  const fichaAbierta = useMemo(
    () => fichas?.find((f) => f.id === abierta) ?? null,
    [fichas, abierta],
  )

  const totalMenciones = fichas?.reduce((n, f) => n + f.menciones.length, 0) ?? 0

  const fichasGrid = useMemo(() => {
    if (!fichas) return []
    if (!filtro) return fichas
    return fichas.filter((f) => anotPorCanon.get(f.canon)?.coleccion === filtro)
  }, [fichas, filtro, anotPorCanon])

  const resultadosAdd = useMemo(() => {
    if (!fichas) return []
    const q = norm(busca)
    if (!q) return fichas
    return fichas.filter((f) => norm(f.titulo).includes(q))
  }, [fichas, busca])

  const conteoPorAutor = (f: Ficha) => {
    const mapa = new Map<string, number>()
    for (const m of f.menciones) {
      const etiqueta = etiquetaAutor(m.autor)
      mapa.set(etiqueta, (mapa.get(etiqueta) ?? 0) + 1)
    }
    return [...mapa.entries()].sort((a, b) => b[1] - a[1])
  }

  const iniciales = (t: string) =>
    t
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('')

  return (
    <div className="wc-cine">
      {fase === 'buscando' && (
        <div className="wc-centro">
          <div className="wc-cine-buscando">Buscando fichas…</div>
        </div>
      )}
      {fase === 'error' && (
        <div className="wc-centro">
          <div className="wc-cine-error">No se pudo contactar con las APIs de fichas.</div>
          <button className="boton-secundario" onClick={() => setIntento((n) => n + 1)}>
            Reintentar
          </button>
        </div>
      )}
      {fase === 'listo' && fichas && fichas.length === 0 && (
        <div className="wc-fav-vacio">No se detectaron títulos en el chat.</div>
      )}
      {fase === 'listo' && fichas && fichas.length > 0 && (
        <>
          <div className="wc-cine-resumen-fila">
            <div className="wc-cine-resumen">
              {fichas.length} títulos · {totalMenciones} menciones
            </div>
            <button className="wc-cine-add-btn" onClick={() => setDlgAdd(true)}>
              ➕ Añadir
            </button>
          </div>
          {listas.colecciones.length > 0 && (
            <div className="wc-cine-filtros">
              <button
                className={filtro === null ? 'wc-cine-chip' : 'wc-cine-genero'}
                onClick={() => setFiltro(null)}
              >
                Todas ×{fichas.length}
              </button>
              {listas.colecciones.map((c) => (
                <button
                  key={c.id}
                  className={filtro === c.id ? 'wc-cine-chip' : 'wc-cine-genero'}
                  onClick={() => setFiltro(filtro === c.id ? null : c.id)}
                >
                  {c.nombre} ×{listas.anots.filter((a) => a.coleccion === c.id).length}
                </button>
              ))}
            </div>
          )}
          {fichasGrid.length === 0 && (
            <div className="wc-fav-vacio">Ningún título en esta lista todavía.</div>
          )}
          <div className="wc-cine-grid">
            {fichasGrid.map((f) => (
              <article className="wc-cine-card" key={f.id}>
                <button
                  className="wc-cine-card-abrir"
                  onClick={() => setAbierta(f.id)}
                  aria-label={`Ver ficha de ${f.titulo}`}
                >
                  {f.poster ? (
                    <img
                      className="wc-cine-poster"
                      src={f.poster}
                      alt=""
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="wc-cine-poster-fallback">{iniciales(f.titulo)}</div>
                  )}
                  <div className="wc-cine-card-titulo">{f.titulo}</div>
                  <div className="wc-cine-card-meta">
                    {f.rating != null && <span>★ {f.rating.toFixed(1)}</span>}
                    {f.anio != null && <span>{f.anio}</span>}
                    <span>{TIPO_LABEL[f.tipo]}</span>
                  </div>
                  <div className="wc-cine-card-autores">
                    {conteoPorAutor(f).map(([nombre, n]) => (
                      <span
                        key={nombre}
                        className={nombre === NOMBRE_ELLA ? 'wc-cine-chip suya' : 'wc-cine-chip'}
                      >
                        {nombre} ×{n}
                      </span>
                    ))}
                  </div>
                  {anotPorCanon.get(f.canon) && (
                    <div className="wc-cine-lista-nombre">
                      {nombreLista(anotPorCanon.get(f.canon)!.coleccion)}
                    </div>
                  )}
                  {f.recomendo.length > 0 && (
                    <div className="wc-cine-rec">Recomendada por {f.recomendo.map(etiquetaAutor).join(', ')}</div>
                  )}
                </button>
              </article>
            ))}
          </div>
        </>
      )}

      {dlgAdd && (
        <>
          <div className="wc-fav-sheet-backdrop" onPointerDown={() => setDlgAdd(false)} />
          <div className="wc-fav-sheet" role="dialog" aria-label="Añadir recomendada">
            <div className="wc-fav-sheet-grab" />
            <div className="wc-fav-sheet-top">
              <span className="wc-fav-sheet-meta">Añadir recomendada</span>
              <button className="wc-nav-btn" onClick={() => setDlgAdd(false)} aria-label="Cerrar">
                ✕
              </button>
            </div>
            <div className="wc-cine-nueva">
              <input
                className="wc-cine-buscar"
                placeholder="Nueva lista…"
                value={nueva}
                onChange={(e) => setNueva(e.target.value)}
              />
              <button
                className="boton-secundario"
                onClick={() => {
                  updListas((e) => crearColeccionCine(e, nueva))
                  setNueva('')
                }}
              >
                Crear
              </button>
            </div>
            <input
              className="wc-cine-buscar"
              placeholder="Buscar título…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <div className="wc-cine-add-lista">
              {resultadosAdd.map((f) => (
                <div className="wc-cine-add-fila" key={f.id}>
                  <div className="wc-cine-add-titulo">
                    {f.titulo} <span className="wc-cine-add-tipo">{TIPO_LABEL[f.tipo]}</span>
                  </div>
                  <div className="wc-cine-add-chips">
                    {listas.colecciones.map((c) => {
                      const act = anotPorCanon.get(f.canon)?.coleccion === c.id
                      return (
                        <button
                          key={c.id}
                          className={act ? 'wc-cine-chip' : 'wc-cine-genero'}
                          onClick={() => updListas((e) => asignarCine(e, f.canon, c.id))}
                        >
                          {c.nombre}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
              {resultadosAdd.length === 0 && (
                <div className="wc-canc-estado">Sin resultados para «{busca}».</div>
              )}
            </div>
          </div>
        </>
      )}

      {fichaAbierta && (
        <>
          <div className="wc-fav-sheet-backdrop" onPointerDown={() => setAbierta(null)} />
          <div className="wc-fav-sheet" role="dialog" aria-label={`Ficha de ${fichaAbierta.titulo}`}>
            <div className="wc-fav-sheet-grab" />
            <div className="wc-fav-sheet-top">
              <span className="wc-fav-sheet-meta">
                {TIPO_LABEL[fichaAbierta.tipo]}
                {fichaAbierta.anio != null && ` · ${fichaAbierta.anio}`}
                {fichaAbierta.rating != null && ` · ★ ${fichaAbierta.rating.toFixed(1)}`}
                {fichaAbierta.estado && ` · ${fichaAbierta.estado}`}
              </span>
              <button className="wc-nav-btn" onClick={() => setAbierta(null)} aria-label="Cerrar">
                ✕
              </button>
            </div>
            <div className="wc-cine-sheet-cab">
              {fichaAbierta.poster ? (
                <img className="wc-cine-sheet-poster" src={fichaAbierta.poster} alt="" loading="lazy" />
              ) : (
                <div className="wc-cine-sheet-poster-fallback">{iniciales(fichaAbierta.titulo)}</div>
              )}
              <div>
                <h2 className="wc-cine-sheet-titulo">{fichaAbierta.titulo}</h2>
                {fichaAbierta.generos.length > 0 && (
                  <div className="wc-cine-generos">
                    {fichaAbierta.generos.map((g) => (
                      <span key={g} className="wc-cine-genero">
                        {g}
                      </span>
                    ))}
                  </div>
                )}
                {fichaAbierta.recomendo.length > 0 && (
                  <div className="wc-cine-rec">
                    Recomendada por {fichaAbierta.recomendo.map(etiquetaAutor).join(', ')}
                  </div>
                )}
              </div>
            </div>
            {fichaAbierta.resumen && <p className="wc-cine-resumen-txt">{fichaAbierta.resumen}</p>}
            <div className="wc-cine-menciones">
              <h3>
                Menciones ({fichaAbierta.menciones.length})
              </h3>
              {fichaAbierta.menciones.map((m) => (
                <button
                  key={m.msgId}
                  className="wc-cine-mencion"
                  onClick={() => {
                    onIrA(m.msgId)
                    setAbierta(null)
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
    </div>
  )
})

export default CineTab
