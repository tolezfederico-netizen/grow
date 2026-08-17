import { useNavigate } from 'react-router-dom'
import styles from './CategoryCard.module.css'

interface Props {
  nombre: string
  categoriaId: string
  productos: Array<{ producto_id: string; imagen_url: string | null }>
}

export default function CategoryCard({ nombre, categoriaId, productos }: Props) {
  const navigate = useNavigate()
  const imagenesValidas = productos.filter((p): p is { producto_id: string; imagen_url: string } => !!p.imagen_url).slice(0, 2)

  return (
    <button className={styles.card} onClick={() => navigate(`/productos/${categoriaId}`)}>
      <span className={styles.nombreTitulo}>{nombre}</span>
      <div className={styles.imagenWrapper}>
        {imagenesValidas.length === 0 && <div className={styles.placeholder} />}
        {imagenesValidas.length === 1 && <img src={imagenesValidas[0].imagen_url} alt="" className={styles.img} />}
        {imagenesValidas.length === 2 && (
          <div className={styles.imagenesDobles}>
            {imagenesValidas.map(p => (
              <img key={p.producto_id} src={p.imagen_url} alt="" className={styles.imagenMitad} />
            ))}
          </div>
        )}
      </div>
    </button>
  )
}
