import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Footer from '../components/layout/Footer'
import styles from './LoginPage.module.css'

function esEmailValido(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim())
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorEmail, setErrorEmail] = useState<string | null>(null)
  const [errorPassword, setErrorPassword] = useState<string | null>(null)
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const montado = useRef(true)

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    const errEmail = !esEmailValido(email) ? 'Ingresá un email válido.' : null
    const errPassword = password.trim() ? null : 'Ingresá tu contraseña.'

    setErrorEmail(errEmail)
    setErrorPassword(errPassword)
    setErrorGeneral(null)

    if (errEmail || errPassword) return

    setEnviando(true)
    const msg = await login(email.trim(), password)

    if (!montado.current) return

    if (msg) {
      setErrorGeneral(msg)
      setEnviando(false)
      return
    }

    navigate('/')
  }

  return (
    <div className={styles.wrapper}>
      <main className={styles.page}>
        <div className={styles.card}>
          <p className={styles.kicker}>Grow client</p>
          <h1 className={styles.title}>Iniciar sesión</h1>
          <p className={styles.text}>Accedé para ver tu perfil y seguir comprando más rápido.</p>

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}>✉️</span>
              <input
                className={`${styles.input} ${errorEmail ? styles.inputError : ''}`}
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => { setEmail(e.target.value); setErrorEmail(null) }}
              />
              {errorEmail && <p className={styles.errorCampo}>{errorEmail}</p>}
            </div>

            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}>🔒</span>
              <input
                className={`${styles.input} ${errorPassword ? styles.inputError : ''}`}
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={e => { setPassword(e.target.value); setErrorPassword(null) }}
              />
              {errorPassword && <p className={styles.errorCampo}>{errorPassword}</p>}
            </div>

            {errorGeneral && <p className={styles.error}>{errorGeneral}</p>}

            <button className={styles.boton} disabled={enviando}>
              {enviando ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>

          <p className={styles.linkTexto}>
            ¿No tenés cuenta? <Link to="/registro">Registrate</Link>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  )
}
