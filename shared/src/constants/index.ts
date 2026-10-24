import type { EstadoProducto, EstadoCategoria, EstadoPanel } from '../types'

/** Estados runtime de producto/variante, para poblar un `<select>` en el admin. */
export const ESTADOS_PRODUCTO: readonly EstadoProducto[] = [
  'disponible',
  'pausado',
] as const

/** Estados runtime de categoría, para poblar un `<select>` en el admin. */
export const ESTADOS_CATEGORIA: readonly EstadoCategoria[] = [
  'activa',
  'pausada',
] as const

/** Estados runtime de panel de categoría, para poblar un `<select>` en el admin. */
export const ESTADOS_PANEL: readonly EstadoPanel[] = [
  'activo',
  'pausado',
] as const

/**
 * Claves de red social sugeridas para el formulario de configuración.
 * No es una restricción de base de datos — `configuracion_tienda.redes_sociales`
 * es jsonb flexible y acepta cualquier clave adicional.
 */
export const REDES_SOCIALES_SUGERIDAS = [
  'instagram',
  'tiktok',
  'facebook',
  'twitter',
] as const

/** Bucket de Supabase Storage para imágenes de producto. */
export const BUCKET_PRODUCTOS = 'imagenes-productos'

/**
 * Las dos versiones de cada imagen de producto que genera el admin antes de
 * subirla (WebP): lado mayor en px y peso máximo objetivo en KB. La grande va
 * a la ficha; la miniatura, a tarjetas, carruseles, búsqueda y menú.
 */
export const IMAGEN_PRODUCTO = {
  grande: { ladoMaxPx: 1000, pesoMaxKB: 60 },
  miniatura: { ladoMaxPx: 400, pesoMaxKB: 15 },
} as const

/** Caché de las imágenes en el navegador y la CDN: un año (cada archivo tiene nombre único). */
export const IMAGEN_PRODUCTO_CACHE_SEGUNDOS = 31536000
