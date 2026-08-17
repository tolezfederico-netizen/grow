import { useEffect } from 'react'
import { formatPrecio } from '@shared'
import type { CartItem } from '../../context/CartContext'
import styles from './ConfirmarPedidoModal.module.css'

interface Props {
  abierto: boolean
  onConfirmar: () => void
  onCancelar: () => void
  items: CartItem[]
  total: number
  enviando: boolean
  error: string | null
}

export default function ConfirmarPedidoModal({
  abierto,
  onConfirmar,
  onCancelar,
  items,
  total,
  enviando,
  error,
}: Props) {
  useEffect(() => {
    if (!abierto) return

    const overflowOriginal = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !enviando) onCancelar()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = overflowOriginal
    }
  }, [abierto, enviando, onCancelar])

  if (!abierto) return null

  function handleOverlayClick() {
    if (!enviando) onCancelar()
  }

  return (
    <div className={styles.overlay} role="presentation" onClick={handleOverlayClick}>
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmar-pedido-titulo"
        onClick={e => e.stopPropagation()}
      >
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>Antes de continuar</p>
            <h2 id="confirmar-pedido-titulo" className={styles.titulo}>Confirmá tu pedido</h2>
          </div>
          {!enviando && (
            <button type="button" className={styles.cerrar} onClick={onCancelar} aria-label="Cerrar modal">
              ×
            </button>
          )}
        </header>

        <div className={styles.contenido}>
          <ul className={styles.lista}>
            {items.map(item => {
              const subtotal = item.cantidad * item.precioUnitario
              return (
                <li key={item.cartId} className={styles.item}>
                  <div className={styles.itemTexto}>
                    <p className={styles.nombre}>{item.productoNombre}</p>
                    {item.varianteNombre && <p className={styles.variante}>{item.varianteNombre}</p>}
                  </div>
                  <div className={styles.itemResumen}>
                    <span className={styles.cantidad}>x{item.cantidad}</span>
                    <span className={styles.precio}>{formatPrecio(item.precioUnitario)}</span>
                    <span className={styles.subtotal}>{formatPrecio(subtotal)}</span>
                  </div>
                </li>
              )
            })}
          </ul>

          <div className={styles.total}>
            <span>Total</span>
            <strong>{formatPrecio(total)}</strong>
          </div>

          {error && <p className={styles.error}>{error}</p>}
        </div>

        <footer className={styles.footer}>
          <button type="button" className={styles.botonSecundario} onClick={onCancelar} disabled={enviando}>
            Cancelar
          </button>
          <button type="button" className={styles.botonPrimario} onClick={onConfirmar} disabled={enviando}>
            {enviando ? 'Enviando…' : 'Confirmar pedido'}
          </button>
        </footer>
      </section>
    </div>
  )
}
