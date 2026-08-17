// Barrel file — @grow/shared

export type * from './types'
export { ESTADOS_PEDIDO } from './types'

export { supabase } from './supabase/client'
export type { Database } from './supabase/database.types'
export {
  mapearProducto,
  mapearProductoVariante,
  mapearCategoria,
  mapearPedido,
  mapearPedidoItem,
  mapearCliente,
  mapearConfiguracionTienda,
  mapearSucursal,
  mapearPanelCategoria,
  mapearPanelCategoriaItem,
  mapearPanelCategoriaItemProducto,
} from './supabase/mappers'

export {
  ESTADOS_PRODUCTO,
  ESTADOS_CATEGORIA,
  ESTADOS_PANEL,
  REDES_SOCIALES_SUGERIDAS,
  BUCKET_PRODUCTOS,
  IMAGEN_PRODUCTO_PESO_OBJETIVO_KB,
} from './constants'

export { formatPrecio } from './utils/formatPrecio'
export { formatEstadoPedido } from './utils/formatEstadoPedido'
export { esEmailContactoValido, EMAIL_CONTACTO_REGEX } from './utils/validarEmail'
