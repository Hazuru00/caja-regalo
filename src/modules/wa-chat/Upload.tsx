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
      // Defaults: quien exportó aparece como «Tú»; si el archivo trae los nombres
      // reales, se respetan (así un export hecho desde el celular de ella asigna bien).
      const emisores = c.emisores
      const conNombreDe = (n: string) => emisores.find((e) => e !== 'Tú' && e.toLowerCase().includes(n.toLowerCase()))
      const mioEnArchivo = conNombreDe(NOMBRE_MIO)
      const ellaEnArchivo = conNombreDe(NOMBRE_ELLA)
      const hayTu = emisores.includes('Tú')
      let defYo: string
      let defElla: string
      if (mioEnArchivo) {
        defYo = mioEnArchivo
        defElla = hayTu ? 'Tú' : (ellaEnArchivo ?? emisores.find((e) => e !== mioEnArchivo) ?? '')
      } else if (hayTu) {
        defYo = 'Tú'
        defElla = ellaEnArchivo ?? emisores.find((e) => e !== 'Tú') ?? ''
      } else {
        defYo = emisores[0] ?? ''
        defElla = emisores[1] ?? ''
      }
      if (emisores.length === 1) defYo = emisores[0]
      setYo(defYo)
      setElla(defElla)
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
          <p className="wc-suave">
            ¿Quién es quién? Así pintamos las burbujas bien: elige con qué nombre aparece cada persona en el archivo.
          </p>
          <label className="wc-mapeo">
            <span className="wc-mapeo-cab">
              <b>{NOMBRE_MIO}</b>
              <span className="wc-mapeo-burbuja verde">derecha, verde</span>
            </span>
            <span className="wc-mapeo-en">En el archivo aparece como:</span>
            <select value={yo} onChange={(e) => setYo(e.target.value)}>
              {chat.emisores.map((e) => (
                <option key={e} value={e}>
                  {e === 'Tú' ? 'Tú (quien exportó el archivo)' : e}
                </option>
              ))}
            </select>
          </label>
          <label className="wc-mapeo">
            <span className="wc-mapeo-cab">
              <b>{NOMBRE_ELLA}</b>
              <span className="wc-mapeo-burbuja blanca">izquierda, blanca</span>
            </span>
            <span className="wc-mapeo-en">En el archivo aparece como:</span>
            <select value={ella} onChange={(e) => setElla(e.target.value)}>
              {chat.emisores.map((e) => (
                <option key={e} value={e}>
                  {e === 'Tú' ? 'Tú (quien exportó el archivo)' : e}
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
