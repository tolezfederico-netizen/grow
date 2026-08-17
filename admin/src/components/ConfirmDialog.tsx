import { useEffect, useRef } from 'react'
import { useModalAccesible } from '../hooks/useModalAccesible'
import styles from './ConfirmDialog.module.css'

interface Props {
  titulo?: string
  mensaje: string
  tipo: 'confirm' | 'notify' | 'toast'
  textoConfirmar?: string
  textoCancelar?: string
  duracionMs?: number
  onConfirmar: () => void
  onCancelar: () => void
}

export default function ConfirmDialog({
  titulo,
  mensaje,
  tipo,
  textoConfirmar,
  textoCancelar,
  duracionMs = 2800,
  onConfirmar,
  onCancelar,
}: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const modalActivo = tipo !== 'toast'
  const cerrarConEscape = tipo === 'confirm' ? onCancelar : onConfirmar
  const modalRef = useModalAccesible<HTMLDivElement>(modalActivo, cerrarConEscape)

  useEffect(() => {
    if (tipo !== 'toast') return

    timerRef.current = setTimeout(() => {
      onConfirmar()
    }, duracionMs)

    return () => clearTimeout(timerRef.current)
  }, [tipo, duracionMs, onConfirmar])

  function handleOverlayClick() {
    if (tipo === 'toast') {
      clearTimeout(timerRef.current)
      onConfirmar()
    } else if (tipo === 'confirm') {
      onCancelar()
    } else {
      onConfirmar()
    }
  }

  if (tipo === 'toast') {
    return (
      <div className={styles.overlayToast} onClick={handleOverlayClick}>
        <div className={styles.toast} onClick={e => e.stopPropagation()}>
          <div className={styles.toastAcento} />
          <div className={styles.toastBody}>
            {titulo && <h3 className={styles.titulo}>{titulo}</h3>}
            <p className={styles.mensaje}>{mensaje}</p>
          </div>
        </div>
      </div>
    )
  }

  const tituloFinal = titulo ?? (tipo === 'confirm' ? 'Confirmar acción' : 'Aviso')

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div
        ref={modalRef}
        className={styles.modal}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
      >
        <h3 className={styles.titulo}>{tituloFinal}</h3>
        <p className={styles.mensaje}>{mensaje}</p>
        <div className={styles.acciones}>
          {tipo === 'confirm' && (
            <button className={styles.btnCancelar} onClick={onCancelar}>
              {textoCancelar ?? 'Cancelar'}
            </button>
          )}
          <button className={tipo === 'confirm' ? styles.btnConfirmar : styles.btnAceptar} onClick={onConfirmar}>
            {tipo === 'confirm' ? (textoConfirmar ?? 'Confirmar') : (textoConfirmar ?? 'Aceptar')}
          </button>
        </div>
      </div>
    </div>
  )
}
