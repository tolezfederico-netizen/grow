import { useState, type FormEvent } from 'react'
import { supabase } from '@shared'
import styles from './PanelForm.module.css'

interface Props {
  panel?: {
    id: string
    titulo: string
    descripcion: string | null
    orden: number | null
    estado: string
  }
  onClose: () => void
  onSave: () => void
}

export default function PanelForm({ panel, onClose, onSave }: Props) {
  const [titulo, setTitulo] = useState(panel?.titulo ?? '')
  const [descripcion, setDescripcion] = useState(panel?.descripcion ?? '')
  const [orden, setOrden] = useState(panel?.orden?.toString() ?? '')
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubiendo(true)
    setError(null)

    const tituloFinal = titulo.trim()
    const descripcionFinal = descripcion.trim() || null
    const ordenFinal = orden.trim() === '' ? null : Number(orden)

    if (panel) {
      const { error: err } = await supabase.from('paneles_categoria').update({
        titulo: tituloFinal,
        descripcion: descripcionFinal,
        orden: ordenFinal,
      }).eq('id', panel.id)
      if (err) {
        if (err.code === '23505') {
          setError(`Ya existe un panel con el orden ${orden}. Quitale ese número al otro panel antes de asignarlo acá.`)
        } else {
          setError(err.message)
        }
        setSubiendo(false)
        return
      }
    } else {
      const { error: err } = await supabase.from('paneles_categoria').insert({
        titulo: tituloFinal,
        descripcion: descripcionFinal,
        orden: ordenFinal,
        estado: 'activo',
      })
      if (err) {
        if (err.code === '23505') {
          setError(`Ya existe un panel con el orden ${orden}. Quitale ese número al otro panel antes de asignarlo acá.`)
        } else {
          setError(err.message)
        }
        setSubiendo(false)
        return
      }
    }

    onSave()
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>{panel ? 'Editar panel' : 'Nuevo panel'}</h2>
          <button type="button" className={styles.btnCerrar} onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.campo}>
            <span className={styles.campoLabel}>Título</span>
            <input className={styles.input} placeholder="Título" value={titulo} onChange={e => setTitulo(e.target.value)} required />
          </label>
          <label className={styles.campo}>
            <span className={styles.campoLabel}>Descripción</span>
            <textarea className={styles.input} placeholder="Descripción (opcional)" value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={2} />
          </label>
          <label className={styles.campo}>
            <span className={styles.campoLabel}>Orden</span>
            <input className={`${styles.input} ${styles.inputOrden}`} type="number" min="1" placeholder="Sin asignar" value={orden} onChange={e => setOrden(e.target.value)} />
            <span className={styles.ayuda}>Opcional. Vacío = el panel queda sin orden asignado.</span>
          </label>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.acciones}>
            <button type="button" className={styles.btnCancelar} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnGuardar} disabled={subiendo}>
              {subiendo ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
