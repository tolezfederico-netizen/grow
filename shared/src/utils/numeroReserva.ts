/**
 * Número corto de una reserva para mostrar y para que dueño y comprador se
 * refieran a la misma: los primeros 8 caracteres del id, en mayúsculas.
 * La Edge Function de emails arma el mismo número (no puede importar @shared).
 */
export function numeroReserva(id: string): string {
  return id.slice(0, 8).toUpperCase()
}
