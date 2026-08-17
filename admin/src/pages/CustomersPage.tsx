import { useCallback, useEffect, useState } from "react";
import ExcelJS from "exceljs";
import { supabase, mapearCliente } from "@shared";
import type { Cliente } from "@shared";
import LoadingState from "../components/LoadingState";
import ErrorState from "../components/ErrorState";
import { useConfirm } from "../context/ConfirmContext";
import styles from "./CustomersPage.module.css";

function nombreCompleto(cliente: Cliente): string {
  return `${cliente.nombre} ${cliente.apellido}`.trim();
}

export default function CustomersPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const { toast } = useConfirm();

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from("clientes")
      .select("*")
      .order("creado_en", { ascending: false });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    setClientes((data ?? []).map(mapearCliente));
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

  const busquedaNormalizada = busqueda.trim().toLowerCase();

  const filtrados = clientes.filter((cliente) => {
    if (!busquedaNormalizada) {
      return true;
    }

    const texto =
      `${cliente.nombre} ${cliente.apellido} ${cliente.email}`.toLowerCase();

    return texto.includes(busquedaNormalizada);
  });

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState mensaje={error} onReintentar={cargar} />;
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2>Clientes</h2>

        <div className={styles.busquedaOrden}>
          <label className={styles.busquedaOrden}>
            <input
              className={styles.inputBusqueda}
              type="text"
              placeholder="Buscar cliente..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </label>

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
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValor}>{clientes.length}</span>
          <span className={styles.statEtiqueta}>Total</span>
        </div>
      </div>

      {filtrados.length === 0 ? (
        <div className={styles.estadoVacio}>
          <p className={styles.vacio}>
            {busquedaNormalizada
              ? `No se encontraron clientes con «${busqueda}».`
              : "No hay clientes registrados."}
          </p>
        </div>
      ) : (
        <div className={styles.lista}>
          {filtrados.map((cliente) => (
            <article key={cliente.id} className={styles.cliente}>
              <div className={styles.identidad}>
                <span className={styles.avatarCliente}>
                  {cliente.nombre.charAt(0).toUpperCase()}
                </span>

                <div className={styles.nombre}>{nombreCompleto(cliente)}</div>
              </div>

              <div className={styles.campoEmail}>
                <a
                  className={styles.contactoLinkEmail}
                  href={`mailto:${cliente.email}`}
                  title={cliente.email}
                >
                  {cliente.email}
                </a>

                <button
                  className={styles.btnCopiar}
                  type="button"
                  onClick={() =>
                    navigator.clipboard
                      .writeText(cliente.email)
                      .then(() => toast("Email copiado."))
                      .catch(() => {})
                  }
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
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
              </div>

              <div className={styles.campoTelefono}>
                {cliente.telefono ? (
                  <>
                    <a
                      className={styles.contactoLink}
                      href={`tel:${cliente.telefono}`}
                    >
                      {cliente.telefono}
                    </a>

                    <button
                      className={styles.btnCopiar}
                      type="button"
                      onClick={() =>
                        navigator.clipboard
                          .writeText(cliente.telefono ?? "")
                          .then(() => toast("Teléfono copiado."))
                          .catch(() => {})
                      }
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
                  </>
                ) : (
                  <span className={styles.valor}>—</span>
                )}
              </div>

              <div className={styles.creadoEn}>
                {new Date(cliente.creado_en).toLocaleDateString()}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
