import { useEffect, useState, type FormEvent } from "react";
import {
  supabase,
  mapearConfiguracionTienda,
  mapearSucursal,
  REDES_SOCIALES_SUGERIDAS,
  esEmailContactoValido,
} from "@shared";
import type { Sucursal } from "@shared";
import LoadingState from "../components/LoadingState";
import ErrorState from "../components/ErrorState";
import ConfirmDialog from "../components/ConfirmDialog";
import styles from "./SettingsPage.module.css";

const PLACEHOLDER_REDES: Record<string, string> = {
  instagram: "https://instagram.com/tu_usuario",
  facebook: "https://facebook.com/tu_pagina",
  tiktok: "https://tiktok.com/@tu_usuario",
  twitter: "https://twitter.com/tu_usuario",
};

const ICONO_TIENDA = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const ICONO_LEGAL = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="13" y2="17" />
  </svg>
);

const ICONO_TELEFONO = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const ICONO_RELOJ = (
  <svg
    width="18"
    height="18"
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
);

const ICONO_COMPARTIR = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);

const ICONO_UBICACION = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const ICONO_EMAIL = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22 6 12 13 2 6" />
  </svg>
);

const ICONO_ALERTA = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const ICONO_SUCURSAL = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="4" y="2" width="16" height="20" rx="1" />
    <line x1="8" y1="6" x2="8" y2="6.01" />
    <line x1="12" y1="6" x2="12" y2="6.01" />
    <line x1="16" y1="6" x2="16" y2="6.01" />
    <line x1="8" y1="10" x2="8" y2="10.01" />
    <line x1="12" y1="10" x2="12" y2="10.01" />
    <line x1="16" y1="10" x2="16" y2="10.01" />
    <line x1="8" y1="14" x2="8" y2="14.01" />
    <line x1="12" y1="14" x2="12" y2="14.01" />
    <line x1="16" y1="14" x2="16" y2="14.01" />
    <path d="M9 22v-4h6v4" />
  </svg>
);

