import { useEffect, useState, useCallback } from 'react'

import { supabase, mapearProductoVariante } from '@shared'
import type { ProductoVariante } from '@shared'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import ProductCard from '../components/product/ProductCard'
import ArticulosSidebar from '../components/product/ArticulosSidebar'
import LoadingState from '../components/common/LoadingState'
import ErrorState from '../components/common/ErrorState'
import Footer from '../components/layout/Footer'
import styles from './ProductsPage.module.css'

interface ProductoRow {
  id: string
  nombre: string
  descripcion: string | null
  imagen_url: string | null
  tiene_variantes: boolean
  precio_base: number | null
  creado_en: string
  estado: string
}

interface ProductoConDatos {
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

export default function ProductsPage() {
  const { categoriaId, panelId } = useParams<{ categoriaId?: string; panelId?: string }>()
  const [searchParams] = useSearchParams()
  const [categoriaActual, setCategoriaActual] = useState<string | undefined>(categoriaId)
  const [productos, setProductos] = useState<ProductoConDatos[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState(searchParams.get('buscar') ?? '')
  const { addItem } = useCart()

  useEffect(() => {
    setCategoriaActual(categoriaId)
  }, [categoriaId])

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)

    let idsFiltro: string[] | undefined

    if (panelId) {
      const { data: itemsPanel } = await supabase
        .from('paneles_categoria_items')
        .select('categoria_id')
        .eq('panel_id', panelId)
      const catIds = (itemsPanel ?? []).map(r => r.categoria_id)
      if (catIds.length > 0) {
        const { data: rels } = await supabase
          .from('producto_categorias')
          .select('producto_id')
          .in('categoria_id', catIds)
        idsFiltro = [...new Set((rels ?? []).map(r => r.producto_id))]
        if (idsFiltro.length === 0) {
          setProductos([])
          setLoading(false)
          return
        }
      } else {
        setProductos([])
        setLoading(false)
        return
      }
    } else if (categoriaActual) {
      const { data: rels } = await supabase
        .from('producto_categorias')
        .select('*')
        .eq('categoria_id', categoriaActual)
      idsFiltro = (rels ?? []).map(r => r.producto_id)
      if (!idsFiltro || idsFiltro.length === 0) {
        setProductos([])
        setLoading(false)
        return
      }
    }

    let query = supabase.from('productos').select('*').in('estado', ['disponible', 'sin_stock'])
    if (idsFiltro) query = query.in('id', idsFiltro)
    if (busqueda) query = query.ilike('nombre', `%${busqueda}%`)
    const { data: rows, error: errProds } = await query
    if (errProds) { setError(errProds.message); setLoading(false); return }

    const raw = (rows ?? []) as ProductoRow[]

    const idsConVariantes = raw.filter(r => r.tiene_variantes).map(r => r.id)

    let variantesMap = new Map<string, ProductoVariante[]>()
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

    const completos: ProductoConDatos[] = raw.map(r => {
      const variantes = variantesMap.get(r.id) ?? []
      const precios = variantes.map(v => v.precio)
      const precioMinimo = precios.length > 0 ? Math.min(...precios) : null
      return {
        id: r.id,
        nombre: r.nombre,
        descripcion: r.descripcion,
        imagenUrl: r.imagen_url,
        tieneVariantes: r.tiene_variantes,
        precioBase: r.precio_base,
        variantes,
        precioMinimo,
        estado: r.estado,
      }
    })

    setProductos(completos)
    setLoading(false)
  }, [categoriaActual, panelId, busqueda])

  useEffect(() => { cargar() }, [cargar])

  if (loading && productos.length === 0) return <LoadingState />
  if (error) return <ErrorState mensaje={error} onReintentar={cargar} />

  return (
    <>
      <div className={styles.franja}>
        <div className={styles.layout}>
          <ArticulosSidebar
            busqueda={busqueda}
            setBusqueda={setBusqueda}
            categoriaActiva={categoriaActual}
            panelActivo={panelId}
          />
          <div className={styles.page}>
            <div className={styles.barra}>
              {(categoriaActual || panelId) && (
                <Link to="/productos" className={styles.verTodos}>← Ver todos los productos</Link>
              )}

              <div className={styles.badgeConfianza}>
                <span className={styles.badgeIcono}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <span className={styles.badgeTexto}>Compra Protegida</span>
                </span>
                <p className={styles.badgeSubtexto}>Tus datos cuidados durante toda la compra</p>
              </div>
            </div>

            {productos.length === 0 ? (
              <p className={styles.vacio}>No hay productos disponibles.</p>
            ) : (
              <div className={styles.grid}>
                {productos.map(p => (
                  <ProductCard
                    key={p.id}
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
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </>
  )
}
