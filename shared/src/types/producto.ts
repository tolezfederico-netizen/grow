/** @see EstadoProducto */
export type EstadoProducto = 'disponible' | 'pausado' | 'sin_stock'

/** @see EstadoProductoVariante (mismos literales, aliado por claridad semántica) */
export type EstadoProductoVariante = 'disponible' | 'pausado'

export interface ProductoVariante {
  /** UUID generado por la base de datos */
  id: string
  /** FK → productos.id */
  producto_id: string
  /** Ej: "10L", "20L", "40L", "70L" */
  nombre_variante: string
  precio: number
  estado: EstadoProductoVariante
}

/**
 * Producto sin variantes.
 * `precio_base` es number y no existen filas en `producto_variantes` para este producto.
 */
export interface ProductoSimple {
  id: string
  nombre: string
  descripcion: string
  especificaciones: string
  /** URL de Supabase Storage, formato WebP */
  imagen_url: string
  /** Miniatura de 400 px para tarjetas y listas; si el producto no tiene, la misma imagen_url */
  imagen_miniatura_url: string
  tiene_variantes: false
  precio_base: number
  estado: EstadoProducto
  /** true si el admin lo eligió para el carrusel de destacados del Home (máx. 10 simultáneos, validado en DB) */
  destacado: boolean
  /** ISO 8601 — devuelto como string por Supabase JS */
  creado_en: string
}

/**
 * Producto con variantes.
 * `precio_base` es `null`; los precios se definen en cada variante (ProductoVariante).
 */
export interface ProductoConVariantes {
  id: string
  nombre: string
  descripcion: string
  especificaciones: string
  /** URL de Supabase Storage, formato WebP */
  imagen_url: string
  /** Miniatura de 400 px para tarjetas y listas; si el producto no tiene, la misma imagen_url */
  imagen_miniatura_url: string
  tiene_variantes: true
  precio_base: null
  estado: EstadoProducto
  /** true si el admin lo eligió para el carrusel de destacados del Home (máx. 10 simultáneos, validado en DB) */
  destacado: boolean
  /** ISO 8601 — devuelto como string por Supabase JS */
  creado_en: string
}

/**
 * Unión discriminada por `tiene_variantes`.
 * - Si `tiene_variantes === false` → `precio_base` es `number`.
 * - Si `tiene_variantes === true`  → `precio_base` es `null` y existen variantes.
 */
export type Producto = ProductoSimple | ProductoConVariantes

/** Para crear un producto desde la UI. Omite `id` y `creado_en` (autogenerados). */
export type ProductoInput = Omit<Producto, 'id' | 'creado_en'>

/** Para crear una variante desde la UI. Omite `id` (autogenerado). */
export type ProductoVarianteInput = Omit<ProductoVariante, 'id'>
