import { useRef, useCallback, useState } from 'react'
import { useModalAccesible } from '../../../hooks/useModalAccesible'
import styles from './ReviewsCarousel.module.css'

interface Review {
  id: string
  autor: string
  puntuacion: number
  texto: string
  imagen: string
}

const reviews: Review[] = [
  { id: "1", autor: "Rubén Alberto Hassna", puntuacion: 5, texto: "Fui por una consulta y me encontré con un muchacho que dedicó todo su tiempo a explicar con honestidad y no a tratar de vender. La verdadera función de un comercio serio.", imagen: "/1.jpg" },
  { id: "2", autor: "Pablo Jose", puntuacion: 5, texto: "Muy buen local y excelente atención.", imagen: "/2.jpg" },
  { id: "3", autor: "otoniv", puntuacion: 5, texto: "Excelente lugar especializado. Tiene una amplísima variedad de productos para todo tipo de necesidades en el jardín. Lo más destacable es el asesoramiento personalizado. La diferencia entre vender productos y ofrecer soluciones concretas para cada caso particular. La vocación de servicio es lo que hace que uno quiera volver. Sin dudas, lo mejor de la zona. 100% recomendable.", imagen: "/3.jpg" },
  { id: "4", autor: "Emiliano Balestriere", puntuacion: 5, texto: "Un lujo...siempre te atienden con la mejor! 🙌🏻", imagen: "/4.png" },
  { id: "5", autor: "lucas sanz", puntuacion: 5, texto: "Buena atención. Siempre atentos. Buenos precios, buena variedad. Compren acá si necesitan una atención personalizada", imagen: "/5.png" },
  { id: "6", autor: "gabriel gustavo", puntuacion: 4, texto: "Abre un poco tarde y en horario acotado lo cual genera bastante demora por la cantidad de gente que va a comprar sus productos. Atención y productos de primera! Estaría bueno que agregue un toldo o algo para estar a la sombra el día que esperas afuera.", imagen: "/6.jpg" },
  { id: "7", autor: "Natacha Lobo Marquez", puntuacion: 5, texto: "Atención de primera, tienen tarjeta. Abren hasta las 20:30. Cada vez que voy se toma el tiempo necesario para contestar cada duda o consulta, muy amables. Tiene gran surtido de artículos", imagen: "/7.jpg" },
  { id: "8", autor: "Aldana Vazquez", puntuacion: 5, texto: "Muy buena la atención! Podés ir y sacarte cualquier duda, que te asesoran sobre todo, la calidad de los productos son muy buenos, y precios accesibles", imagen: "/8.jpg" },
  { id: "9", autor: "Seba Saw", puntuacion: 5, texto: "Excelente atención, amables y eficientes, tienen todo lo necesario y los precios son normales, fui varias veces, lo único me gustaría que atiendan hasta las 20:00hs !", imagen: "/9.jpg" },
  { id: "10", autor: "Agustin Gonzalo", puntuacion: 5, texto: "Un Grow atendido por gente que sabe de la planta y de lo que vende. Además de vender productos frescos, te llevas una buena asesoría. Se nota que el muchacho que atiende es apasionado del tema. Además de que tiene excelente parafernalia, te volvés con las dudas despejadas y algún preventivo de paso jaja. Grow de los que no encuentro seguido.", imagen: "/10.jpg" },
]

const PUNTUACION_PROMEDIO = 4.8
const TOTAL_RESENAS = 232

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
      <div className={styles.resumenPuntuacion}>
        <span className={styles.promedio}>{PUNTUACION_PROMEDIO}</span>
        <div className={styles.resumenEstrellas}>
          <Estrellas puntuacion={Math.round(PUNTUACION_PROMEDIO)} />
          <span className={styles.totalResenas}>({TOTAL_RESENAS})</span>
        </div>
      </div>
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
              <img src={r.imagen} alt={r.autor} className={styles.avatar} />
              <div className={styles.autorInfo}>
                <span className={styles.autorNombre}>{r.autor}</span>
                <span className={styles.autorLabel}>Review de Google</span>
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
              <img src={reviewSeleccionada.imagen} alt={reviewSeleccionada.autor} className={styles.avatar} />
              <div className={styles.autorInfo}>
                <span className={styles.autorNombre}>{reviewSeleccionada.autor}</span>
                <span className={styles.autorLabel}>Review de Google</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
