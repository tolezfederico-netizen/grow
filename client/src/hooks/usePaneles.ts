import { useEffect, useState } from 'react'
import { supabase, mapearPanelCategoria, mapearPanelCategoriaItem } from '@shared'
import type { PanelCategoriaCompleto, ConfiguracionTienda } from '@shared'
import { obtenerConfiguracionTienda } from './useConfiguracionTienda'

function ordenarPaneles(paneles: PanelCategoriaCompleto[]): PanelCategoriaCompleto[] {
  const conOrden = paneles.filter(p => p.orden !== null).sort((a, b) => (a.orden as number) - (b.orden as number))
  const sinOrden = paneles.filter(p => p.orden === null)
  const sinOrdenMezclados = [...sinOrden]
  for (let i = sinOrdenMezclados.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[sinOrdenMezclados[i], sinOrdenMezclados[j]] = [sinOrdenMezclados[j], sinOrdenMezclados[i]]
  }

  const total = paneles.length
  const resultado: (PanelCategoriaCompleto | null)[] = new Array(total).fill(null)

  for (const p of conOrden) {
    const idx = (p.orden as number) - 1
    if (idx >= 0 && idx < total && resultado[idx] === null) {
      resultado[idx] = p
    }
  }

  const colocados = new Set(resultado.filter(Boolean).map(p => (p as PanelCategoriaCompleto).id))
  const noColocados = conOrden.filter(p => !colocados.has(p.id))
  const relleno = [...noColocados, ...sinOrdenMezclados]

  let cursor = 0
  for (let i = 0; i < total; i++) {
    if (resultado[i] === null && cursor < relleno.length) {
      resultado[i] = relleno[cursor]
      cursor++
    }
  }

  return resultado.filter(Boolean) as PanelCategoriaCompleto[]
}

// Caché compartida por Header, Footer y ArticulosSidebar: una sola consulta
// por pestaña y el mismo orden (los paneles sin orden fijo se reparten al azar
// una única vez). Si falla, se descarta para que el próximo intento reconsulte.
let pedido: Promise<PanelCategoriaCompleto[]> | null = null

function obtenerPaneles(): Promise<PanelCategoriaCompleto[]> {
  if (!pedido) {
    pedido = (async () => {
      const rPaneles = await supabase
        .from('paneles_categoria')
        .select(`
          id, titulo, descripcion, orden, estado, creado_en,
          paneles_categoria_items(
            id, panel_id, categoria_id, nombre_visible, orden, es_card,
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
          items: rawItems.map(item => {
            const i = item as Record<string, unknown>
            const rawProductos: unknown[] = (i.paneles_categoria_items_productos as unknown[]) ?? []
            const cat = i.categorias as { nombre?: string } | null
            return {
              ...mapearPanelCategoriaItem({
                id: i.id as string,
                panel_id: i.panel_id as string,
                categoria_id: i.categoria_id as string,
                nombre_visible: (i.nombre_visible as string) ?? null,
                orden: i.orden as number,
                es_card: i.es_card as boolean,
              }),
              categoria_nombre: cat?.nombre ?? '',
              productos: rawProductos.map(ip => {
                const p = ip as Record<string, unknown>
                const prod = p.productos as { imagen_url?: string | null; imagen_miniatura_url?: string | null } | null
                return {
                  producto_id: p.producto_id as string,
                  // Las cards del menú son chicas: miniatura si existe, si no la grande
                  imagen_url: prod?.imagen_miniatura_url ?? prod?.imagen_url ?? null,
                }
              }),
            }
          }),
        }
      })

      return ordenarPaneles(completos)
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
      .catch(err => { if (!cancel) { setError(err instanceof Error ? err.message : 'Error al cargar los paneles'); setLoading(false) } })

    return () => { cancel = true }
  }, [])

  return { paneles, config, loading, error }
}
