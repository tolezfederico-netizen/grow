import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, formatPrecio, formatEstadoPedido, mapearPedido, ESTADOS_PEDIDO } from '@shared'
import type { Pedido } from '@shared'
import ErrorState from '../components/ErrorState'
import { iconoEstado } from '../utils/iconoEstado'
import styles from './DashboardPage.module.css'

function claseBadgeEstado(estado: string): string {
  const map: Record<string, string> = {
    pendiente: styles.badgePendiente,
    confirmado: styles.badgeConfirmado,
    listo_para_retirar: styles.badgeListo,
    completado: styles.badgeCompletado,
    cancelado: styles.badgeCancelado,
  }
  return map[estado] ?? ''
}

export default function DashboardPage() {
  const [pendientes, setPendientes] = useState(0)
  const [productosActivos, setProductosActivos] = useState(0)
  const [ultimos, setUltimos] = useState<Pedido[]>([])
  const [ventasHoy, setVentasHoy] = useState(0)
  const [conteoEstados, setConteoEstados] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function cargar() {
    setLoading(true)
    setError(null)

    const hoyInicio = new Date()
    hoyInicio.setHours(0, 0, 0, 0)
    const hoyFin = new Date()
    hoyFin.setHours(23, 59, 59, 999)

    const [resPendientes, resProductos, resUltimos, resVentasHoy, ...resConteos] = await Promise.all([
      supabase.from('pedidos').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente').eq('eliminado', false),
      supabase.from('productos').select('id', { count: 'exact', head: true }).eq('estado', 'disponible'),
      supabase.from('pedidos').select('*').eq('eliminado', false).order('creado_en', { ascending: false }).limit(6),
      supabase.from('pedidos').select('total').eq('estado', 'completado').eq('eliminado', false).gte('actualizado_en', hoyInicio.toISOString()).lte('actualizado_en', hoyFin.toISOString()),
      ...ESTADOS_PEDIDO.map(e => supabase.from('pedidos').select('id', { count: 'exact', head: true }).eq('estado', e).eq('eliminado', false)),
    ])

    if (resPendientes.error) { setError(resPendientes.error.message); setLoading(false); return }
    if (resProductos.error) { setError(resProductos.error.message); setLoading(false); return }
    if (resUltimos.error) { setError(resUltimos.error.message); setLoading(false); return }
    if (resVentasHoy.error) { setError(resVentasHoy.error.message); setLoading(false); return }
    const errConteo = resConteos.find(r => r.error)
    if (errConteo) { setError(errConteo.error!.message); setLoading(false); return }

    const totalVentasHoy = (resVentasHoy.data ?? []).reduce((sum, r) => sum + r.total, 0)

    const conteo: Record<string, number> = {}
    ESTADOS_PEDIDO.forEach((e, i) => { conteo[e] = resConteos[i].count ?? 0 })

    setPendientes(resPendientes.count ?? 0)
    setProductosActivos(resProductos.count ?? 0)
    setUltimos((resUltimos.data ?? []).map(mapearPedido))
    setVentasHoy(totalVentasHoy)
    setConteoEstados(conteo)
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.tarjetas}>
          <div className={`${styles.tarjeta} ${styles.skeleton}`} />
          <div className={`${styles.tarjeta} ${styles.skeleton}`} />
          <div className={`${styles.tarjeta} ${styles.skeleton}`} />
        </div>
        {[1, 2, 3, 4, 5].map(i => <div key={i} className={styles.skeletonRow} />)}
      </div>
    )
  }

  if (error) return <ErrorState mensaje={error} onReintentar={cargar} />

  return (
    <div className={styles.page}>
      <div className={styles.tarjetas}>
        <Link to="/pedidos?estado=pendiente" className={styles.tarjeta}>
          <p className={styles.numero}>{pendientes}</p>
          <p className={styles.etiqueta}>Pedidos pendientes</p>
        </Link>
        <Link to="/productos" className={styles.tarjeta}>
          <p className={styles.numero}>{productosActivos}</p>
          <p className={styles.etiqueta}>Productos activos</p>
        </Link>
        <div className={styles.tarjeta}>
          <p className={styles.numero}>{formatPrecio(ventasHoy)}</p>
          <p className={styles.etiqueta}>Ventas de hoy</p>
        </div>
      </div>

      <div className={styles.miniTarjetas}>
        {ESTADOS_PEDIDO.map(e => (
          <Link key={e} to={`/pedidos?estado=${e}`} className={styles.miniTarjeta}>
            <span className={styles.miniIcono}>{iconoEstado(e)}</span>
            <p className={styles.miniNumero}>{conteoEstados[e] ?? 0}</p>
            <p className={styles.miniEtiqueta}>{formatEstadoPedido(e)}</p>
          </Link>
        ))}
      </div>

      <div className={styles.sectionHeader}>
        <h2 className={styles.subtitulo}>Últimos pedidos</h2>
        <button className={styles.btnRefrescar} onClick={cargar}>↻ Actualizar</button>
      </div>
      {ultimos.length === 0 ? (
        <p className={styles.vacio}>No hay pedidos todavía.</p>
      ) : (
        <>
          <div className={styles.pedidosGrid}>
            {ultimos.map(p => (
              <div key={p.id} className={styles.pedidoRow}>
                <span className={styles.pedidoCliente}>{p.cliente_nombre}</span>
                <span className={`${styles.badge} ${claseBadgeEstado(p.estado)}`}>{iconoEstado(p.estado)}{formatEstadoPedido(p.estado)}</span>
                <span className={styles.pedidoTotal}>{formatPrecio(p.total)}</span>
                <Link to={`/pedidos?id=${p.id}`} className={styles.link}>Ver</Link>
              </div>
            ))}
          </div>
          <Link to="/pedidos" className={styles.verTodos}>Ver todos los pedidos →</Link>
        </>
      )}
    </div>
  )
}
