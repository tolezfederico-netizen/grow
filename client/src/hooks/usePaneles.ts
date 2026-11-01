import { useEffect, useState } from 'react'
import { supabase, mapearPanelCategoria, mapearPanelCategoriaItem } from '@shared'
import { CATEGORIAS_EN_DESPLEGABLE } from '@shared'
import type { PanelCategoriaCompleto, ConfiguracionTienda } from '@shared'
import { obtenerConfiguracionTienda } from './useConfiguracionTienda'

/**
 * Las categorías del desplegable sin una imagen elegida (o cuyo producto ya no
 * se ve) usan la automática. Si la consulta falla, la tarjeta queda sin imagen:
 * el menú sigue funcionando igual.
 */
async function completarImagenes(paneles: PanelCategoriaCompleto[]): Promise<void> {
  const sinImagen = paneles
    .flatMap(p => p.items.slice(0, CATEGORIAS_EN_DESPLEGABLE))
    .filter(item => !item.productos.some(p => p.imagen_url))
  if (sinImagen.length === 0) return

  const { data, error } = await supabase.rpc('imagenes_categorias_menu', {
    p_categoria_ids: sinImagen.map(item => item.categoria_id),
  })
  if (error) return

  for (const item of sinImagen) {
    item.productos = (data ?? [])
      .filter(fila => fila.categoria_id === item.categoria_id)
      .map(fila => ({
        producto_id: fila.producto_id,
        imagen_url: fila.imagen_miniatura_url ?? fila.imagen_url,
      }))
  }
}

// Caché compartida por Header, Footer y ArticulosSidebar: una sola consulta
// por pestaña. Si falla, se descarta para que el próximo intento reconsulte.
let pedido: Promise<PanelCategoriaCompleto[]> | null = null

function obtenerPaneles(): Promise<PanelCategoriaCompleto[]> {
  if (!pedido) {
    pedido = (async () => {
      const rPaneles = await supabase
        .from('paneles_categoria')
        .select(`
          id, titulo, descripcion, orden, estado, creado_en,
          paneles_categoria_items(
            id, panel_id, categoria_id, nombre_visible, orden,
            categorias(nombre),
            paneles_categoria_items_productos(
              producto_id, orden,
              productos(imagen_url, imagen_miniatura_url)
            )
          )
        `)
        .eq('estado', 'activo')
        .order('orden')
      if (rPaneles.error) throw new Error(rPaneles.error.message)

      const data = rPaneles.data ?? []
      const completos: PanelCategoriaCompleto[] = data.map(p => {
        const rawItems: unknown[] = (p as Record<string, unknown>).paneles_categoria_items as unknown[] ?? []
        return {
          ...mapearPanelCategoria({
            id: p.id,
            titulo: p.titulo,
            descripcion: p.descripcion,
            orden: p.orden,
            estado: p.estado,
            creado_en: p.creado_en,
          }),
          // Una categoría pausada no llega (RLS): no ocupa lugar en el menú
          items: rawItems
            .filter(item => !!(item as Record<string, unknown>).categorias)
            .map(item => {
              const i = item as Record<string, unknown>
              const rawProductos = ((i.paneles_categoria_items_productos as unknown[]) ?? []) as Record<string, unknown>[]
              const cat = i.categorias as { nombre?: string } | null
              return {
                ...mapearPanelCategoriaItem({
                  id: i.id as string,
                  panel_id: i.panel_id as string,
                  categoria_id: i.categoria_id as string,
                  nombre_visible: (i.nombre_visible as string) ?? null,
                  orden: i.orden as number,
                }),
                categoria_nombre: cat?.nombre ?? '',
                productos: [...rawProductos]
                  .sort((a, b) => (a.orden as number) - (b.orden as number))
                  .map(p => {
                    const prod = p.productos as { imagen_url?: string | null; imagen_miniatura_url?: string | null } | null
                    return {
                      producto_id: p.producto_id as string,
                      // Las cards del menú son chicas: miniatura si existe, si no la grande
                      imagen_url: prod?.imagen_miniatura_url ?? prod?.imagen_url ?? null,
                    }
                  }),
              }
            })
            .sort((a, b) => a.orden - b.orden),
        }
      })

      // Una sección sin categorías no tiene nada que mostrar en la tienda
      const paneles = completos.filter(p => p.items.length > 0)
      await completarImagenes(paneles)
      return paneles
    })()
    pedido.catch(() => { pedido = null })
  }
  return pedido
}

export function usePaneles() {
  const [paneles, setPaneles] = useState<PanelCategoriaCompleto[]>([])
  const [config, setConfig] = useState<ConfiguracionTienda | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false

    // La configuración es secundaria acá: si falla, el header sigue con los paneles
    obtenerConfiguracionTienda()
      .then(c => { if (!cancel) setConfig(c) })
      .catch(() => {})

    obtenerPaneles()
      .then(p => { if (!cancel) { setPaneles(p); setLoading(false) } })
      .catch(err => { if (!cancel) { setError(err instanceof Error ? err.message : 'Error al cargar el menú'); setLoading(false) } })

    return () => { cancel = true }
  }, [])

  return { paneles, config, loading, error }
}
