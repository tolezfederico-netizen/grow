-- =============================================================================
-- Migración incremental 2026-10-31 — Menú simple: limpieza final
--
-- Quita lo que ya no usa nadie: es_card y su trigger, y los órdenes vacíos.
--
-- Aplicar DESPUÉS de 2026-10-31-menu-simple.sql y solo cuando TODO lo publicado
-- tenga el código nuevo: tienda y admin en Cloudflare Pages y en Vercel, y la
-- copia de diseño (grow-diseno-1), que usa la misma base. Una versión vieja que
-- siga pidiendo es_card se queda sin menú.
--
-- Después de correrla, regenerar database.types.ts (desaparece es_card).
-- =============================================================================

BEGIN;

DROP TRIGGER IF EXISTS trg_validar_max_items_panel ON paneles_categoria_items;
DROP FUNCTION IF EXISTS fn_validar_max_items_panel();
ALTER TABLE paneles_categoria_items DROP COLUMN IF EXISTS es_card;

ALTER TABLE paneles_categoria ALTER COLUMN orden SET NOT NULL;

COMMENT ON COLUMN paneles_categoria.titulo IS 'Nombre de la sección en la barra de la tienda (hasta 16 caracteres)';
COMMENT ON COLUMN paneles_categoria.orden IS 'Posición en la barra de la tienda (menor = primero); se cambia arrastrando en el admin';
COMMENT ON COLUMN paneles_categoria_items.orden IS 'Orden dentro de la sección (menor = primero); las primeras 4 categorías activas van al desplegable';
COMMENT ON COLUMN paneles_categoria_items_productos.orden IS 'Orden de la imagen elegida (menor = primera). Sin filas, la tienda usa imagenes_categorias_menu';

COMMIT;
