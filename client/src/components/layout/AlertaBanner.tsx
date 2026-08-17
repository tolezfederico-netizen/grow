import type { ConfiguracionTienda } from '@shared'
import styles from './AlertaBanner.module.css'

interface AlertaBannerProps {
  config: ConfiguracionTienda | null
}

export default function AlertaBanner({ config }: AlertaBannerProps) {
  const vencido = config?.mensaje_alerta_expira_en
    ? new Date(config.mensaje_alerta_expira_en) <= new Date()
    : false

  if (!config || !config.mensaje_alerta?.trim() || vencido) {
    return null
  }

  return (
    <div className={styles.container}>
      <div className={styles.textWrapper}>
        <span className={styles.text}>{config.mensaje_alerta}</span>
      </div>
    </div>
  )
}
