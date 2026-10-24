// Barrel file — @grow/shared

export type * from './types'
export { ESTADOS_PEDIDO } from './types'

export { supabase, SUPABASE_URL } from './supabase/client'
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
  IMAGEN_PRODUCTO,
  IMAGEN_PRODUCTO_CACHE_SEGUNDOS,
} from './constants'

export { formatPrecio } from './utils/formatPrecio'
export { formatEstadoPedido } from './utils/formatEstadoPedido'
export { esEmailContactoValido, EMAIL_CONTACTO_REGEX } from './utils/validarEmail'
export { rutaEnBucket } from './utils/rutaEnBucket'
export { numeroReserva } from './utils/numeroReserva'
export {
  TELEFONO_AR_REGEX,
  TELEFONO_AR_AYUDA,
  esTelefonoAR,
  armarTelefonoAR,
  separarTelefonoAR,
  formatTelefonoAR,
  linkWhatsapp,
} from './utils/telefono'
