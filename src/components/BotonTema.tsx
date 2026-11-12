import { useState } from 'react'
import { alternarTema, cargarTema } from '../lib/tema'
import type { Tema } from '../lib/tema'

export default function BotonTema({ className, bloqueado }: { className?: string; bloqueado?: boolean }) {
  const [tema, setTema] = useState<Tema>(cargarTema)
  return (
    <button
      type="button"
      className={`boton-tema ${className ?? ''}${bloqueado ? ' bloqueado' : ''}`.trim()}
      aria-label={
        bloqueado
          ? 'Tema bloqueado mientras dura el eclipse'
          : tema === 'oscuro'
            ? 'Cambiar a modo claro'
            : 'Cambiar a modo oscuro'
      }
      aria-pressed={tema === 'oscuro'}
      disabled={bloqueado}
      onClick={() => setTema(alternarTema())}
    >
      <span className="orbita" aria-hidden="true">
        <span className="astro" />
        <span className="estrellitas">
          <i />
          <i />
          <i />
        </span>
      </span>
    </button>
  )
}
