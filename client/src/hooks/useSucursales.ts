import { useState, useEffect } from 'react'
import type { Sucursal } from '@shared'
import { supabase, mapearSucursal } from '@shared'

export function useSucursales() {
  const [sucursales, setSucursales] = useState<Sucursal[]>([])

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('sucursales').select('*').order('orden')
      if (data) setSucursales(data.map(mapearSucursal))
    })()
  }, [])

  return sucursales
}
