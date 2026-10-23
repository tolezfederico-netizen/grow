import { useRef, useCallback, useState } from 'react'
import { useModalAccesible } from '../../../hooks/useModalAccesible'
import AvatarIlustrado, { type RasgosAvatar } from './AvatarIlustrado'
import styles from './ReviewsCarousel.module.css'

interface Review {
  id: string
  autor: string
  puntuacion: number
  texto: string
  avatar: RasgosAvatar
}

// Reseñas de ejemplo, ficticias y genéricas: sin referencias a tiendas, horarios,
// empleados ni medios de pago. Al personalizar para un negocio se reemplazan por
// reseñas reales o se oculta la sección.
const reviews: Review[] = [
  { id: "1", autor: "Martina L.", puntuacion: 5, texto: "Me asesoraron con paciencia y sin apurarme. Salí con exactamente lo que necesitaba y con varias dudas resueltas.", avatar: { pelo: "largo", fondo: 1, ropa: "secundaria", aros: true } },
  { id: "2", autor: "Diego R.", puntuacion: 5, texto: "Muy buena atención y variedad de productos.", avatar: { pelo: "corto", fondo: 3, ropa: "primaria", barba: true } },
  { id: "3", autor: "Camila S.", puntuacion: 5, texto: "Empecé con mis primeras plantas sin saber nada y me explicaron todo desde cero: sustrato, riego, luz y qué errores evitar. Volví a las semanas con fotos para consultar un problema en las hojas y me ayudaron a resolverlo. Se nota que les interesa que te vaya bien y no solo venderte algo. Súper recomendable.", avatar: { pelo: "rulos", fondo: 2, ropa: "clara", anteojos: true } },
  { id: "4", autor: "Nicolás P.", puntuacion: 5, texto: "Siempre encuentro lo que busco. ¡Recomendado! 🙌", avatar: { pelo: "gorra", fondo: 3, ropa: "secundaria" } },
  { id: "5", autor: "Valentina G.", puntuacion: 4, texto: "Buenos productos y precios razonables. A veces hay que esperar un poco porque se llena, pero vale la pena.", avatar: { pelo: "rodete", fondo: 1, ropa: "clara" } },
  { id: "6", autor: "Tomás F.", puntuacion: 5, texto: "Hice la reserva por la web, pasé a retirar y estaba todo listo. Rápido y sin vueltas.", avatar: { pelo: "pelado", fondo: 2, ropa: "primaria", barba: true, anteojos: true } },
  { id: "7", autor: "Lucía M.", puntuacion: 5, texto: "Muy amables. Respondieron todas mis consultas y me recomendaron productos acordes a lo que quería gastar.", avatar: { pelo: "corto", fondo: 1, ropa: "clara", aros: true } },
  { id: "8", autor: "Joaquín B.", puntuacion: 5, texto: "Calidad de primera en todo lo que compré. Ya es mi lugar de confianza.", avatar: { pelo: "rulos", fondo: 3, ropa: "secundaria", barba: true } },
  { id: "9", autor: "Florencia D.", puntuacion: 4, texto: "Buena variedad y buena onda. Me gustaría que hubiera más opciones en algunos fertilizantes, pero en general muy conforme.", avatar: { pelo: "largo", fondo: 2, ropa: "primaria", anteojos: true } },
  { id: "10", autor: "Matías A.", puntuacion: 5, texto: "Lo mejor es el asesoramiento: te escuchan, te preguntan cómo es tu espacio y en base a eso te recomiendan. Nada de venderte lo más caro. Además los productos están bien conservados. De los mejores lugares que conocí.", avatar: { pelo: "gorra", fondo: 1, ropa: "clara", barba: true } },
]

function Estrellas({ puntuacion }: { puntuacion: number }) {
  return (
    <div className={styles.estrellas} aria-label={`${puntuacion} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={i <= puntuacion ? styles.estrellaLlena : styles.estrellaVacia} aria-hidden={true}>
          ★
        </span>
      ))}
    </div>
  )
}

export default function ReviewsCarousel() {
  const trackRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const startXRef = useRef(0)
  const scrollLeftRef = useRef(0)
  const totalMovimientoRef = useRef(0)
  const reviewPresionadaRef = useRef<Review | null>(null)
  const [reviewSeleccionada, setReviewSeleccionada] = useState<Review | null>(null)
  const UMBRAL_CLICK_PX = 5
  const modalRef = useModalAccesible<HTMLDivElement>(
    !!reviewSeleccionada,
    () => setReviewSeleccionada(null),
  )

  const handlePointerDown = useCallback((e: React.PointerEvent, review?: Review) => {
    if (!trackRef.current) return
    draggingRef.current = true
    startXRef.current = e.pageX
    scrollLeftRef.current = trackRef.current.scrollLeft
    totalMovimientoRef.current = 0
    reviewPresionadaRef.current = review ?? null
    trackRef.current.setPointerCapture(e.pointerId)
    trackRef.current.style.userSelect = 'none'
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current || !trackRef.current) return
    e.preventDefault()
    const dx = e.pageX - startXRef.current
    totalMovimientoRef.current = Math.abs(dx)
    trackRef.current.scrollLeft = scrollLeftRef.current - dx
  }, [])

  const handlePointerUp = useCallback(() => {
    draggingRef.current = false
    if (trackRef.current) {
      trackRef.current.style.userSelect = ''
    }
    if (totalMovimientoRef.current < UMBRAL_CLICK_PX && reviewPresionadaRef.current) {
      setReviewSeleccionada(reviewPresionadaRef.current)
    }
    reviewPresionadaRef.current = null
  }, [])

  const handlePointerLeave = useCallback(() => {
    draggingRef.current = false
    if (trackRef.current) {
      trackRef.current.style.userSelect = ''
    }
  }, [])

  return (
    <section className={styles.seccion}>
      <h2 className={styles.titulo}>Lo que dicen nuestros clientes</h2>
      <div
        ref={trackRef}
        className={styles.track}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      >
        {reviews.map(r => (
          <article
            key={r.id}
            className={styles.card}
            onPointerDown={e => {
              e.stopPropagation()
              handlePointerDown(e, r)
            }}
          >
            <Estrellas puntuacion={r.puntuacion} />
            <p className={styles.texto}>{r.texto}</p>
            <div className={styles.autor}>
              <AvatarIlustrado rasgos={r.avatar} className={styles.avatar} />
              <div className={styles.autorInfo}>
                <span className={styles.autorNombre}>{r.autor}</span>
                <span className={styles.autorLabel}>Reseña de cliente</span>
              </div>
            </div>
          </article>
        ))}
      </div>

      {reviewSeleccionada && (
        <div
          className={styles.modalOverlay}
          onClick={() => setReviewSeleccionada(null)}
        >
          <div
            ref={modalRef}
            className={styles.modalCard}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
          >
            <button
              type="button"
              className={styles.modalCerrar}
              onClick={() => setReviewSeleccionada(null)}
              aria-label="Cerrar"
            >
              ✕
            </button>
            <Estrellas puntuacion={reviewSeleccionada.puntuacion} />
            <p className={styles.modalTexto}>{reviewSeleccionada.texto}</p>
            <div className={styles.autor}>
              <AvatarIlustrado rasgos={reviewSeleccionada.avatar} className={styles.avatar} />
              <div className={styles.autorInfo}>
                <span className={styles.autorNombre}>{reviewSeleccionada.autor}</span>
                <span className={styles.autorLabel}>Reseña de cliente</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
