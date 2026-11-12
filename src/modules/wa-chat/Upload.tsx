import { useRef, useState } from 'react'
import type { Chat, Mapeo } from './tipos'
import { parsearArchivo } from './parser'
import { NOMBRE_ELLA, NOMBRE_MIO } from './estadisticas'

export default function Upload({ onConfirmar }: { onConfirmar: (chat: Chat, mapeo: Mapeo) => void }) {
  const [chat, setChat] = useState<Chat | null>(null)
  const [error, setError] = useState('')
  const [arrastrando, setArrastrando] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [yo, setYo] = useState('')
  const [ella, setElla] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function procesar(file: File) {
    setError('')
    setProcesando(true)
    try {
      const c = await parsearArchivo(file)
      const otros = c.emisores.filter((e) => e !== 'Tú')
      setYo('Tú')
      setElla(otros[0] ?? c.emisores.find((e) => e !== 'Tú') ?? '')
      if (c.emisores.length === 1) setYo(c.emisores[0])
      setChat(c)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el archivo.')
    } finally {
      setProcesando(false)
    }
  }

  function confirmar() {
    if (!chat || !yo || !ella) return
    onConfirmar(chat, { yo, ella })
  }

  if (chat) {
    return (
      <div className="wc-centro">
        <div className="wc-subida-caja">
          <h2>Ya está el chat 🎉</h2>
          <p>
            {chat.mensajes.length.toLocaleString('es')} mensajes · {chat.emisores.length} personas
          </p>
          <p className="wc-suave">¿Quién es quién? Así pintamos las burbujas bien.</p>
          <label>
            {NOMBRE_MIO} (derecha, verde)
            <select value={yo} onChange={(e) => setYo(e.target.value)}>
              {chat.emisores.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </label>
          <label>
            {NOMBRE_ELLA} (izquierda, blanca)
            <select value={ella} onChange={(e) => setElla(e.target.value)}>
              {chat.emisores.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </label>
          {yo === ella && <div className="wc-error">Elige dos personas distintas.</div>}
          <button className="wc-boton" onClick={confirmar} disabled={yo === ella}>
            Ver el chat
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`wc-drop ${arrastrando ? 'activo' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setArrastrando(true)
      }}
      onDragLeave={() => setArrastrando(false)}
      onDrop={(e) => {
        e.preventDefault()
        setArrastrando(false)
        const file = e.dataTransfer.files[0]
        if (file) procesar(file)
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".zip,.txt,.md"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) procesar(file)
          e.target.value = ''
        }}
      />
      <div className="wc-drop-icono">📦</div>
      <h2>Sube la exportación del chat</h2>
      <p>
        En WhatsApp: <b>Ajustes → Chats → Exportar chat → Sin medios</b>. Te sale un .zip; arrástralo aquí.
      </p>
      <button className="wc-boton" onClick={() => inputRef.current?.click()} disabled={procesando}>
        {procesando ? 'Leyendo el chat…' : 'Elegir archivo'}
      </button>
      {procesando && <p className="wc-suave">Solo un momento, son muchos recuerdos…</p>}
      {error && <div className="wc-error">{error}</div>}
    </div>
  )
}
