import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import CartItemRow from "./CartItemRow";
import { formatPrecio } from "@shared";
import styles from "./CartDrawer.module.css";

export default function CartDrawer() {
  const navigate = useNavigate();
  const { isOpen, closeCart, items, total, updateCantidad, removeItem } =
    useCart();

  const carritoVacio = items.length === 0;

  useEffect(() => {
    if (!isOpen) return;

    const scrollY = window.scrollY;
    const bodyStyle = document.body.style;

    bodyStyle.position = "fixed";
    bodyStyle.top = `-${scrollY}px`;
    bodyStyle.left = "0";
    bodyStyle.right = "0";
    bodyStyle.overflow = "hidden";

    return () => {
      bodyStyle.position = "";
      bodyStyle.top = "";
      bodyStyle.left = "";
      bodyStyle.right = "";
      bodyStyle.overflow = "";
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  function handleProcederPago() {
    if (carritoVacio) return;
    closeCart();
    navigate("/resumen");
  }

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={closeCart}>
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.titulo}>
            <svg
              className={styles.tituloIcon}
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            Carrito de Compras
          </h2>
          <button
            className={styles.cerrar}
            onClick={closeCart}
            aria-label="Cerrar"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.cuerpo}>
          {items.length === 0 ? (
            <div className={styles.vacio}>
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              <p>El carrito de compras está vacío.</p>
            </div>
          ) : (
            items.map((item) => (
              <CartItemRow
                key={item.cartId}
                item={item}
                onActualizarCantidad={updateCantidad}
                onEliminar={removeItem}
              />
            ))
          )}
        </div>

        <div className={styles.footer}>
          <div className={styles.totalRow}>
            <span>Total</span>
            <span className={styles.totalValor}>{formatPrecio(total)}</span>
          </div>
          <p className={styles.avisoRetiro}>
            Solo retiro en nuestros locales — no realizamos envíos
          </p>
          <button
            className={styles.btnPago}
            onClick={handleProcederPago}
            disabled={carritoVacio}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            Proceder al pago
          </button>
        </div>
      </div>
    </div>
  );
}
