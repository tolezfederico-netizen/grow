import { Component, type ErrorInfo, type ReactNode } from 'react'

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
        <main style={styles.container}>
          <section style={styles.panel}>
            <p style={styles.kicker}>Grow admin</p>
            <h1 style={styles.title}>No se pudo cargar el panel</h1>
            <p style={styles.message}>
              Ocurrio un error al iniciar la aplicacion. Revisa la consola del navegador y las
              variables de entorno de Supabase.
            </p>
            <pre style={styles.error}>{this.state.error.message}</pre>
          </section>
        </main>
      )
    }

    return this.props.children
  }
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: '24px',
    background: '#f8fafc',
    color: '#111827',
  },
  panel: {
    width: 'min(100%, 560px)',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '24px',
    background: '#ffffff',
    boxShadow: '0 16px 40px rgba(15, 23, 42, 0.08)',
  },
  kicker: {
    marginBottom: '8px',
    color: '#4f46e5',
    fontSize: '14px',
    fontWeight: 700,
  },
  title: {
    marginBottom: '12px',
    fontSize: '24px',
    lineHeight: 1.2,
  },
  message: {
    marginBottom: '16px',
    color: '#4b5563',
  },
  error: {
    overflowX: 'auto',
    whiteSpace: 'pre-wrap',
    borderRadius: '6px',
    padding: '12px',
    background: '#111827',
    color: '#f9fafb',
    fontSize: '13px',
  },
} satisfies Record<string, React.CSSProperties>
