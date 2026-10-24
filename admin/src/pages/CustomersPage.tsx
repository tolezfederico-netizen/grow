import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ExcelJS from "exceljs";
import {
  supabase,
  mapearCliente,
  formatPrecio,
  formatEstadoPedido,
  formatTelefonoAR,
  linkWhatsapp,
} from "@shared";
import type { Cliente, EstadoPedido } from "@shared";
import { useModalAccesible } from "../hooks/useModalAccesible";
import { iconoEstado } from "../utils/iconoEstado";
import LoadingState from "../components/LoadingState";
import ErrorState from "../components/ErrorState";
import { useConfirm } from "../context/ConfirmContext";
import styles from "./CustomersPage.module.css";

function nombreCompleto(cliente: Cliente): string {
  return `${cliente.nombre} ${cliente.apellido}`.trim();
}

/** Pedido resumido para el conteo y el detalle de cada cliente. */
interface PedidoCliente {
  id: string;
  usuario_id: string | null;
  cliente_email: string;
  total: number;
  estado: EstadoPedido;
  creado_en: string;
}

type OrdenClientes = "recientes" | "pedidos" | "nombre";

function iniciales(cliente: Cliente): string {
  const texto = `${cliente.nombre.charAt(0)}${cliente.apellido.charAt(0)}`;
  return texto.toUpperCase() || "?";
}

/** "hoy", "ayer", "hace 3 d", "hace 2 meses" (en días de calendario). */
function haceCuanto(iso: string): string {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fecha = new Date(iso);
  fecha.setHours(0, 0, 0, 0);
  const dias = Math.round((hoy.getTime() - fecha.getTime()) / 86_400_000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 60) return `hace ${dias} d`;
  return `hace ${Math.floor(dias / 30)} meses`;
}

function claseEstado(estado: string): string {
  const map: Record<string, string> = {
    pendiente: styles.estadoPendiente,
    confirmado: styles.estadoConfirmado,
    listo_para_retirar: styles.estadoListo,
    completado: styles.estadoCompletado,
    cancelado: styles.estadoCancelado,
  };
  return map[estado] ?? "";
}

