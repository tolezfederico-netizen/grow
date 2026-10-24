import { useEffect, useState, useCallback, useRef } from 'react'

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
  imagen_miniatura_url: string | null
  tiene_variantes: boolean
  precio_base: number | null
  estado: string
}

// Solo las columnas que usa la tarjeta (sin especificaciones, que es texto largo)
const COLUMNAS_TARJETA = 'id, nombre, descripcion, imagen_url, imagen_miniatura_url, tiene_variantes, precio_base, estado'
const COLUMNAS_VARIANTE = 'id, producto_id, nombre_variante, precio, estado'

/** Productos por página: con "Ver más" se agregan de a esta cantidad. */
const POR_PAGINA = 24

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
  const [total, setTotal] = useState(0)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [filtroIds, setFiltroIds] = useState<string[] | undefined>(undefined)
  // Cada carga del catálogo (cambio de filtro o búsqueda) incrementa este
  // número; una respuesta que llega con un número viejo se descarta, así una
  // página pedida con otro filtro no se mezcla con la lista nueva.
  const consultaActual = useRef(0)
  const [busqueda, setBusqueda] = useState(searchParams.get('buscar') ?? '')
  const { addItem } = useCart()

  useEffect(() => {
    setCategoriaActual(categoriaId)
  }, [categoriaId])

  const cargar = useCallback(async () => {
    const consulta = ++consultaActual.current
    const vigente = () => consulta === consultaActual.current
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
          if (!vigente()) return
          setProductos([])
          setLoading(false)
          return
        }
      } else {
        if (!vigente()) return
        setProductos([])
        setLoading(false)
        return
      }
    } else if (categoriaActual) {
      const { data: rels } = await supabase
        .from('producto_categorias')
        .select('producto_id')
        .eq('categoria_id', categoriaActual)
      idsFiltro = (rels ?? []).map(r => r.producto_id)
      if (!idsFiltro || idsFiltro.length === 0) {
        if (!vigente()) return
        setProductos([])
        setLoading(false)
        return
      }
    }

    if (!vigente()) return
    setFiltroIds(idsFiltro)
    const pagina = await cargarPagina(0, idsFiltro)
    if (!vigente()) return
    if ('error' in pagina) { setError(pagina.error); setLoading(false); return }

    setProductos(pagina.productos)
    setTotal(pagina.total)
    setLoading(false)
  }, [categoriaActual, panelId, busqueda])

  /**
   * Trae una página del catálogo (orden fijo: más nuevos primero, id para
   * desempatar) con sus variantes disponibles y el total de resultados.
   */
  async function cargarPagina(
    desde: number,
    idsFiltro: string[] | undefined,
  ): Promise<{ error: string } | { productos: ProductoConDatos[]; total: number }> {
    let query = supabase
      .from('productos')
      .select(COLUMNAS_TARJETA, { count: 'exact' })
      .in('estado', ['disponible', 'sin_stock'])
      .order('creado_en', { ascending: false })
      .order('id')
      .range(desde, desde + POR_PAGINA - 1)
    if (idsFiltro) query = query.in('id', idsFiltro)
    if (busqueda) query = query.ilike('nombre', `%${busqueda}%`)
    const { data: rows, count, error: errProds } = await query
    if (errProds) return { error: errProds.message }

    const raw = (rows ?? []) as ProductoRow[]

    const idsConVariantes = raw.filter(r => r.tiene_variantes).map(r => r.id)

    const variantesMap = new Map<string, ProductoVariante[]>()
    if (idsConVariantes.length > 0) {
      const { data: vars } = await supabase
        .from('producto_variantes')
        .select(COLUMNAS_VARIANTE)
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
        // Tarjeta chica: miniatura si existe, si no la grande
        imagenUrl: r.imagen_miniatura_url ?? r.imagen_url,
        tieneVariantes: r.tiene_variantes,
        precioBase: r.precio_base,
        variantes,
        precioMinimo,
        estado: r.estado,
      }
    })

    return { productos: completos, total: count ?? completos.length }
  }

  async function verMas() {
    const consulta = consultaActual.current
    setCargandoMas(true)
    const pagina = await cargarPagina(productos.length, filtroIds)
    setCargandoMas(false)
    // Si mientras tanto cambió el filtro, esta página ya no corresponde
    if (consulta !== consultaActual.current) return
    if ('error' in pagina) setError(pagina.error)
    else {
      // Sin duplicados por si el catálogo cambió entre una página y otra
      setProductos(prev => {
        const vistos = new Set(prev.map(p => p.id))
        return [...prev, ...pagina.productos.filter(p => !vistos.has(p.id))]
      })
      setTotal(pagina.total)
    }
  }

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
            {(categoriaActual || panelId) && (
              <div className={styles.barra}>
                <Link to="/productos" className={styles.verTodos}>← Ver todos los productos</Link>
              </div>
            )}

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

            {productos.length > 0 && productos.length < total && (
              <div className={styles.verMasWrap}>
                <button type="button" className={styles.verMas} onClick={verMas} disabled={cargandoMas}>
                  {cargandoMas ? 'Cargando…' : `Ver más (${total - productos.length})`}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </>
  )
}
