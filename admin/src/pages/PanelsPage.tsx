import { useEffect, useState, useCallback } from "react";
import {
  supabase,
  mapearPanelCategoria,
  mapearPanelCategoriaItem,
  mapearPanelCategoriaItemProducto,
  mapearCategoria,
} from "@shared";
import type { Categoria, ProductoCategoria } from "@shared";
import PanelForm from "../components/PanelForm";
import PanelItemsEditor from "../components/PanelItemsEditor";
import LoadingState from "../components/LoadingState";
import { useConfirm } from "../context/ConfirmContext";
import ErrorState from "../components/ErrorState";
import styles from "./PanelsPage.module.css";

interface PanelRow {
  id: string;
  titulo: string;
  descripcion: string | null;
  orden: number | null;
  estado: string;
  creado_en: string;
}

interface PanelItemRow {
  id: string;
  panel_id: string;
  categoria_id: string;
  nombre_visible: string | null;
  orden: number;
}

interface ItemProductoRow {
  id: string;
  item_id: string;
  producto_id: string;
  orden: number;
}

export default function PanelsPage() {
  const [paneles, setPaneles] = useState<PanelRow[]>([]);
  const [items, setItems] = useState<PanelItemRow[]>([]);
  const [itemProductos, setItemProductos] = useState<ItemProductoRow[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [relaciones, setRelaciones] = useState<ProductoCategoria[]>([]);
  const [productos, setProductos] = useState<
    { id: string; nombre: string; imagen_url: string | null }[]
  >([]);
  const [selPanelId, setSelPanelId] = useState<string | null>(null);
  const [editando, setEditando] = useState<PanelRow | null>(null);
  const [creando, setCreando] = useState(false);
  const [modoAccion, setModoAccion] = useState<"eliminar" | "pausar" | null>(
    null,
  );
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { confirm, notify, toast } = useConfirm();
  const puedeArrastrar = busqueda === "" && modoAccion === null;

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [rP, rI, rIP, rC, rPC, rPr] = await Promise.all([
      supabase.from("paneles_categoria").select("*").order("orden"),
      supabase.from("paneles_categoria_items").select("*").order("orden"),
      supabase
        .from("paneles_categoria_items_productos")
        .select("*")
        .order("orden"),
      supabase.from("categorias").select("*"),
      supabase.from("producto_categorias").select("*"),
      supabase.from("productos").select("id, nombre, imagen_url"),
    ]);
    if (rP.error) {
      setError(rP.error.message);
      setLoading(false);
      return;
    }
    if (rI.error) {
      setError(rI.error.message);
      setLoading(false);
      return;
    }
    if (rIP.error) {
      setError(rIP.error.message);
      setLoading(false);
      return;
    }
    if (rC.error) {
      setError(rC.error.message);
      setLoading(false);
      return;
    }
    if (rPC.error) {
      setError(rPC.error.message);
      setLoading(false);
      return;
    }
    if (rPr.error) {
      setError(rPr.error.message);
      setLoading(false);
      return;
    }
    setPaneles(rP.data);
    setItems(rI.data);
    setItemProductos(rIP.data);
    setCategorias((rC.data ?? []).map(mapearCategoria));
    setRelaciones(rPC.data ?? []);
    setProductos(rPr.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function toggleEstado(p: PanelRow) {
    const nuevo = p.estado === "activo" ? "pausado" : "activo";
    const mensaje =
      p.estado === "activo"
        ? `¿Pausar el panel «${p.titulo}»? Dejará de mostrarse en el sitio.`
        : `¿Reactivar el panel «${p.titulo}»? Volverá a mostrarse en el sitio.`;
    const confirmado = await confirm(mensaje, {
      titulo: p.estado === "activo" ? "Pausar panel" : "Reactivar panel",
      textoConfirmar: p.estado === "activo" ? "Pausar" : "Reactivar",
    });
    if (!confirmado) return;
    const { error: err } = await supabase
      .from("paneles_categoria")
      .update({ estado: nuevo })
      .eq("id", p.id);
    if (err) {
      await notify(err.message, { titulo: "Error" });
      return;
    }
    toast(p.estado === "activo" ? "Panel pausado." : "Panel reactivado.");
    cargar();
  }

  function toggleSeleccionado(id: string) {
    setSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function eliminarSeleccionados() {
    const cantidad = seleccionados.length;
    const confirmado = await confirm(
      `¿Eliminar ${cantidad} panel(es)? Se eliminarán también sus cards asociadas.`,
      { titulo: "Eliminar paneles", textoConfirmar: "Eliminar" },
    );
    if (!confirmado) return;
    const { error: err } = await supabase
      .from("paneles_categoria")
      .delete()
      .in("id", seleccionados);
    if (err) {
      await notify(err.message, { titulo: "Error" });
      return;
    }
    toast(`${cantidad} panel(es) eliminado(s).`);
    setSeleccionados([]);
    setModoAccion(null);
    cargar();
  }

  async function pausarSeleccionados() {
    const cantidad = seleccionados.length;
    const confirmado = await confirm(
      `¿Pausar ${cantidad} panel(es)? Dejarán de mostrarse en el sitio.`,
      { titulo: "Pausar paneles", textoConfirmar: "Pausar" },
    );
    if (!confirmado) return;
    const { error: err } = await supabase
      .from("paneles_categoria")
      .update({ estado: "pausado" })
      .in("id", seleccionados);
    if (err) {
      await notify(err.message, { titulo: "Error" });
      return;
    }
    toast(`${cantidad} panel(es) pausado(s).`);
    setSeleccionados([]);
    setModoAccion(null);
    cargar();
  }

  function handleDragStart(id: string) {
    if (!puedeArrastrar) return;
    setDraggedId(id);
  }

  function handleDragOver(e: React.DragEvent, id: string) {
    if (!puedeArrastrar || !draggedId) return;
    e.preventDefault();
    if (id !== dragOverId) setDragOverId(id);
  }

  async function handleDrop(targetId: string) {
    if (!puedeArrastrar || !draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    const orden = [...panelesFiltrados];
    const fromIndex = orden.findIndex((p) => p.id === draggedId);
    const toIndex = orden.findIndex((p) => p.id === targetId);
    if (fromIndex === -1 || toIndex === -1) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    const [moved] = orden.splice(fromIndex, 1);
    orden.splice(toIndex, 0, moved);

    setDraggedId(null);
    setDragOverId(null);

    const updatesTemp = orden.map((p, i) =>
      supabase
        .from("paneles_categoria")
        .update({ orden: -(i + 1) })
        .eq("id", p.id),
    );
    const resultadosTemp = await Promise.all(updatesTemp);
    const conErrorTemp = resultadosTemp.find((r) => r.error);
    if (conErrorTemp?.error) {
      await notify(conErrorTemp.error.message, {
        titulo: "Error al reordenar",
      });
      return;
    }

    const updatesFinal = orden.map((p, i) =>
      supabase
        .from("paneles_categoria")
        .update({ orden: i + 1 })
        .eq("id", p.id),
    );
    const resultadosFinal = await Promise.all(updatesFinal);
    const conErrorFinal = resultadosFinal.find((r) => r.error);
    if (conErrorFinal?.error) {
      await notify(conErrorFinal.error.message, {
        titulo: "Error al reordenar",
      });
      return;
    }
    toast("Orden actualizado.");
    cargar();
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDragOverId(null);
  }

  const panelSel = paneles.find((p) => p.id === selPanelId) ?? null;
  const itemsSel = items.filter((i) => i.panel_id === selPanelId);

  const colsBase =
    "minmax(10rem, 1fr) minmax(4rem, 6rem) minmax(4rem, 6rem) minmax(4rem, 6rem) minmax(7rem, 10rem)";
  const colsConCheckbox =
    "minmax(10rem, 1fr) minmax(4rem, 6rem) minmax(4rem, 6rem) minmax(4rem, 6rem) minmax(6rem, 9rem) 3rem";
  const cols = modoAccion !== null ? colsConCheckbox : colsBase;
  const colsVar = { "--cols": cols } as React.CSSProperties;

  const panelesFiltrados = paneles.filter(
    (p) => !busqueda || p.titulo.toLowerCase().includes(busqueda.toLowerCase()),
  );

  if (loading) return <LoadingState />;
  if (error) return <ErrorState mensaje={error} onReintentar={cargar} />;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2>Paneles de Categoría</h2>
        <div className={styles.headerBtns}>
          <button className={styles.btnNuevo} onClick={() => setCreando(true)}>
            + Nuevo panel
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
        </div>
      </div>

      <div className={styles.headerFiltros}>
        <input
          className={styles.inputBusquedaPanel}
          type="text"
          placeholder="Buscar panel..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {modoAccion !== null && seleccionados.length > 0 && (
        <div className={styles.barraSeleccion}>
          <span className={styles.seleccionadosInfo}>
            {seleccionados.length} panel(es) seleccionado(s)
          </span>
          <button
            className={`${styles.btnConfirmarAccion} ${modoAccion === "eliminar" ? styles.btnConfirmarEliminar : styles.btnConfirmarPausar}`}
            onClick={
              modoAccion === "eliminar"
                ? eliminarSeleccionados
                : pausarSeleccionados
            }
          >
            {modoAccion === "eliminar" ? "Eliminar" : "Pausar"}{" "}
            {seleccionados.length} panel(es)
          </button>
        </div>
      )}

      {panelesFiltrados.length === 0 ? (
        <div className={styles.estadoVacioPaneles}>
          {paneles.length === 0 ? (
            <>
              <p className={styles.vacio}>Todavía no creaste ningún panel.</p>
              <button
                className={styles.btnNuevo}
                onClick={() => setCreando(true)}
              >
                + Nuevo panel
              </button>
            </>
          ) : (
            <>
              <p className={styles.vacio}>
                No se encontraron paneles con ese nombre.
              </p>
              <button
                className={styles.btnSeleccion}
                onClick={() => setBusqueda("")}
              >
                Limpiar búsqueda
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className={styles.filaHeader} style={colsVar}>
            <span>Título</span>
            <span>Orden</span>
            <span>Estado</span>
            <span>Categorías</span>
            <span></span>
            {modoAccion !== null && <span></span>}
          </div>

          {panelesFiltrados.map((p) => (
            <div
              key={p.id}
              className={`${styles.filaPanel}${selPanelId === p.id ? ` ${styles.selFila}` : ""}${dragOverId === p.id ? ` ${styles.dragOver}` : ""}${draggedId === p.id ? ` ${styles.arrastrando}` : ""}`}
              style={colsVar}
              draggable={puedeArrastrar}
              onDragStart={() => handleDragStart(p.id)}
              onDragOver={(e) => handleDragOver(e, p.id)}
              onDrop={() => handleDrop(p.id)}
              onDragEnd={handleDragEnd}
            >
              <div>
                {puedeArrastrar && (
                  <span
                    className={styles.dragHandle}
                    aria-hidden="true"
                    title="Arrastrar para reordenar"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <circle cx="9" cy="6" r="1.5" />
                      <circle cx="15" cy="6" r="1.5" />
                      <circle cx="9" cy="12" r="1.5" />
                      <circle cx="15" cy="12" r="1.5" />
                      <circle cx="9" cy="18" r="1.5" />
                      <circle cx="15" cy="18" r="1.5" />
                    </svg>
                  </span>
                )}
                <button
                  className={styles.linkFila}
                  onClick={() =>
                    setSelPanelId(selPanelId === p.id ? null : p.id)
                  }
                >
                  <svg
                    className={`${styles.flechaFila} ${selPanelId === p.id ? styles.flechaFilaAbierta : ""}`}
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                  {p.titulo}
                </button>
                {p.descripcion && (
                  <span className={styles.sub}>{p.descripcion}</span>
                )}
              </div>
              <div data-label="Orden">
                {p.orden !== null ? (
                  p.orden
                ) : (
                  <span className={styles.sinAsignar}>Sin asignar</span>
                )}
              </div>
              <div data-label="Estado">
                <span
                  className={`${styles.badgeEstado} ${p.estado === "activo" ? styles.activo : styles.pausado}`}
                >
                  {p.estado}
                </span>
              </div>
              <div data-label="Categorías">
                {items.filter((i) => i.panel_id === p.id).length}
              </div>
              <div className={styles.acciones}>
                <button
                  className={styles.btnAccion}
                  onClick={() => setEditando(p)}
                >
                  Editar
                </button>
                {p.estado === "pausado" && (
                  <button
                    className={styles.btnAccion}
                    onClick={() => toggleEstado(p)}
                  >
                    Reactivar
                  </button>
                )}
              </div>
              {modoAccion !== null && (
                <div className={styles.celdaCheckbox}>
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
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {selPanelId && panelSel && (
        <PanelItemsEditor
          panel={panelSel}
          items={itemsSel}
          todosLosItems={items}
          itemProductos={itemProductos}
          categorias={categorias}
          relaciones={relaciones}
          productos={productos}
          onReload={cargar}
        />
      )}

      {(editando || creando) && (
        <PanelForm
          panel={editando ?? undefined}
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
