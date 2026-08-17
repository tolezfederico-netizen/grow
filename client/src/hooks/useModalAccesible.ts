import { useEffect, useRef } from 'react'

/**
 * Agrega comportamiento de accesibilidad de teclado a un modal:
 * - Cierra el modal al presionar Escape.
 * - Atrapa el foco dentro del modal mientras está abierto (Tab / Shift+Tab
 *   no dejan salir del contenedor).
 * - Al abrirse, mueve el foco al contenedor del modal.
 * - Al cerrarse, devuelve el foco al elemento que estaba enfocado antes de
 *   que el modal se abriera.
 *
 * @param activo si el modal está actualmente abierto
 * @param onCerrar callback a ejecutar cuando el usuario presiona Escape
 * @returns ref para asignar al elemento contenedor del modal (el que tiene
 *          los estilos de tarjeta/panel, no el overlay de fondo)
 */
export function useModalAccesible<T extends HTMLElement>(activo: boolean, onCerrar: () => void) {
  const contenedorRef = useRef<T>(null)
  const elementoPrevioRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!activo) return

    elementoPrevioRef.current = document.activeElement as HTMLElement | null
    contenedorRef.current?.focus()

    function obtenerFocuseables(): HTMLElement[] {
      if (!contenedorRef.current) return []
      const selector = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      return Array.from(contenedorRef.current.querySelectorAll<HTMLElement>(selector))
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCerrar()
        return
      }

      if (e.key !== 'Tab') return

      const focuseables = obtenerFocuseables()
      if (focuseables.length === 0) return

      const primero = focuseables[0]
      const ultimo = focuseables[focuseables.length - 1]

      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault()
        primero.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      elementoPrevioRef.current?.focus()
    }
  }, [activo, onCerrar])

  return contenedorRef
}
