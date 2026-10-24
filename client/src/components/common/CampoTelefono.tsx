import { useId } from 'react'
import { TELEFONO_AR_AYUDA } from '@shared'
import styles from './CampoTelefono.module.css'

// Teléfono en dos campos (código de área y número) para checkout, registro y
// Mi cuenta. La página arma el número final con armarTelefonoAR (549…).

interface Props {
  idArea?: string
  area: string
  numero: string
  onCambiarArea: (valor: string) => void
  onCambiarNumero: (valor: string) => void
  error?: string | null
}

export default function CampoTelefono({ idArea, area, numero, onCambiarArea, onCambiarNumero, error }: Props) {
  // La ayuda o el error quedan asociados a los dos campos para lectores de pantalla
  const idMensaje = useId()

  return (
    <div>
      <div className={styles.fila}>
        <div className={`${styles.caja} ${styles.cajaArea}`}>
          <span className={styles.icono} aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z" />
            </svg>
          </span>
          <input
            id={idArea}
            className={`${styles.input} ${error ? styles.inputError : ''}`}
            placeholder="Área"
            aria-label="Código de área, sin 0"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-area-code"
            maxLength={5}
            aria-invalid={error ? true : undefined}
            aria-describedby={idMensaje}
            value={area}
            onChange={e => onCambiarArea(e.target.value.replace(/\D/g, ''))}
          />
        </div>
        <div className={styles.caja}>
          <input
            className={`${styles.input} ${styles.inputSinIcono} ${error ? styles.inputError : ''}`}
            placeholder="Número"
            aria-label="Número, sin 15"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-local"
            maxLength={10}
            aria-invalid={error ? true : undefined}
            aria-describedby={idMensaje}
            value={numero}
            onChange={e => onCambiarNumero(e.target.value.replace(/\D/g, ''))}
          />
        </div>
      </div>
      {error ? (
        <p id={idMensaje} className={styles.error} role="alert">{error}</p>
      ) : (
        <p id={idMensaje} className={styles.ayuda}>{TELEFONO_AR_AYUDA}</p>
      )}
    </div>
  )
}
