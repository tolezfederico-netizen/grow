import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute() {
  const { session, esAdmin, loading, logout } = useAuth()

  if (loading) return null

  if (!session) return <Navigate to="/login" replace />

  if (!esAdmin) {
    void logout()
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
