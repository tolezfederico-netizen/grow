import { useMemo } from 'react'
import type { ProductoCategoria } from '@shared'
import styles from './ProductoImagenSelector.module.css'

interface Props {
  productos: { id: string; nombre: string; imagen_url: string | null }[]
  relaciones: ProductoCategoria[]
  categoriaId?: string
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

export default function ProductoImagenSelector({ productos, relaciones, categoriaId, selectedIds, onChange }: Props) {
  const catProductoIds = useMemo(() => {
    if (!categoriaId) return null
    return new Set(relaciones.filter(r => r.categoria_id === categoriaId).map(r => r.producto_id))
  }, [relaciones, categoriaId])

  const productosFiltrados = useMemo(() => {
    if (!catProductoIds) return productos
    return productos.filter(p => catProductoIds.has(p.id))
  }, [productos, catProductoIds])

  const slotLleno = selectedIds.length >= 2

  function toggleProducto(pid: string) {
    if (selectedIds.includes(pid)) {
      onChange(selectedIds.filter(id => id !== pid))
    } else {
      if (selectedIds.length >= 2) return
      onChange([...selectedIds, pid])
    }
  }

  function slotLabel(pid: string): string | null {
    const idx = selectedIds.indexOf(pid)
    if (idx === 0) return '1ra imagen'
    if (idx === 1) return '2da imagen'
    return null
  }

  return (
    <div className={styles.wrapper}>
      <p className={styles.label}>Imágenes para la card (seleccioná hasta 2 productos de esta categoría):</p>
      <div className={styles.grilla}>
        {productosFiltrados.map(p => {
          const sel = selectedIds.includes(p.id)
          const disabled = !sel && slotLleno
          return (
            <label key={p.id} className={`${styles.item} ${sel ? styles.sel : ''} ${disabled ? styles.disabled : ''}`}>
              <input
                type="checkbox"
                checked={sel}
                disabled={disabled}
                onChange={() => toggleProducto(p.id)}
                className={styles.check}
              />
              <div className={styles.thumb}>
                {p.imagen_url ? (
                  <img src={p.imagen_url} alt={p.nombre} className={styles.img} />
                ) : (
                  <div className={styles.sinImg}>Sin imagen</div>
                )}
              </div>
              <span className={styles.nombre}>{p.nombre}</span>
              {sel && <span className={styles.slotBadge}>{slotLabel(p.id)}</span>}
            </label>
          )
        })}
      </div>
      {productosFiltrados.length === 0 && <p className={styles.vacio}>No hay productos para esta categoría.</p>}
    </div>
  )
}
