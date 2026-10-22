import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  mapearPedido,
  mapearPedidoItem,
  formatEstadoPedido,
  formatPrecio,
  supabase,
} from "@shared";
import { useAuth } from "../context/AuthContext";
import Footer from "../components/layout/Footer";
import PedidoDetalleModal from "../components/common/PedidoDetalleModal";
import {
  getMiCuentaCache,
  setMiCuentaCache,
  updateMiCuentaCacheImagenes,
  updateMiCuentaCachePerfil,
} from "./miCuentaCache";
import styles from "./MiCuentaPage.module.css";

function esNombreValido(valor: string): boolean {
  return valor.trim().length > 0;
}

function esTelefonoValido(valor: string): boolean {
  return valor.length >= 8 && valor.length <= 10;
}

export default function MiCuentaPage() {
  const { session } = useAuth();
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [errorNombre, setErrorNombre] = useState<string | null>(null);
  const [errorApellido, setErrorApellido] = useState<string | null>(null);
  const [errorTelefono, setErrorTelefono] = useState<string | null>(null);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [exito, setExito] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [cargandoPerfil, setCargandoPerfil] = useState(true);
  const [errorPerfil, setErrorPerfil] = useState<string | null>(null);
  const [pedidos, setPedidos] = useState<
    Array<ReturnType<typeof mapearPedido> extends infer T ? T : never>
  >([]);
  const [itemsPorPedido, setItemsPorPedido] = useState<
    Record<string, ReturnType<typeof mapearPedidoItem>[]>
  >({});
  const [pedidoAbierto, setPedidoAbierto] = useState<string | null>(null);
  const [imagenesPorProducto, setImagenesPorProducto] = useState<
    Record<string, string | null>
  >({});
  const [cargandoImagenes, setCargandoImagenes] = useState(false);
  const [cargandoPedidos, setCargandoPedidos] = useState(true);
  const [errorPedidos, setErrorPedidos] = useState<string | null>(null);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  async function abrirModalPedido(pedidoId: string) {
    setPedidoAbierto(pedidoId);

    const items = itemsPorPedido[pedidoId] ?? [];
    const idsAPedir = Array.from(
      new Set(
        items
          .map((item) => item.producto_id)
          .filter(
            (id): id is string => id !== null && !(id in imagenesPorProducto),
          ),
      ),
    );

    if (idsAPedir.length === 0) return;

    setCargandoImagenes(true);

    try {
      const { data, error } = await supabase
        .from("productos")
        .select("id, imagen_url")
        .in("id", idsAPedir);

      if (!montado.current) return;

      setImagenesPorProducto((prev) => {
        const next = { ...prev };
        for (const id of idsAPedir) next[id] = null;

        if (!error) {
          for (const row of data ?? []) {
            next[row.id] = row.imagen_url ?? null;
          }
        }

        if (session?.user.id) {
          updateMiCuentaCacheImagenes(session.user.id, next);
        }

        return next;
      });

      if (error) {
        console.error(
          "No se pudieron cargar las imagenes de productos del pedido:",
          error,
        );
      }
    } finally {
      if (montado.current) setCargandoImagenes(false);
    }
  }

  function cerrarModalPedido() {
    setPedidoAbierto(null);
  }

  useEffect(() => {
    if (!session) return;
    const userId = session.user.id;
    const cache = getMiCuentaCache(userId);

    if (cache) {
      setNombre(cache.perfil.nombre);
      setApellido(cache.perfil.apellido);
      setTelefono(cache.perfil.telefono);
      setEmail(cache.perfil.email);
      setPedidos(cache.pedidos);
      setItemsPorPedido(cache.itemsPorPedido);
      setImagenesPorProducto(cache.imagenesPorProducto);
      setCargandoPerfil(false);
      setCargandoPedidos(false);
      setErrorPerfil(null);
      setErrorPedidos(null);
      return;
    }

    let cancelado = false;

    async function cargarPerfilYPedidos() {
      setCargandoPerfil(true);
      setErrorPerfil(null);
      setCargandoPedidos(true);
      setErrorPedidos(null);

      const [perfilRes, pedidosRes] = await Promise.all([
        supabase
          .from("clientes")
          .select("nombre, apellido, telefono, email")
          .eq("id", userId)
          .single(),
        supabase
          .from("pedidos")
          .select("*")
          .eq("usuario_id", userId)
          .order("creado_en", { ascending: false }),
      ]);

      if (!montado.current || cancelado) return;

      if (perfilRes.error || !perfilRes.data) {
        setErrorPerfil(
          perfilRes.error?.message ?? "No se pudo cargar tu perfil.",
        );
      } else {
        const perfil = perfilRes.data;
        setNombre(perfil.nombre ?? "");
        setApellido(perfil.apellido ?? "");
        setTelefono(perfil.telefono ?? "");
        setEmail(perfil.email ?? "");
      }
      setCargandoPerfil(false);

      if (pedidosRes.error) {
        setErrorPedidos(pedidosRes.error.message);
        setCargandoPedidos(false);
        return;
      }

      const pedidosMapeados = (pedidosRes.data ?? []).map(mapearPedido);
      setPedidos(pedidosMapeados);

      if (pedidosMapeados.length === 0) {
        setItemsPorPedido({});
        setCargandoPedidos(false);
        return;
      }

      const idsPedidos = pedidosMapeados.map((p) => p.id);
      const itemsRes = await supabase
        .from("pedido_items")
        .select("*")
        .in("pedido_id", idsPedidos);

      if (!montado.current || cancelado) return;

      if (itemsRes.error) {
        setErrorPedidos(itemsRes.error.message);
        setItemsPorPedido({});
        setCargandoPedidos(false);
        return;
      }

      const itemsMapeados = (itemsRes.data ?? []).map(mapearPedidoItem);
      const agrupados = itemsMapeados.reduce<
        Record<string, ReturnType<typeof mapearPedidoItem>[]>
      >((acc, item) => {
        (acc[item.pedido_id] ??= []).push(item);
        return acc;
      }, {});

      setItemsPorPedido(agrupados);
      setMiCuentaCache(userId, {
        perfil: {
          nombre: perfilRes.data?.nombre ?? "",
          apellido: perfilRes.data?.apellido ?? "",
          telefono: perfilRes.data?.telefono ?? "",
          email: perfilRes.data?.email ?? "",
        },
        pedidos: pedidosMapeados,
        itemsPorPedido: agrupados,
        imagenesPorProducto: {},
      });
      setCargandoPedidos(false);
    }

    cargarPerfilYPedidos().catch((error) => {
      if (!montado.current || cancelado) return;
      setErrorPerfil(error?.message ?? "No se pudo cargar tu perfil.");
      setErrorPedidos(error?.message ?? "No se pudo cargar tu historial.");
      setCargandoPerfil(false);
      setCargandoPedidos(false);
    });

    return () => {
      cancelado = true;
    };
  }, [session]);

  async function handleGuardar(e: FormEvent) {
    e.preventDefault();

    const errNombre = esNombreValido(nombre) ? null : "Ingresá tu nombre.";
    const errApellido = esNombreValido(apellido)
      ? null
      : "Ingresá tu apellido.";
    const errTelefono = esTelefonoValido(telefono)
      ? null
      : "El teléfono debe tener entre 8 y 10 dígitos.";

    setErrorNombre(errNombre);
    setErrorApellido(errApellido);
    setErrorTelefono(errTelefono);
    setErrorGeneral(null);
    setExito(false);

    if (errNombre || errApellido || errTelefono || !session) return;

    setGuardando(true);
    const userId = session.user.id;
    const { error } = await supabase
      .from("clientes")
      .update({
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        telefono: telefono.trim(),
      })
      .eq("id", userId);

    if (!montado.current) return;

    if (error) {
      setErrorGeneral(error.message);
      setGuardando(false);
      return;
    }

    if (session?.user.id) {
      updateMiCuentaCachePerfil(session.user.id, {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        telefono: telefono.trim(),
        email,
      });
    }

    setExito(true);
    setGuardando(false);
  }

  return (
    <div className={styles.wrapper}>
      <main className={styles.page}>
        <div className={styles.content}>
          <h1 className={styles.title}>Mi cuenta</h1>
          <p className={styles.text}>
            Mantené tu perfil al día y revisá tu historial de pedidos.
          </p>

          <div className={styles.columnas}>
            <section className={`${styles.seccion} ${styles.seccionPerfil}`}>
              <h2 className={styles.seccionTitulo}>Perfil</h2>
              {cargandoPerfil ? (
                <div className={styles.loadingBox}>Cargando…</div>
              ) : (
                <>
                  <div className={styles.datosBloque}>
                    <p className={styles.etiqueta}>Email</p>
                    <p className={styles.datoFijo}>{email || "—"}</p>
                  </div>

                  <form className={styles.form} onSubmit={handleGuardar}>
                    <div className={styles.inputWrapper}>
                      <label className={styles.etiqueta} htmlFor="mi-cuenta-nombre">
                        Nombre
                      </label>
                      <div className={styles.inputCaja}>
                        <span className={styles.inputIcon} aria-hidden="true">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M20 21a8 8 0 10-16 0" />
                            <circle cx="12" cy="8" r="4" />
                          </svg>
                        </span>
                        <input
                          id="mi-cuenta-nombre"
                          className={`${styles.input} ${errorNombre ? styles.inputError : ""}`}
                          placeholder="Nombre"
                          value={nombre}
                          onChange={(e) => {
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
                      <label className={styles.etiqueta} htmlFor="mi-cuenta-apellido">
                        Apellido
                      </label>
                      <div className={styles.inputCaja}>
                        <span className={styles.inputIcon} aria-hidden="true">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M20 21a8 8 0 10-16 0" />
                            <circle cx="12" cy="8" r="4" />
                          </svg>
                        </span>
                        <input
                          id="mi-cuenta-apellido"
                          className={`${styles.input} ${errorApellido ? styles.inputError : ""}`}
                          placeholder="Apellido"
                          value={apellido}
                          onChange={(e) => {
                            setApellido(e.target.value);
                            setErrorApellido(null);
                          }}
                        />
                      </div>
                      {errorApellido && (
                        <p className={styles.errorCampo}>{errorApellido}</p>
                      )}
                    </div>

                    <div className={styles.inputWrapper}>
                      <label className={styles.etiqueta} htmlFor="mi-cuenta-telefono">
                        Teléfono
                      </label>
                      <div className={styles.inputCaja}>
                        <span className={styles.inputIcon} aria-hidden="true">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M4 5a2 2 0 012-2h2.09a2 2 0 011.9 1.37l.72 2.16a2 2 0 01-.45 2.08l-1.21 1.2a14.05 14.05 0 006.06 6.06l1.2-1.21a2 2 0 012.08-.45l2.16.72A2 2 0 0121 16.91V19a2 2 0 01-2 2h-1C8.82 21 3 15.18 3 8V7a2 2 0 012-2z" />
                          </svg>
                        </span>
                        <input
                          id="mi-cuenta-telefono"
                          className={`${styles.input} ${errorTelefono ? styles.inputError : ""}`}
                          placeholder="Teléfono"
                          type="tel"
                          inputMode="numeric"
                          maxLength={10}
                          value={telefono}
                          onChange={(e) => {
                            setTelefono(e.target.value.replace(/\D/g, ""));
                            setErrorTelefono(null);
                          }}
                        />
                      </div>
                      {errorTelefono && (
                        <p className={styles.errorCampo}>{errorTelefono}</p>
                      )}
                    </div>

                    {errorGeneral && (
                      <p className={styles.error}>{errorGeneral}</p>
                    )}
                    {exito && (
                      <p className={styles.exito}>Datos actualizados.</p>
                    )}

                    <button className={styles.boton} disabled={guardando}>
                      {guardando ? "Guardando…" : "Guardar cambios"}
                    </button>
                  </form>
                </>
              )}
              {errorPerfil && <p className={styles.error}>{errorPerfil}</p>}
            </section>

            <section className={styles.seccion}>
              <h2 className={styles.seccionTitulo}>Historial de pedidos</h2>
              {cargandoPedidos ? (
                <div className={styles.loadingBox}>Cargando…</div>
              ) : errorPedidos ? (
                <p className={styles.error}>{errorPedidos}</p>
              ) : pedidos.length === 0 ? (
                <div className={styles.emptyBox}>
                  <p className={styles.emptyTexto}>
                    Todavía no hiciste ningún pedido.
                  </p>
                  <Link to="/productos" className={styles.emptyLink}>
                    Ver productos
                  </Link>
                </div>
              ) : (
                <ul className={styles.pedidosLista}>
                  {pedidos.map((pedido) => {
                    const items = itemsPorPedido[pedido.id] ?? [];
                    const total = items.reduce(
                      (acc, item) => acc + item.precio_unitario * item.cantidad,
                      0,
                    );
                    return (
                      <li key={pedido.id} className={styles.pedidoFila}>
                        <div className={styles.pedidoInfo}>
                          <div className={styles.pedidoCabecera}>
                            <p className={styles.pedidoFecha}>
                              {new Date(pedido.creado_en).toLocaleDateString()}
                            </p>
                            <span
                              className={`${styles.estadoBadge} ${styles[`estado_${pedido.estado}`] ?? ""}`}
                            >
                              {formatEstadoPedido(pedido.estado)}
                            </span>
                          </div>
                          <p className={styles.pedidoItems}>
                            {items
                              .map((item) => `${item.nombre_producto} ×${item.cantidad}`)
                              .join(" · ")}
                          </p>
                        </div>

                        <div className={styles.pedidoLado}>
                          <p className={styles.pedidoTotal}>{formatPrecio(total)}</p>
                          <button
                            type="button"
                            className={styles.verBoton}
                            onClick={() => abrirModalPedido(pedido.id)}
                          >
                            Ver detalle
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>
        <PedidoDetalleModal
          abierto={pedidoAbierto !== null}
          onCerrar={cerrarModalPedido}
          pedido={
            pedidoAbierto
              ? (pedidos.find((p) => p.id === pedidoAbierto) ?? null)
              : null
          }
          items={pedidoAbierto ? (itemsPorPedido[pedidoAbierto] ?? []) : []}
          imagenesPorProducto={imagenesPorProducto}
          cargandoImagenes={cargandoImagenes}
        />
      </main>
      <Footer />
    </div>
  );
}
