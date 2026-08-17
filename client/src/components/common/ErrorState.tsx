import styles from './ErrorState.module.css'

interface Props {
  mensaje?: string
  onReintentar?: () => void
}

export default function ErrorState({
  mensaje = 'Ocurrió un error al cargar los datos.',
  onReintentar,
}: Props) {
  return (
    <div className={styles.error}>
      <p>{mensaje}</p>
      {onReintentar && (
        <button className={styles.boton} onClick={onReintentar}>
          Reintentar
        </button>
      )}
    </div>
  )
}
