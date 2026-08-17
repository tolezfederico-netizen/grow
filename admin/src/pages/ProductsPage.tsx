import { useEffect, useState, useCallback, useRef } from "react";
import {
  supabase,
  formatPrecio,
  mapearCategoria,
  mapearProductoVariante,
} from "@shared";
import type { Categoria, ProductoCategoria, ProductoVariante } from "@shared";
import ProductForm from "../components/ProductForm";
import { useConfirm } from "../context/ConfirmContext";
import LoadingState from "../components/LoadingState";
import ErrorState from "../components/ErrorState";
import styles from "./ProductsPage.module.css";

interface ProductoRow {
  id: string;
  nombre: string;
  descripcion: string | null;
  imagen_url: string | null;
  tiene_variantes: boolean;
  precio_base: number | null;
  estado: string;
  destacado: boolean;
  creado_en: string;
  especificaciones: string | null;
}

export default function ProductsPage() {
  const [productos, setProductos] = useState<ProductoRow[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [relaciones, setRelaciones] = useState<ProductoCategoria[]>([]);
  const [variantes, setVariantes] = useState<ProductoVariante[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [completitudFiltro, setCompletitudFiltro] = useState("");
  const [editando, setEditando] = useState<ProductoRow | null>(null);
  const [creando, setCreando] = useState(false);
  const [modoAccion, setModoAccion] = useState<
    "eliminar" | "pausar" | "sin_stock" | null
  >(null);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const { confirm, notify, toast } = useConfirm();
  const inputBusquedaRef = useRef<HTMLInputElement>(null);

  function labelEstado(estado: string): string {
    if (estado === "sin_stock") return "Sin stock";
    if (estado === "disponible") return "Disponible";
    if (estado === "pausado") return "Pausado";
    return estado;
  }

  function estadoCompletitud(p: ProductoRow): {
    completo: boolean;
    mensaje: string;
  } {
    const tieneDesc = p.descripcion && p.descripcion.trim() !== "";
    const tieneEspecs = p.especificaciones && p.especificaciones.trim() !== "";
    if (tieneDesc && tieneEspecs)
      return { completo: true, mensaje: "Información completa" };
    if (!tieneDesc && !tieneEspecs)
      return {
        completo: false,
        mensaje: "Falta descripción y especificaciones",
      };
    if (!tieneDesc) return { completo: false, mensaje: "Falta descripción" };
    return { completo: false, mensaje: "Falta especificaciones" };
  }

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [r1, r2, r3, r4] = await Promise.all([
      supabase
        .from("productos")
        .select("*")
        .order("creado_en", { ascending: false }),
      supabase.from("categorias").select("*"),
      supabase.from("producto_categorias").select("*"),
      supabase.from("producto_variantes").select("*"),
    ]);
    if (r1.error) {
      setError(r1.error.message);
      setLoading(false);
      return;
    }
    if (r2.error) {
      setError(r2.error.message);
      setLoading(false);
      return;
    }
    if (r3.error) {
      setError(r3.error.message);
      setLoading(false);
      return;
    }
    if (r4.error) {
      setError(r4.error.message);
      setLoading(false);
      return;
    }
    setProductos(r1.data);
    setCategorias((r2.data ?? []).map(mapearCategoria));
    setRelaciones(r3.data ?? []);
    setVariantes((r4.data ?? []).map(mapearProductoVariante));
    setLoading(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function toggleDestacado(p: ProductoRow) {
    if (!p.destacado && destacadosCount >= 10) {
      await notify(
        "Ya hay 10 productos destacados. Quitá alguno antes de agregar uno nuevo.",
        { titulo: "Límite alcanzado" },
      );
      return;
    }
    const { error: err } = await supabase
      .from("productos")
      .update({ destacado: !p.destacado })
      .eq("id", p.id);
    if (err) {
      await notify(err.message, { titulo: "Error" });
      return;
    }
    toast(
      p.destacado ? "Producto quitado de destacados." : "Producto destacado.",
    );
    cargar();
  }

  async function reactivar(p: ProductoRow) {
    const confirmado = await confirm(
      `¿Reactivar «${p.nombre}»? Volverá a estar disponible en el sitio.`,
      { titulo: "Reactivar producto", textoConfirmar: "Reactivar" },
    );
    if (!confirmado) return;
    const { error: err } = await supabase
      .from("productos")
      .update({ estado: "disponible" })
      .eq("id", p.id);
    if (err) {
      await notify(err.message, { titulo: "Error" });
      return;
    }
    toast("Producto reactivado.");
    cargar();
  }

  function toggleSeleccionado(id: string) {
    setSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function eliminarSeleccionados() {
    const cantidad = seleccionados.length;
    const confirmado = await confirm(`¿Eliminar ${cantidad} producto(s)?`, {
      titulo: "Eliminar productos",
      textoConfirmar: "Eliminar",
    });
    if (!confirmado) return;
    const { error: err } = await supabase
      .from("productos")
      .delete()
      .in("id", seleccionados);
    if (err) {
      if (err.code === "23503") {
        await notify(
          "Uno o más productos seleccionados están siendo usados como imagen en un panel de navegación y no pueden eliminarse. Desvinculalos del panel primero desde Paneles.",
          { titulo: "No se puede eliminar" },
        );
      } else {
        await notify(err.message, { titulo: "Error" });
      }
      return;
    }
    toast(`${cantidad} producto(s) eliminado(s).`);
    setSeleccionados([]);
    setModoAccion(null);
    cargar();
  }

  async function pausarSeleccionados() {
    const cantidad = seleccionados.length;
    const confirmado = await confirm(
      `¿Pausar ${cantidad} producto(s)? Dejarán de mostrarse en el sitio.`,
      { titulo: "Pausar productos", textoConfirmar: "Pausar" },
    );
    if (!confirmado) return;
    const { error: err } = await supabase
      .from("productos")
      .update({ estado: "pausado" })
      .in("id", seleccionados);
    if (err) {
      await notify(err.message, { titulo: "Error" });
      return;
    }
    toast(`${cantidad} producto(s) pausado(s).`);
    setSeleccionados([]);
    setModoAccion(null);
    cargar();
  }

  async function sinStockSeleccionados() {
    const cantidad = seleccionados.length;
    const confirmado = await confirm(
      `¿Marcar ${cantidad} producto(s) como sin stock?`,
      { titulo: "Marcar sin stock", textoConfirmar: "Marcar sin stock" },
    );
    if (!confirmado) return;
    const { error: err } = await supabase
      .from("productos")
      .update({ estado: "sin_stock" })
      .in("id", seleccionados);
    if (err) {
      await notify(err.message, { titulo: "Error" });
      return;
    }
    toast(`${cantidad} producto(s) marcado(s) sin stock.`);
    setSeleccionados([]);
    setModoAccion(null);
    cargar();
  }

  function categoriaIds(productoId: string) {
    return relaciones
      .filter((r) => r.producto_id === productoId)
      .map((r) => r.categoria_id);
  }

  function variantesDe(productoId: string) {
    return variantes.filter((v) => v.producto_id === productoId);
  }

  const totalProductos = productos.length;
  const disponiblesCount = productos.filter(
    (p) => p.estado === "disponible",
  ).length;
  const pausadosCount = productos.filter((p) => p.estado === "pausado").length;
  const sinStockCount = productos.filter(
    (p) => p.estado === "sin_stock",
  ).length;
  const destacadosCount = productos.filter((p) => p.destacado).length;

  const productosFiltrados = productos.filter((p) => {
    if (categoriaFiltro !== "" && !categoriaIds(p.id).includes(categoriaFiltro))
      return false;
    if (estadoFiltro !== "" && p.estado !== estadoFiltro) return false;
    if (
      busqueda.trim() !== "" &&
      !p.nombre.toLowerCase().includes(busqueda.trim().toLowerCase())
    )
      return false;
    if (completitudFiltro === "completo" && !estadoCompletitud(p).completo)
      return false;
    if (completitudFiltro === "incompleto" && estadoCompletitud(p).completo)
      return false;
    return true;
  });

  if (loading) return <LoadingState />;
  if (error) return <ErrorState mensaje={error} onReintentar={cargar} />;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2>Productos</h2>
        <div className={styles.headerBtns}>
          <button className={styles.btnNuevo} onClick={() => setCreando(true)}>
            + Nuevo
          </button>
          <button
            className={styles.btnSeleccion}
            onClick={() => {
              setSeleccionados([]);
              setModoAccion((prev) => (prev === "pausar" ? null : "pausar"));
            }}
          >
            {modoAccion === "pausar" ? "Cancelar" : "Pausar"}
          </button>
          <button
            className={styles.btnSeleccion}
            onClick={() => {
              setSeleccionados([]);
              setModoAccion((prev) =>
                prev === "eliminar" ? null : "eliminar",
              );
            }}
          >
            {modoAccion === "eliminar" ? "Cancelar" : "Eliminar"}
          </button>
          <button
            className={styles.btnSeleccion}
            onClick={() => {
              setSeleccionados([]);
              setModoAccion((prev) =>
                prev === "sin_stock" ? null : "sin_stock",
              );
            }}
          >
            {modoAccion === "sin_stock" ? "Cancelar" : "Sin Stock"}
          </button>
        </div>
      </div>

      <div className={styles.stats}>
        <div className={styles.statItem}>
          <span className={styles.statValor}>{totalProductos}</span>
          <span className={styles.statLabel}>Total</span>
        </div>
        <div className={styles.statItem}>
          <span className={`${styles.statValor} ${styles.statDisponible}`}>
            {disponiblesCount}
          </span>
          <span className={styles.statLabel}>Disponibles</span>
        </div>
        <div className={styles.statItem}>
          <span className={`${styles.statValor} ${styles.statPausado}`}>
            {pausadosCount}
          </span>
          <span className={styles.statLabel}>Pausados</span>
        </div>
        <div className={styles.statItem}>
          <span className={`${styles.statValor} ${styles.statSinStock}`}>
            {sinStockCount}
          </span>
          <span className={styles.statLabel}>Sin Stock</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValor}>{destacadosCount}/10</span>
          <span className={styles.statLabel}>Destacados</span>
        </div>
      </div>

      {modoAccion !== null && seleccionados.length > 0 && (
        <div className={styles.barraSeleccion}>
          <span className={styles.seleccionadosInfo}>
            {seleccionados.length} producto{seleccionados.length > 1 ? "s" : ""}{" "}
            seleccionado{seleccionados.length > 1 ? "s" : ""}
          </span>
          {(() => {
            const accion = (() => {
              if (modoAccion === "eliminar")
                return {
                  texto: "Eliminar",
                  fn: eliminarSeleccionados,
                  clase: styles.btnConfirmarEliminar,
                };
              if (modoAccion === "sin_stock")
                return {
                  texto: "Marcar sin stock",
                  fn: sinStockSeleccionados,
                  clase: styles.btnConfirmarSinStock,
                };
              return {
                texto: "Pausar",
                fn: pausarSeleccionados,
                clase: styles.btnConfirmarPausar,
              };
            })();
            return (
              <button
                className={`${styles.btnConfirmarAccion} ${accion.clase}`}
                onClick={accion.fn}
              >
                {accion.texto} {seleccionados.length} producto
                {seleccionados.length > 1 ? "s" : ""}
              </button>
            );
          })()}
        </div>
      )}

      <div className={styles.filtros}>
        <div className={styles.busquedaWrap}>
          <input
            ref={inputBusquedaRef}
            className={styles.inputBusqueda}
            type="text"
            placeholder="Buscar por nombre..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          {busqueda.trim() !== "" && (
            <button
              type="button"
              className={styles.btnLimpiarBusqueda}
              aria-label="Limpiar búsqueda"
              onClick={() => {
                setBusqueda("");
                inputBusquedaRef.current?.focus();
              }}
            >
              ✕
            </button>
          )}
        </div>
        <select
          className={styles.selectCategoria}
          value={categoriaFiltro}
          onChange={(e) => setCategoriaFiltro(e.target.value)}
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <select
          className={styles.selectCategoria}
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="disponible">Disponibles</option>
          <option value="pausado">Pausados</option>
          <option value="sin_stock">Sin Stock</option>
        </select>
        <select
          className={styles.selectCategoria}
          value={completitudFiltro}
          onChange={(e) => setCompletitudFiltro(e.target.value)}
        >
          <option value="">Todas</option>
          <option value="completo">Completos</option>
          <option value="incompleto">Incompletos</option>
        </select>
      </div>

      <div className={styles.tablaWrapper}>
        <table className={styles.tabla}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Estado</th>
              <th>Precio</th>
              <th>Destacado</th>
              <th></th>
              {modoAccion !== null && <th></th>}
            </tr>
          </thead>
          <tbody>
            {productosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={modoAccion !== null ? 6 : 5}>
                  No se encontraron productos.
                </td>
              </tr>
            ) : (
              productosFiltrados.map((p) => {
                const vars = variantesDe(p.id);
                const precio = p.tiene_variantes
                  ? vars.length > 0
                    ? formatPrecio(
                        Math.min(...vars.map((v) => Number(v.precio))),
                      )
                    : "Con variantes"
                  : formatPrecio(Number(p.precio_base));
                return (
                  <tr key={p.id}>
                    <td>{p.nombre}</td>
                    <td>
                      <span
                        className={
                          p.estado === "disponible"
                            ? styles.disponible
                            : p.estado === "sin_stock"
                              ? styles.sinStock
                              : styles.pausado
                        }
                      >
                        {labelEstado(p.estado)}
                      </span>
                    </td>
                    <td>{precio}</td>
                    <td>
                      <input
                        type="checkbox"
                        className={styles.checkDestacado}
                        checked={p.destacado}
                        onChange={() => toggleDestacado(p)}
                        title={
                          p.destacado
                            ? "Quitar de destacados"
                            : "Marcar como destacado"
                        }
                      />
                    </td>
                    <td className={styles.acciones}>
                      <button
                        className={styles.btnAccion}
                        onClick={() => setEditando(p)}
                      >
                        Editar
                      </button>
                      {(() => {
                        const ec = estadoCompletitud(p);
                        return (
                          <span
                            className={styles.tooltipWrap}
                            data-tooltip={ec.mensaje}
                          >
                            <span
                              className={
                                ec.completo
                                  ? styles.iconoCompleto
                                  : styles.iconoIncompleto
                              }
                            >
                              {ec.completo ? (
                                <svg
                                  width="1rem"
                                  height="1rem"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  aria-label={ec.mensaje}
                                >
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              ) : (
                                <svg
                                  width="1rem"
                                  height="1rem"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  aria-label={ec.mensaje}
                                >
                                  <circle cx="12" cy="12" r="10" />
                                  <line x1="12" y1="8" x2="12" y2="12" />
                                  <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                              )}
                            </span>
                          </span>
                        );
                      })()}
                      {p.estado !== "disponible" && (
                        <button
                          className={styles.btnAccion}
                          onClick={() => reactivar(p)}
                        >
                          Reactivar
                        </button>
                      )}
                    </td>
                    {modoAccion !== null && (
                      <td>
                        <label className={styles.checkboxSeleccion}>
                          <input
                            type="checkbox"
                            checked={seleccionados.includes(p.id)}
                            onChange={() => toggleSeleccionado(p.id)}
                          />
                          <span
                            className={styles.checkmarkCirculo}
                            aria-hidden="true"
                          />
                        </label>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {(editando || creando) && (
        <ProductForm
          producto={editando ?? undefined}
          categorias={categorias}
          categoriaIdsActuales={editando ? categoriaIds(editando.id) : []}
          onClose={() => {
            setEditando(null);
            setCreando(false);
          }}
          onSave={() => {
            setEditando(null);
            setCreando(false);
            cargar();
          }}
        />
      )}
    </div>
  );
}