function CopiarIcono() {
  return (
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
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

interface DetalleProps {
  cliente: Cliente;
  pedidos: PedidoCliente[];
  onCerrar: () => void;
  onCopiar: (texto: string, aviso: string) => void;
}

function DetalleCliente({ cliente, pedidos, onCerrar, onCopiar }: DetalleProps) {
  const modalRef = useModalAccesible<HTMLDivElement>(true, onCerrar);
  const totalCompletado = pedidos
    .filter((p) => p.estado === "completado")
    .reduce((sum, p) => sum + p.total, 0);

  return (
    <div className={styles.overlay} onClick={onCerrar}>
      <div
        ref={modalRef}
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
      >
        <div className={styles.modalHeader}>
          <span className={styles.avatarCliente}>{iniciales(cliente)}</span>
          <h2 className={styles.modalTitulo}>
            {nombreCompleto(cliente) || "Sin nombre"}
          </h2>
          <button
            type="button"
            className={styles.btnCerrar}
            onClick={onCerrar}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className={styles.modalCuerpo}>
          <div className={styles.datos}>
            <div className={styles.dato}>
              <span className={styles.etiqueta}>Email</span>
              <span className={styles.valorFila}>
                <a className={styles.contactoLink} href={`mailto:${cliente.email}`}>
                  {cliente.email}
                </a>
                <button
                  className={styles.btnCopiar}
                  type="button"
                  onClick={() => onCopiar(cliente.email, "Email copiado.")}
                  aria-label="Copiar email"
                >
                  <CopiarIcono />
                </button>
              </span>
            </div>
            <div className={styles.dato}>
              <span className={styles.etiqueta}>Teléfono</span>
              {cliente.telefono ? (
                <span className={styles.valorFila}>
                  <a
                    className={styles.contactoLink}
                    href={linkWhatsapp(cliente.telefono)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {formatTelefonoAR(cliente.telefono)}
                  </a>
                  <button
                    className={styles.btnCopiar}
                    type="button"
                    onClick={() => onCopiar(cliente.telefono ?? "", "Teléfono copiado.")}
                    aria-label="Copiar teléfono"
                  >
                    <CopiarIcono />
                  </button>
                </span>
              ) : (
                <span className={styles.valor}>—</span>
              )}
            </div>
            <div className={styles.dato}>
              <span className={styles.etiqueta}>Registrado</span>
              <span className={styles.valor}>
                {new Date(cliente.creado_en).toLocaleDateString()}
              </span>
            </div>
            <div className={styles.dato}>
              <span className={styles.etiqueta}>Retirado en total</span>
              <span className={styles.valorMonto}>{formatPrecio(totalCompletado)}</span>
            </div>
          </div>

          <p className={styles.seccionTitulo}>
            Reservas ({pedidos.length})
          </p>
          {pedidos.length === 0 ? (
            <p className={styles.vacioDetalle}>Todavía no hizo reservas.</p>
          ) : (
            <div className={styles.pedidosLista}>
              {pedidos.map((p) => (
                <Link key={p.id} to={`/pedidos?id=${p.id}`} className={styles.pedidoFila}>
                  <span className={styles.pedidoFecha}>
                    {new Date(p.creado_en).toLocaleDateString()}
                  </span>
                  <span className={`${styles.badge} ${claseEstado(p.estado)}`}>
                    {iconoEstado(p.estado)}
                    {formatEstadoPedido(p.estado)}
                  </span>
                  <span className={styles.pedidoTotal}>{formatPrecio(p.total)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [pedidos, setPedidos] = useState<PedidoCliente[]>([]);
  const [orden, setOrden] = useState<OrdenClientes>("recientes");
  const [seleccionado, setSeleccionado] = useState<Cliente | null>(null);
  const { toast } = useConfirm();

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [resClientes, resPedidos] = await Promise.all([
      supabase
        .from("clientes")
        .select("*")
        .order("creado_en", { ascending: false }),
      supabase
        .from("pedidos")
        .select("id, usuario_id, cliente_email, total, estado, creado_en")
        .eq("eliminado", false)
        .order("creado_en", { ascending: false }),
    ]);

    const err = resClientes.error ?? resPedidos.error;
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    setClientes((resClientes.data ?? []).map(mapearCliente));
    setPedidos((resPedidos.data ?? []) as PedidoCliente[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const exportarExcel = useCallback(async () => {
    if (clientes.length === 0) {
      toast("No hay clientes para exportar.");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const hoja = workbook.addWorksheet("Clientes");

    hoja.columns = [
      { header: "Nombre", key: "nombre", width: 28 },
      { header: "Email", key: "email", width: 30 },
      { header: "Teléfono", key: "telefono", width: 18 },
      { header: "Fecha de registro", key: "fecha", width: 18 },
    ];

    clientes.forEach((cliente) => {
      hoja.addRow({
        nombre: nombreCompleto(cliente),
        email: cliente.email,
        telefono: cliente.telefono || "—",
        fecha: new Date(cliente.creado_en).toLocaleDateString(),
      });
    });

    const filaEncabezado = hoja.getRow(1);

    filaEncabezado.eachCell((celda) => {
      celda.font = {
        bold: true,
        color: { argb: "FF221E1F" },
      };

      celda.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFDCE05" },
      };

      celda.alignment = {
        vertical: "middle",
      };
    });

    const buffer = await workbook.xlsx.writeBuffer();

    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    const fechaArchivo = new Date().toISOString().slice(0, 10);

    enlace.href = url;
    enlace.download = `Clientes_Grow_${fechaArchivo}.xlsx`;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);

    URL.revokeObjectURL(url);
  }, [clientes, toast]);

  // Pedidos del cliente: los hechos con su cuenta o, como invitado, con su email
  const pedidosDe = useCallback(
    (cliente: Cliente) =>
      pedidos.filter(
        (p) =>
          p.usuario_id === cliente.id ||
          p.cliente_email.toLowerCase() === cliente.email.toLowerCase(),
      ),
    [pedidos],
  );

  const copiar = useCallback(
    (texto: string, aviso: string) => {
      navigator.clipboard
        .writeText(texto)
        .then(() => toast(aviso))
        .catch(() => {});
    },
    [toast],
  );

  const busquedaNormalizada = busqueda.trim().toLowerCase();

  const filtrados = clientes.filter((cliente) => {
    if (!busquedaNormalizada) {
      return true;
    }

    const texto =
      `${cliente.nombre} ${cliente.apellido} ${cliente.email} ${cliente.telefono ?? ""}`.toLowerCase();

    return texto.includes(busquedaNormalizada);
  });

  const ordenados = [...filtrados].sort((a, b) => {
    if (orden === "pedidos") return pedidosDe(b).length - pedidosDe(a).length;
    if (orden === "nombre")
      return nombreCompleto(a).localeCompare(nombreCompleto(b), "es");
    return new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime();
  });

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState mensaje={error} onReintentar={cargar} />;
  }

  const ordenes: { valor: OrdenClientes; texto: string }[] = [
    { valor: "recientes", texto: "Recientes" },
    { valor: "pedidos", texto: "Más reservas" },
    { valor: "nombre", texto: "Nombre A–Z" },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.barra}>
        <label className={styles.busquedaLabel}>
          <input
            className={styles.inputBusqueda}
            type="text"
            placeholder="Buscar por nombre, email o teléfono..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </label>
        <div className={styles.ordenes}>
          <span className={styles.ordenesLabel}>Ordenar</span>
          {ordenes.map((o) => (
            <button
              key={o.valor}
              type="button"
              className={`${styles.chip} ${orden === o.valor ? styles.chipActivo : ""}`}
              onClick={() => setOrden(o.valor)}
            >
              {o.texto}
            </button>
          ))}
        </div>
        <button
          className={styles.btnExportar}
          type="button"
          onClick={exportarExcel}
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
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Descargar Excel
        </button>
      </div>

      <p className={styles.totalClientes}>
        {busquedaNormalizada
          ? `${filtrados.length} de ${clientes.length} clientes`
          : `${clientes.length} cliente${clientes.length !== 1 ? "s" : ""} registrado${clientes.length !== 1 ? "s" : ""}`}
      </p>

      {ordenados.length === 0 ? (
        <div className={styles.estadoVacio}>
          <p className={styles.vacio}>
            {busquedaNormalizada
              ? `No se encontraron clientes con «${busqueda}».`
              : "No hay clientes registrados."}
          </p>
        </div>
      ) : (
        <div className={styles.grilla}>
          {ordenados.map((cliente) => {
            const suyos = pedidosDe(cliente);
            const ultimo = suyos[0];
            return (
              <button
                key={cliente.id}
                type="button"
                className={styles.card}
                onClick={() => setSeleccionado(cliente)}
              >
                <span className={styles.avatarCliente}>{iniciales(cliente)}</span>
                <span className={styles.cardDatos}>
                  <span className={styles.nombre}>
                    {nombreCompleto(cliente) || (
                      <span className={styles.sinNombre}>Sin nombre</span>
                    )}
                  </span>
                  <span className={styles.cardLinea}>
                    {formatTelefonoAR(cliente.telefono) || "Sin teléfono"}
                  </span>
                  <span className={styles.cardLinea} title={cliente.email}>
                    {cliente.email}
                  </span>
                  <span className={styles.cardPie}>
                    {ultimo
                      ? `Última reserva ${haceCuanto(ultimo.creado_en)}`
                      : `Registrado ${haceCuanto(cliente.creado_en)}`}
                  </span>
                </span>
                <span
                  className={`${styles.badgePedidos} ${suyos.length === 0 ? styles.badgeSinPedidos : ""}`}
                >
                  {suyos.length} reserva{suyos.length !== 1 ? "s" : ""}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {seleccionado && (
        <DetalleCliente
          cliente={seleccionado}
          pedidos={pedidosDe(seleccionado)}
          onCerrar={() => setSeleccionado(null)}
          onCopiar={copiar}
        />
      )}
    </div>
  );
}
