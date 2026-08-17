import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useSucursales } from "../../hooks/useSucursales";
import type { ConfiguracionTienda, PanelCategoriaCompleto } from "@shared";
import { formatPrecio, supabase } from "@shared";
import { parseRedSocial, RedSocialIcon } from "../../utils/redesSociales";
import logo from "../../assets/logo.png";
import styles from "./HeaderTop.module.css";

interface Props {
  config: ConfiguracionTienda | null;
  loadingConfig: boolean;
  scrolled: boolean;
  paneles: PanelCategoriaCompleto[];
}

export default function HeaderTop({
  config,
  loadingConfig,
  scrolled,
  paneles,
}: Props) {
  const { session, loading, logout } = useAuth();
  const { items, toggleCart, cartIconRef } = useCart();
  const navigate = useNavigate();

  const [showInfo, setShowInfo] = useState(false);
  const [showCuenta, setShowCuenta] = useState(false);
  const [cerrandoSesion, setCerrandoSesion] = useState(false);
  const [nombreCliente, setNombreCliente] = useState<string | null>(null);

  const [infoPos, setInfoPos] = useState<{
    top: number;
    right: number;
  } | null>(null);

  const [cuentaPos, setCuentaPos] = useState<{
    top: number;
    right: number;
  } | null>(null);

  const [busqueda, setBusqueda] = useState("");

  const [resultados, setResultados] = useState<
    {
      id: string;
      nombre: string;
      imagen_url: string;
      precio_base: number | null;
      tiene_variantes: boolean;
      precioMinimo: number | null;
    }[]
  >([]);

  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [searchMobileAbierta, setSearchMobileAbierta] = useState(false);

  const resultadosRef = useRef<HTMLDivElement>(null);
  const resultadosMobileRef = useRef<HTMLDivElement>(null);
  const infoBtnRef = useRef<HTMLButtonElement>(null);
  const infoDropdownRef = useRef<HTMLDivElement>(null);
  const cuentaBtnRef = useRef<HTMLButtonElement>(null);
  const cuentaDropdownRef = useRef<HTMLDivElement>(null);

  const timeoutInfo = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const timeoutCuenta = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const montado = useRef(true);
  const cantidad = items.reduce((s, i) => s + i.cantidad, 0);

  const isTouch = typeof window !== "undefined" && "ontouchstart" in window;

  const sucursales = useSucursales();

  const tieneWhatsapp = config?.telefono && config.telefono.trim();

  const tieneEmail = config?.email_contacto && config.email_contacto.trim();

  useEffect(() => {
    montado.current = true;

    return () => {
      montado.current = false;
    };
  }, []);

  useEffect(() => {
    if (!showInfo) {
      setInfoPos(null);
      return;
    }

    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      const inBtn = infoBtnRef.current?.contains(target);
      const inDropdown = infoDropdownRef.current?.contains(target);

      if (!inBtn && !inDropdown) {
        setShowInfo(false);
      }
    }

    document.addEventListener("mousedown", onClick);

    return () => {
      document.removeEventListener("mousedown", onClick);
    };
  }, [showInfo]);

  useEffect(() => {
    if (!showCuenta) {
      setCuentaPos(null);
      return;
    }

    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      const inBtn = cuentaBtnRef.current?.contains(target);
      const inDropdown = cuentaDropdownRef.current?.contains(target);

      if (!inBtn && !inDropdown) {
        setShowCuenta(false);
      }
    }

    document.addEventListener("mousedown", onClick);

    return () => {
      document.removeEventListener("mousedown", onClick);
    };
  }, [showCuenta]);

  useEffect(() => {
    if (!showInfo) return;

    function onResize() {
      if (infoBtnRef.current) {
        const rect = infoBtnRef.current.getBoundingClientRect();

        setInfoPos({
          top: rect.bottom + 6,
          right: window.innerWidth - rect.right,
        });
      }
    }

    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [showInfo]);

  useEffect(() => {
    if (!showCuenta) return;

    function onResize() {
      if (cuentaBtnRef.current) {
        const rect = cuentaBtnRef.current.getBoundingClientRect();

        setCuentaPos({
          top: rect.bottom + 6,
          right: window.innerWidth - rect.right,
        });
      }
    }

    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [showCuenta]);

  const abrirInfo = useCallback(() => {
    if (timeoutInfo.current) {
      clearTimeout(timeoutInfo.current);
    }

    if (infoBtnRef.current) {
      const rect = infoBtnRef.current.getBoundingClientRect();

      setInfoPos({
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right,
      });
    }

    setShowInfo(true);
  }, []);

  const cerrarInfo = useCallback(() => {
    if (timeoutInfo.current) {
      clearTimeout(timeoutInfo.current);
    }

    timeoutInfo.current = setTimeout(() => {
      setShowInfo(false);
    }, 200);
  }, []);

  const cancelarCierreInfo = useCallback(() => {
    if (timeoutInfo.current) {
      clearTimeout(timeoutInfo.current);
    }
  }, []);

  const abrirCuenta = useCallback(() => {
    if (timeoutCuenta.current) {
      clearTimeout(timeoutCuenta.current);
    }

    if (cuentaBtnRef.current) {
      const rect = cuentaBtnRef.current.getBoundingClientRect();

      setCuentaPos({
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right,
      });
    }

    setShowCuenta(true);
  }, []);

  const cerrarCuenta = useCallback(() => {
    if (timeoutCuenta.current) {
      clearTimeout(timeoutCuenta.current);
    }

    timeoutCuenta.current = setTimeout(() => {
      setShowCuenta(false);
    }, 200);
  }, []);

  const cancelarCierreCuenta = useCallback(() => {
    if (timeoutCuenta.current) {
      clearTimeout(timeoutCuenta.current);
    }
  }, []);

  async function handleLogoutCuenta() {
    if (cerrandoSesion) return;

    setCerrandoSesion(true);

    try {
      await logout();

      if (montado.current) {
        setShowCuenta(false);
        setMenuAbierto(false);
      }
    } finally {
      if (montado.current) {
        setCerrandoSesion(false);
      }
    }
  }

  useEffect(() => {
    if (busqueda.trim().length < 2) {
      setResultados([]);
      setMostrarResultados(false);
      return;
    }

    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("productos")
        .select("id, nombre, imagen_url, precio_base, tiene_variantes")
        .in("estado", ["disponible", "sin_stock"])
        .ilike("nombre", `%${busqueda.trim()}%`)
        .limit(4);

      if (!data) {
        setResultados([]);
        setMostrarResultados(false);
        return;
      }

      let conPrecioMinimo: {
        id: string;
        precioMinimo: number | null;
      }[] = [];

      const idsConVariantes = data
        .filter((p) => p.tiene_variantes)
        .map((p) => p.id);

      if (idsConVariantes.length > 0) {
        const { data: variantes } = await supabase
          .from("producto_variantes")
          .select("producto_id, precio")
          .in("estado", ["disponible", "sin_stock"])
          .in("producto_id", idsConVariantes);

        if (variantes) {
          const mapa = new Map<string, number[]>();

          for (const v of variantes) {
            const arr = mapa.get(v.producto_id) ?? [];

            arr.push(v.precio);
            mapa.set(v.producto_id, arr);
          }

          conPrecioMinimo = idsConVariantes.map((id) => ({
            id,
            precioMinimo: mapa.has(id) ? Math.min(...mapa.get(id)!) : null,
          }));
        }
      }

      const completo = data.map((p) => ({
        ...p,
        precioMinimo:
          conPrecioMinimo.find((c) => c.id === p.id)?.precioMinimo ?? null,
      }));

      setResultados(completo as typeof resultados);
      setMostrarResultados(data.length > 0);
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [busqueda]);

  useEffect(() => {
    if (!mostrarResultados) return;

    function onClick(e: MouseEvent) {
      const target = e.target as Node;

      const inDesktop = resultadosRef.current?.contains(target);

      const inMobile = resultadosMobileRef.current?.contains(target);

      if (!inDesktop && !inMobile) {
        setMostrarResultados(false);
      }
    }

    document.addEventListener("mousedown", onClick);

    return () => {
      document.removeEventListener("mousedown", onClick);
    };
  }, [mostrarResultados]);

  useEffect(() => {
    let cancelado = false;

    async function cargarNombreCliente() {
      if (!session) {
        if (montado.current && !cancelado) {
          setNombreCliente(null);
        }

        return;
      }

      const { data, error } = await supabase
        .from("clientes")
        .select("nombre")
        .eq("id", session.user.id)
        .single();

      if (!montado.current || cancelado) return;

      if (error || !data) {
        setNombreCliente(null);
        return;
      }

      setNombreCliente(data.nombre?.trim() || null);
    }

    cargarNombreCliente().catch(() => {
      if (montado.current && !cancelado) {
        setNombreCliente(null);
      }
    });

    return () => {
      cancelado = true;
    };
  }, [session?.user.id]);

  useEffect(() => {
    if (menuAbierto) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [menuAbierto]);

  useEffect(() => {
    if (!menuAbierto) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuAbierto(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuAbierto]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setMostrarResultados(false);
    setSearchMobileAbierta(false);

    if (busqueda.trim()) {
      navigate(`/productos?buscar=${encodeURIComponent(busqueda.trim())}`);
    }
  }

  function cerrarMenu() {
    setMenuAbierto(false);
  }

  function renderResultados() {
    return resultados.map((r) => (
      <Link
        key={r.id}
        to={`/productos?buscar=${encodeURIComponent(r.nombre)}`}
        className={styles.resultCard}
        onClick={() => {
          setMostrarResultados(false);
          setSearchMobileAbierta(false);
        }}
      >
        {r.imagen_url ? (
          <img src={r.imagen_url} alt={r.nombre} className={styles.resultImg} />
        ) : (
          <div className={styles.resultImg} />
        )}

        <span className={styles.resultNombre}>{r.nombre}</span>

        <span className={styles.resultPrecio}>
          {r.tiene_variantes
            ? r.precioMinimo != null
              ? formatPrecio(r.precioMinimo)
              : "—"
            : formatPrecio(r.precio_base!)}
        </span>
      </Link>
    ));
  }

  const textoCuenta = !session ? "Mi Cuenta" : nombreCliente || "Mi Cuenta";

  return (
    <div className={`${styles.top} ${scrolled ? styles.topScrolled : ""}`}>
      <button
        type="button"
        className={styles.hamburgerBtn}
        onClick={() => setMenuAbierto(true)}
        aria-label="Abrir menú"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      <Link to="/" className={styles.logo}>
        <img
          src={logo}
          alt={config?.nombre_tienda ?? "Grow"}
          className={styles.logoImg}
        />
      </Link>

      <div className={styles.searchWrap}>
        <form className={styles.search} onSubmit={handleSubmit}>
          <svg
            className={styles.searchIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>

          <input
            className={styles.searchInput}
            type="search"
            placeholder="Buscar productos…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </form>

        {mostrarResultados && (
          <div className={styles.searchResults} ref={resultadosRef}>
            {renderResultados()}
          </div>
        )}
      </div>

      <div className={styles.botones}>
        <div
          className={styles.infoWrap}
          onMouseEnter={isTouch ? undefined : abrirInfo}
          onMouseLeave={isTouch ? undefined : cerrarInfo}
        >
          <button
            type="button"
            className={styles.btn}
            ref={infoBtnRef}
            onClick={() => isTouch && setShowInfo((prev) => !prev)}
          >
            Info
          </button>
        </div>

        {!loading && (
          <div
            className={styles.cuentaWrap}
            onMouseEnter={isTouch ? undefined : abrirCuenta}
            onMouseLeave={isTouch ? undefined : cerrarCuenta}
          >
            <button
              type="button"
              className={styles.btn}
              ref={cuentaBtnRef}
              onClick={() => isTouch && setShowCuenta((prev) => !prev)}
            >
              {textoCuenta}
            </button>
          </div>
        )}

        <button
          type="button"
          className={styles.carrito}
          ref={cartIconRef as React.Ref<HTMLButtonElement>}
          onClick={toggleCart}
        >
          <svg
            className={styles.cartIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>

          <span className={styles.carritoTexto}>Carrito</span>

          {cantidad > 0 && <span className={styles.contador}>{cantidad}</span>}
        </button>
      </div>

      <button
        type="button"
        className={styles.mobileSearchBtn}
        onClick={() => setSearchMobileAbierta((v) => !v)}
        aria-label={searchMobileAbierta ? "Cerrar búsqueda" : "Buscar"}
      >
        {searchMobileAbierta ? (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        )}
      </button>

      {searchMobileAbierta && (
        <div className={styles.mobileSearchRow}>
          <form className={styles.search} onSubmit={handleSubmit}>
            <svg
              className={styles.searchIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>

            <input
              className={styles.searchInput}
              type="search"
              placeholder="Buscar productos…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              autoFocus
            />

            <button
              type="button"
              className={styles.mobileSearchClose}
              onClick={() => setSearchMobileAbierta(false)}
              aria-label="Cerrar búsqueda"
            >
              ✕
            </button>
          </form>

          {mostrarResultados && (
            <div className={styles.searchResults} ref={resultadosMobileRef}>
              {renderResultados()}
            </div>
          )}
        </div>
      )}

      {showInfo &&
        config &&
        infoPos &&
        createPortal(
          <div
            className={styles.infoDropdown}
            style={{
              position: "fixed",
              top: infoPos.top,
              right: infoPos.right,
            }}
            ref={infoDropdownRef}
            onMouseEnter={cancelarCierreInfo}
            onMouseLeave={cerrarInfo}
          >
            {(() => {
              const sucursalesList = [
                {
                  nombre: config.nombre_tienda,
                  direccion: config.direccion,
                },
                ...sucursales.map((s) => ({
                  nombre: s.nombre,
                  direccion: s.direccion,
                })),
              ];

              return sucursalesList.map((s, i) => (
                <div
                  key={s.direccion}
                  className={i > 0 ? styles.infoSucursalBlock : ""}
                >
                  <p className={styles.infoNombre}>{s.nombre}</p>

                  <p className={styles.infoLine}>{s.direccion}</p>
                </div>
              ));
            })()}

            <p className={styles.infoLine}>{config.telefono}</p>

            <p className={styles.infoLine}>
              {config.horario_apertura} – {config.horario_cierre}
            </p>

            {Object.keys(config.redes_sociales).length > 0 && (
              <div className={styles.redes}>
                {Object.entries(config.redes_sociales).map(([red, url]) => {
                  const parsed = parseRedSocial(red, url);

                  if (!parsed) return null;

                  const label =
                    red === "instagram" ? `@${parsed.label}` : parsed.label;

                  return (
                    <a
                      key={red}
                      href={parsed.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.redLink}
                    >
                      <RedSocialIcon red={red} />
                      {label}
                    </a>
                  );
                })}
              </div>
            )}
          </div>,
          document.body,
        )}

      {showCuenta &&
        cuentaPos &&
        createPortal(
          <div
            className={styles.cuentaDropdown}
            style={{
              position: "fixed",
              top: cuentaPos.top,
              right: cuentaPos.right,
            }}
            ref={cuentaDropdownRef}
            onMouseEnter={cancelarCierreCuenta}
            onMouseLeave={cerrarCuenta}
          >
            {!session ? (
              <>
                <Link to="/login" className={styles.cuentaItem}>
                  Iniciar sesión
                </Link>

                <Link to="/registro" className={styles.cuentaItem}>
                  Registrarme
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/mi-cuenta"
                  className={styles.cuentaItem}
                  onClick={() => setShowCuenta(false)}
                >
                  Mi cuenta
                </Link>

                <button
                  type="button"
                  className={styles.cuentaItemButton}
                  onClick={handleLogoutCuenta}
                  disabled={cerrandoSesion}
                >
                  {cerrandoSesion ? "Cerrando…" : "Cerrar sesión"}
                </button>
              </>
            )}
          </div>,
          document.body,
        )}

      {menuAbierto &&
        createPortal(
          <>
            <div className={styles.drawerOverlay} onClick={cerrarMenu} />

            <div
              className={styles.drawer}
              role="dialog"
              aria-modal="true"
              aria-label="Menú"
            >
              <div className={styles.drawerHeader}>
                <span className={styles.drawerTitulo}>Menú</span>

                <button
                  type="button"
                  className={styles.drawerCerrar}
                  onClick={cerrarMenu}
                  aria-label="Cerrar menú"
                >
                  ✕
                </button>
              </div>

              <div className={styles.drawerBody}>
                <button
                  type="button"
                  className={styles.drawerCarrito}
                  onClick={() => {
                    cerrarMenu();
                    toggleCart();
                  }}
                >
                  <svg
                    className={styles.cartIcon}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="9" cy="21" r="1" />
                    <circle cx="20" cy="21" r="1" />
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                  </svg>
                  Carrito
                  {cantidad > 0 && (
                    <span className={styles.contador}>{cantidad}</span>
                  )}
                </button>

                <div className={styles.drawerSeccion}>
                  <p className={styles.drawerSeccionTitulo}>Mi cuenta</p>

                  {!session ? (
                    <>
                      <Link
                        to="/login"
                        className={styles.drawerLink}
                        onClick={cerrarMenu}
                      >
                        <span className={styles.drawerIcon}>
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                            <polyline points="10 17 15 12 10 7" />
                            <line x1="15" y1="12" x2="3" y2="12" />
                          </svg>
                        </span>
                        Iniciar sesión
                      </Link>

                      <Link
                        to="/registro"
                        className={styles.drawerLink}
                        onClick={cerrarMenu}
                      >
                        <span className={styles.drawerIcon}>
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="8.5" cy="7" r="4" />
                            <line x1="20" y1="8" x2="20" y2="14" />
                            <line x1="17" y1="11" x2="23" y2="11" />
                          </svg>
                        </span>
                        Registrarme
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link
                        to="/mi-cuenta"
                        className={styles.drawerLink}
                        onClick={cerrarMenu}
                      >
                        <span className={styles.drawerIcon}>
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                        </span>

                        {textoCuenta}
                      </Link>

                      <button
                        type="button"
                        className={styles.drawerLinkButton}
                        onClick={handleLogoutCuenta}
                        disabled={cerrandoSesion}
                      >
                        <span className={styles.drawerIcon}>
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                          </svg>
                        </span>

                        {cerrandoSesion ? "Cerrando…" : "Cerrar sesión"}
                      </button>
                    </>
                  )}
                </div>

                {paneles.length > 0 && (
                  <div className={styles.drawerSeccion}>
                    <p className={styles.drawerSeccionTitulo}>Categorías</p>

                    {paneles.map((p) => (
                      <Link
                        key={p.id}
                        to={`/productos/panel/${p.id}`}
                        className={styles.drawerLink}
                        onClick={cerrarMenu}
                      >
                        <span className={styles.drawerIcon}>
                          <svg
                            width="15"
                            height="15"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.24L4 3a1 1 0 0 0-1 1l.24 5.59a2 2 0 0 0 .59 1.41l9.58 9.58a2 2 0 0 0 2.83 0l4.35-4.35a2 2 0 0 0 0-2.82Z" />
                            <circle
                              cx="7.5"
                              cy="7.5"
                              r="1.1"
                              fill="currentColor"
                              stroke="none"
                            />
                          </svg>
                        </span>

                        {p.titulo}
                      </Link>
                    ))}
                  </div>
                )}

                {config && (
                  <div className={styles.drawerSeccion}>
                    <p className={styles.drawerSeccionTitulo}>Info</p>

                    {(() => {
                      const sucursalesList = [
                        {
                          nombre: config.nombre_tienda,
                          direccion: config.direccion,
                        },
                        ...sucursales.map((s) => ({
                          nombre: s.nombre,
                          direccion: s.direccion,
                        })),
                      ];

                      return sucursalesList.map((s, i) => (
                        <div
                          key={s.direccion}
                          className={`${styles.drawerInfoRow} ${
                            i > 0 ? styles.infoSucursalBlock : ""
                          }`}
                        >
                          <span className={styles.drawerInfoIcon}>
                            <svg
                              width="15"
                              height="15"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 1 1 18 0Z" />
                              <circle cx="12" cy="10" r="3" />
                            </svg>
                          </span>

                          <div>
                            <p className={styles.infoNombre}>{s.nombre}</p>

                            <p className={styles.infoLine}>{s.direccion}</p>
                          </div>
                        </div>
                      ));
                    })()}

                    <div className={styles.drawerInfoRow}>
                      <span className={styles.drawerInfoIcon}>
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z" />
                        </svg>
                      </span>

                      <p className={styles.infoLine}>{config.telefono}</p>
                    </div>

                    <div className={styles.drawerInfoRow}>
                      <span className={styles.drawerInfoIcon}>
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                      </span>

                      <p className={styles.infoLine}>
                        {config.horario_apertura} – {config.horario_cierre}
                      </p>
                    </div>
                  </div>
                )}

                {(tieneWhatsapp || tieneEmail) && (
                  <div className={styles.drawerSeccion}>
                    <p className={styles.drawerSeccionTitulo}>Ayuda</p>

                    {tieneWhatsapp && (
                      <a
                        className={styles.drawerLink}
                        href={`https://wa.me/${config!.telefono.replace(
                          /\D/g,
                          "",
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={cerrarMenu}
                      >
                        <span className={styles.drawerIcon}>
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                        </span>
                        WhatsApp
                      </a>
                    )}

                    {tieneEmail && (
                      <a
                        className={styles.drawerLink}
                        href={`mailto:${config!.email_contacto}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={cerrarMenu}
                      >
                        <span className={styles.drawerIcon}>
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                          </svg>
                        </span>
                        Email
                      </a>
                    )}
                  </div>
                )}

                <Link
                  to="/terminos-y-condiciones"
                  className={styles.drawerTerminos}
                  onClick={cerrarMenu}
                >
                  <span className={styles.drawerIcon}>
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                  </span>
                  Términos y Condiciones
                </Link>
              </div>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
