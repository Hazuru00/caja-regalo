import { useState } from 'react'
import { guardarPin, pinConfigurado, verificarPin, desbloquear } from '../lib/gate'

export default function Gate({ onEntrar }: { onEntrar: () => void }) {
  const creando = !pinConfigurado()
  const [pin, setPin] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (pin.length < 4) {
      setError('El PIN debe tener al menos 4 dígitos.')
      return
    }
    if (creando) {
      if (pin !== confirmacion) {
        setError('Los PIN no coinciden.')
        return
      }
      setCargando(true)
      await guardarPin(pin)
    } else {
      setCargando(true)
      if (!(await verificarPin(pin))) {
        setError('PIN incorrecto.')
        setCargando(false)
        return
      }
    }
    desbloquear()
    onEntrar()
  }

  return (
    <div className="gate">
      <form className="gate-caja" onSubmit={enviar}>
        <div className="gate-icono">🔒</div>
        <h1>Caja regalo</h1>
        <p>{creando ? 'Crea un PIN para proteger todo lo de aquí adentro.' : 'Introduce el PIN para entrar.'}</p>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          placeholder="PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          autoFocus
        />
        {creando && (
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Repite el PIN"
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
          />
        )}
        {error && <div className="gate-error">{error}</div>}
        <button type="submit" disabled={cargando}>
          {cargando ? 'Un momento…' : creando ? 'Crear PIN' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
