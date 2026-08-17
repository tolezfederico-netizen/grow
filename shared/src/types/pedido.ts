/**
 * Ciclo de vida del pedido:
 *   pendiente → confirmado → listo_para_retirar → completado
 *   cancelado   (puede ocurrir desde cualquier estado anterior a completado)
 */
export type EstadoPedido =
  | 'pendiente'
  | 'confirmado'
  | 'listo_para_retirar'
  | 'completado'
  | 'cancelado'

/** Array iterable de todos los estados, útil para poblar un `<select>` en el admin. */
export const ESTADOS_PEDIDO: readonly EstadoPedido[] = [
  'pendiente',
  'confirmado',
  'listo_para_retirar',
  'completado',
  'cancelado',
] as const

export interface Pedido {
  id: string
  cliente_nombre: string
  cliente_telefono: string
  cliente_email: string
  estado: EstadoPedido
  total: number
  creado_en: string
  actualizado_en: string
  eliminado: boolean
}

export interface PedidoItem {
  id: string
  pedido_id: string
  producto_id: string | null
  variante_id: string | null
  nombre_producto: string
  nombre_variante: string | null
  cantidad: number
  precio_unitario: number
}

/** Para crear un pedido desde la UI. Omite `id`, `creado_en` y `actualizado_en` (autogenerados). */
export type PedidoInput = Omit<Pedido, 'id' | 'creado_en' | 'actualizado_en'>

/** Para agregar un ítem a un pedido desde la UI. Omite `id` (autogenerado). */
export type PedidoItemInput = Omit<PedidoItem, 'id'>
