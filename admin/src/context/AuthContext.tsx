import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@shared";
import type { Session } from "@supabase/supabase-js";

interface AuthValue {
  session: Session | null;
  esAdmin: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [esAdmin, setEsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cargaInicialHecha = false;
    // Usuario cuyo is_admin() ya se resolvió. Un refresh de token o volver a
    // la pestaña emiten eventos con el mismo usuario: no hace falta re-verificar.
    let usuarioVerificado: string | null = null;

    async function verificarAdmin(session: Session | null) {
      usuarioVerificado = session?.user.id ?? null;
      if (!session) {
        setEsAdmin(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc("is_admin");
        if (error) throw error;
        setEsAdmin(data === true);
      } catch (error) {
        console.error("[Grow admin] No se pudo verificar is_admin:", error);
        setEsAdmin(false);
      }
    }

    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        setSession(session);
        await verificarAdmin(session);
      })
      .catch((error) => {
        console.error("[Grow admin] No se pudo obtener la sesion:", error);
        setSession(null);
        setEsAdmin(false);
      })
      .finally(() => {
        cargaInicialHecha = true;
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!cargaInicialHecha) return;
      if ((session?.user.id ?? null) === usuarioVerificado) return;

      // Mientras se resuelve is_admin() para esta sesión nueva (ej. tras un
      // login), loading vuelve a true. Esto evita que ProtectedRoute lea un
      // esAdmin todavía no actualizado (valor inicial: false) y cierre la
      // sesión recién creada creyendo que el usuario no es admin.
      setLoading(true);
      // setTimeout: supabase-js desaconseja llamar a la API dentro de este
      // callback (puede trabarse esperando su propio lock de sesión).
      setTimeout(() => {
        verificarAdmin(session).finally(() => setLoading(false));
      }, 0);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function login(
    email: string,
    password: string,
  ): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return error?.message ?? null;
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, esAdmin, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
