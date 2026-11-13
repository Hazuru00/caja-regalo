import { memo, useState, useMemo } from 'react'
import type { Chat, Horario, Mapeo, MediaTipo } from './tipos'
import {
  calcularEstadisticas,
  desfaseGlobal,
  fechaCorta,
  minutosATexto,
  MEDIA_INFO,
  NOMBRE_ELLA,
  semanasDe,
  UMBRALES_INICIO,
  ZONAS,
} from './estadisticas'

const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const TRAMOS_RESP = ['⚡ <10 s', '🚀 10-60 s', '💬 1-5 min', '🐢 5-30 min', '🦥 >30 min']
const TRAMOS_EMOJI = ['⚡', '🚀', '💬', '🐢', '🦥']
const MEDIA_ORDEN: MediaTipo[] = ['sticker', 'voz', 'audio', 'video', 'imagen', 'gif', 'documento', 'contacto', 'ubicacion', 'album']
const FAM_EMOJI: Record<string, string> = { ja: '😂', je: '😄', ji: '😁', js: '🤣', xd: '😆', tecleo: '🎹', otra: '💬' }

function horaTexto(h: number) {
  return `${h % 12 || 12}${h < 12 ? ' a. m.' : ' p. m.'}`
}

const StatsTab = memo(function StatsTab({
  chat,
  mapeo,
  horario,
  onHorario,
  onIrA,
}: {
  chat: Chat
  mapeo: Mapeo
  horario: Horario
  onHorario: (h: Horario) => void
  onIrA: (id: number) => void
}) {
  const gMs = desfaseGlobal(horario) * 3600000
  const st = useMemo(() => calcularEstadisticas(chat, horario, mapeo), [chat, horario, mapeo])
  const semanas = useMemo(() => semanasDe(chat.mensajes, gMs), [chat, gMs])

  const hitos = useMemo(() => {
    const res: Array<{ id: number; ts: number; autor: string | null; label: string; preview: string }> = []
    const ms = chat.mensajes
    const prev = (m: (typeof ms)[number]) =>
      m.texto ? m.texto.slice(0, 90) + (m.texto.length > 90 ? '…' : '') : m.media ? MEDIA_INFO[m.media].icono : '—'
    if (ms.length) res.push({ id: ms[0].id, ts: ms[0].ts, autor: ms[0].autor, label: 'Primer mensaje 🌱', preview: prev(ms[0]) })
    const primerSticker = ms.find((m) => m.media === 'sticker')
    if (primerSticker) {
      res.push({ id: primerSticker.id, ts: primerSticker.ts, autor: primerSticker.autor, label: 'Primer sticker 🎨', preview: '🎨' })
    }
    for (const n of [1000, 10000, 25000, 50000]) {
      if (n <= ms.length) {
        const m = ms[n - 1]
        res.push({
          id: m.id,
          ts: m.ts,
          autor: m.autor,
          label: `Mensaje #${n.toLocaleString('es')}`,
          preview: prev(m),
        })
      }
    }
    return res.sort((a, b) => a.ts - b.ts)
  }, [chat])

  const autores = Object.entries(st.porAutor).sort((a, b) => b[1] - a[1])
  const maxHora = Math.max(...st.porHora, 1)
  const maxDiaSemana = Math.max(...st.porDiaSemana, 1)
  const maxTopDia = Math.max(...st.topDias.map((d) => d.total), 1)
  const etiquetaAutor = (a: string) => (a === mapeo.yo ? 'Moises 💙' : a === mapeo.ella ? 'Jania 💛' : a)
  const nombreZona = (off: number) => ZONAS.find((z) => z.off === off)?.label ?? `UTC${off >= 0 ? '+' : ''}${off}`
  const offVista = horario.vista === 'archivo' ? horario.archivo : horario.vista
  const zonaGlobal = horario.porPersona ? 'cada quien en su zona' : nombreZona(offVista)
  const zonaAutor = (autor: string | null) =>
    horario.porPersona && autor
      ? nombreZona(autor === mapeo.yo ? horario.tu : autor === mapeo.ella ? horario.ella : offVista)
      : nombreZona(offVista)

  const filasPalabras = autores
    .map(([autor]) => ({
      autor,
      palabras: st.palabrasTotal[autor] ?? 0,
      mensajes: st.porAutor[autor] ?? 0,
    }))
    .filter((f) => f.mensajes > 0)
  const maxPalabras = Math.max(...filasPalabras.map((f) => f.palabras), 1)

  const maxSemana = Math.max(...semanas.map((s) => s.total), 1)
  const maxDurBloque = Math.max(...st.bloques.map((b) => b.dur), 1)
  const maxCalor = Math.max(...st.calor.flat(), 1)
  const maxAvg = Math.max(
    ...autores.map(([a]) => (st.charsTotal[a] ?? 0) / Math.max(st.conTexto[a] ?? 1, 1)),
    1,
  )

  const [umbralIn, setUmbralIn] = useState(UMBRALES_INICIO[0])
  const [muestra, setMuestra] = useState<{ clave: string; titulo: string } | null>(null)
  const [infoToque, setInfoToque] = useState<{ sec: string; txt: string } | null>(null)
  const filaIn = st.inicia.find((x) => x.umbral === umbralIn) ?? st.inicia[0]
  const filasInicia = autores.map(([autor]) => ({ autor, n: filaIn.porAutor[autor] ?? 0 }))
  const totalInicia = filasInicia.reduce((a, f) => a + f.n, 0) || 1
  const reyInicia = [...filasInicia].sort((a, b) => b.n - a.n)[0]
  const etiquetaUmbral = umbralIn >= 60 ? `${umbralIn / 60} h` : `${umbralIn} min`

  const fmtFranja = (v: number) => (v > 0 ? minutosATexto(v) : '—')

  const entsResp = Object.entries(st.respuestaMediana).filter(([, v]) => v > 0)
  let caraACara: string | null = null
  if (entsResp.length === 2) {
    const orden = [...entsResp].sort((a, b) => a[1] - b[1])
    const ratio = orden[1][1] / Math.max(orden[0][1], 1)
    caraACara =
      ratio >= 1.1
        ? `🏆 ${etiquetaAutor(orden[0][0])} contesta ${ratio.toFixed(1)}× más rápido que ${etiquetaAutor(orden[1][0])}`
        : '🤝 Empate: los dos contestan prácticamente igual de rápido'
  }
  const hayTramos = Object.values(st.respuestaTramos).some((t) => t.some((n) => n > 0))

  return (
    <div className="wc-stats">
      <section className="wc-tarjeta">
        <h3>🕐 Horario</h3>
        <div className="wc-horario-fila">
          <label>
            Este archivo se exportó desde
            <select value={String(horario.archivo)} onChange={(e) => onHorario({ ...horario, archivo: Number(e.target.value) })}>
              {ZONAS.map((z) => (
                <option key={z.off} value={String(z.off)}>
                  {z.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Mostrar el chat en
            <select
              value={String(horario.vista)}
              onChange={(e) => {
                const v = e.target.value
                onHorario({ ...horario, vista: v === 'archivo' ? 'archivo' : Number(v) })
              }}
            >
              <option value="archivo">Igual que el archivo</option>
              {ZONAS.map((z) => (
                <option key={z.off} value={String(z.off)}>
                  {z.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="wc-horario-fila">
          <label className="wc-check">
            <input
              type="checkbox"
              checked={horario.porPersona}
              onChange={(e) => onHorario({ ...horario, porPersona: e.target.checked })}
            />
            Actividad de cada quien en su propia zona
          </label>
          {horario.porPersona && (
            <>
              <label>
                Tu zona
                <select value={String(horario.tu)} onChange={(e) => onHorario({ ...horario, tu: Number(e.target.value) })}>
                  {ZONAS.map((z) => (
                    <option key={z.off} value={String(z.off)}>
                      {z.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Zona de {NOMBRE_ELLA}
                <select value={String(horario.ella)} onChange={(e) => onHorario({ ...horario, ella: Number(e.target.value) })}>
                  {ZONAS.map((z) => (
                    <option key={z.off} value={String(z.off)}>
                      {z.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </div>
        <p className="wc-suave">
          El archivo guarda todo con el reloj de quien lo exportó. Ajusta aquí si lo subió el otro para ver las horas
          reales de cada uno.
        </p>
      </section>

      <section className="wc-tarjeta">
        <h3>Resumen</h3>
        <div className="wc-numeros">
          <Dato valor={st.total.toLocaleString('es')} label="mensajes" />
          <Dato valor={st.diasHablando.toLocaleString('es')} label="días hablando" />
          <Dato valor={minutosATexto(st.hablandoMs / Math.max(st.diasActivos, 1))} label="promedio charlando al día" />
        </div>
        {autores.map(([autor, total]) => (
          <div key={autor} className="wc-barra-fila">
            <span className="wc-barra-nombre">{etiquetaAutor(autor)}</span>
            <div className="wc-barra">
              <div className="wc-barra-fill" style={{ width: `${(total / st.total) * 100}%` }} />
            </div>
            <span className="wc-barra-valor">
              {total.toLocaleString('es')} ({Math.round((total / st.total) * 100)}%)
            </span>
          </div>
        ))}
        <p className="wc-suave">Contados desde el 5 de julio, cuando empezaron a hablar.</p>
        <p className="wc-suave">
          Primer mensaje: {st.primero ? fechaCorta(st.primero) : '—'} · Último: {st.ultimo ? fechaCorta(st.ultimo) : '—'}
        </p>
        <p className="wc-suave">
          Charla total estimada: {minutosATexto(st.hablandoMs)} — solo los ratos seguidos, sin pausas de más de 15 minutos.
          Lo de Insta y TikTok no cuenta aquí.
        </p>
      </section>

      <section className="wc-tarjeta">
        <h3>Quién dice más</h3>
        {filasPalabras.map((f) => (
          <div key={f.autor} className="wc-barra-fila">
            <span className="wc-barra-nombre">{etiquetaAutor(f.autor)}</span>
            <div className="wc-barra">
              <div className="wc-barra-fill" style={{ width: `${(f.palabras / maxPalabras) * 100}%` }} />
            </div>
            <span className="wc-barra-valor">{f.palabras.toLocaleString('es')} palabras</span>
          </div>
        ))}
        {filasPalabras.map((f) => (
          <p key={f.autor + '-det'} className="wc-suave">
            {etiquetaAutor(f.autor)}: {f.mensajes.toLocaleString('es')} mensajes ·{' '}
            {(f.palabras / Math.max(f.mensajes, 1)).toFixed(1)} palabras por mensaje
          </p>
        ))}
        {filasPalabras.length === 2 &&
          (() => {
            const [a, b] = filasPalabras
            const dif = Math.abs(a.palabras - b.palabras)
            if (dif === 0) return <p className="wc-suave">Empatados a palabras.</p>
            const w = a.palabras > b.palabras ? a : b
            return (
              <p className="wc-suave">
                Le gana en palabras {etiquetaAutor(w.autor)} por {dif.toLocaleString('es')}.
              </p>
            )
          })()}
      </section>

      <section className="wc-tarjeta">
        <h3>📈 Mensajes por semana</h3>
        {semanas.map((s) => (
          <button key={s.ts} type="button" className="wc-barra-fila wc-salta" onClick={() => onIrA(s.id)}>
            <span className="wc-barra-nombre">{fechaCorta(s.ts)}</span>
            <div className="wc-barra">
              <div className="wc-barra-fill" style={{ width: `${(s.total / maxSemana) * 100}%` }} />
            </div>
            <span className="wc-barra-valor wc-ancho">{s.total.toLocaleString('es')} mensajes</span>
          </button>
        ))}
        <p className="wc-suave">Cada barra es una semana (lunes a domingo). Toca para saltar a esa semana.</p>
      </section>

      <section className="wc-tarjeta">
        <h3>📅 Comparativa por mes</h3>
        {st.meses.map((mes) => {
          const totalMes = Object.values(mes.porAutor).reduce((a, b) => a + b, 0)
          const filasMes = autores.map(([autor]) => ({ autor, n: mes.porAutor[autor] ?? 0 }))
          const wMes = [...filasMes].sort((a, b) => b.n - a.n)[0]
          const empateMes = filasMes.length === 2 && filasMes[0].n === filasMes[1].n
          return (
            <div key={mes.ts} className="wc-mes">
              <h4>
                {new Date(mes.ts).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })} ·{' '}
                {totalMes.toLocaleString('es')} mensajes
              </h4>
              {filasMes.map((f) => (
                <div key={f.autor} className="wc-barra-fila">
                  <span className="wc-barra-nombre">{etiquetaAutor(f.autor)}</span>
                  <div className="wc-barra">
                    <div className="wc-barra-fill" style={{ width: `${(f.n / Math.max(totalMes, 1)) * 100}%` }} />
                  </div>
                  <span className="wc-barra-valor">
                    {f.n.toLocaleString('es')} ({Math.round((f.n / Math.max(totalMes, 1)) * 100)}%)
                  </span>
                </div>
              ))}
              <p className="wc-suave">
                {empateMes ? 'Mes empatado.' : `Ese mes habló más ${etiquetaAutor(wMes.autor)}.`}
              </p>
            </div>
          )
        })}
      </section>

      <section className="wc-tarjeta">
        <h3>🏅 Hitos</h3>
        {hitos.map((h) => (
          <button key={h.id} type="button" className="wc-ref-msg" onClick={() => onIrA(h.id)}>
            <div className="wc-ref-meta">
              {h.label} · {fechaCorta(h.ts + gMs)} · {h.autor ? etiquetaAutor(h.autor) : '—'}
            </div>
            <div className="wc-ref-texto">{h.preview}</div>
          </button>
        ))}
        <p className="wc-suave">Toca cualquiera para verlo en su contexto.</p>
      </section>

      <section className="wc-tarjeta">
        <h3>🌅 Buenos días y buenas noches</h3>
        {autores.map(([autor]) => {
          const mad = (st.porHoraAutor[autor] ?? []).slice(0, 6).reduce((a, b) => a + b, 0)
          const total = st.porAutor[autor] ?? 1
          return (
            <p key={autor} className="wc-suave">
              {etiquetaAutor(autor)}: 🌤 {((st.mananas[autor] ?? 0).toLocaleString('es'))} buenos días (
              {(st.mananasDias[autor] ?? 0).toLocaleString('es')} días) · 🌙 {((st.noches[autor] ?? 0).toLocaleString('es'))}{' '}
              buenas noches ({(st.nochesDiasAutor[autor] ?? 0).toLocaleString('es')} días) · 🦉 {mad.toLocaleString('es')}{' '}
              mensajes entre 0 y 6 h ({Math.round((mad / total) * 100)}% de los suyos)
            </p>
          )
        })}
        <p className="wc-suave">
          Cuenta solo mensajes con texto — los audios (de esos hay muchos 😅) no se pueden leer.
        </p>
      </section>

      <section className="wc-tarjeta">
        <h3>💍 Propuestas y apodos de casados</h3>
        {autores.map(([autor]) => {
          const p = st.propuestas[autor]
          if (!p) return null
          return (
            <p key={autor} className="wc-suave">
              {etiquetaAutor(autor)}: 💍 {p.propuestas.toLocaleString('es')} propuestas · 💑 {p.apodos.toLocaleString('es')} apodos
            </p>
          )
        })}
        {Object.keys(st.propuestas).length === 0 && (
          <p className="wc-suave">Todavía no han dicho "casémonos" por escrito… 👀</p>
        )}
        {st.propuestasRefs.length > 0 && (
          <>
            <h4>💬 Los mensajes 💍</h4>
            {st.propuestasRefs
              .slice(-12)
              .reverse()
              .map((r) => (
                <button key={r.id} type="button" className="wc-ref-msg" onClick={() => onIrA(r.id)}>
                  <div className="wc-ref-meta">
                    {r.autor ? etiquetaAutor(r.autor) : '—'} · {fechaCorta(r.ts + gMs)}
                  </div>
                  <div className="wc-ref-texto">{r.texto}</div>
                </button>
              ))}
            <p className="wc-suave">Toca una propuesta para verla en su contexto.</p>
          </>
        )}
      </section>

      <section className="wc-tarjeta">
        <h3>🎯 ¿Quién tira la primera?</h3>
        <div className="wc-umbral">
          {UMBRALES_INICIO.map((u) => (
            <button
              key={u}
              type="button"
              className={u === umbralIn ? 'wc-umbral-btn activo' : 'wc-umbral-btn'}
              onClick={() => setUmbralIn(u)}
            >
              {u >= 60 ? `${u / 60} h` : `${u} min`}
            </button>
          ))}
        </div>
        {filasInicia.map((f) => (
          <div key={f.autor} className="wc-barra-fila">
            <span className="wc-barra-nombre">{etiquetaAutor(f.autor)}</span>
            <div className="wc-barra">
              <div className="wc-barra-fill" style={{ width: `${(f.n / totalInicia) * 100}%` }} />
            </div>
            <span className="wc-barra-valor">
              {f.n.toLocaleString('es')} ({Math.round((f.n / totalInicia) * 100)}%)
            </span>
          </div>
        ))}
        <p className="wc-suave">
          {reyInicia &&
            `Es ${etiquetaAutor(reyInicia.autor)} quien más rompe el hielo: ${reyInicia.n.toLocaleString('es')} veces.`}{' '}
          Se cuenta cada vez que alguien escribe tras más de {etiquetaUmbral} de silencio (y el primer mensaje del chat).
        </p>
      </section>

      <section className="wc-tarjeta">
        <h3>🌙 Las conversaciones más largas sin parar</h3>
        <p className="wc-suave">Conversaciones donde nadie se callaba más de 15 minutos.</p>
        {st.bloques.map((b) => (
          <button key={b.ts} type="button" className="wc-barra-fila wc-salta" onClick={() => onIrA(b.id)}>
            <span className="wc-barra-nombre">{fechaCorta(b.ts + gMs)}</span>
            <div className="wc-barra">
              <div className="wc-barra-fill" style={{ width: `${(b.dur / maxDurBloque) * 100}%` }} />
            </div>
            <span className="wc-barra-valor wc-ancho">
              {minutosATexto(b.dur)} · {b.mensajes.toLocaleString('es')} mensajes
            </span>
          </button>
        ))}
        {st.bloques.length === 0 && <p className="wc-suave">No hubo conversaciones de más de 30 minutos sin parar.</p>}
      </section>

      <section className="wc-tarjeta">
        <h3>Por cuándo escriben</h3>
        <h4>Hora del día · {zonaGlobal}</h4>
        <div className="wc-histograma">
          {st.porHora.map((n, h) => (
            <div
              key={h}
              className="wc-col"
              title={`${h}:00 · ${zonaGlobal} — ${n.toLocaleString('es')} mensajes`}
              onClick={() =>
                setInfoToque({ sec: 'hora', txt: `${horaTexto(h)} · ${zonaGlobal} — ${n.toLocaleString('es')} mensajes` })
              }
            >
              <div className="wc-col-fill" style={{ height: `${(n / maxHora) * 100}%` }} />
              <span>{h % 6 === 0 ? h : ''}</span>
            </div>
          ))}
        </div>
        {infoToque?.sec === 'hora' && <p className="wc-toque-info">{infoToque.txt}</p>}
        <h4>Día de la semana</h4>
        <div className="wc-semana">
          {st.porDiaSemana.map((n, d) => (
            <div
              key={d}
              className="wc-semana-dia"
              title={`${DIAS_CORTOS[d]} — ${n.toLocaleString('es')}`}
              onClick={() => setInfoToque({ sec: 'dia', txt: `${DIAS_CORTOS[d]} — ${n.toLocaleString('es')} mensajes` })}
            >
              <div className="wc-semana-fill" style={{ height: `${(n / maxDiaSemana) * 100}%` }} />
              <span>{DIAS_CORTOS[d]}</span>
            </div>
          ))}
        </div>
        {infoToque?.sec === 'dia' && <p className="wc-toque-info">{infoToque.txt}</p>}
        <h4>Actividad por persona{horario.porPersona ? ' (cada quien en su zona)' : ''}</h4>
        {autores.map(([autor]) => {
          const arr = st.porHoraAutor[autor]
          if (!arr) return null
          const max = Math.max(...arr, 1)
          const pico = arr.indexOf(Math.max(...arr))
          return (
            <div key={autor} className="wc-hora-persona">
              <div className="wc-hora-persona-top">
                <b>{etiquetaAutor(autor)}</b> · hora punta: {horaTexto(pico)}
              </div>
              <div className="wc-histograma wc-histograma-mini">
                {arr.map((n, h) => (
                  <div
                    key={h}
                    className="wc-col"
                    title={`${horaTexto(h)} · ${zonaAutor(autor)} — ${n.toLocaleString('es')} mensajes`}
                    onClick={() =>
                      setInfoToque({
                        sec: `persona-${autor}`,
                        txt: `${etiquetaAutor(autor)} ${horaTexto(h)} · ${zonaAutor(autor)} — ${n.toLocaleString('es')} mensajes`,
                      })
                    }
                  >
                    <div className="wc-col-fill" style={{ height: `${(n / max) * 100}%` }} />
                    <span>{h % 6 === 0 ? h : ''}</span>
                  </div>
                ))}
              </div>
              {infoToque?.sec === `persona-${autor}` && <p className="wc-toque-info">{infoToque.txt}</p>}
            </div>
          )
        })}
      </section>

      <section className="wc-tarjeta">
        <h3>🗺️ Mapa de calor</h3>
        <p className="wc-suave">Dónde se concentran las conversaciones: día × hora.</p>
        <div className="wc-calor-scroll">
          <div className="wc-calor">
            {[1, 2, 3, 4, 5, 6, 0].map((dia) => (
              <div key={dia} className="wc-calor-fila">
                <span className="wc-calor-label">{DIAS_CORTOS[dia]}</span>
                {st.calor[dia].map((n, h) => (
                  <div
                    key={h}
                    className="wc-calor-celda"
                    title={`${DIAS_CORTOS[dia]} ${horaTexto(h)} · ${zonaGlobal} — ${n.toLocaleString('es')} mensajes`}
                    onClick={() =>
                      setInfoToque({
                        sec: 'calor',
                        txt: `${DIAS_CORTOS[dia]} ${horaTexto(h)} · ${zonaGlobal} — ${n.toLocaleString('es')} mensajes`,
                      })
                    }
                    style={n ? { background: `rgba(0, 168, 135, ${0.12 + (0.88 * n) / maxCalor})` } : undefined}
                  />
                ))}
              </div>
            ))}
            <div className="wc-calor-fila">
              <span className="wc-calor-label" />
              {Array.from({ length: 24 }, (_, h) => (
                <span key={h} className="wc-calor-hora">
                  {h % 6 === 0 ? h : ''}
                </span>
              ))}
            </div>
          </div>
        </div>
        {infoToque?.sec === 'calor' && <p className="wc-toque-info">{infoToque.txt}</p>}
      </section>

      <section className="wc-tarjeta">
        <h3>Días más intensos</h3>
        {st.topDias.map((d) => (
          <button key={d.ts} type="button" className="wc-barra-fila wc-salta" onClick={() => onIrA(d.id)}>
            <span className="wc-barra-nombre">{fechaCorta(d.ts)}</span>
            <div className="wc-barra">
              <div className="wc-barra-fill" style={{ width: `${(d.total / maxTopDia) * 100}%` }} />
            </div>
            <span className="wc-barra-valor wc-ancho">{d.total.toLocaleString('es')} mensajes</span>
          </button>
        ))}
        {st.topDiasVoz.length > 0 && (
          <>
            <h4>🎤 Días con más voces</h4>
            {st.topDiasVoz.map((d) => (
              <button key={d.ts} type="button" className="wc-barra-fila wc-salta" onClick={() => onIrA(d.id)}>
                <span className="wc-barra-nombre">{fechaCorta(d.ts)}</span>
                <div className="wc-barra">
                  <div
                    className="wc-barra-fill"
                    style={{ width: `${(d.total / Math.max(...st.topDiasVoz.map((x) => x.total), 1)) * 100}%` }}
                  />
                </div>
                <span className="wc-barra-valor wc-ancho">{d.total.toLocaleString('es')} voces</span>
              </button>
            ))}
          </>
        )}
        <p className="wc-suave">Toca un día para verlo en el chat.</p>
      </section>

      <section className="wc-tarjeta">
        <h3>Stickers, audios y más</h3>
        {autores.map(([autor]) => {
          const media = st.mediaPorAutor[autor]
          if (!media) return null
          const filas = MEDIA_ORDEN.filter((k) => media[k] > 0)
          if (filas.length === 0) return null
          return (
            <div key={autor} className="wc-media-autor">
              <h4>{etiquetaAutor(autor)}</h4>
              <div className="wc-media-chips">
                {filas.map((k) => (
                  <span key={k} className="wc-chip">
                    {MEDIA_INFO[k].icono} {MEDIA_INFO[k].label.split(' · ')[0]} · {media[k].toLocaleString('es')}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
        {(() => {
          const tipos = MEDIA_ORDEN.filter((k) => autores.some(([a]) => (st.mediaPorAutor[a]?.[k] ?? 0) > 0))
          if (!tipos.length) return null
          return (
            <div className="wc-media-autor">
              <h4>Comparativa</h4>
              {tipos.map((k) => {
                const filas = autores.map(([autor]) => ({ autor, n: st.mediaPorAutor[autor]?.[k] ?? 0 }))
                const max = Math.max(...filas.map((f) => f.n), 1)
                const w = [...filas].sort((a, b) => b.n - a.n)[0]
                const empate = filas.length === 2 && filas[0].n === filas[1].n
                return (
                  <div key={k} className="wc-medio-fila">
                    <h5>
                      {MEDIA_INFO[k].icono} {MEDIA_INFO[k].label.split(' · ')[0]} —{' '}
                      {empate ? 'empate' : `gana ${etiquetaAutor(w.autor)}`}
                    </h5>
                    {filas.map((f) => (
                      <div key={f.autor} className="wc-barra-fila">
                        <span className="wc-barra-nombre">{etiquetaAutor(f.autor)}</span>
                        <div className="wc-barra">
                          <div className="wc-barra-fill" style={{ width: `${(f.n / max) * 100}%` }} />
                        </div>
                        <span className="wc-barra-valor">{f.n.toLocaleString('es')}</span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )
        })()}
        {(() => {
          const totalElim = Object.values(st.eliminados).reduce((a, b) => a + b, 0)
          const totalPend = Object.values(st.pendientes).reduce((a, b) => a + b, 0)
          if (totalElim + totalPend === 0) return null
          return (
            <div className="wc-media-autor">
              <h4>Lo que ya no está aquí</h4>
              <div className="wc-media-chips">
                {totalElim > 0 && <span className="wc-chip">🚫 {totalElim.toLocaleString('es')} mensajes eliminados</span>}
                {totalPend > 0 && <span className="wc-chip">⏳ {totalPend.toLocaleString('es')} mensajes sin enviar</span>}
              </div>
            </div>
          )
        })()}
      </section>

      <section className="wc-tarjeta">
        <h3>😂 Emojis favoritos</h3>
        {autores.map(([autor]) => {
          const top = st.emojis[autor]
          if (!top?.length) return null
          return (
            <div key={autor} className="wc-media-autor">
              <h4>{etiquetaAutor(autor)}</h4>
              <div className="wc-media-chips">
                {top.slice(0, 8).map(([e, n]) => (
                  <span key={e} className="wc-chip">
                    {e} · {n.toLocaleString('es')}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </section>

      <section className="wc-tarjeta">
        <h3>📏 Tamaño de los mensajes</h3>
        {autores.map(([autor]) => {
          const avg = (st.charsTotal[autor] ?? 0) / Math.max(st.conTexto[autor] ?? 1, 1)
          return (
            <div key={autor} className="wc-barra-fila">
              <span className="wc-barra-nombre">{etiquetaAutor(autor)}</span>
              <div className="wc-barra">
                <div className="wc-barra-fill" style={{ width: `${(avg / maxAvg) * 100}%` }} />
              </div>
              <span className="wc-barra-valor wc-ancho">{Math.round(avg)} caracteres por mensaje</span>
            </div>
          )
        })}
        {autores.map(([autor]) => {
          const ml = st.masLargo[autor]
          if (!ml) return null
          return (
            <button key={autor + '-largo'} type="button" className="wc-ref-msg" onClick={() => onIrA(ml.id)}>
              <div className="wc-ref-meta">
                El más largo de {etiquetaAutor(autor)}: {ml.longitud.toLocaleString('es')} caracteres ·{' '}
                {fechaCorta(ml.ts + gMs)}
              </div>
              <div className="wc-ref-texto">
                {ml.texto.slice(0, 100)}
                {ml.texto.length > 100 ? '…' : ''}
              </div>
            </button>
          )
        })}
        <p className="wc-suave">El promedio cuenta solo mensajes con texto.</p>
      </section>

      <section className="wc-tarjeta">
        <h3>🤪 Curiosidades</h3>
        <p className="wc-suave">Toca cualquier chip para ver ejemplos y saltar a los mensajes.</p>
        {autores.map(([autor]) => {
          const r = st.risas[autor]
          const p = st.preguntas[autor]
          const total = st.porAutor[autor] ?? 1
          const fams = r ? Object.entries(r.familias).sort((a, b) => b[1] - a[1]) : []
          return (
            <div key={autor} className="wc-media-autor">
              <h4>{etiquetaAutor(autor)}</h4>
              <div className="wc-media-chips">
                {fams.map(([f, n]) => (
                  <button
                    key={f}
                    type="button"
                    className="wc-chip wc-chip-btn"
                    onClick={() =>
                      setMuestra(
                        muestra?.clave === `${autor}|${f}`
                          ? null
                          : { clave: `${autor}|${f}`, titulo: `Risas «${f}» de ${etiquetaAutor(autor)}` },
                      )
                    }
                  >
                    {FAM_EMOJI[f] ?? '💬'} {f} · {n.toLocaleString('es')}
                  </button>
                ))}
                {r && r.puras > 0 && (
                  <button
                    type="button"
                    className="wc-chip wc-chip-btn"
                    onClick={() =>
                      setMuestra(
                        muestra?.clave === `${autor}|pura`
                          ? null
                          : { clave: `${autor}|pura`, titulo: `Mensajes puros de risa de ${etiquetaAutor(autor)}` },
                      )
                    }
                  >
                    😆 puros · {r.puras.toLocaleString('es')}
                  </button>
                )}
                {r && r.cadenas > 0 && (
                  <button
                    type="button"
                    className="wc-chip wc-chip-btn"
                    onClick={() =>
                      setMuestra(
                        muestra?.clave === `${autor}|cadena`
                          ? null
                          : { clave: `${autor}|cadena`, titulo: `Cadenas largas de ${etiquetaAutor(autor)}` },
                      )
                    }
                  >
                    🔗 cadenas · {r.cadenas.toLocaleString('es')}
                  </button>
                )}
                {p && (
                  <button
                    type="button"
                    className="wc-chip wc-chip-btn"
                    onClick={() =>
                      setMuestra(
                        muestra?.clave === `${autor}|pregunta`
                          ? null
                          : { clave: `${autor}|pregunta`, titulo: `Preguntas de ${etiquetaAutor(autor)}` },
                      )
                    }
                  >
                    ❓ preguntas · {p.con.toLocaleString('es')}
                  </button>
                )}
              </div>
              {p && (
                <p className="wc-suave">
                  {Math.round((p.con / total) * 100)}% de sus mensajes tienen pregunta ({p.total.toLocaleString('es')}{' '}
                  signos ¿?)
                </p>
              )}
            </div>
          )
        })}
        {muestra && (
          <div className="wc-muestra">
            <div className="wc-muestra-cabecera">
              <b>{muestra.titulo}</b>
              <button type="button" className="wc-nav-btn" onClick={() => setMuestra(null)} aria-label="Cerrar">
                ✕
              </button>
            </div>
            {(st.ejemplosCurios[muestra.clave] ?? [])
              .slice()
              .reverse()
              .slice(0, 12)
              .map((id) => {
                const m = chat.mensajes[id]
                if (!m) return null
                return (
                  <button key={id} type="button" className="wc-ref-msg" onClick={() => onIrA(m.id)}>
                    <div className="wc-ref-meta">
                      {m.autor ? etiquetaAutor(m.autor) : '—'} · {fechaCorta(m.ts + gMs)}
                    </div>
                    <div className="wc-ref-texto">
                      {m.texto.slice(0, 110)}
                      {m.texto.length > 110 ? '…' : ''}
                    </div>
                  </button>
                )
              })}
          </div>
        )}
      </section>

      <section className="wc-tarjeta">
        <h3>Tiempo de respuesta</h3>
        <p className="wc-suave">Cuánto tarda cada uno en contestar cuando le escribe el otro (solo intercambios de menos de 24 h).</p>
        {Object.entries(st.respuestaMediana).map(([autor, ms]) => {
          const f = st.respuestaFranja[autor]
          const pc = st.respuestaPercentiles[autor]
          return (
            <div key={autor}>
              <div className="wc-barra-fila simple">
                <span className="wc-barra-nombre">{etiquetaAutor(autor)}</span>
                <span className="wc-barra-valor">{minutosATexto(ms)}</span>
              </div>
              {pc && (
                <p className="wc-suave wc-franja-linea">
                  ⚡ El 10% más rápido contesta en menos de {minutosATexto(pc.p10)} · 🦥 El 10% más lento tarda más de{' '}
                  {minutosATexto(pc.p90)}
                </p>
              )}
              {f && (
                <p className="wc-suave wc-franja-linea">
                  Mañanas {fmtFranja(f.manana)} · Tardes {fmtFranja(f.tarde)} · Noches {fmtFranja(f.noche)}
                </p>
              )}
            </div>
          )
        })}
        {Object.keys(st.respuestaMediana).length === 0 && <p className="wc-suave">No hay datos suficientes.</p>}
        {caraACara && <p className="wc-suave">{caraACara}</p>}
        {st.respuestaRecord.rapida && (
          <p className="wc-suave">
            ⚡ Récord de respuesta: {minutosATexto(st.respuestaRecord.rapida.gap)} — {etiquetaAutor(st.respuestaRecord.rapida.autor)}
          </p>
        )}
        {st.respuestaRecord.tardia && (
          <p className="wc-suave">
            🦥 La más tardía: {minutosATexto(st.respuestaRecord.tardia.gap)} — {etiquetaAutor(st.respuestaRecord.tardia.autor)},{' '}
            {fechaCorta(st.respuestaRecord.tardia.ts)}
          </p>
        )}
        {hayTramos && (
          <>
            <h4>¿Qué tan al instante? (toca una barra)</h4>
            {Object.entries(st.respuestaTramos).map(([autor, t]) => {
              const total = t.reduce((a, b) => a + b, 0) || 1
              return (
                <div key={autor} className="wc-hora-persona">
                  <div className="wc-hora-persona-top">
                    <b>{etiquetaAutor(autor)}</b>
                  </div>
                  <div className="wc-histograma wc-histograma-mini">
                    {t.map((n, i) => (
                      <div
                        key={i}
                        className="wc-col"
                        title={`${TRAMOS_RESP[i]} — ${Math.round((n / total) * 100)}%`}
                        onClick={() => {
                          const sec = `tramo-${autor}-${i}`
                          setInfoToque((p) =>
                            p?.sec === sec
                              ? null
                              : { sec, txt: `${etiquetaAutor(autor)} · ${TRAMOS_RESP[i]} — ${Math.round((n / total) * 100)}% de sus respuestas` },
                          )
                        }}
                      >
                        <div className="wc-col-fill" style={{ height: `${(n / total) * 100}%` }} />
                        <span>{TRAMOS_EMOJI[i]}</span>
                      </div>
                    ))}
                  </div>
                  {infoToque?.sec.startsWith(`tramo-${autor}-`) && <p className="wc-toque-info">{infoToque.txt}</p>}
                </div>
              )
            })}
          </>
        )}
        {st.respuestaTendencia &&
          (() => {
            const { inicio, fin } = st.respuestaTendencia
            const pct = Math.round((1 - fin / inicio) * 100)
            return (
              <p className="wc-suave">
                {pct > 5
                  ? `📈 Se aceleraron un ${pct}%`
                  : pct < -5
                    ? `📉 Ahora tardan un ${Math.abs(pct)}% más`
                    : '➡️ Mismo ritmo que al principio'}{' '}
                — de {minutosATexto(inicio)} a {minutosATexto(fin)} de mediana (más barra, más tardío).
              </p>
            )
          })()}
        {st.respuestaMeses.length >= 2 && (
          <>
            <div className="wc-semana">
              {st.respuestaMeses.map((m) => {
                const maxMed = Math.max(...st.respuestaMeses.map((x) => x.mediana), 1)
                const d = new Date(m.ts)
                const txt = `${MES_CORTOS[d.getMonth()]} — mediana ${minutosATexto(m.mediana)}`
                return (
                  <div
                    key={m.ts}
                    className="wc-semana-dia"
                    title={txt}
                    onClick={() => setInfoToque((p) => (p?.sec === `med-${m.ts}` ? null : { sec: `med-${m.ts}`, txt }))}
                  >
                    <span className="wc-semana-valor">{minutosATexto(m.mediana)}</span>
                    <div className="wc-semana-fill" style={{ height: `${(m.mediana / maxMed) * 100}%` }} />
                    <span>{MES_CORTOS[d.getMonth()]}</span>
                  </div>
                )
              })}
            </div>
            {infoToque?.sec.startsWith('med-') && <p className="wc-toque-info">{infoToque.txt}</p>}
          </>
        )}
      </section>
    </div>
  )
})

export default StatsTab

function Dato({ valor, label }: { valor: string; label: string }) {
  return (
    <div className="wc-dato">
      <div className="wc-dato-valor">{valor}</div>
      <div className="wc-dato-label">{label}</div>
    </div>
  )
}
