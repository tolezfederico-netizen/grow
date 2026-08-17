import { useCallback, useEffect, useState } from 'react'
import { supabase, mapearConfiguracionTienda } from '@shared'
import type { ConfiguracionTienda } from '@shared'

export function useConfiguracionTienda() {
  const [config, setConfig] = useState<ConfiguracionTienda | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase.from('configuracion_tienda').select('*').maybeSingle()

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    setConfig(data ? mapearConfiguracionTienda(data) : null)
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  return { config, loading, error, recargar: cargar }
}
