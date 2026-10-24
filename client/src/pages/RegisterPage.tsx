import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Footer from '../components/layout/Footer'
import styles from './RegisterPage.module.css'

function esEmailValido(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim())
}

export default function RegisterPage() {
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorNombre, setErrorNombre] = useState<string | null>(null)
  const [errorApellido, setErrorApellido] = useState<string | null>(null)
  const [errorTelefono, setErrorTelefono] = useState<string | null>(null)
  const [errorEmail, setErrorEmail] = useState<string | null>(null)
  const [errorPassword, setErrorPassword] = useState<string | null>(null)
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [exito, setExito] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const montado = useRef(true)

  useEffect(() => {
    montado.current = true
    return () => { montado.current = false }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    const errNombre = nombre.trim() ? null : 'Ingresá tu nombre.'
    const errApellido = apellido.trim() ? null : 'Ingresá tu apellido.'
    const errTelefono = telefono.length >= 8 && telefono.length <= 10 ? null : 'El teléfono debe tener entre 8 y 10 dígitos.'
    const errEmail = !esEmailValido(email) ? 'Ingresá un email válido.' : null
    // Mismo criterio que Authentication → Policies en Supabase (8+, letras y números)
    const errPassword = password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password)
      ? null
      : 'La contraseña debe tener al menos 8 caracteres, con letras y números.'

    setErrorNombre(errNombre)
    setErrorApellido(errApellido)
    setErrorTelefono(errTelefono)
    setErrorEmail(errEmail)
    setErrorPassword(errPassword)
    setErrorGeneral(null)
    setExito(false)

    if (errNombre || errApellido || errTelefono || errEmail || errPassword) return

    setEnviando(true)
    const msg = await signUp(email.trim(), password, {
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      telefono: telefono.trim(),
    })

    if (!montado.current) return

    if (msg) {
      setErrorGeneral(msg)
      setEnviando(false)
      return
    }

    setExito(true)
    setEnviando(false)
  }

  return (
    <div className={styles.wrapper}>
      <main className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>Crear cuenta</h1>
          <p className={styles.text}>Guardá tus datos para acelerar futuras compras.</p>

          {exito ? (
            <div className={styles.exitoBox}>
              <p className={styles.exitoTitulo}>Registro exitoso.</p>
              <p className={styles.exitoTexto}>Si te pedimos confirmar tu email, revisá tu casilla.</p>
              <Link to="/login" className={styles.botonSecundario}>Ir a login</Link>
            </div>
          ) : (
            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <input
                  className={`${styles.input} ${errorNombre ? styles.inputError : ''}`}
                  placeholder="Nombre"
                  value={nombre}
                  onChange={e => { setNombre(e.target.value); setErrorNombre(null) }}
                />
                {errorNombre && <p className={styles.errorCampo}>{errorNombre}</p>}
              </div>

              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <input
                  className={`${styles.input} ${errorApellido ? styles.inputError : ''}`}
                  placeholder="Apellido"
                  value={apellido}
                  onChange={e => { setApellido(e.target.value); setErrorApellido(null) }}
                />
                {errorApellido && <p className={styles.errorCampo}>{errorApellido}</p>}
              </div>

              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-10 6L2 7" />
                  </svg>
                </span>
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
                <span className={styles.inputIcon}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z" />
                  </svg>
                </span>
                <input
                  className={`${styles.input} ${errorTelefono ? styles.inputError : ''}`}
                  placeholder="Teléfono"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={telefono}
                  onChange={e => { setTelefono(e.target.value.replace(/\D/g, '')); setErrorTelefono(null) }}
                />
                {errorTelefono && <p className={styles.errorCampo}>{errorTelefono}</p>}
              </div>

              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
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

              <p className={styles.aviso}>
                Al registrarte aceptás los <Link to="/terminos-y-condiciones">Términos y Condiciones</Link>.
                Usamos tus datos según nuestra <Link to="/politica-de-privacidad">Política de privacidad</Link>.
              </p>

              <button className={styles.boton} disabled={enviando}>
                {enviando ? 'Registrando…' : 'Registrarme'}
              </button>
            </form>
          )}

          <p className={styles.linkTexto}>
            ¿Ya tenés cuenta? <Link to="/login">Iniciá sesión</Link>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  )
}
