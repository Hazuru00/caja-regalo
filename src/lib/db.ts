import { get, set, del } from 'idb-keyval'
import type { Chat, Mapeo } from '../modules/wa-chat/tipos'
import type { Deseo } from '../modules/deseos/tipos'

export function obtenerChat() {
  return get<Chat>('chat')
}

export async function guardarChat(chat: Chat) {
  await set('chat', chat)
}

export function obtenerDeseos() {
  return get<Deseo[]>('deseos')
}

export async function guardarDeseos(deseos: Deseo[]) {
  await set('deseos', deseos)
}

export function obtenerMapeo() {
  return get<Mapeo>('mapeo')
}

export async function guardarMapeo(mapeo: Mapeo) {
  await set('mapeo', mapeo)
}

export async function borrarChat() {
  await del('chat')
  await del('mapeo')
}
