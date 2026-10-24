import { useState, useEffect, type FormEvent } from 'react'
import { supabase, BUCKET_PRODUCTOS, IMAGEN_PRODUCTO, IMAGEN_PRODUCTO_CACHE_SEGUNDOS, rutaEnBucket } from '@shared'
import type { Categoria } from '@shared'
import { comprimirImagen } from '../utils/comprimirImagen'
import styles from './ProductForm.module.css'

interface VarianteLocal {
  id?: string
  nombre_variante: string
  precio: string
  estado: 'disponible' | 'pausado'
}

/** Comprime y sube una versión de la imagen; devuelve su ruta en el bucket y su URL pública. */
async function subirVersion(archivo: File, ruta: string, opciones: { ladoMaxPx: number; pesoMaxKB: number }) {
  const { blob, extension } = await comprimirImagen(archivo, opciones)
  const rutaFinal = `${ruta}.${extension}`
  const { error } = await supabase.storage
    .from(BUCKET_PRODUCTOS)
    .upload(rutaFinal, blob, { cacheControl: String(IMAGEN_PRODUCTO_CACHE_SEGUNDOS), contentType: blob.type })
  if (error) throw error
  const { data: { publicUrl } } = supabase.storage.from(BUCKET_PRODUCTOS).getPublicUrl(rutaFinal)
  return { ruta: rutaFinal, url: publicUrl }
}

/** Borra archivos del bucket sin frenar el guardado: si falla, el archivo queda huérfano y se avisa en consola. */
async function borrarArchivos(rutas: Array<string | null>) {
  const validas = rutas.filter((r): r is string => !!r)
  if (validas.length === 0) return
  const { error } = await supabase.storage.from(BUCKET_PRODUCTOS).remove(validas)
  if (error) console.warn('No se pudieron borrar imágenes del bucket:', error.message)
}

interface Props {
  producto?: {
    id: string
    nombre: string
    descripcion: string | null
    especificaciones: string | null
    imagen_url: string | null
    imagen_miniatura_url: string | null
    tiene_variantes: boolean
    precio_base: number | null
    estado: string
  }
  categorias: Categoria[]
  categoriaIdsActuales: string[]
  onClose: () => void
  onSave: () => void
}

