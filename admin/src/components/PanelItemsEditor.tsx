import { useState, type DragEvent } from 'react'
import { supabase } from '@shared'
import type { Categoria, ProductoCategoria } from '@shared'
import PanelItemForm from './PanelItemForm'
import { useConfirm } from '../context/ConfirmContext'
import styles from './PanelItemsEditor.module.css'

interface PanelRow {
  id: string
  titulo: string
  orden: number | null
  estado: string
}

interface PanelItemRow {
  id: string
  panel_id: string
  categoria_id: string
  nombre_visible: string | null
  orden: number
  es_card?: boolean
}

interface ItemProductoRow {
  id: string
  item_id: string
  producto_id: string
  orden: number
}

interface Props {
  panel: PanelRow
  items: PanelItemRow[]
  todosLosItems: PanelItemRow[]
  itemProductos: ItemProductoRow[]
  categorias: Categoria[]
  relaciones: ProductoCategoria[]
  productos: { id: string; nombre: string; imagen_url: string | null }[]
  onReload: () => void
}

export default function PanelItemsEditor({ panel, items, todosLosItems, itemProductos, categorias, relaciones, productos, onReload }: Props) {
  const [editandoItem, setEditandoItem] = useState<PanelItemRow | null>(null)
  const [creandoItem, setCreandoItem] = useState(false)
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null)
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null)
  const [mostrarPreview, setMostrarPreview] = useState(false)
  const { confirm, notify } = useConfirm()

  function nombreCategoria(catId: string) {
    return categorias.find(c => c.id === catId)?.nombre ?? catId
  }

  function imagenesCount(itemId: string) {
    return itemProductos.filter(ip => ip.item_id === itemId).length
  }

  const cardsCount = items.filter(i => i.es_card).length

  const cardsOrdenadas = items
    .filter(i => i.es_card)
    .sort((a, b) => a.orden - b.orden)
    .map(item => {
      const primeraImagen = itemProductos
        .filter(ip => ip.item_id === item.id)
        .sort((a, b) => a.orden - b.orden)[0]
      const producto = primeraImagen ? productos.find(p => p.id === primeraImagen.producto_id) : undefined
      return {
        id: item.id,
        nombre: nombreCategoria(item.categoria_id),
        imagenUrl: producto?.imagen_url ?? null,
      }
    })

  async function eliminarItem(item: PanelItemRow) {
    const imgCount = imagenesCount(item.id)
    const msg = imgCount > 0
      ? `¿Eliminar esta categoría? También se desvincularán sus ${imgCount} imágenes.`
      : '¿Eliminar esta categoría del panel?'
    const confirmado = await confirm(msg, { titulo: 'Eliminar categoría del panel', textoConfirmar: 'Eliminar' })
    if (!confirmado) return
    const { error: err } = await supabase.from('paneles_categoria_items').delete().eq('id', item.id)
    if (err) { await notify(err.message, { titulo: 'Error' }); return }
    onReload()
  }

  function handleDragStartItem(id: string) {
    setDraggedItemId(id)
  }

  function handleDragOverItem(e: DragEvent, id: string) {
    if (!draggedItemId) return
    e.preventDefault()
    if (id !== dragOverItemId) setDragOverItemId(id)
  }

  async function handleDropItem(targetId: string) {
    if (!draggedItemId || draggedItemId === targetId) {
      setDraggedItemId(null)
      setDragOverItemId(null)
      return
    }

    const orden = [...items]
    const fromIndex = orden.findIndex(i => i.id === draggedItemId)
    const toIndex = orden.findIndex(i => i.id === targetId)
    if (fromIndex === -1 || toIndex === -1) { setDraggedItemId(null); setDragOverItemId(null); return }

    const [moved] = orden.splice(fromIndex, 1)
    orden.splice(toIndex, 0, moved)

    setDraggedItemId(null)
    setDragOverItemId(null)

    const updatesTemp = orden.map((it, i) =>
      supabase.from('paneles_categoria_items').update({ orden: -(i + 1) }).eq('id', it.id)
    )
    const resultadosTemp = await Promise.all(updatesTemp)
    const conErrorTemp = resultadosTemp.find(r => r.error)
    if (conErrorTemp?.error) { await notify(conErrorTemp.error.message, { titulo: 'Error al reordenar' }); return }

    const updatesFinal = orden.map((it, i) =>
      supabase.from('paneles_categoria_items').update({ orden: i }).eq('id', it.id)
    )
    const resultadosFinal = await Promise.all(updatesFinal)
    const conErrorFinal = resultadosFinal.find(r => r.error)
    if (conErrorFinal?.error) { await notify(conErrorFinal.error.message, { titulo: 'Error al reordenar' }); return }
    onReload()
  }

  function handleDragEndItem() {
    setDraggedItemId(null)
    setDragOverItemId(null)
  }

  return (
    <div className={styles.editor}>
      <div className={styles.header}>
        <h3 className={styles.titulo}>Categorías de: {panel.titulo}</h3>
        <div className={styles.headerRight}>
          <span className={`${styles.contador} ${cardsCount >= 4 ? styles.contadorLleno : ''}`}>{cardsCount}/4 marcadas como card visual</span>
          <button className={styles.btnPreview} onClick={() => setMostrarPreview(v => !v)}>
            {mostrarPreview ? 'Ocultar vista previa' : 'Vista previa'}
          </button>
          <button className={styles.btnNuevo} onClick={() => setCreandoItem(true)}>+ Agregar categoría</button>
        </div>
      </div>

      {mostrarPreview && (
        <div className={styles.preview}>
          {cardsOrdenadas.length === 0 ? (
            <p className={styles.previewVacio}>Este panel no tiene categorías marcadas como card visual todavía.</p>
          ) : (
            <div className={styles.previewGrid}>
              {cardsOrdenadas.map((c, i) => (
                <div key={c.id} className={styles.previewCard}>
                  <span className={styles.previewOrden}>{i + 1}</span>
                  {c.imagenUrl ? (
                    <img src={c.imagenUrl} alt={c.nombre} className={styles.previewImg} />
                  ) : (
                    <div className={styles.previewImgPlaceholder}>Sin imagen</div>
                  )}
                  <span className={styles.previewNombre}>{c.nombre}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <p className={styles.vacio}>Este panel no tiene categorías todavía.</p>
      ) : (
        <table className={styles.tabla}>
          <thead>
            <tr><th>Categoría</th><th>Orden</th><th>Card visual</th><th></th></tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr
                key={item.id}
                draggable
                onDragStart={() => handleDragStartItem(item.id)}
                onDragOver={e => handleDragOverItem(e, item.id)}
                onDrop={() => handleDropItem(item.id)}
                onDragEnd={handleDragEndItem}
                className={`${dragOverItemId === item.id ? styles.dragOver : ''} ${draggedItemId === item.id ? styles.arrastrando : ''}`}
              >
                <td>
                  <span className={styles.dragHandle} aria-hidden="true" title="Arrastrar para reordenar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
                      <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                      <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
                    </svg>
                  </span>
                  {nombreCategoria(item.categoria_id)}
                </td>
                <td>{item.orden}</td>
                <td>{item.es_card ? <span className={styles.badgeCard}>Card</span> : <span className={styles.badgeLista}>Solo listado</span>}</td>
                <td className={styles.acciones}>
                  <button className={styles.btnAccion} onClick={() => setEditandoItem(item)}>Editar</button>
                  <button className={styles.btnAccion} onClick={() => eliminarItem(item)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {(editandoItem || creandoItem) && (
        <PanelItemForm
          item={editandoItem ?? undefined}
          panelId={panel.id}
          categorias={categorias}
          relaciones={relaciones}
          productos={productos}
          itemsExistentes={todosLosItems}
          cardsActualesCount={cardsCount}
          onClose={() => { setEditandoItem(null); setCreandoItem(false) }}
          onSave={() => { setEditandoItem(null); setCreandoItem(false); onReload() }}
        />
      )}
    </div>
  )
}
