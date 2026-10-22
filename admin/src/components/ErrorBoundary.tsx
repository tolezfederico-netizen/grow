import { Component, type ErrorInfo, type ReactNode } from 'react'
import styles from './ErrorBoundary.module.css'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = {
    error: null,
  }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Grow admin] Error no capturado:', error, errorInfo)
  }

  render() {
    if (this.state.error) {
      return (
        <main className={styles.container}>
          <section className={styles.panel}>
            <p className={styles.kicker}>Grow admin</p>
            <h1 className={styles.title}>No se pudo cargar el panel</h1>
            <p className={styles.message}>
              Ocurrio un error al iniciar la aplicacion. Revisa la consola del navegador y las
              variables de entorno de Supabase.
            </p>
            <pre className={styles.error}>{this.state.error.message}</pre>
          </section>
        </main>
      )
    }

    return this.props.children
  }
}
