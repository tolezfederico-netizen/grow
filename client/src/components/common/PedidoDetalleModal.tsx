import { useEffect } from 'react'
import { formatEstadoPedido, formatPrecio, type Pedido, type PedidoItem } from '@shared'
import styles from './PedidoDetalleModal.module.css'

interface Props {
  abierto: boolean
  onCerrar: () => void
  pedido: Pick<Pedido, 'id' | 'creado_en' | 'estado'> | null
  items: PedidoItem[]
  imagenesPorProducto: Record<string, string | null>
  cargandoImagenes: boolean
}

function formatCurrency(valor: number): string {
  return formatPrecio(valor)
}

function PlaceholderImagen() {
  return (
    <div className={styles.placeholder} aria-hidden="true">
      <svg className={styles.placeholderIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 16l-5-5-4 4-2-2-5 5" />
      </svg>
    </div>
  )
}

export default function PedidoDetalleModal({
  abierto,
  onCerrar,
  pedido,
  items,
  imagenesPorProducto,
  cargandoImagenes,
}: Props) {
  useEffect(() => {
    if (!abierto) return

    const overflowOriginal = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCerrar()
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = overflowOriginal
    }
  }, [abierto, onCerrar])

  if (!abierto || !pedido) return null

  const total = items.reduce((acc, item) => acc + item.precio_unitario * item.cantidad, 0)

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={onCerrar}
    >
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pedido-detalle-titulo"
        onClick={e => e.stopPropagation()}
      >
        <header className={styles.header}>
          <div>
            <p className={styles.subtitulo}>Reserva</p>
            <h2 id="pedido-detalle-titulo" className={styles.titulo}>
              {new Date(pedido.creado_en).toLocaleDateString()}
            </h2>
          </div>

          <div className={styles.headerActions}>
            <span className={`${styles.estadoBadge} ${styles[`estado_${pedido.estado}`] ?? ''}`}>
              {formatEstadoPedido(pedido.estado)}
            </span>
            <button type="button" className={styles.cerrarBoton} onClick={onCerrar} aria-label="Cerrar modal">
              ×
            </button>
          </div>
        </header>

        <div className={styles.contenido}>
          {items.length === 0 ? (
            <p className={styles.vacio}>Esta reserva no tiene productos para mostrar.</p>
          ) : (
            <ul className={styles.lista}>
              {items.map(item => {
                const keyProducto = item.producto_id ?? ''
                const imagen = keyProducto ? imagenesPorProducto[keyProducto] : null
                const subtotal = item.precio_unitario * item.cantidad
                const tieneVariante = item.nombre_variante != null

                return (
                  <li key={item.id} className={styles.item}>
                    <div className={styles.imagenWrap}>
                      {cargandoImagenes ? (
                        <div className={styles.imagenCargando} aria-hidden="true" />
                      ) : imagen ? (
                        <img src={imagen} alt={item.nombre_producto} className={styles.imagen} width={400} height={400} loading="lazy" decoding="async" />
                      ) : (
                        <PlaceholderImagen />
                      )}
                    </div>

                    <div className={styles.info}>
                      <div className={styles.nombreLinea}>
                        <h3 className={styles.nombre}>{item.nombre_producto}</h3>
                        <span className={styles.cantidad}>x{item.cantidad}</span>
                      </div>
                      {tieneVariante && <p className={styles.variante}>{item.nombre_variante}</p>}
                      <p className={styles.detalle}>
                        {formatCurrency(item.precio_unitario)} c/u
                      </p>
                    </div>

                    <div className={styles.montos}>
                      <p className={styles.montoLabel}>Subtotal</p>
                      <p className={styles.monto}>{formatCurrency(subtotal)}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <footer className={styles.footer}>
          <span className={styles.totalLabel}>Total</span>
          <strong className={styles.totalValor}>{formatCurrency(total)}</strong>
        </footer>
      </section>
    </div>
  )
}
