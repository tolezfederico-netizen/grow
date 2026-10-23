import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase, formatPrecio } from "@shared";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import CartItemRow from "../components/cart/CartItemRow";
import ConfirmarPedidoModal from "../components/common/ConfirmarPedidoModal";
import FeaturedCarousel from "../components/product/FeaturedCarousel";
import Footer from "../components/layout/Footer";
import styles from "./ResumePage.module.css";

function esNombreCompletoValido(valor: string): boolean {
  const partes = valor.trim().split(/\s+/).filter(Boolean);
  return partes.length >= 2;
}

function esEmailValido(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim());
}

export default function ResumePage() {
  const { items, total, removeItem, updateCantidad, clearCart } = useCart();
  const { session } = useAuth();
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorNombre, setErrorNombre] = useState<string | null>(null);
  const [errorTelefono, setErrorTelefono] = useState<string | null>(null);
  const [errorEmail, setErrorEmail] = useState<string | null>(null);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState(false);
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);
  const [carritoVacioAlEntrar, setCarritoVacioAlEntrar] = useState(
    items.length === 0,
  );
  const location = useLocation();
  const montado = useRef(true);
  const precargaHecha = useRef(false);
  const nombreActual = useRef(nombre);
  const telefonoActual = useRef(telefono);
  const emailActual = useRef(email);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  useEffect(() => {
    if (!session || precargaHecha.current) return;

    let cancelado = false;
    const userId = session.user.id;

    async function precargarDatosCliente() {
      const { data: cliente, error } = await supabase
        .from("clientes")
        .select("nombre, apellido, telefono, email")
        .eq("id", userId)
        .single();

      if (!montado.current || cancelado || precargaHecha.current) return;

      if (error || !cliente) return;

      if (!nombreActual.current.trim()) {
        setNombre(`${cliente.nombre ?? ""} ${cliente.apellido ?? ""}`.trim());
      }

      if (!telefonoActual.current.trim()) {
        setTelefono(cliente.telefono ?? "");
      }

      if (!emailActual.current.trim()) {
        setEmail(cliente.email ?? "");
      }

      precargaHecha.current = true;
    }

    precargarDatosCliente().catch(() => {});

    return () => {
      cancelado = true;
    };
  }, [session]);

  useEffect(() => {
    setConfirmado(false);
    setCarritoVacioAlEntrar(items.length === 0);
  }, [location.key]);

  useEffect(() => {
    if (!confirmado && items.length === 0) {
      setCarritoVacioAlEntrar(true);
    }
  }, [items.length, confirmado]);

  function handleAbrirConfirmacion() {
    const errNombre = !esNombreCompletoValido(nombre)
      ? "Ingresá tu nombre y apellido completo."
      : null;
    const errTelefono =
      telefono.length < 8 || telefono.length > 10
        ? "El teléfono debe tener entre 8 y 10 dígitos."
        : null;
    const errEmail = !esEmailValido(email) ? "Ingresá un email válido." : null;

    setErrorNombre(errNombre);
    setErrorTelefono(errTelefono);
    setErrorEmail(errEmail);
    setErrorGeneral(null);

    if (errNombre || errTelefono || errEmail) return;

    setMostrarConfirmacion(true);
  }

  async function handleEnviarPedidoConfirmado() {
    setEnviando(true);

    const { data: pedido, error } = await supabase.rpc(
      "crear_pedido_completo",
      {
        p_cliente_nombre: nombre.trim(),
        p_cliente_telefono: telefono.trim(),
        p_cliente_email: email.trim(),
        // El usuario y los precios los resuelve la RPC del lado del servidor.
        p_items: items.map((i) => ({
          producto_id: i.productoId,
          variante_id: i.varianteId,
          cantidad: i.cantidad,
        })),
      },
    );

    if (error || !pedido) {
      // P0001 = RAISE EXCEPTION de la RPC (mensajes pensados para el usuario);
      // cualquier otro error no se muestra crudo.
      setErrorGeneral(
        error?.code === "P0001"
          ? error.message
          : "Error al crear el pedido. Intentá de nuevo.",
      );
      setEnviando(false);
      return;
    }

    // TODO: Edge Function de Supabase para enviar notificación WhatsApp/email
    // enviarNotificacionPedido(pedido)

    clearCart();
    setConfirmado(true);
    setMostrarConfirmacion(false);
    setEnviando(false);
  }

  if (confirmado) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.page}>
          <div className={styles.confirmacion}>
            <h2>¡Pedido recibido!</h2>
            <p>Te vamos a contactar a la brevedad para coordinar el retiro.</p>
            <Link to="/productos" className={styles.botonSeguirComprando}>
              Seguir comprando
            </Link>
          </div>
        </div>
        <div className={styles.destacadosVacio}>
          <FeaturedCarousel />
        </div>
        <Footer />
      </div>
    );
  }

  if (!confirmado && carritoVacioAlEntrar) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.page}>
          <div className={styles.vacioCentrado}>
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <p className={styles.vacio}>El carrito de compras está vacío.</p>
            <Link to="/productos" className={styles.botonVacio}>
              Ver productos
            </Link>
          </div>
        </div>
        <div className={styles.destacadosVacio}>
          <FeaturedCarousel />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.page}>
        <h2 className={styles.titulo}>Resumen del pedido</h2>

        <div className={styles.layout}>
          <div>
            <div className={styles.items}>
              {items.map((item) => (
                <CartItemRow
                  key={item.cartId}
                  item={item}
                  onActualizarCantidad={updateCantidad}
                  onEliminar={removeItem}
                />
              ))}
            </div>

            <div className={styles.total}>
              <span>Total</span>
              <strong className={styles.totalValor}>{formatPrecio(total)}</strong>
            </div>
          </div>

          <div className={styles.panel}>
            <div className={styles.resumenCompacto}>
              <p className={styles.resumenCompactoTexto}>
                {items.reduce((s, i) => s + i.cantidad, 0)} producto
                {items.reduce((s, i) => s + i.cantidad, 0) !== 1 ? "s" : ""} en
                tu pedido
              </p>
              <p className={styles.avisoRetiro}>
                Solo retiro en nuestros locales — no realizamos envíos
              </p>
            </div>

            <p className={styles.alerta}>
              <span className={styles.alertaIcono}>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </span>
              Revisá bien tus datos de contacto: los usaremos para comunicarnos
              con vos y avisarte sobre el estado de tu pedido.
            </p>

            <div className={styles.form}>
              <div className={styles.inputWrapper}>
                <label className={styles.etiqueta} htmlFor="resumen-nombre">
                  Nombre y apellido
                </label>
                <div className={styles.inputCaja}>
                  <span className={styles.inputIcon}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <input
                    id="resumen-nombre"
                    className={`${styles.input} ${errorNombre ? styles.inputError : ""}`}
                    placeholder="Nombre y Apellido"
                    value={nombre}
                    onChange={(e) => {
                      nombreActual.current = e.target.value;
                      setNombre(e.target.value);
                      setErrorNombre(null);
                    }}
                  />
                </div>
                {errorNombre && (
                  <p className={styles.errorCampo}>{errorNombre}</p>
                )}
              </div>
              <div className={styles.inputWrapper}>
                <label className={styles.etiqueta} htmlFor="resumen-telefono">
                  Teléfono
                </label>
                <div className={styles.inputCaja}>
                  <span className={styles.inputIcon}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z" />
                    </svg>
                  </span>
                  <input
                    id="resumen-telefono"
                    className={`${styles.input} ${errorTelefono ? styles.inputError : ""}`}
                    placeholder="Teléfono"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={telefono}
                    onChange={(e) => {
                      const valor = e.target.value.replace(/\D/g, "");
                      telefonoActual.current = valor;
                      setTelefono(valor);
                      setErrorTelefono(null);
                    }}
                  />
                </div>
                {errorTelefono && (
                  <p className={styles.errorCampo}>{errorTelefono}</p>
                )}
              </div>
              <div className={styles.inputWrapper}>
                <label className={styles.etiqueta} htmlFor="resumen-email">
                  Email
                </label>
                <div className={styles.inputCaja}>
                  <span className={styles.inputIcon}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="m22 7-10 6L2 7" />
                    </svg>
                  </span>
                  <input
                    id="resumen-email"
                    className={`${styles.input} ${errorEmail ? styles.inputError : ""}`}
                    placeholder="Email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      emailActual.current = e.target.value;
                      setEmail(e.target.value);
                      setErrorEmail(null);
                    }}
                  />
                </div>
                {errorEmail && (
                  <p className={styles.errorCampo}>{errorEmail}</p>
                )}
              </div>
            </div>

            {errorGeneral && <p className={styles.error}>{errorGeneral}</p>}

            <div className={styles.badgeConfianza}>
              <span className={styles.badgeIcono}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span className={styles.badgeTexto}>Datos protegidos</span>
              </span>
              <p className={styles.badgeSubtexto}>
                Usamos tus datos solo para gestionar tu reserva.{" "}
                <Link to="/politica-de-privacidad" className={styles.badgeLink}>
                  Política de privacidad
                </Link>
              </p>
            </div>

            <button
              className={styles.boton}
              disabled={enviando}
              onClick={handleAbrirConfirmacion}
            >
              {enviando ? "Enviando…" : "Confirmar pedido"}
            </button>
          </div>
        </div>
      </div>
      <ConfirmarPedidoModal
        abierto={mostrarConfirmacion}
        onConfirmar={handleEnviarPedidoConfirmado}
        onCancelar={() => setMostrarConfirmacion(false)}
        items={items}
        total={total}
        enviando={enviando}
        error={errorGeneral}
      />
      <Footer />
    </div>
  );
}
