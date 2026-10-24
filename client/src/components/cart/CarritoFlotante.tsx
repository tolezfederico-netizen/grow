import { formatPrecio } from '@shared'
import { useCart } from '../../context/CartContext'
import styles from './CarritoFlotante.module.css'

// Barra fija abajo (solo mobile, por CSS) que aparece cuando hay productos en el carrito
export default function CarritoFlotante() {
  const { items, total, isOpen, openCart } = useCart()

  const cantidad = items.reduce((s, i) => s + i.cantidad, 0)
  if (cantidad === 0) return null

  return (
    <>
      {/* Espacio al final de la página para que la barra no tape el footer */}
      <div className={styles.espaciador} aria-hidden="true" />

      {!isOpen && (
        <button type="button" className={styles.barra} onClick={openCart}>
          <span className={styles.izquierda}>
            <svg className={styles.icono} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            Ver reserva
            <span className={styles.contador}>{cantidad}</span>
          </span>
          <span className={styles.total}>{formatPrecio(total)}</span>
        </button>
      )}
    </>
  )
}
