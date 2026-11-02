import { supabase, mapearProductoVariante } from '@shared'
import type { ProductoVariante } from '@shared'

/** Trae las variantes disponibles de los productos indicados, agrupadas por producto. */
export async function cargarVariantesDisponibles(
  productoIds: string[],
): Promise<Map<string, ProductoVariante[]>> {
  const porProducto = new Map<string, ProductoVariante[]>()
  if (productoIds.length === 0) return porProducto

  const { data } = await supabase
    .from('producto_variantes')
    .select('id, producto_id, nombre_variante, precio, estado')
    .in('producto_id', productoIds)
    .eq('estado', 'disponible')

  for (const v of (data ?? []).map(mapearProductoVariante)) {
    const variantes = porProducto.get(v.producto_id) ?? []
    variantes.push(v)
    porProducto.set(v.producto_id, variantes)
  }
  return porProducto
}

/** Precio más bajo entre las variantes, o null si no hay ninguna. */
export function precioMinimo(variantes: ProductoVariante[]): number | null {
  return variantes.length > 0 ? Math.min(...variantes.map(v => v.precio)) : null
}
