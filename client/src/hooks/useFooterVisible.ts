import { useEffect, useState } from 'react'

/**
 * Indica si el footer de la página está entrando en pantalla.
 *
 * Lo usan los botones flotantes para ocultarse en mobile al llegar al final,
 * así no tapan el contenido del footer. Se busca el <footer> en cada scroll
 * porque cada página lo monta recién cuando terminó de cargar sus datos.
 */
export function useFooterVisible() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    function revisar() {
      const footer = document.querySelector('footer')
      setVisible(!!footer && footer.getBoundingClientRect().top < window.innerHeight)
    }

    revisar()
    window.addEventListener('scroll', revisar, { passive: true })
    window.addEventListener('resize', revisar)
    return () => {
      window.removeEventListener('scroll', revisar)
      window.removeEventListener('resize', revisar)
    }
  }, [])

  return visible
}
