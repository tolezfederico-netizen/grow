import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import type { PanelCategoriaCompleto, ConfiguracionTienda } from '@shared'
import styles from './HeaderNav.module.css'

interface Props {
  paneles: PanelCategoriaCompleto[]
  panelActivo: string | null
  isTouch: boolean
  onAbrir: (id: string) => void
  config: ConfiguracionTienda | null
  scrolled: boolean
}

export default function HeaderNav({ paneles, panelActivo, isTouch, onAbrir, config, scrolled }: Props) {
  const [showAyuda, setShowAyuda] = useState(false)
  const ayudaRef = useRef<HTMLDivElement>(null)
  const timeoutAyuda = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (!showAyuda) return
    function onClick(e: MouseEvent) {
      if (ayudaRef.current && !ayudaRef.current.contains(e.target as Node)) {
        setShowAyuda(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [showAyuda])

  const abrirAyuda = useCallback(() => {
    clearTimeout(timeoutAyuda.current)
    setShowAyuda(true)
  }, [])

  const cerrarAyuda = useCallback(() => {
    clearTimeout(timeoutAyuda.current)
    timeoutAyuda.current = setTimeout(() => setShowAyuda(false), 200)
  }, [])

  const cancelarCierreAyuda = useCallback(() => {
    clearTimeout(timeoutAyuda.current)
  }, [])

  const tieneWhatsapp = config?.telefono && config.telefono.trim()
  const tieneEmail = config?.email_contacto && config.email_contacto.trim()
  const mostrarAyuda = tieneWhatsapp || tieneEmail

  function handleClick(id: string) {
    if (!isTouch) return
    onAbrir(id === panelActivo ? '' : id)
  }

  return (
    <nav className={`${styles.nav} ${scrolled ? styles.navScrolled : ''}`}>
      {paneles.map(p => (
        <button
          key={p.id}
          className={`${styles.item} ${panelActivo === p.id ? styles.activo : ''}`}
          onMouseEnter={() => !isTouch && onAbrir(p.id)}
          onClick={() => handleClick(p.id)}
        >
          {p.titulo}
          <span className={`${styles.flecha} ${panelActivo === p.id ? styles.flechaActiva : ''}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </button>
      ))}
      <div className={styles.accionesDerecha}>
        <Link to="/terminos-y-condiciones" className={styles.sucursalesBtn}>
          Términos y Condiciones
        </Link>

        {mostrarAyuda && (
          <div
            className={styles.ayudaWrap}
            ref={ayudaRef}
            onMouseEnter={isTouch ? undefined : abrirAyuda}
            onMouseLeave={isTouch ? undefined : cerrarAyuda}
          >
            <button
              type="button"
              className={styles.sucursalesBtn}
              onClick={() => isTouch && setShowAyuda(prev => !prev)}
            >
              Ayuda
            </button>
            {showAyuda && (
              <div
                className={styles.ayudaDropdown}
                onMouseEnter={cancelarCierreAyuda}
                onMouseLeave={cerrarAyuda}
              >
                {tieneWhatsapp && (
                  <a
                    className={styles.ayudaLink}
                    href={`https://wa.me/${config!.telefono.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    WhatsApp
                  </a>
                )}
                {tieneEmail && (
                  <a
                    className={styles.ayudaLink}
                    href={`mailto:${config!.email_contacto}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                    </svg>
                    Email
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
