import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

// Login y registro: con una sesión abierta no tienen sentido, se vuelve al inicio.
export default function SoloInvitadoRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '2rem' }}>
        <p>Cargando…</p>
      </div>
    )
  }

  if (session) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
