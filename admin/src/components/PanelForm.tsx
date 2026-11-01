import { useState, type FormEvent } from 'react'
import { supabase, MAX_TITULO_SECCION } from '@shared'
import styles from './PanelForm.module.css'

interface Props {
  panel?: {
    id: string
    titulo: string
    descripcion: string | null
    estado: string
  }
  /** Una sección nueva va al final de la lista */
  siguienteOrden: number
  onClose: () => void
  onSave: () => void
}

export default function PanelForm({ panel, siguienteOrden, onClose, onSave }: Props) {
  const [titulo, setTitulo] = useState(panel?.titulo ?? '')
  const [descripcion, setDescripcion] = useState(panel?.descripcion ?? '')
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubiendo(true)
    setError(null)

    const datos = { titulo: titulo.trim(), descripcion: descripcion.trim() || null }
    const { error: err } = panel
      ? await supabase.from('paneles_categoria').update(datos).eq('id', panel.id)
      : await supabase.from('paneles_categoria').insert({ ...datos, orden: siguienteOrden, estado: 'activo' })

    if (err) {
      setError(err.message)
      setSubiendo(false)
      return
    }

    onSave()
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>{panel ? 'Editar sección' : 'Nueva sección'}</h2>
          <button type="button" className={styles.btnCerrar} onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.campo}>
            <span className={styles.campoLabel}>Título</span>
            <input className={styles.input} placeholder="Título" value={titulo} maxLength={MAX_TITULO_SECCION} onChange={e => setTitulo(e.target.value)} required />
            <span className={styles.ayuda}>Es el nombre que se ve en la barra de la tienda ({titulo.length}/{MAX_TITULO_SECCION} caracteres).</span>
          </label>
          <label className={styles.campo}>
            <span className={styles.campoLabel}>Descripción</span>
            <textarea className={styles.input} placeholder="Descripción (opcional)" value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={2} />
            <span className={styles.ayuda}>Se muestra al abrir la sección en el menú.</span>
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
