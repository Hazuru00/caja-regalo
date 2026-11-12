const CLAVE_HASH = 'cr-pin'
const CLAVE_SESION = 'cr-sesion'

export function pinConfigurado() {
  return localStorage.getItem(CLAVE_HASH) !== null
}

export function desbloqueado() {
  return sessionStorage.getItem(CLAVE_SESION) === '1'
}

export function desbloquear() {
  sessionStorage.setItem(CLAVE_SESION, '1')
}

export function bloquear() {
  sessionStorage.removeItem(CLAVE_SESION)
}

async function sha256(texto: string) {
  const datos = new TextEncoder().encode(texto)
  const hash = await crypto.subtle.digest('SHA-256', datos)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function guardarPin(pin: string) {
  localStorage.setItem(CLAVE_HASH, await sha256(pin))
}

export async function verificarPin(pin: string) {
  return (await sha256(pin)) === localStorage.getItem(CLAVE_HASH)
}
