import { Fragment, useState, type DragEvent } from 'react'
import { supabase, CATEGORIAS_EN_DESPLEGABLE } from '@shared'
import type { Categoria, ProductoCategoria } from '@shared'
import { AgregarCategoriaForm, ImagenCategoriaForm } from './PanelItemForm'
import { useConfirm } from '../context/ConfirmContext'
import styles from './PanelItemsEditor.module.css'

interface PanelRow {
  id: string
  titulo: string
}

interface PanelItemRow {
  id: string
  panel_id: string
  categoria_id: string
  orden: number
}

interface ItemProductoRow {
  id: string
  item_id: string
  producto_id: string
  orden: number
}

interface ProductoRow {
  id: string
  nombre: string
  imagen_url: string | null
  estado: string
}

interface Props {
  panel: PanelRow
  paneles: PanelRow[]
  items: PanelItemRow[]
  todosLosItems: PanelItemRow[]
  itemProductos: ItemProductoRow[]
  categorias: Categoria[]
  relaciones: ProductoCategoria[]
  productos: ProductoRow[]
  /** Imagen que la tienda usa en cada categoría sin una elegida a mano */
  imagenesAutomaticas: Record<string, string[]>
  onReload: () => void
}

export default function PanelItemsEditor({ panel, paneles, items, todosLosItems, itemProductos, categorias, relaciones, productos, imagenesAutomaticas, onReload }: Props) {
  const [imagenDe, setImagenDe] = useState<PanelItemRow | null>(null)
  const [agregando, setAgregando] = useState(false)
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null)
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null)
  const { confirm, notify } = useConfirm()

  const productosElegibles = productos.filter(p => p.imagen_url && p.estado !== 'pausado')

  function categoria(catId: string) {
    return categorias.find(c => c.id === catId)
  }

  function nombreCategoria(catId: string) {
    return categoria(catId)?.nombre ?? catId
  }

  // Misma regla que la tienda: lo elegido a mano si se puede mostrar; si no, lo automático
  function imagenes(item: PanelItemRow): { urls: string[]; elegida: boolean } {
    const elegidas = itemProductos
      .filter(ip => ip.item_id === item.id)
      .sort((a, b) => a.orden - b.orden)
      .map(ip => productosElegibles.find(p => p.id === ip.producto_id)?.imagen_url)
      .filter((url): url is string => !!url)
      .slice(0, 2)
    if (elegidas.length > 0) return { urls: elegidas, elegida: true }
    return { urls: imagenesAutomaticas[item.categoria_id] ?? [], elegida: false }
  }

  // Una categoría pausada no se ve en la tienda, así que no ocupa lugar en el desplegable
  const activos = items.filter(i => categoria(i.categoria_id)?.estado !== 'pausada')
  const enDesplegable = new Set(activos.slice(0, CATEGORIAS_EN_DESPLEGABLE).map(i => i.id))
  const primeroEnLateral = activos[CATEGORIAS_EN_DESPLEGABLE]?.id

  const seccionDeCategoria: Record<string, string> = {}
  todosLosItems.forEach(i => {
    seccionDeCategoria[i.categoria_id] = paneles.find(p => p.id === i.panel_id)?.titulo ?? ''
  })

  async function quitarItem(item: PanelItemRow) {
    const confirmado = await confirm(
      `¿Quitar «${nombreCategoria(item.categoria_id)}» de esta sección? La categoría y sus productos no se borran, pero deja de aparecer en el menú.`,
      { titulo: 'Quitar categoría', textoConfirmar: 'Quitar' },
    )
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

    const resultados = await Promise.all(
      orden.map((it, i) => supabase.from('paneles_categoria_items').update({ orden: i }).eq('id', it.id)),
    )
    const conError = resultados.find(r => r.error)
    if (conError?.error) { await notify(conError.error.message, { titulo: 'Error al reordenar' }); return }
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
        <button className={styles.btnNuevo} onClick={() => setAgregando(true)}>+ Agregar categoría</button>
      </div>

      {items.length === 0 ? (
        <p className={styles.vacio}>Esta sección no tiene categorías todavía: hasta que le agregues una, no aparece en la tienda.</p>
      ) : (
        <>
          <p className={styles.ayuda}>
            <strong>Arrastrá las categorías para ordenarlas.</strong> Las primeras {CATEGORIAS_EN_DESPLEGABLE} se ven con imagen al abrir la sección en el menú.
          </p>
          <table className={styles.tabla}>
            <colgroup>
              <col className={styles.colNombre} />
              <col />
              <col className={styles.colAcciones} />
            </colgroup>
            <tbody>
              <tr className={styles.divisor}>
                <td colSpan={3}>Se ven en el menú desplegable</td>
              </tr>
              {items.map(item => {
                const pausada = categoria(item.categoria_id)?.estado === 'pausada'
                const destacada = enDesplegable.has(item.id)
                const { urls, elegida } = imagenes(item)
                return (
                  <Fragment key={item.id}>
                    {item.id === primeroEnLateral && (
                      <tr className={styles.divisor}>
                        <td colSpan={3}>Solo en la barra lateral de productos</td>
                      </tr>
                    )}
                    <tr
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
                      <td>
                        {pausada && <span className={styles.badgePausada}>Pausada: no se ve en la tienda</span>}
                        {destacada && (
                          <div className={styles.imagenes}>
                            {urls.map(url => <img key={url} src={url} alt="" className={styles.miniatura} />)}
                            <span className={styles.origenImagen}>
                              {urls.length === 0 ? 'Sin imagen' : elegida ? 'Elegida' : 'Automática'}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className={styles.acciones}>
                        {destacada && <button className={styles.btnAccion} onClick={() => setImagenDe(item)}>Cambiar imagen</button>}
                        <button className={`${styles.btnAccion} ${styles.btnQuitar}`} onClick={() => quitarItem(item)}>Quitar</button>
                      </td>
                    </tr>
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </>
      )}

      {agregando && (
        <AgregarCategoriaForm
          panelId={panel.id}
          panelTitulo={panel.titulo}
          categorias={categorias}
          seccionDeCategoria={seccionDeCategoria}
          siguienteOrden={items.reduce((max, i) => Math.max(max, i.orden), -1) + 1}
          onClose={() => setAgregando(false)}
          onSave={() => { setAgregando(false); onReload() }}
        />
      )}

      {imagenDe && (
        <ImagenCategoriaForm
          itemId={imagenDe.id}
          categoriaId={imagenDe.categoria_id}
          categoriaNombre={nombreCategoria(imagenDe.categoria_id)}
          relaciones={relaciones}
          productos={productosElegibles}
          onClose={() => setImagenDe(null)}
          onSave={() => { setImagenDe(null); onReload() }}
        />
      )}
    </div>
  )
}
