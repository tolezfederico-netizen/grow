import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePaneles } from '../../hooks/usePaneles'
import { useCart } from '../../context/CartContext'
import LoadingState from '../common/LoadingState'
import ErrorState from '../common/ErrorState'
import styles from './ArticulosSidebar.module.css'

interface Props {
  busqueda: string
  setBusqueda: (v: string) => void
  categoriaActiva?: string
  panelActivo?: string
}

export default function ArticulosSidebar({ busqueda, setBusqueda, categoriaActiva, panelActivo }: Props) {
  const { paneles, loading, error } = usePaneles()
  const { openCart, items } = useCart()
  const navigate = useNavigate()
  const [panelExpandido, setPanelExpandido] = useState<string | null>(null)

  useEffect(() => {
    if (panelActivo) setPanelExpandido(panelActivo)
  }, [panelActivo])

  if (loading) return <div className={styles.sidebar}><LoadingState mensaje="Cargando paneles…" /></div>
  if (error) return <div className={styles.sidebar}><ErrorState mensaje={error} /></div>

  const itemsCount = items.reduce((s, i) => s + i.cantidad, 0)

  return (
    <div className={styles.sidebar}>
      <div className={styles.searchRow}>
        <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          className={styles.searchInput}
          placeholder="Buscar articulo..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
      </div>

      <button className={styles.verPedido} onClick={openCart}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
        Ver reserva {itemsCount > 0 && <span className={styles.badge}>{itemsCount}</span>}
      </button>

      <div className={styles.paneles}>
        {paneles.map(p => {
          const expandido = panelExpandido === p.id
          return (
            <div key={p.id} className={styles.panel}>
              <button
                className={`${styles.panelHeader} ${expandido ? styles.expandido : ''} ${(panelActivo === p.id || (categoriaActiva && p.items.some(item => item.categoria_id === categoriaActiva))) ? styles.activo : ''}`}
                onClick={() => {
                  const abriendo = panelExpandido !== p.id
                  setPanelExpandido(abriendo ? p.id : null)
                  if (abriendo) navigate(`/productos/panel/${p.id}`)
                }}
              >
                <span>{p.titulo}</span>
                <span className={`${styles.flecha} ${expandido ? styles.flechaAbierta : ''}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </button>
              {expandido && (
                <div className={styles.panelBody}>
                  {p.items.length === 0 ? (
                    <p className={styles.sinCats}>Sin categorías</p>
                  ) : (
                    p.items.map(item => (
                      <button
                        key={item.id}
                        className={`${styles.catItem} ${categoriaActiva === item.categoria_id ? styles.activo : ''}`}
                        onClick={() => navigate(`/productos/${item.categoria_id}`)}
                      >
                        {item.nombre_visible ?? item.categoria_nombre}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
