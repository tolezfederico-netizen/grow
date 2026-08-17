import type { Database, Json } from './database.types'
import type {
  Producto,
  ProductoSimple,
  ProductoConVariantes,
  ProductoVariante,
  Categoria,
  Pedido,
  PedidoItem,
  Cliente,
  ConfiguracionTienda,
  Sucursal,
  EstadoProducto,
  EstadoProductoVariante,
  EstadoCategoria,
  EstadoPedido,
  EstadoPanel,
  PanelCategoria,
  PanelCategoriaItem,
  PanelCategoriaItemProducto,
} from '../types'

/** Arrays de literales válidos para validación en runtime. */
const ESTADOS_PRODUCTO_VALIDOS: readonly EstadoProducto[] = ['disponible', 'pausado', 'sin_stock']
const ESTADOS_PRODUCTO_VARIANTE_VALIDOS: readonly EstadoProductoVariante[] = ['disponible', 'pausado']
const ESTADOS_CATEGORIA_VALIDOS: readonly EstadoCategoria[] = ['activa', 'pausada']
const ESTADOS_PEDIDO_VALIDOS: readonly EstadoPedido[] = [
  'pendiente', 'confirmado', 'listo_para_retirar', 'completado', 'cancelado',
]
const ESTADOS_PANEL_VALIDOS: readonly EstadoPanel[] = ['activo', 'pausado']

/**
 * Valida que `valor` sea uno de los literales permitidos.
 * Falla rápido con error descriptivo si no coincide, en vez de hacer un cast ciego.
 */
function validarLiteral<T extends string>(
  valor: string,
  permitidos: readonly T[],
  nombreCampo: string,
): T {
  if ((permitidos as readonly string[]).includes(valor)) return valor as T
  throw new Error(
    `[Grow] Valor inválido para ${nombreCampo}: "${valor}". ` +
    `Esperado: ${permitidos.map(v => `"${v}"`).join(' | ')}`,
  )
}

// ── Mappers ──────────────────────────────────────────────────────────────────

/**
 * Convierte una fila cruda de `productos` (con `estado: string`) al discriminated
 * union de dominio (`ProductoSimple | ProductoConVariantes`).
 */
export function mapearProducto(
  row: Database['public']['Tables']['productos']['Row'],
): Producto {
  const estado = validarLiteral(row.estado, ESTADOS_PRODUCTO_VALIDOS, 'productos.estado')

  if (row.tiene_variantes) {
    const p: ProductoConVariantes = {
      id: row.id,
      nombre: row.nombre,
      descripcion: row.descripcion ?? '',
      especificaciones: row.especificaciones ?? '',
      imagen_url: row.imagen_url ?? '',
      tiene_variantes: true,
      precio_base: null,
      estado,
      destacado: row.destacado ?? false,
      creado_en: row.creado_en,
    }
    return p
  }

  const p: ProductoSimple = {
    id: row.id,
    nombre: row.nombre,
    descripcion: row.descripcion ?? '',
    especificaciones: row.especificaciones ?? '',
    imagen_url: row.imagen_url ?? '',
    tiene_variantes: false,
    precio_base: row.precio_base!, // DB CHECK garantiza NOT NULL cuando tiene_variantes = false
    estado,
    destacado: row.destacado ?? false,
    creado_en: row.creado_en,
  }
  return p
}

/**
 * Convierte una fila cruda de `producto_variantes` al tipo de dominio.
 */
export function mapearProductoVariante(
  row: Database['public']['Tables']['producto_variantes']['Row'],
): ProductoVariante {
  const estado = validarLiteral(row.estado, ESTADOS_PRODUCTO_VARIANTE_VALIDOS, 'producto_variantes.estado')

  return {
    id: row.id,
    producto_id: row.producto_id,
    nombre_variante: row.nombre_variante,
    precio: row.precio,
    estado,
  }
}

/**
 * Convierte una fila cruda de `categorias` al tipo de dominio.
 */
export function mapearCategoria(
  row: Database['public']['Tables']['categorias']['Row'],
): Categoria {
  const estado = validarLiteral(row.estado, ESTADOS_CATEGORIA_VALIDOS, 'categorias.estado')

  return {
    id: row.id,
    nombre: row.nombre,
    estado,
  }
}

/**
 * Convierte una fila cruda de `pedidos` al tipo de dominio.
 */
