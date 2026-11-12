import { memo, useMemo, useRef, useState, type ChangeEvent } from 'react'
import type { Chat, Horario, Mapeo, Mensaje } from './tipos'
import type { FavoritosEstado } from './favoritos'
import {
  borrarColeccion,
  borrarEntrada,
  crearColeccion,
  exportarBackup,
  leerBackup,
  moverColeccion,
  ponerNota,
} from './favoritos'
import { desfaseGlobal, fechaCorta, MEDIA_INFO, NOMBRE_ELLA, NOMBRE_MIO } from './estadisticas'
import { normalizar } from '../../lib/texto'
import { guardarTema } from '../../lib/tema'

interface Props {
  chat: Chat
  mapeo: Mapeo
  horario: Horario
  favoritos: FavoritosEstado
  onFavoritos: (f: FavoritosEstado) => void
  onIrA: (id: number) => void
  onHorario: (h: Horario) => void
}

const FavTab = memo(function FavTab({ chat, mapeo, horario, favoritos, onFavoritos, onIrA, onHorario }: Props) {
  const [q, setQ] = useState('')
  const [filtroCol, setFiltroCol] = useState<string>('todas')
  const [orden, setOrden] = useState<'recientes' | 'antiguos'>('recientes')
  const [abierta, setAbierta] = useState<string | null>(null)
  const [msgBackup, setMsgBackup] = useState('')
  const inputFileRef = useRef<HTMLInputElement>(null)
  const gMs = desfaseGlobal(horario) * 3600000

  const mapaMensajes = useMemo(() => {
    const mapa = new Map<number, Mensaje>()
    for (const m of chat.mensajes) mapa.set(m.id, m)
    return mapa
  }, [chat])

  const etiquetaAutor = (a: string | null) =>
    a === null ? '—' : a === mapeo.yo ? NOMBRE_MIO : a === mapeo.ella ? NOMBRE_ELLA : a

  const conteoCol = (id: string | 'todas' | 'sin') => {
    if (id === 'todas') return favoritos.entradas.length
    if (id === 'sin') return favoritos.entradas.filter((e) => !e.coleccion).length
    return favoritos.entradas.filter((e) => e.coleccion === id).length
  }

  const lista = useMemo(() => {
    const qq = normalizar(q.trim())
    let res = favoritos.entradas.map((e) => ({ e, m: mapaMensajes.get(e.msgId) }))
    if (filtroCol === 'sin') res = res.filter(({ e }) => !e.coleccion)
    else if (filtroCol !== 'todas') res = res.filter(({ e }) => e.coleccion === filtroCol)
    if (qq)
      res = res.filter(({ e, m }) =>
        normalizar(`${m?.texto ?? ''}\n${m?.mediaNombre ?? ''}\n${e.nota}`).includes(qq),
      )
    res.sort((a, b) => (orden === 'recientes' ? b.e.ts - a.e.ts : a.e.ts - b.e.ts))
    return res
  }, [favoritos, filtroCol, q, orden, mapaMensajes])

  const entradaAbierta = abierta ? favoritos.entradas.find((e) => e.id === abierta) ?? null : null
  const msgAbierto = entradaAbierta ? mapaMensajes.get(entradaAbierta.msgId) : undefined

  const colActiva = favoritos.colecciones.find((c) => c.id === filtroCol)

  function nuevaColeccion() {
    const nombre = window.prompt('Nombre de la colección:')
    if (nombre && nombre.trim()) onFavoritos(crearColeccion(favoritos, nombre.trim()))
  }

  function alCambiarFiltro(v: string) {
    if (v === '__nueva') {
      nuevaColeccion()
      return
    }
    setFiltroCol(v)
  }

  function alCambiarColeccionEntrada(v: string) {
    if (!entradaAbierta) return
    if (v === '__nueva') {
      const nombre = window.prompt('Nombre de la colección:')
      if (nombre && nombre.trim()) {
        const nuevo = crearColeccion(favoritos, nombre.trim())
        const nuevaId = nuevo.colecciones[nuevo.colecciones.length - 1].id
        onFavoritos(moverColeccion(nuevo, entradaAbierta.id, nuevaId))
      }
      return
    }
    onFavoritos(moverColeccion(favoritos, entradaAbierta.id, v || null))
  }

  async function alRestaurar(ev: ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0]
    ev.target.value = ''
    if (!file) return
    try {
      const datos = leerBackup(await file.text())
      onFavoritos(datos.favoritos)
      if (datos.horario) onHorario(datos.horario)
      guardarTema(datos.tema)
      setMsgBackup('Backup restaurado ✓')
    } catch (e) {
      setMsgBackup(e instanceof Error ? e.message : 'No se pudo leer el backup.')
    }
  }

  function textoDe(m: Mensaje | undefined, msgId: number) {
    if (!m) return `Mensaje #${msgId} (ya no está en el chat)`
    if (m.texto) return m.texto
    if (m.media) return `${MEDIA_INFO[m.media].icono} ${MEDIA_INFO[m.media].label}`
    return '—'
  }

  return (
    <div className="wc-favoritos">
      <div className="wc-fav-top">
        <h3>⭐ Favoritos</h3>
        <span className="wc-fav-count">
          {favoritos.entradas.length} guardado{favoritos.entradas.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="wc-fav-busca">
        <input
          type="search"
          placeholder="Buscar en favoritos y notas…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="wc-fav-orden" role="group" aria-label="Ordenar">
          <button
            type="button"
            className={orden === 'recientes' ? 'activo' : undefined}
            onClick={() => setOrden('recientes')}
          >
            Recientes
          </button>
          <button
            type="button"
            className={orden === 'antiguos' ? 'activo' : undefined}
            onClick={() => setOrden('antiguos')}
          >
            Antiguos
          </button>
        </div>
      </div>

      <div className="wc-fav-col-fila">
        <select value={filtroCol} onChange={(e) => alCambiarFiltro(e.target.value)} aria-label="Colección">
          <option value="todas">Todo ({conteoCol('todas')})</option>
          <option value="sin">Sin colección ({conteoCol('sin')})</option>
          {favoritos.colecciones.map((c) => (
            <option key={c.id} value={c.id}>
              📁 {c.nombre} ({conteoCol(c.id)})
            </option>
          ))}
          <option value="__nueva">+ Nueva colección</option>
        </select>
        {colActiva && (
          <button
            type="button"
            className="wc-fav-col-del"
            aria-label={`Borrar colección ${colActiva.nombre}`}
            title="Borrar esta colección (los mensajes quedan sin colección)"
            onClick={() => {
              onFavoritos(borrarColeccion(favoritos, colActiva.id))
              setFiltroCol('todas')
            }}
          >
            🗑
          </button>
        )}
      </div>

      {lista.length === 0 ? (
        <p className="wc-fav-vacio">
          {favoritos.entradas.length
            ? 'Nada con ese filtro.'
            : 'Todavía no hay favoritos: mantén presionado un mensaje (o toca ★) para guardarlo.'}
        </p>
      ) : (
        <div className="wc-fav-grid">
          {lista.map(({ e, m }) => {
            const esMia = m ? m.autor === mapeo.yo : false
            const conMedia = !!m?.media && !m.texto
            return (
              <div key={e.id} className={conMedia ? 'wc-fav-card media' : 'wc-fav-card'}>
                <button
                  type="button"
                  className="wc-fav-card-abrir"
                  onClick={() => setAbierta(e.id)}
                  aria-label={`Abrir favorito de ${m ? etiquetaAutor(m.autor) : 'mensaje'}`}
                >
                  {conMedia && (
                    <div className="wc-fav-card-media-icono">{MEDIA_INFO[m!.media!].icono}</div>
                  )}
                  <div className="wc-fav-card-texto">{textoDe(m, e.msgId).slice(0, 220)}</div>
                  {e.nota && <div className="wc-fav-card-nota">📝 {e.nota}</div>}
                  <div className="wc-fav-card-pie">
                    <span className={esMia ? 'wc-fav-card-autor' : 'wc-fav-card-autor suya'}>
                      {m ? etiquetaAutor(m.autor).slice(0, 1) : '—'}
                    </span>
                    <span>{m && m.ts > 0 ? fechaCorta(m.ts + gMs) : '—'}</span>
                  </div>
                </button>
                <button
                  type="button"
                  className="wc-fav-card-star"
                  onClick={() => onFavoritos(borrarEntrada(favoritos, e.id))}
                  aria-label="Quitar de favoritos"
                >
                  ★
                </button>
              </div>
            )
          })}
        </div>
      )}

      <div className="wc-fav-backup">
        <span aria-hidden="true">💾</span>
        <button type="button" className="wc-fav-backup-btn" onClick={() => exportarBackup(favoritos, horario)}>
          ⬇ Descargar backup
        </button>
        <button type="button" className="wc-fav-backup-btn" onClick={() => inputFileRef.current?.click()}>
          ⬆ Restaurar backup
        </button>
        {msgBackup && <span className="wc-toque-info">{msgBackup}</span>}
        <input ref={inputFileRef} type="file" accept=".json,application/json" hidden onChange={alRestaurar} />
      </div>

      {entradaAbierta && (
        <>
          <div className="wc-fav-sheet-backdrop" onPointerDown={() => setAbierta(null)} />
          <div className="wc-fav-sheet" role="dialog" aria-label="Detalle del favorito">
            <div className="wc-fav-sheet-grab" />
            <div className="wc-fav-sheet-top">
              <span className="wc-fav-sheet-meta">
                {msgAbierto ? etiquetaAutor(msgAbierto.autor) : 'Mensaje'} ·{' '}
                {msgAbierto && msgAbierto.ts > 0 ? fechaCorta(msgAbierto.ts + gMs) : '—'}
              </span>
              <button type="button" className="wc-nav-btn" aria-label="Cerrar" onClick={() => setAbierta(null)}>
                ✕
              </button>
            </div>
            <div className="wc-fav-sheet-texto">{textoDe(msgAbierto, entradaAbierta.msgId)}</div>
            <textarea
              className="wc-fav-nota"
              placeholder="Nota sobre este momento…"
              value={entradaAbierta.nota}
              rows={2}
              onChange={(ev) => onFavoritos(ponerNota(favoritos, entradaAbierta.id, ev.target.value))}
            />
            <select
              value={entradaAbierta.coleccion ?? ''}
              onChange={(ev) => alCambiarColeccionEntrada(ev.target.value)}
              aria-label="Colección"
            >
              <option value="">Sin colección</option>
              {favoritos.colecciones.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
              <option value="__nueva">+ Nueva colección</option>
            </select>
            <div className="wc-dialogo-acciones">
              <button
                type="button"
                className="wc-boton"
                onClick={() => {
                  if (msgAbierto) onIrA(msgAbierto.id)
                  setAbierta(null)
                }}
              >
                Ver en el chat
              </button>
              <button
                type="button"
                className="boton-secundario"
                onClick={() => {
                  onFavoritos(borrarEntrada(favoritos, entradaAbierta.id))
                  setAbierta(null)
                }}
              >
                Quitar de favoritos
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
})

export default FavTab
