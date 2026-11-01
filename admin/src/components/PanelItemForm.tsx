import { useState, useEffect, type FormEvent } from 'react'
import { supabase } from '@shared'
import type { Categoria, ProductoCategoria } from '@shared'
import ProductoImagenSelector from './ProductoImagenSelector'
import styles from './PanelItemForm.module.css'

interface ProductoElegible {
  id: string
  nombre: string
  imagen_url: string | null
}

interface AgregarProps {
  panelId: string
  panelTitulo: string
  categorias: Categoria[]
  /** Dónde está cada categoría ya usada: una categoría va en una sola sección */
  seccionDeCategoria: Record<string, string>
  siguienteOrden: number
  onClose: () => void
  onSave: () => void
}

export function AgregarCategoriaForm({ panelId, panelTitulo, categorias, seccionDeCategoria, siguienteOrden, onClose, onSave }: AgregarProps) {
  const [catId, setCatId] = useState('')
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubiendo(true)
    setError(null)
    const { error: err } = await supabase.from('paneles_categoria_items').insert({
      panel_id: panelId,
      categoria_id: catId,
      orden: siguienteOrden,
    })
    if (err) { setError(err.message); setSubiendo(false); return }
    onSave()
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Agregar categoría a «{panelTitulo}»</h2>
          <button type="button" className={styles.btnCerrar} onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.campo}>
            <span className={styles.campoLabel}>Categoría</span>
            <select className={styles.input} value={catId} onChange={e => setCatId(e.target.value)} required>
              <option value="">Seleccionar categoría…</option>
              {categorias.map(c => {
                const seccion = seccionDeCategoria[c.id]
                return (
                  <option key={c.id} value={c.id} disabled={!!seccion}>
                    {c.nombre}{seccion ? ` (ya está en ${seccion})` : ''}
                  </option>
                )
              })}
            </select>
            <span className={styles.ayuda}>Se agrega al final de la lista. Después podés arrastrarla para cambiar su lugar.</span>
          </label>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.acciones}>
            <button type="button" className={styles.btnCancelar} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnGuardar} disabled={subiendo}>
              {subiendo ? 'Guardando…' : 'Agregar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface ImagenProps {
  itemId: string
  categoriaId: string
  categoriaNombre: string
  relaciones: ProductoCategoria[]
  /** Solo los productos que la tienda puede mostrar */
  productos: ProductoElegible[]
  onClose: () => void
  onSave: () => void
}

export function ImagenCategoriaForm({ itemId, categoriaId, categoriaNombre, relaciones, productos, onClose, onSave }: ImagenProps) {
  const [selectedProductoIds, setSelectedProductoIds] = useState<string[]>([])
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      const { data, error: err } = await supabase
        .from('paneles_categoria_items_productos')
        .select('producto_id')
        .eq('item_id', itemId)
        .order('orden', { ascending: true })
      if (cancel) return
      if (err) { setError(err.message); return }
      setSelectedProductoIds((data ?? []).map(d => d.producto_id).filter(id => productos.some(p => p.id === id)))
    })()
    return () => { cancel = true }
  }, [itemId, productos])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubiendo(true)
    setError(null)

    const { error: errBorrar } = await supabase.from('paneles_categoria_items_productos').delete().eq('item_id', itemId)
    if (errBorrar) { setError(errBorrar.message); setSubiendo(false); return }

    if (selectedProductoIds.length > 0) {
      const rows = selectedProductoIds.map((pid, i) => ({ item_id: itemId, producto_id: pid, orden: i }))
      const { error: errP } = await supabase.from('paneles_categoria_items_productos').insert(rows)
      if (errP) { setError(errP.message); setSubiendo(false); return }
    }

    onSave()
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Imagen de «{categoriaNombre}»</h2>
          <button type="button" className={styles.btnCerrar} onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          <ProductoImagenSelector
            productos={productos}
            relaciones={relaciones}
            categoriaId={categoriaId}
            selectedIds={selectedProductoIds}
            onChange={setSelectedProductoIds}
          />

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.acciones}>
            {selectedProductoIds.length > 0 && (
              <button type="button" className={`${styles.btnCancelar} ${styles.btnAutomatica}`} onClick={() => setSelectedProductoIds([])}>
                Usar imagen automática
              </button>
            )}
            <button type="button" className={styles.btnCancelar} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnGuardar} disabled={subiendo}>
              {subiendo ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
