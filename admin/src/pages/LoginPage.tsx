import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo.png'
import styles from './LoginPage.module.css'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const msg = await login(email, password)
    if (msg) {
      setError(msg)
      setLoading(false)
    } else {
      navigate('/')
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.tarjeta}>
      <div className={styles.panelMarca}>
        <img src={logo} alt="Grow Admin" className={styles.logo} />
        <p className={styles.marcaTagline}>Panel de administraci&oacute;n</p>
      </div>
      <div className={styles.panelForm}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <h2 className={styles.formTitulo}>Iniciar sesi&oacute;n</h2>
          <input className={styles.input} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input className={styles.input} type="password" placeholder="Contrase&ntilde;a" value={password} onChange={e => setPassword(e.target.value)} required />
          {error && <p className={styles.error}>{error}</p>}
          <button className={styles.boton} disabled={loading}>{loading ? 'Ingresando…' : 'Ingresar'}</button>
        </form>
      </div>
      </div>
    </div>
  )
}
