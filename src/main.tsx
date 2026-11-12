import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { aplicarTema, cargarTema } from './lib/tema'
import './styles/index.css'

aplicarTema(cargarTema())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
