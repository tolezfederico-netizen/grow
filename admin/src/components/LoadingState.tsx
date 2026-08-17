import styles from './LoadingState.module.css'

export default function LoadingState({ mensaje = 'Cargando…' }: { mensaje?: string }) {
  return <p className={styles.loading}>{mensaje}</p>
}
