import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  supabase,
  formatPrecio,
  formatEstadoPedido,
  mapearPedido,
  mapearPedidoItem,
  ESTADOS_PEDIDO,
} from "@shared";
import type { Pedido, PedidoItem, EstadoPedido } from "@shared";
import LoadingState from "../components/LoadingState";
import { useConfirm } from "../context/ConfirmContext";
import ErrorState from "../components/ErrorState";
import NotificarPedidoModal from "../components/NotificarPedidoModal";
import { iconoEstado } from "../utils/iconoEstado";
import styles from "./OrdersPage.module.css";

const TRANSICIONES: Record<string, EstadoPedido[]> = {
  pendiente: ["confirmado", "cancelado"],
  confirmado: ["listo_para_retirar", "cancelado"],
  listo_para_retirar: ["completado", "cancelado"],
  completado: [],
  cancelado: [],
};

interface PedidoConItems extends Pedido {
  items: PedidoItem[];
}

/** Ventana inicial del listado: los pedidos más viejos se cargan a pedido. */
const DIAS_VISIBLES = 30;
const ESTADOS_ABIERTOS: EstadoPedido[] = ["pendiente", "confirmado", "listo_para_retirar"];
/** Un pendiente con más horas que esto se marca como "Sin atender". */
const HORAS_SIN_ATENDER = 24;

function diasDesde(iso: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fecha = new Date(iso);
  fecha.setHours(0, 0, 0, 0);
  return Math.round((hoy.getTime() - fecha.getTime()) / 86_400_000);
}

function grupoFecha(iso: string): string {
  const dias = diasDesde(iso);
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Ayer";
  if (dias < 7) return "Esta semana";
  if (dias < DIAS_VISIBLES) return "Este mes";
  return "Más antiguos";
}

/** "21/10 22:13"; agrega el año si no es el actual. */
function formatFecha(iso: string): string {
  const fecha = new Date(iso);
  const hora = fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
  const anio = fecha.getFullYear() !== new Date().getFullYear() ? `/${fecha.getFullYear()}` : "";
  return `${fecha.getDate()}/${fecha.getMonth() + 1}${anio} ${hora}`;
}

/** Bloques consecutivos por fecha; sin título cuando el orden no es cronológico. */
function agruparPorFecha<T extends Pedido>(
  pedidos: T[],
  porFecha: boolean,
): { titulo: string | null; pedidos: T[] }[] {
  if (!porFecha) return [{ titulo: null, pedidos }];
  const grupos: { titulo: string; pedidos: T[] }[] = [];
  pedidos.forEach((p) => {
    const titulo = grupoFecha(p.creado_en);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.titulo === titulo) ultimo.pedidos.push(p);
    else grupos.push({ titulo, pedidos: [p] });
  });
  return grupos;
}

function sinAtender(p: Pedido): boolean {
  return p.estado === "pendiente" && Date.now() - new Date(p.creado_en).getTime() > HORAS_SIN_ATENDER * 3_600_000;
}

function claseEstado(estado: string): string {
  const map: Record<string, string> = {
    pendiente: styles.estadoPendiente,
    confirmado: styles.estadoConfirmado,
    listo_para_retirar: styles.estadoListoParaRetirar,
    completado: styles.estadoCompletado,
    cancelado: styles.estadoCancelado,
  };
  return map[estado] ?? "";
}

function claseBotonFiltro(estado: string): string {
  const map: Record<string, string> = {
    pendiente: styles.btnFiltroPendiente,
    confirmado: styles.btnFiltroConfirmado,
    listo_para_retirar: styles.btnFiltroListoParaRetirar,
    completado: styles.btnFiltroCompletado,
    cancelado: styles.btnFiltroCancelado,
  };
  return map[estado] ?? "";
}

function claseBotonFiltroActivo(estado: string): string {
  const map: Record<string, string> = {
    pendiente: styles.btnFiltroPendienteActivo,
    confirmado: styles.btnFiltroConfirmadoActivo,
    listo_para_retirar: styles.btnFiltroListoParaRetirarActivo,
    completado: styles.btnFiltroCompletadoActivo,
    cancelado: styles.btnFiltroCanceladoActivo,
  };
  return map[estado] ?? "";
}

