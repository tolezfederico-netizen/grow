import { useEffect, useState, useCallback, useRef } from "react";
import {
  supabase,
  formatPrecio,
  mapearCategoria,
  mapearProductoVariante,
  rutaEnBucket,
  BUCKET_PRODUCTOS,
  SUPABASE_URL,
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
  imagen_miniatura_url: string | null;
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
    const { data: borrados, error: err } = await supabase
      .from("productos")
      .delete()
      .in("id", seleccionados)
      .select("imagen_url, imagen_miniatura_url");
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
    // Sus imágenes ya no las usa nadie: se borran del bucket. Si falla, el
    // producto igual quedó eliminado; el archivo queda huérfano y se avisa en consola.
    const rutas = (borrados ?? [])
      .flatMap((p) => [p.imagen_url, p.imagen_miniatura_url])
      .map((url) => rutaEnBucket(url, BUCKET_PRODUCTOS, SUPABASE_URL))
      .filter((r): r is string => !!r);
    if (rutas.length > 0) {
      const { error: errImg } = await supabase.storage
        .from(BUCKET_PRODUCTOS)
        .remove(rutas);
      if (errImg)
        console.warn("No se pudieron borrar imágenes del bucket:", errImg.message);
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

  // Chips de estado: mismos valores que el filtro por estado
  const chipsEstado: { valor: string; texto: string; cantidad: number; clase: string }[] = [
    { valor: "", texto: "Todos", cantidad: totalProductos, clase: styles.chipTodos },
    { valor: "disponible", texto: "Disponibles", cantidad: disponiblesCount, clase: styles.chipDisponible },
    { valor: "pausado", texto: "Pausados", cantidad: pausadosCount, clase: styles.chipPausado },
    { valor: "sin_stock", texto: "Sin stock", cantidad: sinStockCount, clase: styles.chipSinStock },
  ];

  function nombresCategorias(productoId: string): string {
    const ids = categoriaIds(productoId);
    return categorias
      .filter((c) => ids.includes(c.id))
      .map((c) => c.nombre)
      .join(" · ");
  }

  function claseEstadoProducto(estado: string): string {
    if (estado === "disponible") return styles.disponible;
    if (estado === "sin_stock") return styles.sinStock;
    return styles.pausado;
  }

  function cambiarModo(modo: "eliminar" | "pausar" | "sin_stock") {
    setSeleccionados([]);
    setModoAccion((prev) => (prev === modo ? null : modo));
  }

  return (
    <div className={styles.page}>
      <div className={styles.barra}>
        <div className={styles.filaBarra}>
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
            aria-label="Filtrar por categoría"
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
            value={completitudFiltro}
            onChange={(e) => setCompletitudFiltro(e.target.value)}
            aria-label="Filtrar por información completa"
          >
            <option value="">Completos e incompletos</option>
            <option value="completo">Completos</option>
            <option value="incompleto">Incompletos</option>
          </select>
          <button className={styles.btnNuevo} onClick={() => setCreando(true)}>
            + Nuevo
          </button>
        </div>
        <div className={styles.filaBarra}>
          <div className={styles.chips}>
            {chipsEstado.map((c) => (
              <button
                key={c.valor || "todos"}
                className={`${styles.chip} ${c.clase} ${estadoFiltro === c.valor ? styles.chipActivo : ""}`}
                onClick={() => setEstadoFiltro(c.valor)}
              >
                {c.texto} <span className={styles.chipContador}>{c.cantidad}</span>
              </button>
            ))}
          </div>
          <span className={styles.destacadosInfo}>
            Destacados {destacadosCount}/10
          </span>
          <div className={styles.modos}>
            <button
              className={`${styles.btnModo} ${modoAccion === "pausar" ? styles.btnModoActivo : ""}`}
              onClick={() => cambiarModo("pausar")}
            >
              {modoAccion === "pausar" ? "Cancelar" : "Pausar"}
            </button>
            <button
              className={`${styles.btnModo} ${modoAccion === "eliminar" ? styles.btnModoActivo : ""}`}
              onClick={() => cambiarModo("eliminar")}
            >
              {modoAccion === "eliminar" ? "Cancelar" : "Eliminar"}
            </button>
            <button
              className={`${styles.btnModo} ${modoAccion === "sin_stock" ? styles.btnModoActivo : ""}`}
              onClick={() => cambiarModo("sin_stock")}
            >
              {modoAccion === "sin_stock" ? "Cancelar" : "Sin Stock"}
            </button>
          </div>
        </div>
      </div>

      {modoAccion !== null && (
        <div className={styles.barraSeleccion}>
          <span className={styles.seleccionadosInfo}>
            {seleccionados.length === 0
              ? "Tocá los productos para seleccionarlos."
              : `${seleccionados.length} producto${seleccionados.length > 1 ? "s" : ""} seleccionado${seleccionados.length > 1 ? "s" : ""}`}
          </span>
          {seleccionados.length > 0 &&
            (() => {
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

      {productosFiltrados.length === 0 ? (
        <p className={styles.vacio}>No se encontraron productos.</p>
      ) : (
        <div className={styles.grilla}>
          {productosFiltrados.map((p) => {
            const vars = variantesDe(p.id);
            const precio = p.tiene_variantes
              ? vars.length > 0
                ? formatPrecio(Math.min(...vars.map((v) => Number(v.precio))))
                : "Con variantes"
              : formatPrecio(Number(p.precio_base));
            const ec = estadoCompletitud(p);
            const seleccionado = seleccionados.includes(p.id);
            const categoriasTexto = nombresCategorias(p.id);
            return (
              <article
                key={p.id}
                className={`${styles.card} ${p.estado !== "disponible" ? styles.cardInactiva : ""} ${seleccionado ? styles.cardSeleccionada : ""} ${modoAccion !== null ? styles.cardSeleccionable : ""}`}
                onClick={modoAccion !== null ? () => toggleSeleccionado(p.id) : undefined}
              >
                <div className={styles.cardImagen}>
                  {p.imagen_url ? (
                    <img src={p.imagen_url} alt={p.nombre} loading="lazy" />
                  ) : (
                    <span className={styles.sinImagen}>Sin imagen</span>
                  )}
                  {modoAccion !== null && (
                    <label
                      className={styles.checkboxSeleccion}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={seleccionado}
                        onChange={() => toggleSeleccionado(p.id)}
                        aria-label={`Seleccionar ${p.nombre}`}
                      />
                      <span className={styles.checkmarkCirculo} aria-hidden="true" />
                    </label>
                  )}
                  <span className={`${styles.estadoBadge} ${claseEstadoProducto(p.estado)}`}>
                    {labelEstado(p.estado)}
                  </span>
                </div>
                <div className={styles.cardCuerpo}>
                  <span className={styles.cardNombre} title={p.nombre}>
                    {p.nombre}
                  </span>
                  <span
                    className={styles.cardCategorias}
                    title={categoriasTexto || undefined}
                  >
                    {categoriasTexto || "Sin categoría"}
                  </span>
                  <span className={styles.cardPrecio}>{precio}</span>
                  {!ec.completo && (
                    <span className={styles.avisoIncompleto}>{ec.mensaje}</span>
                  )}
                </div>
                <div className={styles.cardAcciones}>
                  <label
                    className={styles.checkDestacado}
                    title={p.destacado ? "Quitar de destacados" : "Marcar como destacado"}
                  >
                    <input
                      type="checkbox"
                      checked={p.destacado}
                      onChange={() => toggleDestacado(p)}
                      disabled={modoAccion !== null}
                    />
                    Destacado
                  </label>
                  {p.estado !== "disponible" && (
                    <button
                      className={styles.btnAccion}
                      onClick={() => reactivar(p)}
                      disabled={modoAccion !== null}
                    >
                      Reactivar
                    </button>
                  )}
                  <button
                    className={styles.btnAccion}
                    onClick={() => setEditando(p)}
                    disabled={modoAccion !== null}
                  >
                    Editar
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

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
