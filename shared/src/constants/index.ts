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
 * Peso objetivo (KB) al que la Edge Function de resize debe comprimir
 * las imágenes de producto antes de subirlas al bucket.
 */
export const IMAGEN_PRODUCTO_PESO_OBJETIVO_KB = {
  min: 30,
  max: 50,
} as const
