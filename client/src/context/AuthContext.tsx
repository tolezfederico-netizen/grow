import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@shared'
import type { Session } from '@supabase/supabase-js'
import { clearMiCuentaCache } from '../pages/miCuentaCache'

interface DatosRegistro {
  nombre: string
  apellido: string
  telefono: string
}

interface AuthValue {
  session: Session | null
  loading: boolean
  login: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string, datos: DatosRegistro) => Promise<string | null>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session)
      })
      .catch(error => {
        console.error('[Grow client] No se pudo obtener la sesion:', error)
        setSession(null)
      })
      .finally(() => {
        setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function login(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error?.message ?? null
  }

  async function signUp(email: string, password: string, datos: DatosRegistro): Promise<string | null> {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // El link del email de confirmación vuelve al mismo sitio donde se
        // registró (tienda publicada o localhost); debe estar en Redirect URLs.
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          nombre: datos.nombre,
          apellido: datos.apellido,
          telefono: datos.telefono,
        },
      },
    })
    return error?.message ?? null
  }

  async function logout() {
    await supabase.auth.signOut()
    clearMiCuentaCache()
  }

  return (
    <AuthContext.Provider value={{ session, loading, login, signUp, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
