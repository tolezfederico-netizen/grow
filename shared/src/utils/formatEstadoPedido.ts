/**
 * Etiqueta visible de cada estado de pedido, con el vocabulario de "reserva"
 * que comparten tienda, admin, WhatsApp y emails. Los valores en la base no
 * cambian (pendiente, confirmado, listo_para_retirar, completado, cancelado).
 */
const ETIQUETAS: Record<string, string> = {
  pendiente: 'Nueva',
  confirmado: 'Confirmada',
  listo_para_retirar: 'Lista para retirar',
  completado: 'Retirada',
  cancelado: 'Cancelada',
}

export function formatEstadoPedido(estado: string): string {
  if (estado in ETIQUETAS) return ETIQUETAS[estado]
  const conEspacios = estado.replace(/_/g, ' ')
  return conEspacios.charAt(0).toUpperCase() + conEspacios.slice(1)
}
