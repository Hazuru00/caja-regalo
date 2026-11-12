import { useSyncExternalStore } from 'react'

function suscribir(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

function obtener() {
  return window.location.hash.slice(1) || '/'
}

export function useRuta() {
  return useSyncExternalStore(suscribir, obtener)
}

export function navegar(ruta: string) {
  window.location.hash = ruta
}
