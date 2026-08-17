/** 'activa' | 'pausada' (nomenclatura distinta a EstadoProducto) */
export type EstadoCategoria = 'activa' | 'pausada'

export interface Categoria {
  /** UUID generado por la base de datos */
  id: string
  nombre: string
  estado: EstadoCategoria
}

/** Fila de la tabla intermedia `producto_categorias` (relación muchos-a-muchos). */
export interface ProductoCategoria {
  /** FK → productos.id */
  producto_id: string
  /** FK → categorias.id */
  categoria_id: string
}

/** Para crear una categoría desde la UI. Omite `id` (autogenerado). */
export type CategoriaInput = Omit<Categoria, 'id'>
