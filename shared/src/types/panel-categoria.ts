export type EstadoPanel = 'activo' | 'pausado'

export interface PanelCategoria {
  id: string
  titulo: string
  descripcion: string | null
  orden: number | null
  estado: EstadoPanel
  creado_en: string
}

export type PanelCategoriaInput = Omit<PanelCategoria, 'id' | 'creado_en'>

export interface PanelCategoriaItem {
  id: string
  panel_id: string
  categoria_id: string
  nombre_visible: string | null
  orden: number
  es_card: boolean
}

export type PanelCategoriaItemInput = Omit<PanelCategoriaItem, 'id'>

export interface PanelCategoriaItemProducto {
  id: string
  item_id: string
  producto_id: string
  orden: number
}

export type PanelCategoriaItemProductoInput = Omit<PanelCategoriaItemProducto, 'id'>

/** Panel completo con sus items resueltos. Pensado para el fetch único del client y admin. */
export interface PanelCategoriaCompleto extends PanelCategoria {
  items: Array<PanelCategoriaItem & {
    categoria_nombre: string
    productos: Array<{
      producto_id: string
      imagen_url: string | null
    }>
  }>
}
