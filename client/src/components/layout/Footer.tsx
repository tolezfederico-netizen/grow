import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { usePaneles } from "../../hooks/usePaneles";
import { useSucursales } from "../../hooks/useSucursales";
import { parseRedSocial, RedSocialIcon } from "../../utils/redesSociales";
import logo from "../../assets/logo.webp";
import styles from "./Footer.module.css";

export default function Footer() {
  const { paneles, config, loading } = usePaneles();
  const sucursales = useSucursales();

  if (loading) return null;

  const sucursalesList = config
    ? [
        { nombre: config.nombre_tienda, direccion: config.direccion },
        ...sucursales.map((s) => ({
          nombre: s.nombre,
          direccion: s.direccion,
        })),
      ]
    : [];

  if (loading) return null;

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <section className={`${styles.section} ${styles.marca}`}>
          <Link to="/" className={styles.logo}>
            <img
              src={logo}
              alt={config?.nombre_tienda ?? "Grow"}
              className={styles.logoImg}
              width={506}
              height={160}
              loading="lazy"
              decoding="async"
            />
          </Link>
        </section>

        {paneles.length > 0 && (
          <section className={`${styles.section} ${styles.categorias}`}>
            <h3 className={styles.sectionTitle}>Categorías</h3>
            <div className={styles.categoriasLinks}>
              {paneles.map((p) => (
                <Link
                  key={p.id}
                  to={`/productos/panel/${p.id}`}
                  className={styles.link}
                >
                  {p.titulo}
                </Link>
              ))}
            </div>
          </section>
        )}

        {sucursalesList.length > 0 && (
          <section className={`${styles.section} ${styles.contacto}`}>
            <h3 className={styles.sectionTitle}>Contacto</h3>
            {sucursalesList.map((s) => (
              <div key={s.direccion} className={styles.sucursalBlock}>
                <p className={styles.sucursalNombre}>{s.nombre}</p>
                <p className={styles.text}>{s.direccion}</p>
              </div>
            ))}
            <p className={styles.text}>{config!.telefono}</p>
            {config!.email_contacto && (
              <p className={styles.text}>{config!.email_contacto}</p>
            )}
          </section>
        )}

        {config && Object.keys(config.redes_sociales).length > 0 && (
          <section className={`${styles.section} ${styles.redesSection}`}>
            <h3 className={styles.sectionTitle}>Sigamos conectados</h3>
            <div className={styles.redes}>
              {Object.entries(config.redes_sociales).map(([red, url]) => {
                const parsed = parseRedSocial(red, url);
                if (!parsed) return null;
                return (
                  <a
                    key={red}
                    href={parsed.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.red}
                  >
                    <RedSocialIcon red={red} />
                    <span>{parsed.label}</span>
                  </a>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <p className={styles.copy}>
        Copyright Grow Shop - 2026. Todos los derechos reservados Creado por
        Garel
      </p>
    </footer>
  );
}
