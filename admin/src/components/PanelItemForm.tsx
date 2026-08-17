import { useState, useEffect, type FormEvent } from 'react'
import { supabase } from '@shared'
import type { Categoria, ProductoCategoria } from '@shared'
import ProductoImagenSelector from './ProductoImagenSelector'
import styles from './PanelItemForm.module.css'

interface Props {
  item?: {
    id: string
    panel_id: string
    categoria_id: string
    nombre_visible: string | null
    orden: number
    es_card?: boolean
  }
  panelId: string
  categorias: Categoria[]
  relaciones: ProductoCategoria[]
  productos: { id: string; nombre: string; imagen_url: string | null }[]
  itemsExistentes: { id: string; categoria_id: string }[]
  cardsActualesCount: number
  onClose: () => void
  onSave: () => void
}

export default function PanelItemForm({ item, panelId, categorias, relaciones, productos, itemsExistentes, cardsActualesCount, onClose, onSave }: Props) {
  const [catId, setCatId] = useState(item?.categoria_id ?? '')
  const [orden, setOrden] = useState(item?.orden.toString() ?? '0')
  const [esCard, setEsCard] = useState(item?.es_card ?? false)
  const [selectedProductoIds, setSelectedProductoIds] = useState<string[]>([])
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const categoriasDisponibles = categorias.filter(c =>
    c.id === item?.categoria_id || !itemsExistentes.some(i => i.categoria_id === c.id)
  )

  const limiteAlcanzado = cardsActualesCount >= 4 && !esCard

  useEffect(() => {
    if (!item) return
    let cancel = false
    ;(async () => {
      const { data, error: err } = await supabase
        .from('paneles_categoria_items_productos')
        .select('producto_id')
        .eq('item_id', item.id)
        .order('orden', { ascending: true })
      if (cancel) return
      if (err) { setError(err.message); return }
      setSelectedProductoIds(data ? data.map(d => d.producto_id) : [])
    })()
    return () => { cancel = true }
  }, [item])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!catId) { setError('Seleccioná una categoría.'); return }
    if (esCard && selectedProductoIds.length === 0) { setError('Seleccioná al menos un producto como imagen para la card visual.'); return }
    setSubiendo(true)
    setError(null)

    const itemData = {
      panel_id: panelId,
      categoria_id: catId,
      nombre_visible: null,
      orden: Number(orden),
      es_card: esCard,
    }

    try {
      let itemId: string

      if (item) {
        const { error: err } = await supabase.from('paneles_categoria_items').update(itemData).eq('id', item.id)
        if (err) { setError(err.message); setSubiendo(false); return }
        itemId = item.id
      } else {
        const { data: nuevo, error: err } = await supabase
          .from('paneles_categoria_items')
          .insert(itemData)
          .select()
          .single()
        if (err) { setError(err.message); setSubiendo(false); return }
        itemId = nuevo.id
      }

      await supabase.from('paneles_categoria_items_productos').delete().eq('item_id', itemId)

      if (esCard && selectedProductoIds.length > 0) {
        const rows = selectedProductoIds.map((pid, i) => ({
          item_id: itemId,
          producto_id: pid,
          orden: i,
        }))
        const { error: errP } = await supabase.from('paneles_categoria_items_productos').insert(rows)
        if (errP) { setError(errP.message); setSubiendo(false); return }
      }

      onSave()
    } catch (e) {
      if (e instanceof Error) {
        setError(e.message)
      } else {
        setError('Error inesperado.')
      }
      setSubiendo(false)
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>{item ? 'Editar categoría del panel' : 'Nueva categoría en el panel'}</h2>
          <button type="button" className={styles.btnCerrar} onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          <select className={styles.input} value={catId} onChange={e => setCatId(e.target.value)} required>
            <option value="">Seleccionar categoría…</option>
            {categoriasDisponibles.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>

          <input className={styles.input} type="number" min="0" placeholder="Orden" value={orden} onChange={e => setOrden(e.target.value)} required />

          <label className={styles.checkRow}>
            <input type="checkbox" checked={esCard} disabled={limiteAlcanzado} onChange={e => {
              setEsCard(e.target.checked)
              if (!e.target.checked) setSelectedProductoIds([])
            }} />
            Mostrar como card visual en el header (máx. 4 por panel)
          </label>

          {limiteAlcanzado && (
            <p className={styles.avisoLimite}>Ya hay 4 categorías marcadas como card visual en este panel. Desmarcá una para poder agregar otra.</p>
          )}

          {esCard && (
            <ProductoImagenSelector
              productos={productos}
              relaciones={relaciones}
              categoriaId={catId || undefined}
              selectedIds={selectedProductoIds}
              onChange={setSelectedProductoIds}
            />
          )}

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.acciones}>
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
