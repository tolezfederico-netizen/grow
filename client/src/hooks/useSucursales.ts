import { useState, useEffect } from 'react'
import type { Sucursal } from '@shared'
import { supabase, mapearSucursal } from '@shared'

// Caché compartida (HeaderTop, Banner y Footer): una sola consulta por pestaña.
let pedido: Promise<Sucursal[]> | null = null

function obtenerSucursales(): Promise<Sucursal[]> {
  if (!pedido) {
    pedido = (async () => {
      const { data, error } = await supabase.from('sucursales').select('*').order('orden')
      if (error) throw new Error(error.message)
      return (data ?? []).map(mapearSucursal)
    })()
    pedido.catch(() => { pedido = null })
  }
  return pedido
}

export function useSucursales() {
  const [sucursales, setSucursales] = useState<Sucursal[]>([])

  useEffect(() => {
    let cancel = false
    obtenerSucursales()
      .then(datos => { if (!cancel) setSucursales(datos) })
      .catch(() => {})
    return () => { cancel = true }
  }, [])

  return sucursales
}
