import { useState } from 'react'
import type { EstadoPedido } from '@shared'
import styles from './NotificarPedidoModal.module.css'

interface Props {
  clienteNombre: string
  clienteTelefono: string
  clienteEmail: string
  estadoDestino: EstadoPedido
  onConfirmar: (canales: { whatsapp: boolean; email: boolean }) => void
  onCancelar: () => void
}

export default function NotificarPedidoModal({
  clienteNombre,
  estadoDestino,
  onConfirmar,
  onCancelar,
}: Props) {
  const [whatsapp, setWhatsapp] = useState(true)
  const [email, setEmail] = useState(true)

  const tituloEstado = estadoDestino === 'confirmado' ? 'Confirmado' : 'Listo para retirar'

  return (
    <div className={styles.overlay} onClick={onCancelar}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h3 className={styles.titulo}>Notificar "{tituloEstado}" — {clienteNombre}</h3>
        <p className={styles.mensaje}>Seleccioná los canales para notificar al cliente.</p>

        <div className={styles.checkboxes}>
          <label className={styles.checkLabel}>
            <input
              type="checkbox"
              checked={whatsapp}
              onChange={e => setWhatsapp(e.target.checked)}
            />
            Enviar WhatsApp
          </label>
          <label className={styles.checkLabel}>
            <input
              type="checkbox"
              checked={email}
              onChange={e => setEmail(e.target.checked)}
            />
            Enviar Email
          </label>
        </div>

        <div className={styles.acciones}>
          <button className={styles.btnCancelar} onClick={onCancelar}>Cancelar</button>
          <button className={styles.btnConfirmar} onClick={() => onConfirmar({ whatsapp, email })}>Confirmar</button>
        </div>
      </div>
    </div>
  )
}
