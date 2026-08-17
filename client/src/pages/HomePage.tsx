import { useConfiguracionTienda } from '../hooks/useConfiguracionTienda'
import LoadingState from '../components/common/LoadingState'
import ErrorState from '../components/common/ErrorState'
import Banner from '../components/home/Banner'
import FeaturedCarousel from '../components/product/FeaturedCarousel'
import Footer from '../components/layout/Footer'
import ReviewsCarousel from '../components/home/ReviewsCarousel/ReviewsCarousel'
import styles from './HomePage.module.css'

export default function HomePage() {
  const { config: tienda, loading, error, recargar } = useConfiguracionTienda()

  if (loading) return <LoadingState />
  if (error) return <ErrorState mensaje={error} onReintentar={recargar} />

  return (
    <>
      <div className={styles.page}>
        <FeaturedCarousel />
      </div>

      {tienda && (
        <Banner configuracionTienda={tienda} />
      )}
      <ReviewsCarousel />
      <Footer />
    </>
  )
}
