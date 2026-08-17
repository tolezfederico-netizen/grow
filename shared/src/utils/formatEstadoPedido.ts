export function formatEstadoPedido(estado: string): string {
  const conEspacios = estado.replace(/_/g, ' ')
  return conEspacios.charAt(0).toUpperCase() + conEspacios.slice(1)
}
