import { useEffect, useRef, useState } from "react";
import type { ConfiguracionTienda } from "@shared";
import { useSucursales } from "../../hooks/useSucursales";
import { parseRedSocial, RedSocialIcon } from "../../utils/redesSociales";
import logo from "../../assets/logo.webp";
import styles from "./Banner.module.css";

interface Props {
  configuracionTienda: ConfiguracionTienda;
}

export default function Banner({ configuracionTienda: c }: Props) {
  const sucursales = useSucursales();
  const [direccionSeleccionada, setDireccionSeleccionada] = useState(
    c.direccion,
  );
  const [pinAnimando, setPinAnimando] = useState(false);
  const primerRender = useRef(true);

  useEffect(() => {
    setDireccionSeleccionada(c.direccion);
  }, [c.direccion]);

  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false;
      return;
    }
    setPinAnimando(true);
  }, [direccionSeleccionada]);

  const opciones = [
    { label: c.nombre_tienda, direccion: c.direccion },
    ...sucursales.map((s) => ({ label: s.nombre, direccion: s.direccion })),
  ];

  const direccionActual = direccionSeleccionada || c.direccion;
  const opcionActual = opciones.find((op) => op.direccion === direccionActual);
  const nombreActual = opcionActual?.label ?? c.nombre_tienda;
  const mapsQuery = direccionActual.trim();
  const mapsUrl = mapsQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`
    : "#";
  const mapsEmbedSrc = mapsQuery
    ? `https://maps.google.com/maps?q=${encodeURIComponent(mapsQuery)}&output=embed&z=15`
    : "";

  const redDestacadaValida =
    c.red_social_destacada && c.redes_sociales[c.red_social_destacada]
      ? c.red_social_destacada
      : null;
  const tieneRedes = !!redDestacadaValida;
  const tieneContacto = c.telefono || c.email_contacto || tieneRedes;

  return (
    <section className={styles.banner}>
      <div className={styles.inner}>
        <h2 className={styles.titulo}>Retiro en nuestros locales</h2>

        <div
          className={`${styles.grilla}${tieneContacto ? "" : ` ${styles.grillaSinContacto}`}`}
        >
          <div className={`${styles.panel} ${styles.panelMapa}`}>
            {mapsEmbedSrc && (
              <iframe
                title="Ubicación del local"
                src={mapsEmbedSrc}
                className={styles.map}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            )}
            <img src={logo} alt={c.nombre_tienda} className={styles.mapLogo} width={506} height={160} loading="lazy" decoding="async" />
          </div>

          <div className={`${styles.panel} ${styles.panelLocal}`}>
            {opciones.length > 1 && (
              <div className={styles.sucursales}>
                {opciones.map((op) => (
                  <button
                    key={op.direccion}
                    type="button"
                    className={`${styles.sucursalBtn}${direccionSeleccionada === op.direccion ? ` ${styles.sucursalBtnActivo}` : ""}`}
                    onClick={() => setDireccionSeleccionada(op.direccion)}
                  >
                    {op.label}
                  </button>
                ))}
              </div>
            )}

            <p className={styles.eyebrow}>Encontranos en nuestro local</p>
            <h3 className={styles.nombre}>{nombreActual}</h3>
            <p className={styles.direccion}>
              <span
                className={`${styles.pin}${pinAnimando ? ` ${styles.pinAnimando}` : ""}`}
                onAnimationEnd={() => setPinAnimando(false)}
              >
                📍
              </span>{" "}
              {direccionActual.toUpperCase()}
            </p>

            <div className={styles.acciones}>
              {mapsEmbedSrc && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.btnMaps}
                >
                  Abrir en Maps ↗
                </a>
              )}
              <span className={styles.sticker}>No realizamos envíos</span>
            </div>
          </div>

          <div className={`${styles.panel} ${styles.panelHorario}`}>
            <div className={styles.panelHead}>
              <span className={styles.cardIcon} aria-hidden="true">
                <svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </span>
              <p className={styles.cardTitle}>Horario de atención</p>
            </div>
            <p className={styles.cardValue}>
              {c.horario_apertura} – {c.horario_cierre}
            </p>
            <p className={styles.contactoLine}>Lunes a viernes</p>
            <p className={`${styles.contactoLine} ${styles.lineaSuave}`}>
              Sábados, domingos y feriados: cerrado
            </p>
          </div>

          {tieneContacto && (
            <div className={`${styles.panel} ${styles.panelContacto}`}>
              <div className={styles.panelHead}>
                <span className={styles.cardIcon} aria-hidden="true">
                  <svg
                    width="100%"
                    height="100%"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="4" />
                    <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
                  </svg>
                </span>
                <p className={styles.cardTitle}>Contacto</p>
              </div>
              <div className={styles.cardBody}>
                {c.telefono && (
                  <p className={styles.contactoLine}>📞 {c.telefono}</p>
                )}
                {c.email_contacto && (
                  <p className={`${styles.contactoLine} ${styles.contactoEmail}`}>
                    <span className={styles.iconoOculto} aria-hidden="true">
                      ✉️
                    </span>
                    {c.email_contacto}
                  </p>
                )}
                {tieneRedes &&
                  redDestacadaValida &&
                  (() => {
                    const parsed = parseRedSocial(
                      redDestacadaValida,
                      c.redes_sociales[redDestacadaValida],
                    );
                    if (!parsed) return null;
                    return (
                      <div className={styles.redes}>
                        <a
                          href={parsed.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.redInfo}
                        >
                          <RedSocialIcon red={redDestacadaValida} />
                          <span className={styles.redLabel}>{parsed.label}</span>
                        </a>
                      </div>
                    );
                  })()}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
