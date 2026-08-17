import { useEffect, useState } from 'react'
import { supabase, mapearPanelCategoria, mapearPanelCategoriaItem, mapearPanelCategoriaItemProducto } from '@shared'
import type { PanelCategoriaCompleto, ConfiguracionTienda } from '@shared'
import { mapearConfiguracionTienda } from '@shared'

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

export function usePaneles() {
  const [paneles, setPaneles] = useState<PanelCategoriaCompleto[]>([])
  const [config, setConfig] = useState<ConfiguracionTienda | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false

    async function cargar() {
      setLoading(true)
      setError(null)

      const [rPaneles, rConfig] = await Promise.all([
        supabase
          .from('paneles_categoria')
          .select(`
            id, titulo, descripcion, orden, estado, creado_en,
            paneles_categoria_items(
              id, panel_id, categoria_id, nombre_visible, orden, es_card,
              categorias(nombre),
              paneles_categoria_items_productos(
                producto_id, orden,
                productos(imagen_url)
              )
            )
          `)
          .eq('estado', 'activo')
          .order('orden'),
        supabase.from('configuracion_tienda').select('*').single(),
      ])

      if (cancel) return
      if (rPaneles.error) { setError(rPaneles.error.message); setLoading(false); return }

      if (rConfig.data && !rConfig.error) {
        setConfig(mapearConfiguracionTienda(rConfig.data))
      }

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
                const prod = p.productos as { imagen_url?: string | null } | null
                return {
                  producto_id: p.producto_id as string,
                  imagen_url: prod?.imagen_url ?? null,
                }
              }),
            }
          }),
        }
      })

      setPaneles(ordenarPaneles(completos))
      setLoading(false)
    }

    cargar()
    return () => { cancel = true }
  }, [])

  return { paneles, config, loading, error }
}