function iconoRed(red: string): JSX.Element | null {
  switch (red) {
    case "instagram":
      return (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <rect
            x="2"
            y="2"
            width="20"
            height="20"
            rx="6"
            fill="url(#ig-gradient)"
          />
          <rect
            x="6.5"
            y="6.5"
            width="11"
            height="11"
            rx="3.5"
            stroke="#fff"
            strokeWidth="1.6"
          />
          <circle cx="12" cy="12" r="3" stroke="#fff" strokeWidth="1.6" />
          <circle cx="16.2" cy="7.8" r="1" fill="#fff" />
          <defs>
            <linearGradient
              id="ig-gradient"
              x1="0"
              y1="24"
              x2="24"
              y2="0"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#FEDA75" />
              <stop offset="0.3" stopColor="#FA7E1E" />
              <stop offset="0.6" stopColor="#D62976" />
              <stop offset="0.85" stopColor="#962FBF" />
              <stop offset="1" stopColor="#4F5BD5" />
            </linearGradient>
          </defs>
        </svg>
      );
    case "facebook":
      return (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <rect x="2" y="2" width="20" height="20" rx="6" fill="#1877F2" />
          <path
            d="M14.5 8.5h1.5V6h-2c-1.7 0-3 1.3-3 3v1.5H9.5V13H11v5h2v-5h1.7l.3-2.5H13v-1c0-.6.4-1 1-1z"
            fill="#fff"
          />
        </svg>
      );
    case "tiktok":
      return (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <rect x="2" y="2" width="20" height="20" rx="6" fill="#000" />
          <path
            d="M14.8 7.2c.5.9 1.4 1.5 2.5 1.6v1.9c-1 0-1.9-.3-2.7-.8v4.3a3.9 3.9 0 1 1-3.9-3.9c.2 0 .4 0 .6.05v1.95a2 2 0 1 0 1.4 1.9V6h1.9c0 .4 0 .8.2 1.2z"
            fill="#fff"
          />
          <path
            d="M14.8 7.2c.5.9 1.4 1.5 2.5 1.6v1.9c-1 0-1.9-.3-2.7-.8v4.3a3.9 3.9 0 1 1-3.9-3.9c.2 0 .4 0 .6.05v1.95a2 2 0 1 0 1.4 1.9V6h1.9c0 .4 0 .8.2 1.2z"
            fill="#25F4EE"
            opacity="0.3"
            transform="translate(-0.5, -0.5)"
          />
        </svg>
      );
    case "twitter":
      return (
        <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    default:
      return null;
  }
}

function isoAInputLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function inputLocalAIso(valor: string): string | null {
  if (!valor) return null;
  return new Date(valor).toISOString();
}

interface ConfigData {
  nombre_tienda: string;
  direccion: string;
  telefono: string;
  email_contacto: string;
  horario_apertura: string;
  horario_cierre: string;
  redes_sociales: Record<string, string>;
  red_social_destacada: string | null;
  mensaje_alerta: string;
  mensaje_alerta_expira_en: string;
  razon_social: string;
  cuit: string;
  domicilio_legal: string;
}

/** El CUIT se guarda solo con sus 11 dígitos; se muestra como 20-12345678-9. */
function soloDigitosCuit(valor: string): string {
  return valor.replace(/\D/g, "");
}

function IconoValido() {
  return (
    <span className={styles.iconoValido} aria-hidden="true">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}

export default function SettingsPage() {
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [existe, setExiste] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [mostrarToast, setMostrarToast] = useState(false);

  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [sucursalesEliminadas, setSucursalesEliminadas] = useState<string[]>(
    [],
  );

  async function cargarSucursales() {
    const { data, error: err } = await supabase
      .from("sucursales")
      .select("*")
      .order("orden");
    if (err) {
      setError(err.message);
      return;
    }
    setSucursales(data ? data.map(mapearSucursal) : []);
    setSucursalesEliminadas([]);
  }

  useEffect(() => {
    (async () => {
      const { data, error: err } = await supabase
        .from("configuracion_tienda")
        .select("*")
        .maybeSingle();
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      if (data) {
        const mapeada = mapearConfiguracionTienda(data);
        const horario_apertura = (mapeada.horario_apertura || "").slice(0, 5);
        const horario_cierre = (mapeada.horario_cierre || "").slice(0, 5);
        setConfig({
          ...mapeada,
          email_contacto: mapeada.email_contacto ?? "",
          mensaje_alerta: mapeada.mensaje_alerta ?? "",
          razon_social: mapeada.razon_social ?? "",
          cuit: mapeada.cuit ?? "",
          domicilio_legal: mapeada.domicilio_legal ?? "",
          mensaje_alerta_expira_en: isoAInputLocal(
            mapeada.mensaje_alerta_expira_en,
          ),
          horario_apertura,
          horario_cierre,
        });
        setExiste(true);
      } else {
        setConfig({
          nombre_tienda: "",
          direccion: "",
          telefono: "",
          email_contacto: "",
          horario_apertura: "",
          horario_cierre: "",
          redes_sociales: {},
          red_social_destacada: null,
          mensaje_alerta: "",
          mensaje_alerta_expira_en: "",
          razon_social: "",
          cuit: "",
          domicilio_legal: "",
        });
        setExiste(false);
      }
      await cargarSucursales();
      setLoading(false);
    })();
  }, []);

  function actualizar(
    campo: keyof ConfigData,
    valor: string | Record<string, string> | null,
  ) {
    setConfig((prev) => (prev ? { ...prev, [campo]: valor } : prev));
  }

  function actualizarRed(clave: string, valor: string) {
    if (!config) return;
    actualizar("redes_sociales", { ...config.redes_sociales, [clave]: valor });
  }

  function eliminarRed(clave: string) {
    if (!config) return;
    const copia = { ...config.redes_sociales };
    delete copia[clave];
    actualizar("redes_sociales", copia);
    if (config.red_social_destacada === clave) {
      actualizar("red_social_destacada", null);
    }
  }

  function seleccionarRedDestacada(clave: string) {
    actualizar("red_social_destacada", clave);
  }

  function actualizarSucursal(
    id: string,
    campo: "nombre" | "direccion",
    valor: string,
  ) {
    setSucursales((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [campo]: valor } : s)),
    );
  }

  function agregarSucursal() {
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setSucursales((prev) => [
      ...prev,
      { id: tempId, nombre: "", direccion: "", orden: prev.length },
    ]);
  }

  function eliminarSucursal(id: string) {
    if (!id.startsWith("temp_")) {
      setSucursalesEliminadas((prev) => [...prev, id]);
    }
    setSucursales((prev) => prev.filter((s) => s.id !== id));
  }

  function esUrlHttps(valor: string): boolean {
    try {
      return new URL(valor.trim()).protocol === "https:";
    } catch {
      return false;
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!config) return;
    setGuardando(true);
    setError(null);

    if (
      config.email_contacto.trim() !== "" &&
      !esEmailContactoValido(config.email_contacto)
    ) {
      setError(
        "El email debe tener el formato correcto (ej: nombre@gmail.com).",
      );
      setGuardando(false);
      return;
    }

    const redInvalida = Object.entries(config.redes_sociales).find(
      ([red, url]) => red !== "whatsapp" && url.trim() !== "" && !esUrlHttps(url),
    );
    if (redInvalida) {
      setError(
        `El link de ${redInvalida[0]} debe empezar con https:// (ej: https://instagram.com/tu_usuario).`,
      );
      setGuardando(false);
      return;
    }

    const cuit = soloDigitosCuit(config.cuit);
    if (cuit !== "" && cuit.length !== 11) {
      setError("El CUIT debe tener 11 dígitos (ej: 20-12345678-9).");
      setGuardando(false);
      return;
    }

    const mensajeAlerta = config.mensaje_alerta.trim();
    if (mensajeAlerta === "") {
      actualizar("mensaje_alerta_expira_en", "");
    } else if (config.mensaje_alerta_expira_en) {
      const fecha = new Date(config.mensaje_alerta_expira_en);
      if (!(fecha > new Date())) {
        setError("La fecha de vencimiento debe ser futura.");
        setGuardando(false);
        return;
      }
    }

    const payload = {
      ...config,
      email_contacto: config.email_contacto.trim() || null,
      razon_social: config.razon_social.trim() || null,
      cuit: cuit || null,
      domicilio_legal: config.domicilio_legal.trim() || null,
      mensaje_alerta: mensajeAlerta || null,
      mensaje_alerta_expira_en: inputLocalAIso(
        mensajeAlerta === "" ? "" : config.mensaje_alerta_expira_en,
      ),
    };

    if (existe) {
      const { error: err } = await supabase
        .from("configuracion_tienda")
        .update(payload)
        .eq("singleton", true);
      if (err) {
        setError(err.message);
        setGuardando(false);
        return;
      }
    } else {
      const { error: err } = await supabase
        .from("configuracion_tienda")
        .insert(payload);
      if (err) {
        setError(err.message);
        setGuardando(false);
        return;
      }
    }

    // ── Guardar sucursales ──
    const existentes = sucursales.filter((s) => !s.id.startsWith("temp_"));
    const nuevas = sucursales.filter((s) => s.id.startsWith("temp_"));

    if (existentes.length > 0) {
      const { error: errS } = await supabase
        .from("sucursales")
        .upsert(
          existentes.map((s) => ({
            id: s.id,
            nombre: s.nombre,
            direccion: s.direccion,
            orden: s.orden,
          })),
        );
      if (errS) {
        setError(errS.message);
        setGuardando(false);
        return;
      }
    }

    if (nuevas.length > 0) {
      const { error: errS } = await supabase
        .from("sucursales")
        .insert(
          nuevas.map((s) => ({
            nombre: s.nombre,
            direccion: s.direccion,
            orden: s.orden,
          })),
        );
      if (errS) {
        setError(errS.message);
        setGuardando(false);
        return;
      }
    }

    if (sucursalesEliminadas.length > 0) {
      const { error: errS } = await supabase
        .from("sucursales")
        .delete()
        .in("id", sucursalesEliminadas);
      if (errS) {
        setError(errS.message);
        setGuardando(false);
        return;
      }
    }

    await cargarSucursales();
    setGuardando(false);
    setExiste(true);
    setMostrarToast(true);
  }

  if (loading) return <LoadingState />;
  if (error && !config) return <ErrorState mensaje={error} />;

  if (!config) return null;

  return (
    <div className={styles.page}>
      <form onSubmit={handleSubmit} className={styles.form}>
        {/* ---- Información del local ---- */}
        <section className={styles.seccion}>
          <header className={styles.seccionHeader}>
            <span className={styles.seccionIcono}>{ICONO_TIENDA}</span>
            <div>
              <h3 className={styles.seccionTitulo}>Información del local</h3>
              <p className={styles.seccionSub}>
                Datos del negocio que el cliente ve en la tienda.
              </p>
            </div>
          </header>
          <div className={styles.seccionCuerpo}>
            <div className={styles.grilla}>
              <label className={styles.label}>
                <span className={styles.labelTexto}>
                  {ICONO_TIENDA}Nombre de la tienda
                </span>
                <span className={styles.inputConEstado}>
                  <input
                    className={styles.input}
                    value={config.nombre_tienda}
                    onChange={(e) => actualizar("nombre_tienda", e.target.value)}
                    required
                  />
                  {config.nombre_tienda.trim() !== "" && <IconoValido />}
                </span>
              </label>

              <label className={styles.label}>
                <span className={styles.labelTexto}>
                  {ICONO_TELEFONO}Teléfono
                </span>
                <span className={styles.inputConEstado}>
                  <input
                    className={styles.input}
                    value={config.telefono}
                    onChange={(e) => actualizar("telefono", e.target.value)}
                    required
                  />
                  {config.telefono.trim() !== "" && <IconoValido />}
                </span>
              </label>

              <label className={styles.label}>
                <span className={styles.labelTexto}>
                  {ICONO_UBICACION}Dirección (local principal)
                </span>
                <span className={styles.inputConEstado}>
                  <input
                    className={styles.input}
                    value={config.direccion}
                    onChange={(e) => actualizar("direccion", e.target.value)}
                    required
                  />
                  {config.direccion.trim() !== "" && <IconoValido />}
                </span>
                <span className={styles.ayuda}>
                  Este es el primer local que ve el cliente. Si tenés más de un
                  local, agregalos en "Sucursales" más abajo.
                </span>
              </label>

              <label className={styles.label}>
                <span className={styles.labelTexto}>
                  {ICONO_EMAIL}Email de contacto
                </span>
                <span className={styles.inputConEstado}>
                  <input
                    className={styles.input}
                    type="email"
                    placeholder="nombre@gmail.com"
                    value={config.email_contacto}
                    onChange={(e) => actualizar("email_contacto", e.target.value)}
                  />
                  {config.email_contacto.trim() !== "" &&
                    (esEmailContactoValido(config.email_contacto) ? (
                      <IconoValido />
                    ) : (
                      <span className={styles.iconoInvalido} aria-hidden="true">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </span>
                    ))}
                </span>
                <span className={styles.ayuda}>
                  Debe tener el formato de un email v&aacute;lido (ej:
                  ventas@tunegocio.com.ar).
                </span>
              </label>
            </div>

            <div className={styles.subBloque}>
              <span className={styles.subBloqueTitulo}>
                {ICONO_RELOJ}Horario de atención
              </span>
              <div className={styles.filaAngosta}>
                <label className={styles.label}>
                  <span className={styles.labelTexto}>Apertura</span>
                  <input
                    className={styles.input}
                    type="time"
                    value={config.horario_apertura}
                    onChange={(e) =>
                      actualizar("horario_apertura", e.target.value)
                    }
                    required
                  />
                </label>
                <label className={styles.label}>
                  <span className={styles.labelTexto}>Cierre</span>
                  <input
                    className={styles.input}
                    type="time"
                    value={config.horario_cierre}
                    onChange={(e) =>
                      actualizar("horario_cierre", e.target.value)
                    }
                    required
                  />
                </label>
              </div>
            </div>
          </div>
        </section>

        <div className={styles.filaSecciones}>
          {/* ---- Sucursales ---- */}
          <section className={styles.seccion}>
            <header className={styles.seccionHeader}>
              <span className={styles.seccionIcono}>{ICONO_SUCURSAL}</span>
              <div>
                <h3 className={styles.seccionTitulo}>Sucursales</h3>
                <p className={styles.seccionSub}>
                  Direcciones adicionales del negocio. Si no hay sucursales
                  cargadas, el mapa del client muestra solo la dirección
                  principal.
                </p>
              </div>
            </header>
            <div className={styles.seccionCuerpo}>
              {sucursales.length > 0 && (
                <div className={styles.sucursalesLista}>
                  {sucursales.map((s) => (
                    <div key={s.id} className={styles.sucursalRow}>
                      <input
                        className={styles.input}
                        placeholder="Nombre de la sucursal"
                        value={s.nombre}
                        onChange={(e) =>
                          actualizarSucursal(s.id, "nombre", e.target.value)
                        }
                      />
                      <input
                        className={styles.input}
                        placeholder="Dirección"
                        value={s.direccion}
                        onChange={(e) =>
                          actualizarSucursal(s.id, "direccion", e.target.value)
                        }
                      />
                      <button
                        type="button"
                        className={styles.btnEliminar}
                        onClick={() => eliminarSucursal(s.id)}
                        aria-label="Quitar sucursal"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                className={styles.btnAgregarSucursal}
                onClick={agregarSucursal}
              >
                + Agregar sucursal
              </button>
            </div>
          </section>

          {/* ---- Redes sociales ---- */}
          <section className={styles.seccion}>
            <header className={styles.seccionHeader}>
              <span className={styles.seccionIcono}>{ICONO_COMPARTIR}</span>
              <div>
                <h3 className={styles.seccionTitulo}>Redes sociales</h3>
                <p className={styles.seccionSub}>
                  Marcá con el círculo cuál red social se muestra en el Banner
                  de la tienda.
                </p>
              </div>
            </header>
            <div className={styles.seccionCuerpo}>
              <p className={styles.sugeridas}>
                <span className={styles.sugeridasLabel}>Agregar:</span>
                {REDES_SOCIALES_SUGERIDAS.map((r) => {
                  const existe = config.redes_sociales[r] !== undefined;
                  return (
                    <button
                      key={r}
                      type="button"
                      className={`${styles.sugerencia}${existe ? ` ${styles.sugerenciaActiva}` : ""}`}
                      onClick={() => {
                        if (existe) eliminarRed(r);
                        else actualizarRed(r, "");
                      }}
                      title={existe ? `Quitar ${r}` : `Agregar ${r}`}
                      aria-label={existe ? `Quitar ${r}` : `Agregar ${r}`}
                    >
                      {iconoRed(r)}
                      {existe && (
                        <span className={styles.checkSugerencia}>✓</span>
                      )}
                    </button>
                  );
                })}
              </p>

              {Object.entries(config.redes_sociales).length > 0 && (
                <div className={styles.redesLista}>
                  {Object.entries(config.redes_sociales).map(([red, url]) => (
                    <div key={red} className={styles.redRow}>
                      <input
                        type="radio"
                        name="redDestacada"
                        className={styles.radioDestacada}
                        checked={config.red_social_destacada === red}
                        onChange={() => seleccionarRedDestacada(red)}
                        title={`Mostrar ${red} en el Banner`}
                        aria-label={`Mostrar ${red} en el Banner`}
                      />
                      <span className={styles.redClave}>{red}</span>
                      <input
                        className={styles.input}
                        placeholder={PLACEHOLDER_REDES[red] ?? "URL"}
                        value={url}
                        onChange={(e) => actualizarRed(red, e.target.value)}
                      />
                      <button
                        type="button"
                        className={styles.btnEliminar}
                        onClick={() => eliminarRed(red)}
                        aria-label={`Quitar ${red}`}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* ---- Mensaje de alerta ---- */}
        <section className={styles.seccion}>
          <header className={styles.seccionHeader}>
            <span className={styles.seccionIcono}>{ICONO_ALERTA}</span>
            <div>
              <h3 className={styles.seccionTitulo}>Mensaje de alerta</h3>
              <p className={styles.seccionSub}>
                Se muestra como un cartel animado en la parte superior de la
                tienda. Dejalo vacío para ocultarlo.
              </p>
            </div>
          </header>
          <div className={`${styles.seccionCuerpo} ${styles.alertaCuerpo}`}>
            <div className={styles.alertaCampos}>
              <label className={styles.label}>
                <span className={styles.labelTexto}>Mensaje</span>
                <textarea
                  className={styles.input}
                  rows={2}
                  value={config.mensaje_alerta}
                  onChange={(e) => actualizar("mensaje_alerta", e.target.value)}
                  placeholder="Ej: Envíos especiales por el Día del Padre — consultá stock antes de venir"
                />
              </label>
              <label className={styles.labelVencimiento}>
                <span className={styles.labelTexto}>Vencimiento (opcional)</span>
                <input
                  className={styles.input}
                  type="datetime-local"
                  value={config.mensaje_alerta_expira_en}
                  onChange={(e) =>
                    actualizar("mensaje_alerta_expira_en", e.target.value)
                  }
                  disabled={config.mensaje_alerta.trim() === ""}
                />
              </label>
              <span className={styles.ayuda}>
                Si lo configurás, el mensaje se borra solo apenas se cumple la
                fecha y hora (podés tardar hasta un minuto en verlo
                desaparecer). Dejalo vacío para que el mensaje no venza nunca.
              </span>
            </div>

            <div className={styles.previa}>
              <span className={styles.labelTexto}>Así se ve en la tienda</span>
              <div
                className={`${styles.previaCartel} ${config.mensaje_alerta.trim() === "" ? styles.previaApagada : ""}`}
              >
                {config.mensaje_alerta.trim() || "Sin mensaje"}
              </div>
              <span className={styles.ayuda}>
                {config.mensaje_alerta.trim() === ""
                  ? "Sin mensaje: los clientes no ven el cartel."
                  : "En la tienda el texto se desplaza de derecha a izquierda."}
              </span>
            </div>
          </div>
        </section>

        {/* ---- Datos legales ---- */}
        <section className={styles.seccion}>
          <header className={styles.seccionHeader}>
            <span className={styles.seccionIcono}>{ICONO_LEGAL}</span>
            <div>
              <h3 className={styles.seccionTitulo}>Datos legales</h3>
              <p className={styles.seccionSub}>
                Titular del negocio. Se muestran en Términos y Condiciones y en
                la Política de privacidad de la tienda.
              </p>
            </div>
          </header>
          <div className={styles.seccionCuerpo}>
            <div className={styles.grilla}>
              <label className={styles.label}>
                <span className={styles.labelTexto}>Razón social</span>
                <input
                  className={styles.input}
                  value={config.razon_social}
                  onChange={(e) => actualizar("razon_social", e.target.value)}
                  placeholder="Ej: Juan Pérez o Tu Negocio S.R.L."
                />
              </label>

              <label className={styles.label}>
                <span className={styles.labelTexto}>CUIT</span>
                <input
                  className={styles.input}
                  inputMode="numeric"
                  value={config.cuit}
                  onChange={(e) => actualizar("cuit", e.target.value)}
                  placeholder="20-12345678-9"
                />
              </label>

              <label className={styles.label}>
                <span className={styles.labelTexto}>Domicilio legal</span>
                <input
                  className={styles.input}
                  value={config.domicilio_legal}
                  onChange={(e) =>
                    actualizar("domicilio_legal", e.target.value)
                  }
                  placeholder="Calle 123, Ciudad, Provincia"
                />
              </label>
            </div>
            <span className={styles.ayuda}>
              Opcionales. Si quedan vacíos, la tienda usa el nombre y la
              dirección del local.
            </span>
          </div>
        </section>

        <div className={styles.btnGuardarWrap}>
          {error && <p className={styles.error}>{error}</p>}
          <button className={styles.btnGuardar} disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar configuración"}
          </button>
        </div>
      </form>

      {mostrarToast && (
        <ConfirmDialog
          tipo="toast"
          mensaje="Configuración guardada."
          onConfirmar={() => setMostrarToast(false)}
          onCancelar={() => setMostrarToast(false)}
        />
      )}
    </div>
  );
}
