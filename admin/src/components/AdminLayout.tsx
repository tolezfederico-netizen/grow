import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import styles from "./AdminLayout.module.css";

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
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              isActive ? styles.activo : styles.link
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/pedidos"
            className={({ isActive }) =>
              isActive ? styles.activo : styles.link
            }
          >
            Pedidos
          </NavLink>
          <NavLink
            to="/productos"
            className={({ isActive }) =>
              isActive ? styles.activo : styles.link
            }
          >
            Productos
          </NavLink>
          <NavLink
            to="/clientes"
            className={({ isActive }) =>
              isActive ? styles.activo : styles.link
            }
          >
            Clientes
          </NavLink>
          <NavLink
            to="/paneles"
            className={({ isActive }) =>
              isActive ? styles.activo : styles.link
            }
          >
            Paneles
          </NavLink>
          <NavLink
            to="/categorias"
            className={({ isActive }) =>
              isActive ? styles.activo : styles.link
            }
          >
            Categorías
          </NavLink>
          <NavLink
            to="/configuracion"
            className={({ isActive }) =>
              isActive ? styles.activo : styles.link
            }
          >
            Configuración
          </NavLink>
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
