import { mapearPedido, mapearPedidoItem } from '@shared'

export interface MiCuentaCacheEntry {
  perfil: { nombre: string; apellido: string; telefono: string; email: string }
  pedidos: Array<ReturnType<typeof mapearPedido>>
  itemsPorPedido: Record<string, Array<ReturnType<typeof mapearPedidoItem>>>
  imagenesPorProducto: Record<string, string | null>
}

const cache = new Map<string, MiCuentaCacheEntry>()

export function getMiCuentaCache(userId: string): MiCuentaCacheEntry | undefined {
  return cache.get(userId)
}

export function setMiCuentaCache(userId: string, entry: MiCuentaCacheEntry): void {
  cache.set(userId, entry)
}

export function updateMiCuentaCachePerfil(userId: string, perfil: MiCuentaCacheEntry['perfil']): void {
  const actual = cache.get(userId)
  if (actual) cache.set(userId, { ...actual, perfil })
}

export function updateMiCuentaCacheImagenes(
  userId: string,
  imagenesPorProducto: MiCuentaCacheEntry['imagenesPorProducto'],
): void {
  const actual = cache.get(userId)
  if (actual) cache.set(userId, { ...actual, imagenesPorProducto })
}

export function clearMiCuentaCache(): void {
  cache.clear()
}
