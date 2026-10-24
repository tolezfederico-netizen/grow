import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import styles from "./AdminLayout.module.css";

/** Íconos del menú: trazo grueso, en sintonía con los bordes duros del estilo. */
function Icono({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const SECCIONES: { ruta: string; texto: string; icono: React.ReactNode }[] = [
  {
    ruta: "/",
    texto: "Dashboard",
    icono: (
      <Icono>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </Icono>
    ),
  },
  {
    ruta: "/pedidos",
    texto: "Reservas",
    icono: (
      <Icono>
        <path d="M6 2h12v20l-3-2-3 2-3-2-3 2z" />
        <line x1="9" y1="8" x2="15" y2="8" />
        <line x1="9" y1="12" x2="15" y2="12" />
      </Icono>
    ),
  },
  {
    ruta: "/productos",
    texto: "Productos",
    icono: (
      <Icono>
        <path d="M21 8 12 3 3 8v8l9 5 9-5z" />
        <polyline points="3 8 12 13 21 8" />
        <line x1="12" y1="13" x2="12" y2="21" />
      </Icono>
    ),
  },
  {
    ruta: "/categorias",
    texto: "Categorías",
    icono: (
      <Icono>
        <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
        <circle cx="7.5" cy="7.5" r="1" />
      </Icono>
    ),
  },
  {
    ruta: "/paneles",
    texto: "Paneles",
    icono: (
      <Icono>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="9" y1="9" x2="9" y2="21" />
      </Icono>
    ),
  },
  {
    ruta: "/clientes",
    texto: "Clientes",
    icono: (
      <Icono>
        <circle cx="9" cy="8" r="4" />
        <path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1" />
        <path d="M16 4.5a4 4 0 0 1 0 7" />
        <path d="M19 14.5a6 6 0 0 1 3 5.5v1" />
      </Icono>
    ),
  },
  {
    ruta: "/configuracion",
    texto: "Configuración",
    icono: (
      <Icono>
        <line x1="4" y1="6" x2="20" y2="6" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="18" x2="20" y2="18" />
        <circle cx="9" cy="6" r="2" fill="currentColor" />
        <circle cx="15" cy="12" r="2" fill="currentColor" />
        <circle cx="8" cy="18" r="2" fill="currentColor" />
      </Icono>
    ),
  },
];

export default function AdminLayout() {
  const { logout } = useAuth();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const location = useLocation();

  // Cierra el menú al navegar a otra ruta (click en un link del sidebar en mobile)
  useEffect(() => {
    setMenuAbierto(false);
  }, [location.pathname]);

  // Tecla Escape cierra el menú
  useEffect(() => {
    if (!menuAbierto) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuAbierto(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuAbierto]);

  // Bloquea el scroll del body mientras el menú mobile está abierto
  useEffect(() => {
    document.body.style.overflow = menuAbierto ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuAbierto]);

  return (
    <div className={styles.layout}>
      <button
        className={`${styles.hamburger} ${menuAbierto ? styles.hamburgerOculto : ""}`}
        onClick={() => setMenuAbierto(true)}
        aria-label="Abrir menú"
        aria-expanded={menuAbierto}
      >
        ☰
      </button>

      {menuAbierto && (
        <div className={styles.overlay} onClick={() => setMenuAbierto(false)} />
      )}

      <aside
        className={`${styles.sidebar} ${menuAbierto ? styles.sidebarAbierto : ""}`}
      >
        <h2 className={styles.logo}>Grow Admin</h2>
        <nav className={styles.nav}>
          {SECCIONES.map((seccion) => (
            <NavLink
              key={seccion.ruta}
              to={seccion.ruta}
              end={seccion.ruta === "/"}
              className={({ isActive }) =>
                isActive ? styles.activo : styles.link
              }
            >
              <span className={styles.icono}>{seccion.icono}</span>
              {seccion.texto}
            </NavLink>
          ))}
        </nav>
        <button className={styles.logout} onClick={logout}>
          Cerrar sesión
        </button>
      </aside>

      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
