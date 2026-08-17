/**
 * Fila única de configuración global de la tienda.
 * No tiene `id` ni timestamps — es una tabla de una sola fila.
 */
export interface ConfiguracionTienda {
  nombre_tienda: string
  direccion: string
  telefono: string
  email_contacto: string | null
  horario_apertura: string
  horario_cierre: string
  redes_sociales: Record<string, string>
  red_social_destacada: string | null
  mensaje_alerta: string | null
  mensaje_alerta_expira_en: string | null
}

/** Mismo tipo que `ConfiguracionTienda` (no hay campos autogenerados que omitir). */
export type ConfiguracionTiendaInput = ConfiguracionTienda

export interface Sucursal {
  id: string
  nombre: string
  direccion: string
  orden: number
}