export default function ProductForm({ producto, categorias, categoriaIdsActuales, onClose, onSave }: Props) {
  const [nombre, setNombre] = useState(producto?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(producto?.descripcion ?? '')
  const [especificaciones, setEspecificaciones] = useState(producto?.especificaciones ?? '')
  const [tieneVariantes, setTieneVariantes] = useState(producto?.tiene_variantes ?? false)
  const [precioBase, setPrecioBase] = useState(producto?.precio_base?.toString() ?? '')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [preview, setPreview] = useState(producto?.imagen_url ?? '')
  const [variantes, setVariantes] = useState<VarianteLocal[]>([])
  const [categoriaIds, setCategoriaIds] = useState<string[]>(categoriaIdsActuales)
  const [busquedaCategoria, setBusquedaCategoria] = useState('')
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (producto?.tiene_variantes) {
      supabase
        .from('producto_variantes')
        .select('*')
        .eq('producto_id', producto.id)
        .then(({ data }) => {
          if (data) setVariantes(data.map(v => ({ id: v.id, nombre_variante: v.nombre_variante, precio: v.precio.toString(), estado: v.estado as 'disponible' | 'pausado' })))
        })
    }
  }, [producto])

  function agregarVariante() {
    setVariantes([...variantes, { nombre_variante: '', precio: '', estado: 'disponible' }])
  }

  function actualizarVariante(i: number, campo: 'nombre_variante' | 'precio', valor: string) {
    const copia = [...variantes]
    copia[i] = { ...copia[i], [campo]: valor }
    setVariantes(copia)
  }

  function eliminarVariante(i: number) {
    setVariantes(variantes.filter((_, idx) => idx !== i))
  }

  function toggleEstadoVariante(i: number) {
    const copia = [...variantes]
    copia[i] = { ...copia[i], estado: copia[i].estado === 'disponible' ? 'pausado' : 'disponible' }
    setVariantes(copia)
  }

  function toggleCategoria(id: string) {
    setCategoriaIds(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (categoriaIds.length === 0) {
      setError('Debés seleccionar al menos una categoría.')
      return
    }

    setSubiendo(true)

    try {
      let imagen_url = producto?.imagen_url ?? null
      let imagen_miniatura_url = producto?.imagen_miniatura_url ?? null
      let rutasNuevas: string[] = []

      // Imagen nueva: se comprime en dos versiones WebP (grande y miniatura)
      // con el mismo nombre base y se suben con caché de un año.
      if (archivo) {
        const base = crypto.randomUUID()
        try {
          const grande = await subirVersion(archivo, base, IMAGEN_PRODUCTO.grande)
          rutasNuevas = [grande.ruta]
          const miniatura = await subirVersion(archivo, `${base}-min`, IMAGEN_PRODUCTO.miniatura)
          rutasNuevas.push(miniatura.ruta)
          imagen_url = grande.url
          imagen_miniatura_url = miniatura.url
        } catch (errImg) {
          await borrarArchivos(rutasNuevas)
          const detalle = errImg instanceof Error ? errImg.message : ''
          setError(`No se pudo procesar o subir la imagen. ${detalle}`.trim())
          setSubiendo(false)
          return
        }
      }

      // Producto, variantes y categorías se guardan en una sola transacción.
      // Las variantes viajan con su id: la base actualiza las existentes (sin
      // cambiarles el id), crea las nuevas y borra las que se quitaron.
      const { error: err } = await supabase.rpc('guardar_producto', {
        p_datos: {
          nombre,
          descripcion: descripcion || null,
          especificaciones: especificaciones || null,
          imagen_url,
          imagen_miniatura_url,
          tiene_variantes: tieneVariantes,
          precio_base: tieneVariantes ? null : Math.round(Number(precioBase)),
        },
        p_variantes: tieneVariantes
          ? variantes.map(v => ({ id: v.id ?? null, nombre_variante: v.nombre_variante, precio: Math.round(Number(v.precio)), estado: v.estado }))
          : [],
        p_categoria_ids: categoriaIds,
        p_producto_id: producto?.id,
      })
      if (err) {
        // El producto no se guardó: las imágenes recién subidas quedarían huérfanas
        await borrarArchivos(rutasNuevas)
        setError(err.message)
        setSubiendo(false)
        return
      }

      // Imagen reemplazada: se borran las versiones anteriores del bucket
      if (archivo && producto) {
        await borrarArchivos([
          rutaEnBucket(producto.imagen_url, BUCKET_PRODUCTOS),
          rutaEnBucket(producto.imagen_miniatura_url, BUCKET_PRODUCTOS),
        ])
      }

      onSave()
    } catch {
      setError('Error inesperado.')
      setSubiendo(false)
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>{producto ? 'Editar producto' : 'Nuevo producto'}</h2>
          <button type="button" className={styles.btnCerrar} onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.cuerpo}>
            <div className={styles.columnaImagen}>
              <div className={styles.imagenCaja}>
                {preview ? (
                  <img src={preview} alt="" className={styles.previs} />
                ) : (
                  <span className={styles.sinImagen}>Sin imagen</span>
                )}
              </div>
              <label className={styles.btnArchivo}>
                <input type="file" accept="image/*" className={styles.inputArchivo} onChange={e => { const f = e.target.files?.[0]; if (f) { setArchivo(f); setPreview(URL.createObjectURL(f)) } }} />
                {preview ? 'Cambiar imagen' : 'Subir imagen'}
              </label>

              <div className={styles.bloquePrecio}>
                <p className={styles.catsLabel}>Precio</p>
                <label className={styles.check}>
                  <input type="checkbox" checked={tieneVariantes} onChange={e => { setTieneVariantes(e.target.checked); if (e.target.checked) { setPrecioBase('') } else { setVariantes([]) } }} />
                  Tiene variantes
                </label>
                {!tieneVariantes ? (
                  <input className={`${styles.input} ${styles.inputPrecio}`} type="text" inputMode="numeric" placeholder="Precio base" value={precioBase ? new Intl.NumberFormat('es-AR').format(Number(precioBase)) : ''} onChange={e => setPrecioBase(e.target.value.replace(/\D/g, ''))} required />
                ) : (
                  <p className={styles.ayuda}>Cada variante tiene su propio precio.</p>
                )}
              </div>
            </div>

            <div className={styles.columnaDatos}>
              <div className={styles.campo}>
                <p className={styles.catsLabel}>Nombre</p>
                <input className={styles.input} placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={40} required />
                <span className={styles.contador}>{nombre.length}/40</span>
              </div>
              <div className={styles.campo}>
                <p className={styles.catsLabel}>Descripción</p>
                <input className={styles.input} placeholder="Descripción" value={descripcion} onChange={e => setDescripcion(e.target.value)} maxLength={20} />
                <span className={styles.contador}>{descripcion.length}/20</span>
              </div>
              <div className={styles.campo}>
                <p className={styles.catsLabel}>Especificaciones</p>
                <textarea className={styles.input} placeholder="Especificaciones (opcional) — información detallada del producto" value={especificaciones} onChange={e => setEspecificaciones(e.target.value)} rows={7} />
              </div>

              {tieneVariantes && (
                <div className={styles.campo}>
                  <p className={styles.catsLabel}>Variantes</p>
                  <div className={styles.variantes}>
                    {variantes.map((v, i) => (
                      <div key={i} className={`${styles.varRow} ${v.estado === 'pausado' ? styles.pausado : ''}`}>
                        <input className={styles.input} placeholder="Nombre (ej: 10L)" value={v.nombre_variante} onChange={e => actualizarVariante(i, 'nombre_variante', e.target.value)} />
                        <input className={`${styles.input} ${styles.inputPrecio}`} type="text" inputMode="numeric" placeholder="Precio" value={v.precio ? new Intl.NumberFormat('es-AR').format(Number(v.precio)) : ''} onChange={e => actualizarVariante(i, 'precio', e.target.value.replace(/\D/g, ''))} />
                        <button type="button" className={styles.btnToggle} onClick={() => toggleEstadoVariante(i)}>
                          {v.estado === 'disponible' ? 'Pausar' : 'Reactivar'}
                        </button>
                        <button type="button" className={styles.btnEliminar} onClick={() => eliminarVariante(i)} aria-label="Quitar variante">✕</button>
                      </div>
                    ))}
                    <button type="button" className={styles.btnAgregar} onClick={agregarVariante}>+ Agregar variante</button>
                  </div>
                </div>
              )}

              <div className={styles.cats}>
                <div className={styles.catsHeader}>
                  <p className={styles.catsLabel}>Categorías</p>
                  <span className={styles.catsContador}>{categoriaIds.length} seleccionada{categoriaIds.length !== 1 ? 's' : ''}</span>
                </div>
                <input
                  className={styles.inputBusquedaCategoria}
                  type="text"
                  placeholder="Buscar categoría..."
                  value={busquedaCategoria}
                  onChange={e => setBusquedaCategoria(e.target.value)}
                />
                <div className={styles.catsLista}>
                  {categorias.filter(c => c.nombre.toLowerCase().includes(busquedaCategoria.trim().toLowerCase())).length === 0 ? (
                    <p className={styles.sinResultadosCategoria}>No se encontraron categorías.</p>
                  ) : (
                    categorias
                      .filter(c => c.nombre.toLowerCase().includes(busquedaCategoria.trim().toLowerCase()))
                      .map(c => (
                        <label key={c.id} className={styles.catCheck}>
                          <input type="checkbox" checked={categoriaIds.includes(c.id)} onChange={() => toggleCategoria(c.id)} />
                          {c.nombre}
                        </label>
                      ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.pie}>
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.acciones}>
              <button type="button" className={styles.btnCancelar} onClick={onClose}>Cancelar</button>
              <button type="submit" className={styles.btnGuardar} disabled={subiendo}>{subiendo ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
