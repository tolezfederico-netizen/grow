import { Link } from 'react-router-dom'
import Footer from '../components/layout/Footer'
import styles from './NotFoundPage.module.css'

export default function NotFoundPage() {
  return (
    <div className={styles.wrapper}>
      <main className={styles.page}>
        <section className={styles.card}>
          <p className={styles.codigo}>404</p>
          <h1 className={styles.titulo}>Página no encontrada</h1>
          <p className={styles.texto}>
            La dirección que buscás no existe o ya no está disponible.
          </p>
          <div className={styles.acciones}>
            <Link to="/productos" className={styles.botonPrincipal}>
              Ver productos
            </Link>
            <Link to="/" className={styles.botonSecundario}>
              Volver al inicio
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
