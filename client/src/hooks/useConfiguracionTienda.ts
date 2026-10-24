import { useCallback, useEffect, useState } from 'react'
import { supabase, mapearConfiguracionTienda } from '@shared'
import type { ConfiguracionTienda } from '@shared'

// Caché compartida por toda la tienda: Header, Footer, Home, botón de WhatsApp
// y páginas legales usan la misma consulta en lugar de repetirla. Dura lo que
// la pestaña (un cambio en el admin se ve al recargar). Si falla, se descarta
// para que el próximo intento vuelva a consultar.
let pedido: Promise<ConfiguracionTienda | null> | null = null

export function obtenerConfiguracionTienda(forzar = false): Promise<ConfiguracionTienda | null> {
  if (!pedido || forzar) {
    pedido = (async () => {
      const { data, error } = await supabase.from('configuracion_tienda').select('*').maybeSingle()
      if (error) throw new Error(error.message)
      return data ? mapearConfiguracionTienda(data) : null
    })()
    pedido.catch(() => { pedido = null })
  }
  return pedido
}

export function useConfiguracionTienda() {
  const [config, setConfig] = useState<ConfiguracionTienda | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async (forzar = false) => {
    setLoading(true)
    setError(null)
    try {
      setConfig(await obtenerConfiguracionTienda(forzar))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar la configuración')
    }
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  return { config, loading, error, recargar: () => cargar(true) }
}
