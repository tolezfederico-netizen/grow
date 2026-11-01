import { Link } from 'react-router-dom'
import { CATEGORIAS_EN_DESPLEGABLE } from '@shared'
import type { PanelCategoriaCompleto } from '@shared'
import CategoryCard from '../product/CategoryCard'
import styles from './CategoryDropdown.module.css'

interface Props {
  panel: PanelCategoriaCompleto
  onCerrar: () => void
}

export default function CategoryDropdown({ panel, onCerrar }: Props) {
  const cards = panel.items.slice(0, CATEGORIAS_EN_DESPLEGABLE)

  return (
    <div className={styles.dropdown}>
      <div className={styles.inner}>
        <h3 className={styles.titulo}>{panel.titulo}</h3>
        {panel.descripcion && <p className={styles.desc}>{panel.descripcion}</p>}
        <div className={styles.grilla} onClick={onCerrar}>
          {cards.map(item => (
            <CategoryCard
              key={item.id}
              nombre={item.nombre_visible ?? item.categoria_nombre}
              categoriaId={item.categoria_id}
              productos={item.productos}
            />
          ))}
        </div>
        <Link to={`/productos/panel/${panel.id}`} className={styles.verTodo} onClick={onCerrar}>
          Ver todo
        </Link>
      </div>
    </div>
  )
}
