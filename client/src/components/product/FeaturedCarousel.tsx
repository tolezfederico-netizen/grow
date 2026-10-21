import { useEffect, useState, useRef, useMemo, useLayoutEffect } from 'react'
import { supabase, mapearProducto, mapearProductoVariante } from '@shared'
import type { ProductoVariante } from '@shared'
import { useCart } from '../../context/CartContext'
import ProductCard from './ProductCard'
import styles from './FeaturedCarousel.module.css'

interface ProductoData {
  id: string
  nombre: string
  descripcion: string | null
  imagenUrl: string | null
  tieneVariantes: boolean
  precioBase: number | null
  variantes: ProductoVariante[]
  precioMinimo: number | null
  estado: string
}

// Cuántas tarjetas entran apuntando a ~200px por tarjeta (descontando flechas y márgenes)
const ANCHO_TARJETA = 200
const ESPACIO_FLECHAS = 120

function calcularVisibles(ancho: number): number {
  const cantidad = Math.floor((ancho - ESPACIO_FLECHAS) / ANCHO_TARJETA)
  return Math.min(8, Math.max(1, cantidad))
}

export default function FeaturedCarousel() {
  const [productos, setProductos] = useState<ProductoData[]>([])
  const [indice, setIndice] = useState(0)
  const [visibles, setVisibles] = useState(() =>
    typeof window !== 'undefined' ? calcularVisibles(window.innerWidth) : 4,
  )
  const { addItem } = useCart()
  const trackRef = useRef<HTMLDivElement>(null)
  const [sinTransicion, setSinTransicion] = useState(false)

  useEffect(() => {
    function onResize() {
      setVisibles(calcularVisibles(window.innerWidth))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (productos.length > 0) {
      setIndice(visibles)
    } else {
      setIndice(0)
    }
  }, [productos.length, visibles])

  useEffect(() => {
    let cancel = false
    ;(async () => {
      const { data: rows, error } = await supabase
        .from('productos')
        .select('*')
        .eq('destacado', true)
        .in('estado', ['disponible', 'sin_stock'])
        .order('creado_en', { ascending: false })
      if (error) { console.error('[FeaturedCarousel]', error.message); return }
      if (!rows || rows.length === 0) return
      const raw = rows.map(mapearProducto)
      const idsConVariantes = raw.filter(r => r.tiene_variantes).map(r => r.id)
      const variantesMap = new Map<string, ProductoVariante[]>()
      if (idsConVariantes.length > 0) {
        const { data: vars } = await supabase
          .from('producto_variantes')
          .select('*')
          .in('producto_id', idsConVariantes)
          .eq('estado', 'disponible')
        for (const v of (vars ?? []).map(mapearProductoVariante)) {
          const arr = variantesMap.get(v.producto_id) ?? []
          arr.push(v)
          variantesMap.set(v.producto_id, arr)
        }
      }
      if (!cancel) {
        setProductos(
          raw.map(p => {
            const variantes = variantesMap.get(p.id) ?? []
            const precios = variantes.map(v => v.precio)
            const precioMinimo = precios.length > 0 ? Math.min(...precios) : null
            return {
              id: p.id,
              nombre: p.nombre,
              descripcion: p.descripcion || null,
              imagenUrl: p.imagen_url || null,
              tieneVariantes: p.tiene_variantes,
              precioBase: p.precio_base,
              variantes,
              precioMinimo,
              estado: p.estado,
            }
          }),
        )
      }
    })()
    return () => { cancel = true }
  }, [])

  const slides = useMemo(() => {
    if (productos.length === 0) return [] as ProductoData[]
    const inicio = productos.slice(-visibles)
    const fin = productos.slice(0, visibles)
    return [...inicio, ...productos, ...fin]
  }, [productos, visibles])

  useEffect(() => {
    if (slides.length === 0 || productos.length === 0) return
    if (indice >= productos.length + visibles) {
      const nuevo = visibles + (indice - (productos.length + visibles))
      const id = setTimeout(() => {
        setSinTransicion(true)
        setIndice(nuevo)
      }, 300)
      return () => clearTimeout(id)
    }
    if (indice < visibles) {
      const nuevo = productos.length + indice
      const id = setTimeout(() => {
        setSinTransicion(true)
        setIndice(nuevo)
      }, 300)
      return () => clearTimeout(id)
    }
  }, [indice, visibles, productos.length, slides.length])

  useLayoutEffect(() => {
    if (!sinTransicion || !trackRef.current) return
    trackRef.current.style.transition = 'none'
    void trackRef.current.offsetHeight
    trackRef.current.style.transition = ''
    setSinTransicion(false)
  }, [sinTransicion])

  if (productos.length === 0) return null

  const maxIndice = slides.length - visibles

  function anterior() {
    setIndice(prev => Math.max(prev - 1, 0))
  }

  function siguiente() {
    setIndice(prev => Math.min(prev + 1, maxIndice))
  }

  return (
    <section className={styles.seccion}>
      <h2 className={styles.titulo}>Destacados</h2>
      <div className={styles.carrusel}>
        {productos.length > visibles && (
          <button className={styles.flecha} onClick={anterior} aria-label="Anterior">←</button>
        )}
        <div className={styles.viewport}>
          <div
            ref={trackRef}
            className={styles.track}
            style={{ transform: `translateX(-${indice * (100 / visibles)}%)` }}
          >
            {slides.map((p, i) => (
              <div key={i} className={styles.slide} style={{ flexBasis: `${100 / visibles}%`, maxWidth: `${100 / visibles}%` }}>
                <ProductCard
                  id={p.id}
                  nombre={p.nombre}
                  descripcion={p.descripcion}
                  imagenUrl={p.imagenUrl}
                  tieneVariantes={p.tieneVariantes}
                  precioBase={p.precioBase}
                  variantes={p.variantes}
                  precioMinimo={p.precioMinimo}
                  estado={p.estado}
                  onAddToCart={addItem}
                />
              </div>
            ))}
          </div>
        </div>
        {productos.length > visibles && (
          <button className={styles.flecha} onClick={siguiente} aria-label="Siguiente">→</button>
        )}
      </div>
    </section>
  )
}
