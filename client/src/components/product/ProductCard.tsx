import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { formatPrecio, type ProductoVariante } from '@shared'
import type { CartItem } from '../../context/CartContext'
import { useCart } from '../../context/CartContext'
import styles from './ProductCard.module.css'

interface Props {
  id: string
  nombre: string
  descripcion: string | null
  imagenUrl: string | null
  tieneVariantes: boolean
  precioBase: number | null
  variantes: ProductoVariante[]
  precioMinimo: number | null
  estado?: string
  onAddToCart: (item: Omit<CartItem, 'cartId'>) => void
}

export default function ProductCard({
  id,
  nombre,
  descripcion,
  imagenUrl,
  tieneVariantes,
  precioBase,
  variantes,
  precioMinimo,
  estado,
  onAddToCart,
}: Props) {
  const sinStock = estado === 'sin_stock'
  const [varianteSeleccionada, setVarianteSeleccionada] = useState<string>(
    variantes.length > 0 ? variantes[0].id : '',
  )
  const botonRef = useRef<HTMLButtonElement>(null)
  const { flyToCart } = useCart()

  const variante = tieneVariantes
    ? variantes.find(v => v.id === varianteSeleccionada)
    : null

  const precioMostrado = tieneVariantes
    ? `${precioMinimo ? formatPrecio(precioMinimo) : '—'}`
    : `${precioBase ? formatPrecio(precioBase) : '—'}`

  function handleAgregar() {
    if (sinStock) return
    if (tieneVariantes && variante) {
      onAddToCart({
        productoId: id,
        productoNombre: nombre,
        imagenUrl,
        varianteId: variante.id,
        varianteNombre: variante.nombre_variante,
        cantidad: 1,
        precioUnitario: variante.precio,
      })
      const rect = botonRef.current?.getBoundingClientRect()
      if (rect) flyToCart(rect)
    } else if (!tieneVariantes && precioBase != null) {
      onAddToCart({
        productoId: id,
        productoNombre: nombre,
        imagenUrl,
        varianteId: null,
        varianteNombre: null,
        cantidad: 1,
        precioUnitario: precioBase,
      })
      const rect = botonRef.current?.getBoundingClientRect()
      if (rect) flyToCart(rect)
    }
  }

  return (
    <article className={styles.card}>
      <div className={styles.imgContainer}>
        {imagenUrl ? (
          <img src={imagenUrl} alt={nombre} className={styles.img} width={400} height={400} loading="lazy" decoding="async" />
        ) : (
          <div className={styles.placeholder}>
            <svg className={styles.placeholderIcon} width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
        )}
      </div>
      <div className={styles.body}>
        <h3 className={styles.nombre}>{nombre}</h3>
        {descripcion && <p className={styles.desc}>{descripcion}</p>}
        <p className={styles.precio}>{precioMostrado}</p>

        {tieneVariantes && variantes.length > 0 ? (
          <select
            className={styles.select}
            value={varianteSeleccionada}
            onChange={e => setVarianteSeleccionada(e.target.value)}
          >
            {variantes.map(v => (
              <option key={v.id} value={v.id}>
                {v.nombre_variante} — {formatPrecio(v.precio)}
              </option>
            ))}
          </select>
        ) : (
          <div className={styles.selectPlaceholder} />
        )}

        <div className={styles.acciones}>
          <Link to={`/producto/${id}`} target="_blank" rel="noopener noreferrer" className={styles.verProducto}>Ver Producto</Link>
          <button ref={botonRef} className={`${styles.boton} ${sinStock ? styles.botonSinStock : ''}`} onClick={handleAgregar} disabled={sinStock}>
          {sinStock ? (
            <>
              <svg className={styles.cartIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
              </svg>
              Sin Stock
            </>
          ) : (
            <>
              <svg className={styles.cartIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              Agregar al carrito
            </>
          )}
        </button>
        </div>
      </div>
    </article>
  )
}