export function mapearPedido(
  row: Database['public']['Tables']['pedidos']['Row'],
): Pedido {
  const estado = validarLiteral(row.estado, ESTADOS_PEDIDO_VALIDOS, 'pedidos.estado')

  return {
    id: row.id,
    cliente_nombre: row.cliente_nombre,
    cliente_telefono: row.cliente_telefono,
    cliente_email: row.cliente_email,
    estado,
    total: row.total,
    creado_en: row.creado_en,
    actualizado_en: row.actualizado_en,
    eliminado: row.eliminado,
  }
}

/**
 * Convierte una fila cruda de `pedido_items` al tipo de dominio.
 */
export function mapearPedidoItem(
  row: Database['public']['Tables']['pedido_items']['Row'] & {
    producto_variantes?: { nombre_variante: string } | null
  },
): PedidoItem {
  return {
    ...row,
    nombre_variante: row.producto_variantes?.nombre_variante ?? null,
  }
}

/**
 * Convierte una fila cruda de `clientes` al tipo de dominio.
 */
export function mapearCliente(
  row: Database['public']['Tables']['clientes']['Row'],
): Cliente {
  return {
    id: row.id,
    nombre: row.nombre,
    apellido: row.apellido,
    email: row.email,
    telefono: row.telefono,
    creado_en: row.creado_en,
  }
}

/**
 * Convierte una fila cruda de `configuracion_tienda` al tipo de dominio,
 * normalizando `redes_sociales` de `Json` a `Record<string, string>`.
 *
 * Si `redes_sociales` no es un objeto plano string→string (ej: null, array),
 * degrada a `{}` en vez de lanzar error, para no bloquear la app por un campo
 * de configuración no crítico.
 */
export function mapearConfiguracionTienda(
  row: Database['public']['Tables']['configuracion_tienda']['Row'],
): ConfiguracionTienda {
  return {
    nombre_tienda: row.nombre_tienda,
    direccion: row.direccion,
    telefono: row.telefono,
    email_contacto: row.email_contacto,
    horario_apertura: row.horario_apertura,
    horario_cierre: row.horario_cierre,
    redes_sociales: normalizarRedesSociales(row.redes_sociales),
    red_social_destacada: row.red_social_destacada ?? null,
    mensaje_alerta: row.mensaje_alerta ?? null,
    mensaje_alerta_expira_en: row.mensaje_alerta_expira_en ?? null,
  }
}

function normalizarRedesSociales(valor: Json): Record<string, string> {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return {}

  const result: Record<string, string> = {}
  for (const [key, val] of Object.entries(valor)) {
    if (typeof val === 'string') result[key] = val
  }
  return result
}

/**
 * Convierte una fila cruda de `sucursales` al tipo de dominio.
 * No requiere validación de literales (solo texto y número).
 *
 * TODO: regenerar database.types.ts con supabase gen types.
 */
export function mapearSucursal(row: {
  id: string
  nombre: string
  direccion: string
  orden: number
}): Sucursal {
  return {
    id: row.id,
    nombre: row.nombre,
    direccion: row.direccion,
    orden: row.orden,
  }
}

// ── Mappers para Paneles de Categoría ──────────────────────────────────────

/**
 * Convierte una fila cruda de `paneles_categoria` al tipo de dominio.
 * THROW si `estado` no es un literal válido.
 *
 * TODO: regenerar database.types.ts con supabase gen types y reemplazar el
 * inline type row con Database['public']['Tables']['paneles_categoria']['Row'].
 */
export function mapearPanelCategoria(row: {
  id: string
  titulo: string
  descripcion: string | null
  orden: number | null
  estado: string
  creado_en: string
}): PanelCategoria {
  return {
    id: row.id,
    titulo: row.titulo,
    descripcion: row.descripcion,
    orden: row.orden,
    estado: validarLiteral(row.estado, ESTADOS_PANEL_VALIDOS, 'paneles_categoria.estado'),
    creado_en: row.creado_en,
  }
}

/**
 * Convierte una fila cruda de `paneles_categoria_items` al tipo de dominio.
 * No requiere validación de literales (no tiene columna estado).
 *
 * TODO: regenerar database.types.ts con supabase gen types.
 */
export function mapearPanelCategoriaItem(row: {
  id: string
  panel_id: string
  categoria_id: string
  nombre_visible: string | null
  orden: number
  es_card: boolean
}): PanelCategoriaItem {
  return { ...row }
}

/**
 * Convierte una fila cruda de `paneles_categoria_items_productos` al tipo de dominio.
 * No requiere validación de literales (no tiene columna estado).
 *
 * TODO: regenerar database.types.ts con supabase gen types.
 */
export function mapearPanelCategoriaItemProducto(row: {
  id: string
  item_id: string
  producto_id: string
  orden: number
}): PanelCategoriaItemProducto {
  return { ...row }
}
