import type { ReactNode } from 'react'
import type { ConfiguracionTienda } from '@shared'
import Footer from '../layout/Footer'
import styles from './PaginaLegal.module.css'

// Estructura común de Términos y Condiciones y Política de privacidad:
// franja punteada, título resaltado y una viñeta blanca por sección.

export function PaginaLegal({ titulo, actualizado, children }: { titulo: string; actualizado: string; children: ReactNode }) {
  return (
    <>
      <section className={styles.page}>
        <h1 className={styles.titulo}>{titulo}</h1>
        <p className={styles.actualizado}>Última actualización: {actualizado}</p>
        {children}
      </section>
      <Footer />
    </>
  )
}

export function SeccionLegal({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.subtitulo}>{titulo}</h2>
      {children}
    </section>
  )
}

export function Parrafo({ children }: { children: ReactNode }) {
  return <p className={styles.texto}>{children}</p>
}

export function Lista({ items }: { items: ReactNode[] }) {
  return (
    <ul className={styles.lista}>
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  )
}

function formatearCuit(cuit: string): string {
  return cuit.length === 11 ? `${cuit.slice(0, 2)}-${cuit.slice(2, 10)}-${cuit.slice(10)}` : cuit
}

/**
 * Datos del proveedor (Res. 270/2020): razón social, CUIT, domicilio y medios
 * de contacto. Solo muestra los que están cargados en Configuración.
 */
export function DatosResponsable({ config }: { config: ConfiguracionTienda | null }) {
  if (!config) return null

  const filas: Array<[string, string | null]> = [
    ['Nombre comercial', config.nombre_tienda],
    ['Titular', config.razon_social],
    ['CUIT', config.cuit ? formatearCuit(config.cuit) : null],
    ['Domicilio', config.domicilio_legal || config.direccion],
    ['Email', config.email_contacto],
    ['Teléfono', config.telefono],
  ]

  return (
    <dl className={styles.datos}>
      {filas.filter(([, valor]) => valor).map(([etiqueta, valor]) => (
        <div key={etiqueta} className={styles.datoFila}>
          <dt>{etiqueta}</dt>
          <dd>{valor}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Medio para ejercer derechos o hacer consultas: el email si está cargado; si no, el teléfono. */
export function MedioContacto({ config }: { config: ConfiguracionTienda | null }) {
  if (config?.email_contacto) {
    return <a className={styles.link} href={`mailto:${config.email_contacto}`}>{config.email_contacto}</a>
  }
  if (config?.telefono) return <>{`el teléfono ${config.telefono}`}</>
  return <>los medios de contacto de la tienda</>
}

export const claseLink = styles.link
