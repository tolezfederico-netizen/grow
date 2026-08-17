import type { PanelCategoriaCompleto } from '@shared'
import CategoryCard from '../product/CategoryCard'
import styles from './CategoryDropdown.module.css'

interface Props {
  panel: PanelCategoriaCompleto
}

export default function CategoryDropdown({ panel }: Props) {
  const cards = panel.items.filter(item => item.es_card)

  return (
    <div className={styles.dropdown}>
      <div className={styles.inner}>
        <h3 className={styles.titulo}>{panel.titulo}</h3>
        {panel.descripcion && <p className={styles.desc}>{panel.descripcion}</p>}
        <div className={styles.grilla}>
          {cards.map(item => (
            <CategoryCard
              key={item.id}
              nombre={item.nombre_visible ?? item.categoria_nombre}
              categoriaId={item.categoria_id}
              productos={item.productos}
            />
          ))}
        </div>
        {cards.length === 0 && (
          <p className={styles.vacio}>Este panel no tiene cards configuradas.</p>
        )}
      </div>
    </div>
  )
}
