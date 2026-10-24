import { formatPrecio } from '@shared'
import type { CartItem } from '../../context/CartContext'
import styles from './CartItemRow.module.css'

interface Props {
  item: CartItem
  onActualizarCantidad: (cartId: string, cantidad: number) => void
  onEliminar: (cartId: string) => void
}

export default function CartItemRow({ item, onActualizarCantidad, onEliminar }: Props) {
  const subtotal = item.cantidad * item.precioUnitario

  return (
    <div className={styles.row}>
      <div className={styles.thumb}>
        {item.imagenUrl ? (
          <img src={item.imagenUrl} alt={item.productoNombre} className={styles.img} width={400} height={400} loading="lazy" decoding="async" />
        ) : (
          <div className={styles.sinImg}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
        )}
      </div>
      <div className={styles.info}>
        <div className={styles.header}>
          <div className={styles.headerText}>
            <p className={styles.nombre}>{item.productoNombre}</p>
            {item.varianteNombre && <p className={styles.variante}>{item.varianteNombre}</p>}
          </div>
          <button className={styles.eliminar} onClick={() => onEliminar(item.cartId)} aria-label="Eliminar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
        <div className={styles.footer}>
          <div className={styles.footerRow}>
            <span className={styles.precio}>{formatPrecio(item.precioUnitario)}</span>
            <div className={styles.controles}>
              <button
                className={styles.btn}
                disabled={item.cantidad <= 1}
                onClick={() => onActualizarCantidad(item.cartId, item.cantidad - 1)}
              >
                −
              </button>
              <span className={styles.cantidad}>{item.cantidad}</span>
              <button
                className={styles.btn}
                onClick={() => onActualizarCantidad(item.cartId, item.cantidad + 1)}
              >
                +
              </button>
            </div>
          </div>
          <span className={styles.subtotal}>{formatPrecio(subtotal)}</span>
        </div>
      </div>
    </div>
  )
}
