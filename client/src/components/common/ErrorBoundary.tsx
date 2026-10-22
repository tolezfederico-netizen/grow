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
    console.error('[Grow client] Error no capturado:', error, errorInfo)
  }

  render() {
    if (this.state.error) {
      return (
        <main className={styles.container}>
          <section className={styles.panel}>
            <h1 className={styles.title}>No se pudo cargar la tienda</h1>
            <p className={styles.message}>
              Ocurrió un error al iniciar la aplicación. Revisá la consola del navegador y las
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
