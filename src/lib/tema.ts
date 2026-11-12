export type Tema = 'claro' | 'oscuro'

const CLAVE = 'tema'

export function cargarTema(): Tema {
  return localStorage.getItem(CLAVE) === 'oscuro' ? 'oscuro' : 'claro'
}

export function aplicarTema(tema: Tema) {
  document.documentElement.dataset.tema = tema
}

export function guardarTema(tema: Tema) {
  localStorage.setItem(CLAVE, tema)
  aplicarTema(tema)
}

export function alternarTema(): Tema {
  const nuevo: Tema = cargarTema() === 'oscuro' ? 'claro' : 'oscuro'
  localStorage.setItem(CLAVE, nuevo)
  aplicarTema(nuevo)
  return nuevo
}
