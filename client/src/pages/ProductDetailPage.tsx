import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { supabase, mapearProducto, mapearProductoVariante, formatPrecio } from '@shared'
import type { Producto, ProductoVariante } from '@shared'
import { useCart } from '../context/CartContext'
import ArticulosSidebar from '../components/product/ArticulosSidebar'
import LoadingState from '../components/common/LoadingState'
import ErrorState from '../components/common/ErrorState'
import Footer from '../components/layout/Footer'
import styles from './ProductDetailPage.module.css'

export default function ProductDetailPage() {
  const { productoId } = useParams<{ productoId: string }>()
  const [producto, setProducto] = useState<Producto | null>(null)
  const [variantes, setVariantes] = useState<ProductoVariante[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [varianteSeleccionada, setVarianteSeleccionada] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [copiado, setCopiado] = useState(false)
  const { addItem } = useCart()

  const cargar = useCallback(async () => {
    if (!productoId) return
    setLoading(true)
    setError(null)

    const { data: row, error: err } = await supabase
      .from('productos')
      .select('*')
      .eq('id', productoId)
      .single()

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    if (!row) {
      setError('Producto no encontrado.')
      setLoading(false)
      return
    }

    const mapeado = mapearProducto(row)
    setProducto(mapeado)

    if (mapeado.tiene_variantes) {
      const { data: vars } = await supabase
        .from('producto_variantes')
        .select('*')
        .eq('producto_id', productoId)
        .eq('estado', 'disponible')

      const mapeadas = (vars ?? []).map(mapearProductoVariante)
      setVariantes(mapeadas)
      if (mapeadas.length > 0) setVarianteSeleccionada(mapeadas[0].id)
    }

    setLoading(false)
  }, [productoId])

  useEffect(() => { cargar() }, [cargar])

  const sinStock = producto?.estado === 'sin_stock'

  const variante = producto?.tiene_variantes
    ? variantes.find(v => v.id === varianteSeleccionada)
    : null

  function restarCantidad() {
    setCantidad(c => Math.max(1, c - 1))
  }

  function sumarCantidad() {
    setCantidad(c => c + 1)
  }

  function handleAgregar() {
    if (!producto) return
    if (sinStock) return
    if (producto.tiene_variantes && variante) {
      addItem({
        productoId: producto.id,
        productoNombre: producto.nombre,
        imagenUrl: producto.imagen_url,
        varianteId: variante.id,
        varianteNombre: variante.nombre_variante,
        cantidad,
        precioUnitario: variante.precio,
      })
    } else if (!producto.tiene_variantes && producto.precio_base != null) {
      addItem({
        productoId: producto.id,
        productoNombre: producto.nombre,
        imagenUrl: producto.imagen_url,
        varianteId: null,
        varianteNombre: null,
        cantidad,
        precioUnitario: producto.precio_base,
      })
    }
    setCantidad(1)
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState mensaje={error} onReintentar={cargar} />
  if (!producto) return <ErrorState mensaje="Producto no encontrado." onReintentar={cargar} />

  const precioMostrado = producto.tiene_variantes
    ? variante
      ? formatPrecio(variante.precio)
      : '—'
    : producto.precio_base != null
      ? formatPrecio(producto.precio_base)
      : '—'

  const urlActual = typeof window !== 'undefined' ? window.location.href : ''
  const mensajeCompartir = `Mirá este producto: ${producto.nombre}`
  const linkWhatsapp = `https://wa.me/?text=${encodeURIComponent(`${mensajeCompartir} ${urlActual}`)}`
  const linkFacebook = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(urlActual)}`

  async function compartirInstagram() {
    try {
      await navigator.clipboard.writeText(urlActual)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.content}>
        <div className={styles.layout}>
          <ArticulosSidebar
            busqueda={busqueda}
            setBusqueda={setBusqueda}
          />
          <div className={styles.cardColumn}>
            <div className={styles.imgContainer}>
              {producto.imagen_url ? (
                <img src={producto.imagen_url} alt={producto.nombre} className={styles.img} />
              ) : (
                <div className={styles.placeholder}>
                  <svg className={styles.placeholderIcon} width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </div>
              )}
            </div>
            <div className={styles.infoCard}>
              <h1 className={styles.nombre}>{producto.nombre}</h1>
              <p className={styles.precio}>{precioMostrado}</p>

              {producto.tiene_variantes && variantes.length > 0 && (
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
              )}

              {producto.descripcion && (
                <p className={styles.descripcion}>{producto.descripcion}</p>
              )}

              <div className={styles.filaCompra}>
                {!sinStock && (
                  <div className={styles.selectorCantidad}>
                    <button type="button" className={styles.btnCantidad} onClick={restarCantidad} aria-label="Restar cantidad">−</button>
                    <span className={styles.cantidadValor}>{cantidad}</span>
                    <button type="button" className={styles.btnCantidad} onClick={sumarCantidad} aria-label="Sumar cantidad">+</button>
                  </div>
                )}

                <button className={`${styles.boton} ${sinStock ? styles.botonSinStock : ''}`} onClick={handleAgregar} disabled={sinStock}>
                  {sinStock ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                      </svg>
                      Sin Stock
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="9" cy="21" r="1" />
                        <circle cx="20" cy="21" r="1" />
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                      </svg>
                      Agregar al carrito
                    </>
                  )}
                </button>
              </div>

              <div className={styles.badgeConfianza}>
                <span className={styles.badgeIcono}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <span className={styles.badgeTexto}>Compra Protegida</span>
                </span>
                <p className={styles.badgeSubtexto}>Tus datos cuidados durante toda la compra</p>
              </div>

              <div className={styles.compartir}>
                <p className={styles.compartirTitulo}>Compartir este producto</p>
                <div className={styles.compartirBotones}>
                  <a
                    href={linkWhatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.compartirBtn}
                    aria-label="Compartir por WhatsApp"
                  >
                    <svg width="1.1em" height="1.1em" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    WhatsApp
                  </a>

                  <a
                    href={linkFacebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.compartirBtn}
                    aria-label="Compartir por Facebook"
                  >
                    <svg width="1.1em" height="1.1em" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    Facebook
                  </a>

                  <button
                    type="button"
                    onClick={compartirInstagram}
                    className={styles.compartirBtn}
                    aria-label="Copiar link para Instagram"
                  >
                    <svg width="1.1em" height="1.1em" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                    </svg>
                    {copiado ? 'Link copiado' : 'Instagram'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {producto.especificaciones && (
            <div className={styles.specsColumn}>
              <h2 className={styles.specsTitle}>Especificaciones</h2>
              <p className={styles.specsText}>{producto.especificaciones}</p>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  )
}
