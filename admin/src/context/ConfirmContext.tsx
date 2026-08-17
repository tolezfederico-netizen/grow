import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'

interface ConfirmOptions {
  titulo?: string
  textoConfirmar?: string
  textoCancelar?: string
}

interface NotifyOptions {
  titulo?: string
}

interface ToastOptions {
  titulo?: string
  duracionMs?: number
}

interface ConfirmValue {
  confirm: (mensaje: string, opciones?: ConfirmOptions) => Promise<boolean>
  notify: (mensaje: string, opciones?: NotifyOptions) => Promise<void>
  toast: (mensaje: string, opciones?: ToastOptions) => void
}

const ConfirmContext = createContext<ConfirmValue | null>(null)

type DialogTipo = 'confirm' | 'notify' | 'toast'

interface DialogState {
  tipo: DialogTipo
  mensaje: string
  titulo?: string
  textoConfirmar?: string
  textoCancelar?: string
  duracionMs?: number
  resolve: (valor: boolean | PromiseLike<boolean>) => void
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null)

  const confirm = useCallback((mensaje: string, opciones?: ConfirmOptions): Promise<boolean> => {
    return new Promise(resolve => {
      setDialog({
        tipo: 'confirm',
        mensaje,
        titulo: opciones?.titulo,
        textoConfirmar: opciones?.textoConfirmar,
        textoCancelar: opciones?.textoCancelar,
        resolve,
      })
    })
  }, [])

  const notify = useCallback((mensaje: string, opciones?: NotifyOptions): Promise<void> => {
    return new Promise<boolean>(resolve => {
      setDialog({
        tipo: 'notify',
        mensaje,
        titulo: opciones?.titulo,
        resolve,
      })
    }).then(() => {})
  }, [])

  const toast = useCallback((mensaje: string, opciones?: ToastOptions) => {
    setDialog({
      tipo: 'toast',
      mensaje,
      titulo: opciones?.titulo,
      duracionMs: opciones?.duracionMs,
      resolve: () => {},
    })
  }, [])

  function handleConfirmar() {
    dialog?.resolve(true)
    setDialog(null)
  }

  function handleCancelar() {
    dialog?.resolve(false)
    setDialog(null)
  }

  return (
    <ConfirmContext.Provider value={{ confirm, notify, toast }}>
      {children}
      {dialog && (
        <ConfirmDialog
          tipo={dialog.tipo}
          mensaje={dialog.mensaje}
          titulo={dialog.titulo}
          textoConfirmar={dialog.textoConfirmar}
          textoCancelar={dialog.textoCancelar}
          duracionMs={dialog.duracionMs}
          onConfirmar={handleConfirmar}
          onCancelar={handleCancelar}
        />
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm debe usarse dentro de un ConfirmProvider')
  return ctx
}
