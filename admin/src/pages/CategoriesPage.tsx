import { useEffect, useState, useCallback, type FormEvent } from 'react'
import { supabase, mapearCategoria } from '@shared'
import type { Categoria } from '@shared'
import LoadingState from '../components/LoadingState'
import { useConfirm } from '../context/ConfirmContext'
import ErrorState from '../components/ErrorState'
import styles from './CategoriesPage.module.css'

export default function CategoriesPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editando, setEditando] = useState<Categoria | null>(null)
  const [nombreEdit, setNombreEdit] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<'' | 'activa' | 'pausada'>('')
  const [modoAccion, setModoAccion] = useState<'eliminar' | 'pausar' | null>(null)
  const [seleccionados, setSeleccionados] = useState<string[]>([])
  const [productosPorCategoria, setProductosPorCategoria] = useState<Record<string, number>>({})
  const [creandoCategoria, setCreandoCategoria] = useState(false)
  const [nombreNuevaCategoria, setNombreNuevaCategoria] = useState('')
  const [creandoSubiendo, setCreandoSubiendo] = useState(false)
  const [errorCrear, setErrorCrear] = useState<string | null>(null)
  const { confirm, notify, toast } = useConfirm()

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [resCategorias, resRelaciones] = await Promise.all([
      supabase.from('categorias').select('*').order('nombre'),
      supabase.from('producto_categorias').select('categoria_id'),
    ])
    const err = resCategorias.error ?? resRelaciones.error
    if (err) { setError(err.message); setLoading(false); return }
    // Cantidad de productos asignados a cada categoría
    const conteo: Record<string, number> = {}
    ;(resRelaciones.data ?? []).forEach(r => { conteo[r.categoria_id] = (conteo[r.categoria_id] ?? 0) + 1 })
    setCategorias((resCategorias.data ?? []).map(mapearCategoria))
    setProductosPorCategoria(conteo)
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  function abrirCrear() {
    setNombreNuevaCategoria('')
    setErrorCrear(null)
    setCreandoCategoria(true)
  }

  async function confirmarCrear(e: FormEvent) {
    e.preventDefault()
    const nombre = nombreNuevaCategoria.trim()
    if (!nombre) { setErrorCrear('El nombre no puede estar vacío.'); return }
    setCreandoSubiendo(true)
    setErrorCrear(null)
    const { error: err } = await supabase.from('categorias').insert({ nombre })
    if (err) { setErrorCrear(err.message); setCreandoSubiendo(false); return }
    setCreandoCategoria(false)
    setCreandoSubiendo(false)
    cargar()
  }

  function iniciarEdicion(c: Categoria) {
    setEditando(c)
    setNombreEdit(c.nombre)
  }

  async function guardarEdicion() {
    if (!editando || !nombreEdit.trim()) return
    const { error: err } = await supabase.from('categorias').update({ nombre: nombreEdit.trim() }).eq('id', editando.id)
    if (err) { await notify(err.message, { titulo: 'Error' }); return }
    setEditando(null)
    cargar()
  }

  async function toggleEstado(c: Categoria) {
    const nuevo = c.estado === 'activa' ? 'pausada' : 'activa'
    const mensaje = c.estado === 'activa'
      ? `¿Pausar la categoría «${c.nombre}»? Dejará de mostrarse en el sitio.`
      : `¿Reactivar la categoría «${c.nombre}»? Volverá a mostrarse en el sitio.`
    const confirmado = await confirm(mensaje, {
      titulo: c.estado === 'activa' ? 'Pausar categoría' : 'Reactivar categoría',
      textoConfirmar: c.estado === 'activa' ? 'Pausar' : 'Reactivar',
    })
    if (!confirmado) return
    const { error: err } = await supabase.from('categorias').update({ estado: nuevo }).eq('id', c.id)
    if (err) { await notify(err.message, { titulo: 'Error' }); return }
    toast(c.estado === 'activa' ? 'Categoría pausada.' : 'Categoría reactivada.')
    cargar()
  }

  function toggleSeleccionado(id: string) {
    setSeleccionados(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    )
  }

  async function pausarProductosSinCategoriaActiva(productoIdsAfectados: string[]): Promise<number> {
    if (productoIdsAfectados.length === 0) return 0

    const { data: relRows, error: errRel } = await supabase
      .from('producto_categorias')
      .select('producto_id, categorias(estado)')
      .in('producto_id', productoIdsAfectados)

    if (errRel) return 0

    const tieneActivaPorProducto = new Map<string, boolean>()
    productoIdsAfectados.forEach(id => tieneActivaPorProducto.set(id, false))

    ;(relRows ?? []).forEach(r => {
      if (r.categorias?.estado === 'activa') {
        tieneActivaPorProducto.set(r.producto_id, true)
      }
    })

    const sinCategoriaActiva = productoIdsAfectados.filter(id => !tieneActivaPorProducto.get(id))
    if (sinCategoriaActiva.length === 0) return 0

    const { data: productosActuales } = await supabase
      .from('productos')
      .select('id, estado')
      .in('id', sinCategoriaActiva)

    const idsAPausar = (productosActuales ?? [])
      .filter(p => p.estado === 'disponible')
      .map(p => p.id)

    if (idsAPausar.length === 0) return 0

    await supabase.from('productos').update({ estado: 'pausado' }).in('id', idsAPausar)
    return idsAPausar.length
  }

  async function eliminarSeleccionados() {
    const confirmado = await confirm(`¿Eliminar ${seleccionados.length} categoría(s)? Se desvincularán de todos los productos que las tienen asignadas.`, { titulo: 'Eliminar categorías', textoConfirmar: 'Eliminar' })
    if (!confirmado) return

    const { data: relAntes } = await supabase
      .from('producto_categorias')
      .select('producto_id')
      .in('categoria_id', seleccionados)
    const productosAfectados = [...new Set((relAntes ?? []).map(r => r.producto_id))]

    const { error: err } = await supabase.from('categorias').delete().in('id', seleccionados)
    if (err) {
      if ((err.code === '23503' || err.message.includes('foreign key')) && err.message.includes('paneles_categoria_items')) {
        await notify('Una o más categorías seleccionadas están siendo usadas en un panel de navegación y no pueden eliminarse. Quitalas del panel primero desde Paneles.', { titulo: 'No se puede eliminar' })
      } else {
        await notify(err.message, { titulo: 'Error' })
      }
      return
    }

    const cantPausados = await pausarProductosSinCategoriaActiva(productosAfectados)

    setSeleccionados([])
    setModoAccion(null)
    cargar()

    if (cantPausados > 0) {
      setTimeout(() => toast(`Se pausaron también ${cantPausados} producto${cantPausados > 1 ? 's' : ''} que quedaron sin categoría activa.`), 100)
    }
  }

  async function pausarSeleccionados() {
    const cantidad = seleccionados.length
    const confirmado = await confirm(
      `¿Pausar ${cantidad} categoría${cantidad > 1 ? 's' : ''}? Los productos que queden sin ninguna categoría activa también se pausarán automáticamente.`,
      { titulo: 'Pausar categorías', textoConfirmar: 'Pausar' }
    )
    if (!confirmado) return

    const { data: relAntes } = await supabase
      .from('producto_categorias')
      .select('producto_id')
      .in('categoria_id', seleccionados)
    const productosAfectados = [...new Set((relAntes ?? []).map(r => r.producto_id))]

    const { error: err } = await supabase.from('categorias').update({ estado: 'pausada' }).in('id', seleccionados)
    if (err) { await notify(err.message, { titulo: 'Error' }); return }

    const cantPausados = await pausarProductosSinCategoriaActiva(productosAfectados)

    setSeleccionados([])
    setModoAccion(null)
    cargar()

    toast(`${cantidad} categoría${cantidad > 1 ? 's' : ''} pausada${cantidad > 1 ? 's' : ''}.`)

    if (cantPausados > 0) {
      setTimeout(() => toast(`Se pausaron también ${cantPausados} producto${cantPausados > 1 ? 's' : ''} que quedaron sin categoría activa.`), 100)
    }
  }

  const totalCategorias = categorias.length
  const activasCount = categorias.filter(c => c.estado === 'activa').length
  const pausadasCount = categorias.filter(c => c.estado === 'pausada').length

  const categoriasFiltradas = categorias.filter(c => {
    if (busqueda.trim() !== '' && !c.nombre.toLowerCase().includes(busqueda.trim().toLowerCase())) return false
    if (filtroEstado !== '' && c.estado !== filtroEstado) return false
    return true
  })

  const todasVisiblesSeleccionadas = categoriasFiltradas.length > 0 && categoriasFiltradas.every(c => seleccionados.includes(c.id))

  const baseTotal = filtroEstado === '' ? categorias.length : (filtroEstado === 'activa' ? activasCount : pausadasCount)

  const chipsEstado: { valor: '' | 'activa' | 'pausada'; texto: string; cantidad: number; clase: string }[] = [
    { valor: '', texto: 'Todas', cantidad: totalCategorias, clase: styles.chipTodas },
    { valor: 'activa', texto: 'Activas', cantidad: activasCount, clase: styles.chipActivas },
    { valor: 'pausada', texto: 'Pausadas', cantidad: pausadasCount, clase: styles.chipPausadas },
  ]

  function cambiarModo(modo: 'eliminar' | 'pausar') {
    setSeleccionados([])
    setModoAccion(prev => (prev === modo ? null : modo))
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState mensaje={error} onReintentar={cargar} />

  return (
    <div className={styles.page}>
      <div className={styles.barra}>
        <div className={styles.filaBarra}>
          <input
            className={styles.inputBusqueda}
            type="text"
            placeholder="Buscar por nombre..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          <button className={styles.btnNuevo} onClick={abrirCrear}>+ Nueva</button>
        </div>
        <div className={styles.filaBarra}>
          <div className={styles.filtroBotones}>
            {chipsEstado.map(c => (
              <button
                key={c.valor || 'todas'}
                className={`${styles.btnFiltroEstado} ${c.clase} ${filtroEstado === c.valor ? styles.btnFiltroEstadoActivo : ''}`}
                onClick={() => setFiltroEstado(c.valor)}
              >
                {c.texto} <span className={styles.contadorEstado}>{c.cantidad}</span>
              </button>
            ))}
          </div>
          <div className={styles.modos}>
            <button
              className={`${styles.btnModo} ${modoAccion === 'pausar' ? styles.btnModoActivo : ''}`}
              onClick={() => cambiarModo('pausar')}
            >
              {modoAccion === 'pausar' ? 'Cancelar' : 'Pausar'}
            </button>
            <button
              className={`${styles.btnModo} ${modoAccion === 'eliminar' ? styles.btnModoActivo : ''}`}
              onClick={() => cambiarModo('eliminar')}
            >
              {modoAccion === 'eliminar' ? 'Cancelar' : 'Eliminar'}
            </button>
          </div>
        </div>
      </div>

      {modoAccion !== null && (
        <div className={styles.barraSeleccion}>
          <label className={styles.selectAllLabel}>
            <input
              type="checkbox"
              checked={todasVisiblesSeleccionadas}
              onChange={() => {
                if (todasVisiblesSeleccionadas) {
                  setSeleccionados([])
                } else {
                  setSeleccionados(categoriasFiltradas.map(c => c.id))
                }
              }}
            />
            Seleccionar todas
          </label>
          {seleccionados.length > 0 ? (
            <>
              <span className={styles.seleccionadosInfo}>{seleccionados.length} categoría{seleccionados.length > 1 ? 's' : ''} seleccionada{seleccionados.length > 1 ? 's' : ''}</span>
              <button
                className={`${styles.btnConfirmarAccion} ${modoAccion === 'eliminar' ? styles.btnConfirmarEliminar : styles.btnConfirmarPausar}`}
                onClick={modoAccion === 'eliminar' ? eliminarSeleccionados : pausarSeleccionados}
              >
                {modoAccion === 'eliminar' ? 'Eliminar' : 'Pausar'} {seleccionados.length} categoría{seleccionados.length > 1 ? 's' : ''}
              </button>
            </>
          ) : (
            <span className={styles.seleccionadosInfo}>Tocá las categorías para seleccionarlas.</span>
          )}
        </div>
      )}

      {categoriasFiltradas.length === 0 ? (
        <p className={styles.vacio}>No se encontraron categorías.</p>
      ) : (
        <>
          {busqueda.trim() !== '' && (
            <p className={styles.resultadosInfo}>
              {categoriasFiltradas.length} de {baseTotal} categorías
            </p>
          )}
          <div className={styles.grid}>
            {categoriasFiltradas.map(c => {
              const cantidad = productosPorCategoria[c.id] ?? 0
              const seleccionada = seleccionados.includes(c.id)
              return (
                <div
                  key={c.id}
                  className={`${styles.item} ${c.estado === 'pausada' ? styles.itemPausada : ''} ${seleccionada ? styles.itemSeleccionado : ''} ${modoAccion !== null ? styles.itemSeleccionable : ''}`}
                  onClick={modoAccion !== null ? () => toggleSeleccionado(c.id) : undefined}
                >
                  {modoAccion !== null && (
                    <label className={styles.checkboxSeleccion} onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={seleccionada}
                        onChange={() => toggleSeleccionado(c.id)}
                        aria-label={`Seleccionar ${c.nombre}`}
                      />
                      <span className={styles.checkmarkCirculo} aria-hidden="true" />
                    </label>
                  )}
                  <span
                    className={`${styles.contadorProductos} ${cantidad === 0 ? styles.contadorVacio : ''}`}
                    aria-hidden="true"
                  >
                    {cantidad}
                  </span>
                  <div className={styles.itemDatos}>
                    <span className={styles.nombreTexto}>{c.nombre}</span>
                    <span className={`${styles.cantidadProductos} ${cantidad === 0 ? styles.sinProductos : ''}`}>
                      {cantidad === 0 ? 'Sin productos' : `${cantidad} producto${cantidad !== 1 ? 's' : ''}`}
                    </span>
                  </div>
                  {c.estado === 'pausada' && <span className={styles.badgePausada}>Pausada</span>}
                  <div className={styles.acciones}>
                    {c.estado === 'pausada' && (
                      <button className={styles.btnAccion} onClick={() => toggleEstado(c)} disabled={modoAccion !== null}>
                        Reactivar
                      </button>
                    )}
                    <button className={styles.btnAccion} onClick={() => iniciarEdicion(c)} disabled={modoAccion !== null}>Editar</button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Edición del nombre: mismo modal que "Nueva categoría" */}
      {editando && (
        <div className={styles.overlayModal} onClick={() => setEditando(null)}>
          <div className={styles.modalCrear} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Editar categoría</h2>
              <button type="button" className={styles.btnCerrarModal} onClick={() => setEditando(null)} aria-label="Cerrar">✕</button>
            </div>
            <form
              onSubmit={e => { e.preventDefault(); guardarEdicion() }}
              onKeyDown={e => { if (e.key === 'Escape') setEditando(null) }}
              className={styles.modalForm}
            >
              <input
                className={styles.modalInput}
                placeholder="Nombre de la categoría"
                value={nombreEdit}
                onChange={e => setNombreEdit(e.target.value)}
                autoFocus
                required
              />
              <div className={styles.modalAcciones}>
                <button type="button" className={styles.btnCancelarModal} onClick={() => setEditando(null)}>Cancelar</button>
                <button type="submit" className={styles.btnGuardarModal} disabled={!nombreEdit.trim()}>
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {creandoCategoria && (
        <div className={styles.overlayModal} onClick={() => setCreandoCategoria(false)}>
          <div className={styles.modalCrear} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Nueva categoría</h2>
              <button type="button" className={styles.btnCerrarModal} onClick={() => setCreandoCategoria(false)} aria-label="Cerrar">✕</button>
            </div>
            <form onSubmit={confirmarCrear} className={styles.modalForm}>
              <input
                className={styles.modalInput}
                placeholder="Nombre de la categoría"
                value={nombreNuevaCategoria}
                onChange={e => setNombreNuevaCategoria(e.target.value)}
                autoFocus
                required
              />
              {errorCrear && <p className={styles.error}>{errorCrear}</p>}
              <div className={styles.modalAcciones}>
                <button type="button" className={styles.btnCancelarModal} onClick={() => setCreandoCategoria(false)}>Cancelar</button>
                <button type="submit" className={styles.btnGuardarModal} disabled={creandoSubiendo}>
                  {creandoSubiendo ? 'Creando…' : 'Crear categoría'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
