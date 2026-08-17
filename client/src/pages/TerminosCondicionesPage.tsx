import Footer from '../components/layout/Footer'
import styles from './TerminosCondicionesPage.module.css'

export default function TerminosCondicionesPage() {
  return (
    <>
      <section className={styles.page}>
        <h1 className={styles.titulo}>Términos y Condiciones</h1>

        <section className={styles.section}>
          <h2 className={styles.subtitulo}>POLITICAS Y CONDICIONES DE USO</h2>
          <p className={styles.texto}>Permanecer en www.kanopia.com.ar implica que acepta estas condiciones:</p>
          <p className={styles.texto}>Todos los artículos ofrecidos en KANOPIA GROW SHOP son de lícito comercio en Argentina.</p>
          <p className={styles.texto}>
            KANOPIA GROW SHOP en ningún caso invita ni incita a sus clientes a actuar de forma contraria a la ley, entendiendo que la responsabilidad y diligencia de cada persona sobre los actos propios encuadra bajo el Articulo 19 de la Constitución Nacional Argentina, rogando al cliente un uso recto, noble y responsable de los artículos adquiridos.
          </p>
          <p className={styles.texto}>
            Art 19. - Las acciones privadas de los hombres que de ningún modo ofendan al orden y a la moral pública, ni perjudiquen a un tercero, están sólo reservadas a Dios, y exentas de la autoridad de los magistrados. Ningún habitante de la Nación será obligado a hacer lo que no manda la ley, ni privado de lo que ella no prohíbe.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.subtitulo}>REGISTRO DE USUARIOS</h2>
          <p className={styles.texto}>
            Al generar un usuario para poder realizar compras online KANOPIA GROW SHOP se compromete con sus clientes a NO reproducir, publicar, subir, enviar por correo, transmitir, distribuir, mostrar públicamente, ejecutar, modificar y crear trabajos derivados a partir de dicha información, la misma solo será utilizada para garantizar el mejor servicio posible y la entrega de los productos adquiridos
          </p>
        </section>
      </section>
      <Footer />
    </>
  )
}