function claseBotonTransicion(estado: string): string {
  const map: Record<string, string> = {
    confirmado: styles.btnEstadoConfirmado,
    listo_para_retirar: styles.btnEstadoListoParaRetirar,
    completado: styles.btnEstadoCompletado,
    cancelado: styles.btnEstadoCancelado,
  };
  return `${styles.btnEstado} ${map[estado] ?? ""}`;
}

export default function OrdersPage() {
  const [searchParams] = useSearchParams();
  const [pedidos, setPedidos] = useState<PedidoConItems[]>([]);
  const [filtro, setFiltro] = useState<string>(
    searchParams.get("estado") ?? "",
  );
  const [mostrarEliminados, setMostrarEliminados] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Desde el Dashboard se llega con ?id= para abrir ese pedido
  const [expandido, setExpandido] = useState<string | null>(
    searchParams.get("id"),
  );
  const [notificacionPendiente, setNotificacionPendiente] = useState<{
    pedido: PedidoConItems;
    estadoDestino: EstadoPedido;
  } | null>(null);
  const { confirm, notify, toast } = useConfirm();
  const [busqueda, setBusqueda] = useState("");
  type OrdenPedidos = "recientes" | "antiguos" | "mayor_monto" | "menor_monto";
  const [orden, setOrden] = useState<OrdenPedidos>("recientes");
  const [verAntiguos, setVerAntiguos] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Por defecto: últimos 30 días + los que siguen abiertos (sin importar la fecha)
    let consultaPedidos = supabase
      .from("pedidos")
      .select("*")
      .order("creado_en", { ascending: false });
    if (!verAntiguos) {
      const desde = new Date();
      desde.setHours(0, 0, 0, 0);
      desde.setDate(desde.getDate() - DIAS_VISIBLES);
      consultaPedidos = consultaPedidos.or(
        `creado_en.gte.${desde.toISOString()},estado.in.(${ESTADOS_ABIERTOS.join(",")})`,
      );
    }
    const resP = await consultaPedidos;

    if (resP.error) {
      setError(resP.error.message);
      setLoading(false);
      return;
    }

    // Solo los ítems de los pedidos cargados (con todo el historial, sin filtro)
    let consultaItems = supabase
      .from("pedido_items")
      .select("*, producto_variantes(nombre_variante)");
    if (!verAntiguos) {
      consultaItems = consultaItems.in(
        "pedido_id",
        (resP.data ?? []).map((p) => p.id),
      );
    }
    const resI = await consultaItems;

    if (resI.error) {
      setError(resI.error.message);
      setLoading(false);
      return;
    }

    const items = (resI.data ?? []).map(mapearPedidoItem);
    const combinados: PedidoConItems[] = (resP.data ?? []).map((p) => ({
      ...mapearPedido(p),
      items: items.filter((i) => i.pedido_id === p.id),
    }));

    setPedidos(combinados);
    setLoading(false);
  }, [verAntiguos]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const pedidosVisiblesBase = pedidos.filter(
    (p) => mostrarEliminados || !p.eliminado,
  );

  const filtrados = pedidosVisiblesBase
    .filter((p) => !filtro || p.estado === filtro)
    .filter(
      (p) =>
        !busqueda ||
        p.cliente_nombre.toLowerCase().includes(busqueda.toLowerCase()),
    );

  const filtradosOrdenados = [...filtrados].sort((a, b) => {
    switch (orden) {
      case "recientes":
        return (
          new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime()
        );
      case "antiguos":
        return (
          new Date(a.creado_en).getTime() - new Date(b.creado_en).getTime()
        );
      case "mayor_monto":
        return b.total - a.total;
      case "menor_monto":
        return a.total - b.total;
      default:
        return 0;
    }
  });

  async function cambiarEstado(pedidoId: string, nuevo: EstadoPedido) {
    if (nuevo === "confirmado" || nuevo === "listo_para_retirar") {
      const pedido = pedidos.find((p) => p.id === pedidoId);
      if (pedido) setNotificacionPendiente({ pedido, estadoDestino: nuevo });
      return;
    }
    if (nuevo === "cancelado") {
      const confirmado = await confirm(
        "¿Cancelar este pedido? Esta acción no se puede deshacer desde acá.",
        { titulo: "Cancelar pedido", textoConfirmar: "Cancelar pedido" },
      );
      if (!confirmado) return;
    }
    const { error: err } = await supabase
      .from("pedidos")
      .update({ estado: nuevo })
      .eq("id", pedidoId);
    if (err) {
      await notify(err.message, { titulo: "Error" });
      return;
    }
    toast(
      nuevo === "completado"
        ? "Pedido marcado como completado."
        : "Pedido cancelado.",
    );
    cargar();
  }

  async function confirmarConNotificacion(canales: {
    whatsapp: boolean;
    email: boolean;
  }) {
    if (!notificacionPendiente) return;
    const { pedido, estadoDestino } = notificacionPendiente;

    const whatsappWindow = canales.whatsapp ? window.open("", "_blank") : null;

    const { error: err } = await supabase
      .from("pedidos")
      .update({ estado: estadoDestino })
      .eq("id", pedido.id);
    if (err) {
      await notify(err.message, { titulo: "Error" });
      return;
    }

    if (canales.whatsapp) {
      const itemsStr = pedido.items
        .map(
          (i) =>
            `${i.cantidad}x ${i.nombre_producto}${i.nombre_variante ? ` - ${i.nombre_variante}` : ""} — ${formatPrecio(i.cantidad * i.precio_unitario)}`,
        )
        .join("\n");

      const encabezado =
        estadoDestino === "confirmado"
          ? `Hola ${pedido.cliente_nombre}, tu pedido fue confirmado ✅`
          : `Hola ${pedido.cliente_nombre}, tu pedido ya está listo para retirar 📦`;

      const cierre =
        estadoDestino === "confirmado"
          ? "Te contactamos pronto para coordinar el retiro."
          : "Te esperamos en el local.";

      const mensaje = `${encabezado}\n${itemsStr}\nTotal: ${formatPrecio(pedido.total)}\n${cierre}`;
      const url = `https://wa.me/54${pedido.cliente_telefono}?text=${encodeURIComponent(mensaje)}`;
      if (whatsappWindow) {
        whatsappWindow.location.href = url;
      } else {
        await notify(
          `El navegador bloqueó la apertura de WhatsApp. Permití pop-ups para este sitio o abrí manualmente el link.`,
          { titulo: "Pop-up bloqueado" },
        );
      }
    }

    setNotificacionPendiente(null);

    if (canales.email) {
      const { error: fnErr } = await supabase.functions.invoke(
        "enviar-notificacion-pedido",
        {
          body: {
            cliente_email: pedido.cliente_email,
            cliente_nombre: pedido.cliente_nombre,
            pedido_id: pedido.id,
            estado: estadoDestino,
            items: pedido.items,
            total: pedido.total,
          },
        },
      );
      if (fnErr) {
        const label =
          estadoDestino === "confirmado" ? "confirmó" : "marcó como listo";
        await notify(
          `El pedido se ${label} pero el email no pudo enviarse: ${fnErr.message}`,
          { titulo: "Error de notificación" },
        );
      }
    }

    toast(
      estadoDestino === "confirmado"
        ? "Pedido confirmado."
        : "Pedido marcado como listo para retirar.",
    );
    cargar();
  }

  async function toggleEliminado(pedidoId: string, actual: boolean) {
    const mensaje = actual
      ? "¿Restaurar este pedido? Volverá a aparecer en el listado normal."
      : '¿Eliminar este pedido? Podés restaurarlo después activando "Mostrar eliminados".';
    const confirmado = await confirm(mensaje, {
      titulo: actual ? "Restaurar pedido" : "Eliminar pedido",
      textoConfirmar: actual ? "Restaurar" : "Eliminar",
    });
    if (!confirmado) return;
    const { error: err } = await supabase
      .from("pedidos")
      .update({ eliminado: !actual })
      .eq("id", pedidoId);
    if (err) {
      await notify(err.message, { titulo: "Error" });
      return;
    }
    toast(actual ? "Pedido restaurado." : "Pedido eliminado.");
    cargar();
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState mensaje={error} onReintentar={cargar} />;

  return (
    <div className={styles.page}>
      <div className={styles.barra}>
        <div className={styles.filaSecundaria}>
          <label className={styles.busquedaLabel}>
            <input
              className={styles.inputBusqueda}
              type="text"
              placeholder="Buscar cliente..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {busqueda && (
              <button
                className={styles.btnLimpiarBusqueda}
                onClick={() => setBusqueda("")}
                type="button"
                aria-label="Limpiar búsqueda"
              >
                ✕
              </button>
            )}
          </label>
          <select
            className={styles.selectOrden}
            value={orden}
            onChange={(e) => setOrden(e.target.value as OrdenPedidos)}
            aria-label="Ordenar pedidos"
          >
            <option value="recientes">Más recientes</option>
            <option value="antiguos">Más antiguos</option>
            <option value="mayor_monto">Mayor monto</option>
            <option value="menor_monto">Menor monto</option>
          </select>
          <label className={styles.checkEliminados}>
            <input
              type="checkbox"
              className={styles.checkboxHidden}
              checked={mostrarEliminados}
              onChange={(e) => setMostrarEliminados(e.target.checked)}
            />
            <span className={styles.toggleSlider}></span>
            Mostrar eliminados
          </label>
        </div>
        <div className={styles.filtroBotones}>
          <button
            className={`${styles.btnFiltroEstado} ${filtro === "" ? styles.btnFiltroEstadoActivo : ""}`}
            onClick={() => setFiltro("")}
          >
            Todos{" "}
            <span className={styles.contadorEstado}>
              {pedidosVisiblesBase.length}
            </span>
          </button>
          {ESTADOS_PEDIDO.map((e) => (
            <button
              key={e}
              className={`${styles.btnFiltroEstado} ${claseBotonFiltro(e)} ${filtro === e ? claseBotonFiltroActivo(e) : ""}`}
              onClick={() => setFiltro(e)}
            >
              {iconoEstado(e)}
              {formatEstadoPedido(e)}{" "}
              <span className={styles.contadorEstado}>
                {pedidosVisiblesBase.filter((p) => p.estado === e).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {filtrados.length === 0 ? (
        <div className={styles.estadoVacio}>
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
            <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
            <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
          </svg>
          <p className={styles.vacio}>No hay pedidos.</p>
          {filtro !== "" && (
            <p className={styles.vacioSecundario}>
              No hay pedidos con el estado «{formatEstadoPedido(filtro)}».
              <button
                className={styles.btnVerTodos}
                onClick={() => setFiltro("")}
              >
                Ver todos
              </button>
            </p>
          )}
        </div>
      ) : (
        <div className={styles.grupos}>
          {agruparPorFecha(
            filtradosOrdenados,
            orden === "recientes" || orden === "antiguos",
          ).map((g) => (
            <section key={g.titulo ?? "todos"}>
              {g.titulo && <h3 className={styles.grupo}>{g.titulo}</h3>}
              <div className={styles.lista}>
          {g.pedidos.map((p) => {
            const disponibles = TRANSICIONES[p.estado] ?? [];
            return (
              <div
                key={p.id}
                className={`${styles.pedido} ${p.eliminado ? styles.eliminado : ""} ${expandido === p.id ? styles.pedidoExpandido : ""}`}
              >
                <div
                  className={styles.resumen}
                  onClick={() => setExpandido(expandido === p.id ? null : p.id)}
                >
                  <span className={styles.avatarCliente}>
                    {p.cliente_nombre.charAt(0).toUpperCase()}
                  </span>
                  <span className={styles.cliente}>
                    {p.cliente_nombre}
                    {sinAtender(p) && (
                      <span className={styles.badgeSinAtender}>Sin atender</span>
                    )}
                    {p.eliminado && (
                      <span className={styles.badgeEliminado}>Eliminado</span>
                    )}
                  </span>
                  <span className={`${styles.estado} ${claseEstado(p.estado)}`}>
                    {iconoEstado(p.estado)}
                    {formatEstadoPedido(p.estado)}
                  </span>
                  <span className={styles.total}>{formatPrecio(p.total)}</span>
                  <span className={styles.cantidadItems}>
                    {p.items.length} producto{p.items.length !== 1 ? "s" : ""}
                  </span>
                  <span className={styles.fecha}>{formatFecha(p.creado_en)}</span>
                  <span className={styles.arrow}>
                    {expandido === p.id ? "▾" : "▸"}
                  </span>
                </div>

                {expandido === p.id && (
                  <div className={styles.detalle}>
                    <p>
                      <strong>Tel:</strong>
                      <a
                        href={`https://wa.me/54${p.cliente_telefono}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.contactoLink}
                      >
                        {p.cliente_telefono}
                      </a>
                      <button
                        className={styles.btnCopiar}
                        type="button"
                        onClick={() => {
                          navigator.clipboard
                            .writeText(p.cliente_telefono)
                            .then(() => toast("Teléfono copiado."))
                            .catch(() => {});
                        }}
                        aria-label="Copiar teléfono"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <rect
                            x="9"
                            y="9"
                            width="13"
                            height="13"
                            rx="2"
                            ry="2"
                          />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>
                    </p>
                    <p>
                      <strong>Email:</strong>
                      <a
                        href={`mailto:${p.cliente_email}`}
                        className={styles.contactoLink}
                      >
                        {p.cliente_email}
                      </a>
                      <button
                        className={styles.btnCopiar}
                        type="button"
                        onClick={() => {
                          navigator.clipboard
                            .writeText(p.cliente_email)
                            .then(() => toast("Email copiado."))
                            .catch(() => {});
                        }}
                        aria-label="Copiar email"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <rect
                            x="9"
                            y="9"
                            width="13"
                            height="13"
                            rx="2"
                            ry="2"
                          />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>
                    </p>
                    <div className={styles.tablaWrapper}>
                      <table className={styles.itemsTable}>
                        <thead>
                          <tr>
                            <th>Producto</th>
                            <th>Variante</th>
                            <th>Cant</th>
                            <th>P.U.</th>
                            <th>Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.items.map((i) => (
                            <tr key={i.id}>
                              <td>{i.nombre_producto}</td>
                              <td>{i.nombre_variante ?? "—"}</td>
                              <td>{i.cantidad}</td>
                              <td>{formatPrecio(i.precio_unitario)}</td>
                              <td>
                                {formatPrecio(i.cantidad * i.precio_unitario)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className={styles.totalRow}>
                            <td colSpan={4}>Total</td>
                            <td className={styles.totalValue}>
                              {formatPrecio(p.total)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <div className={styles.accionesPedido}>
                      {disponibles.length > 0 && (
                        <div className={styles.transiciones}>
                          {disponibles.map((est) => (
                            <button
                              key={est}
                              className={claseBotonTransicion(est)}
                              onClick={() => cambiarEstado(p.id, est)}
                            >
                              {iconoEstado(est)}
                              Marcar como «{formatEstadoPedido(est)}»
                            </button>
                          ))}
                        </div>
                      )}
                      <button
                        className={styles.btnEliminar}
                        onClick={() => toggleEliminado(p.id, p.eliminado)}
                      >
                        {p.eliminado ? (
                          <>
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <polyline points="1 4 1 10 7 10" />
                              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                            </svg>
                            Restaurar pedido
                          </>
                        ) : (
                          <>
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              <line x1="10" y1="11" x2="10" y2="17" />
                              <line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                            Eliminar pedido
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className={styles.pieListado}>
        <p>
          {verAntiguos
            ? "Se muestran todos los pedidos."
            : `Se muestran los pedidos de los últimos ${DIAS_VISIBLES} días y los que siguen abiertos.`}
        </p>
        <button
          className={styles.btnVerTodos}
          onClick={() => setVerAntiguos((v) => !v)}
        >
          {verAntiguos ? "Ocultar pedidos antiguos" : "Ver pedidos más antiguos"}
        </button>
      </div>

      {notificacionPendiente && (
        <NotificarPedidoModal
          clienteNombre={notificacionPendiente.pedido.cliente_nombre}
          clienteTelefono={notificacionPendiente.pedido.cliente_telefono}
          clienteEmail={notificacionPendiente.pedido.cliente_email}
          estadoDestino={notificacionPendiente.estadoDestino}
          onConfirmar={confirmarConNotificacion}
          onCancelar={() => setNotificacionPendiente(null)}
        />
      )}
    </div>
  );
}
