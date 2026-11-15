import { useState } from 'react'
import { bloquear, desbloqueado } from './lib/gate'
import { navegar, useRuta } from './lib/router'
import Gate from './components/Gate'
import Home from './components/Home'
import WaChat from './modules/wa-chat/WaChat'
import Arbol from './modules/arbol/Arbol'
import Deseos from './modules/deseos/Deseos'

export default function App() {
  const [abierto, setAbierto] = useState(desbloqueado())
  const ruta = useRuta()

  if (!abierto) {
    return (
      <Gate
        onEntrar={() => {
          setAbierto(true)
        }}
      />
    )
  }

  return (
    <div className={`app ${ruta === '/chat' ? '' : 'app-home'}`.trim()}>
      {ruta === '/chat' ? (
        <WaChat onVolver={() => navegar('/')} />
      ) : (
        <Home
          onBloquear={() => {
            bloquear()
            setAbierto(false)
          }}
        >
          {ruta === '/arbol' ? (
            <Arbol onVolver={() => navegar('/')} />
          ) : ruta === '/deseos' ? (
            <Deseos onVolver={() => navegar('/')} />
          ) : null}
        </Home>
      )}
    </div>
  )
}
