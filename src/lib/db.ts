import { get, set, del } from 'idb-keyval'
import type { Chat, Mapeo } from '../modules/wa-chat/tipos'

export function obtenerChat() {
  return get<Chat>('chat')
}

export async function guardarChat(chat: Chat) {
  await set('chat', chat)
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
