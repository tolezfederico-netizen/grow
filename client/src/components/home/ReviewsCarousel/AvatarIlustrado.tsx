import styles from './AvatarIlustrado.module.css'

// Avatares ilustrados genéricos: no representan a ninguna persona real.
// Usan solo los colores del tema (fondo, primario y secundario) para seguir
// cualquier personalización de :root.

export type PeloAvatar = 'corto' | 'largo' | 'rulos' | 'pelado' | 'rodete' | 'gorra'

export interface RasgosAvatar {
  pelo: PeloAvatar
  fondo: 1 | 2 | 3
  ropa: 'primaria' | 'secundaria' | 'clara'
  barba?: boolean
  anteojos?: boolean
  aros?: boolean
}

const claseFondo = { 1: styles.fondo1, 2: styles.fondo2, 3: styles.fondo3 }
const claseRopa = { primaria: styles.ropaPrimaria, secundaria: styles.ropaSecundaria, clara: styles.ropaClara }

export default function AvatarIlustrado({ rasgos, className }: { rasgos: RasgosAvatar; className?: string }) {
  const { pelo, fondo, ropa, barba, anteojos, aros } = rasgos

  return (
    <span className={className} aria-hidden={true}>
      <svg viewBox="0 0 40 40" className={styles.svg} focusable="false">
        <rect width="40" height="40" className={claseFondo[fondo]} />

        {pelo === 'largo' && (
          <path d="M11 16 C11 8 15 5.5 20 5.5 C25 5.5 29 8 29 16 L29.5 29 L10.5 29 Z" className={styles.pelo} />
        )}

        <path d="M5 41 C5 32 12 28 20 28 C28 28 35 32 35 41 Z" className={claseRopa[ropa]} />
        <rect x="17" y="22" width="6" height="7" className={styles.piel} />
        <ellipse cx="20" cy="17" rx="8" ry="9" className={styles.piel} />

        {barba && (
          <path d="M12.3 18 C12.5 24.5 16 26.6 20 26.6 C24 26.6 27.5 24.5 27.7 18 C26 21.5 23.5 22.6 20 22.6 C16.5 22.6 14 21.5 12.3 18 Z" className={styles.pelo} />
        )}

        {(pelo === 'corto' || pelo === 'largo' || pelo === 'rodete') && (
          <path d="M11.8 16 C11.8 9.5 15.5 7.4 20 7.4 C25 7.4 28.2 10 28.2 16 C26.5 12.4 23.5 11.6 20 11.6 C16.5 11.6 13.6 12.6 11.8 16 Z" className={styles.pelo} />
        )}
        {pelo === 'rodete' && <circle cx="20" cy="5" r="3.2" className={styles.pelo} />}
        {pelo === 'rulos' && (
          <g className={styles.pelo}>
            <circle cx="13" cy="12.5" r="3" />
            <circle cx="16" cy="9.3" r="3" />
            <circle cx="20" cy="8.2" r="3.2" />
            <circle cx="24" cy="9.3" r="3" />
            <circle cx="27" cy="12.5" r="3" />
          </g>
        )}
        {pelo === 'gorra' && (
          <>
            <path d="M11.8 14.5 C11.8 8.5 15.5 6.5 20 6.5 C24.5 6.5 28.2 8.5 28.2 14.5 Z" className={styles.gorra} />
            <rect x="11.5" y="13.3" width="20.5" height="2.6" rx="1.2" className={styles.pelo} />
          </>
        )}

        <circle cx="17" cy="17.2" r="1" className={styles.pelo} />
        <circle cx="23" cy="17.2" r="1" className={styles.pelo} />
        <path d="M17.6 21 Q20 23 22.4 21" className={barba ? styles.lineaClara : styles.linea} />

        {anteojos && (
          <g className={styles.linea}>
            <circle cx="17" cy="17.2" r="2.6" />
            <circle cx="23" cy="17.2" r="2.6" />
            <path d="M19.6 17.2 L20.4 17.2" />
          </g>
        )}
        {aros && (
          <>
            <circle cx="12" cy="20.5" r="1.2" className={styles.gorra} />
            <circle cx="28" cy="20.5" r="1.2" className={styles.gorra} />
          </>
        )}
      </svg>
    </span>
  )
}
