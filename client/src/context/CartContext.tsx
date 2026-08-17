import { createContext, useContext, useReducer, useState, useRef, useEffect, useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface CartItem {
  cartId: string
  productoId: string
  productoNombre: string
  imagenUrl: string | null
  varianteId: string | null
  varianteNombre: string | null
  cantidad: number
  precioUnitario: number
}

interface CartState {
  items: CartItem[]
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: Omit<CartItem, 'cartId'> }
  | { type: 'REMOVE_ITEM'; payload: { cartId: string } }
  | { type: 'UPDATE_CANTIDAD'; payload: { cartId: string; cantidad: number } }
  | { type: 'CLEAR_CART' }

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.items.find(
        i => i.productoId === action.payload.productoId && i.varianteId === action.payload.varianteId,
      )
      if (existing) {
        return {
          items: state.items.map(i =>
            i.cartId === existing.cartId
              ? { ...i, cantidad: i.cantidad + action.payload.cantidad }
              : i,
          ),
        }
      }
      return {
        items: [...state.items, { ...action.payload, cartId: crypto.randomUUID() }],
      }
    }
    case 'REMOVE_ITEM':
      return { items: state.items.filter(i => i.cartId !== action.payload.cartId) }
    case 'UPDATE_CANTIDAD':
      return {
        items: state.items.map(i =>
          i.cartId === action.payload.cartId ? { ...i, cantidad: action.payload.cantidad } : i,
        ),
      }
    case 'CLEAR_CART':
      return { items: [] }
  }
}

interface Flight {
  id: string
  origin: DOMRect
  dest: DOMRect
}

const CartContext = createContext<{
  items: CartItem[]
  total: number
  addItem: (item: Omit<CartItem, 'cartId'>) => void
  removeItem: (cartId: string) => void
  updateCantidad: (cartId: string, cantidad: number) => void
  clearCart: () => void
  isOpen: boolean
  openCart: () => void
  closeCart: () => void
  toggleCart: () => void
  cartIconRef: React.RefObject<HTMLElement | null>
  flyToCart: (originRect: DOMRect) => void
} | null>(null)

function FlyingIcon({ flight, onDone }: { flight: Flight; onDone: (id: string) => void }) {
  const [activo, setActivo] = useState(false)

  const ox = flight.origin.left + flight.origin.width / 2
  const oy = flight.origin.top + flight.origin.height / 2
  const dx = flight.dest.left + flight.dest.width / 2 - ox
  const dy = flight.dest.top + flight.dest.height / 2 - oy

  useEffect(() => {
    const raf = requestAnimationFrame(() => setActivo(true))
    const timer = setTimeout(() => onDone(flight.id), 600)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [])

  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: ox - 14,
        top: oy - 14,
        width: 28,
        height: 28,
        zIndex: 300,
        pointerEvents: 'none',
        color: 'rgba(20,20,20,0.85)',
        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.35))',
        transition: 'transform 550ms cubic-bezier(0.3, 0.1, 0.3, 1), opacity 550ms ease-in',
        transform: activo
          ? `translate(${dx}px, ${dy}px) scale(0.4)`
          : 'translate(0, 0) scale(1)',
        opacity: activo ? 0 : 0.9,
      }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
    </div>,
    document.body,
  )
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [] })
  const [isOpen, setIsOpen] = useState(false)
  const cartIconRef = useRef<HTMLElement | null>(null)
  const [flights, setFlights] = useState<Flight[]>([])

  const total = state.items.reduce((s, i) => s + i.cantidad * i.precioUnitario, 0)

  const flyToCart = useCallback((originRect: DOMRect) => {
    if (originRect.width <= 0 || originRect.height <= 0) return
    const destEl = cartIconRef.current
    if (!destEl) return
    const destRect = destEl.getBoundingClientRect()
    if (destRect.width <= 0 || destRect.height <= 0) return
    const id = crypto.randomUUID()
    setFlights(prev => [...prev, { id, origin: originRect, dest: destRect }])
  }, [])

  const removeFlight = useCallback((id: string) => {
    setFlights(prev => prev.filter(f => f.id !== id))
  }, [])

  return (
    <CartContext.Provider
      value={{
        items: state.items,
        total,
        addItem: payload => dispatch({ type: 'ADD_ITEM', payload }),
        removeItem: cartId => dispatch({ type: 'REMOVE_ITEM', payload: { cartId } }),
        updateCantidad: (cartId, cantidad) =>
          dispatch({ type: 'UPDATE_CANTIDAD', payload: { cartId, cantidad } }),
        clearCart: () => dispatch({ type: 'CLEAR_CART' }),
        isOpen,
        openCart: () => setIsOpen(true),
        closeCart: () => setIsOpen(false),
        toggleCart: () => setIsOpen(prev => !prev),
        cartIconRef,
        flyToCart,
      }}
    >
      {children}
      {flights.map(f => (
        <FlyingIcon key={f.id} flight={f} onDone={removeFlight} />
      ))}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart debe usarse dentro de CartProvider')
  return ctx
}
