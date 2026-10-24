import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, formatPrecio, formatEstadoPedido, mapearPedido, ESTADOS_PEDIDO } from '@shared'
import type { Pedido } from '@shared'
import ErrorState from '../components/ErrorState'
import { iconoEstado } from '../utils/iconoEstado'
import styles from './DashboardPage.module.css'

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function claseEstado(estado: string): string {
  const map: Record<string, string> = {
    pendiente: styles.estadoPendiente,
    confirmado: styles.estadoConfirmado,
    listo_para_retirar: styles.estadoListo,
    completado: styles.estadoCompletado,
    cancelado: styles.estadoCancelado,
  }
  return map[estado] ?? ''
}

function inicioDelDia(fecha: Date): Date {
  const d = new Date(fecha)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Hoy → "12:24"; ayer → "Ayer 20:50"; antes → "16/8 20:50". */
function formatFechaCorta(iso: string): string {
  const fecha = new Date(iso)
  const hora = fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
  const dias = Math.round((inicioDelDia(new Date()).getTime() - inicioDelDia(fecha).getTime()) / 86_400_000)
  if (dias === 0) return hora
  if (dias === 1) return `Ayer ${hora}`
  return `${fecha.getDate()}/${fecha.getMonth() + 1} ${hora}`
}

interface DiaSemana {
  etiqueta: string
  cantidad: number
}

export default function DashboardPage() {
  const [conteoEstados, setConteoEstados] = useState<Record<string, number>>({})
  const [sinStock, setSinStock] = useState(0)
  const [ultimos, setUltimos] = useState<Pedido[]>([])
  const [semana, setSemana] = useState<DiaSemana[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function cargar() {
    setLoading(true)
    setError(null)

    const desde = inicioDelDia(new Date())
    desde.setDate(desde.getDate() - 6)

    const [resSinStock, resUltimos, resSemana, ...resConteos] = await Promise.all([
      supabase.from('productos').select('id', { count: 'exact', head: true }).eq('estado', 'sin_stock'),
      supabase.from('pedidos').select('*').eq('eliminado', false).order('creado_en', { ascending: false }).limit(6),
      supabase.from('pedidos').select('creado_en').eq('eliminado', false).gte('creado_en', desde.toISOString()),
      ...ESTADOS_PEDIDO.map(e => supabase.from('pedidos').select('id', { count: 'exact', head: true }).eq('estado', e).eq('eliminado', false)),
    ])

    const errorRes = [resSinStock, resUltimos, resSemana, ...resConteos].find(r => r.error)
    if (errorRes) { setError(errorRes.error!.message); setLoading(false); return }

    const conteo: Record<string, number> = {}
    ESTADOS_PEDIDO.forEach((e, i) => { conteo[e] = resConteos[i].count ?? 0 })

    // Un casillero por día, del más viejo a hoy
    const dias: DiaSemana[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(desde)
      d.setDate(desde.getDate() + i)
      return { etiqueta: i === 6 ? 'Hoy' : DIAS_SEMANA[d.getDay()], cantidad: 0 }
    })
    ;(resSemana.data ?? []).forEach(p => {
      const indice = Math.round((inicioDelDia(new Date(p.creado_en)).getTime() - desde.getTime()) / 86_400_000)
      if (indice >= 0 && indice < 7) dias[indice].cantidad++
    })

    setConteoEstados(conteo)
    setSinStock(resSinStock.count ?? 0)
    setUltimos((resUltimos.data ?? []).map(mapearPedido))
    setSemana(dias)
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.estados}>
          {ESTADOS_PEDIDO.map(e => <div key={e} className={`${styles.estado} ${styles.skeleton}`} />)}
        </div>
        <div className={styles.columnas}>
          <div className={`${styles.bloque} ${styles.skeleton} ${styles.skeletonBloque}`} />
          <div className={`${styles.bloque} ${styles.skeleton} ${styles.skeletonBloque}`} />
        </div>
      </div>
    )
  }

  if (error) return <ErrorState mensaje={error} onReintentar={cargar} />

  const maximoSemana = Math.max(1, ...semana.map(d => d.cantidad))
  const totalSemana = semana.reduce((sum, d) => sum + d.cantidad, 0)

  return (
    <div className={styles.page}>
      <div className={styles.estados}>
        {ESTADOS_PEDIDO.map(e => {
          const cantidad = conteoEstados[e] ?? 0
          const destacado = e === 'pendiente' && cantidad > 0
          return (
            <Link
              key={e}
              to={`/pedidos?estado=${e}`}
              className={`${styles.estado} ${destacado ? styles.estadoDestacado : ''}`}
            >
              <span className={`${styles.estadoIcono} ${claseEstado(e)}`}>{iconoEstado(e)}</span>
              <span className={styles.estadoNumero}>{cantidad}</span>
              <span className={styles.estadoEtiqueta}>{formatEstadoPedido(e)}</span>
            </Link>
          )
        })}
      </div>

      <div className={styles.columnas}>
        <section className={styles.bloque}>
          <div className={styles.bloqueHeader}>
            <h2 className={styles.bloqueTitulo}>Últimas reservas</h2>
            <div className={styles.bloqueAcciones}>
              <button className={styles.boton} onClick={cargar}>↻ Actualizar</button>
              <Link to="/pedidos" className={styles.boton}>Ver todos</Link>
            </div>
          </div>
          {ultimos.length === 0 ? (
            <p className={styles.vacio}>No hay reservas todavía.</p>
          ) : (
            <div className={styles.lista}>
              {ultimos.map(p => (
                <Link key={p.id} to={`/pedidos?id=${p.id}`} className={styles.pedido}>
                  <span className={styles.pedidoDatos}>
                    <span className={styles.pedidoCliente}>{p.cliente_nombre}</span>
                    <span className={styles.pedidoFecha}>{formatFechaCorta(p.creado_en)}</span>
                  </span>
                  <span className={`${styles.badge} ${claseEstado(p.estado)}`}>
                    {iconoEstado(p.estado)}{formatEstadoPedido(p.estado)}
                  </span>
                  <span className={styles.pedidoTotal}>{formatPrecio(p.total)}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <div className={styles.columnaDerecha}>
          <section className={styles.bloque}>
            <div className={styles.bloqueHeader}>
              <h2 className={styles.bloqueTitulo}>Reservas de los últimos 7 días</h2>
              <span className={styles.totalSemana}>{totalSemana} en total</span>
            </div>
            <div className={styles.grafico} role="img" aria-label={semana.map(d => `${d.etiqueta}: ${d.cantidad}`).join(', ')}>
              {semana.map((d, i) => (
                <div key={i} className={styles.dia} title={`${d.etiqueta}: ${d.cantidad} reserva${d.cantidad !== 1 ? 's' : ''}`}>
                  <span className={styles.diaValor}>{d.cantidad}</span>
                  <div className={styles.diaPista}>
                    {d.cantidad > 0 && (
                      <div className={styles.diaBarra} style={{ height: `${(d.cantidad / maximoSemana) * 100}%` }} />
                    )}
                  </div>
                  <span className={`${styles.diaEtiqueta} ${i === 6 ? styles.diaHoy : ''}`}>{d.etiqueta}</span>
                </div>
              ))}
            </div>
          </section>

          <Link to="/productos" className={`${styles.aviso} ${sinStock > 0 ? styles.avisoActivo : ''}`}>
            <span className={styles.avisoNumero}>{sinStock}</span>
            <span className={styles.avisoTexto}>
              {sinStock === 1 ? 'producto sin stock' : 'productos sin stock'}
            </span>
            <span className={styles.avisoFlecha}>Ver →</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
