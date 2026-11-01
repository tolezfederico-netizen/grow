-- =============================================================================
-- Migración incremental 2026-10-31 — Menú de la tienda más simple
--
--   - Todas las secciones (paneles) pasan a tener un orden fijo: se termina el
--     reparto al azar de las que no tenían número.
--   - El orden de las categorías decide todo: las primeras 4 van al desplegable.
--     Se reordenan dejando primero las que hoy son card, así la tienda se sigue
--     viendo igual.
--   - Borrar un producto ya no se bloquea por estar elegido como imagen.
--   - Máximo 5 secciones activas (las pausadas no cuentan) y títulos de hasta
--     16 caracteres.
--   - RPC imagenes_categorias_menu: imagen automática de cada categoría.
--
-- Aplicar ANTES de publicar el código nuevo: el admin y la tienda publicados
-- siguen funcionando con esta migración. Correr UNA sola vez (el paso 2 usa
-- es_card, que sigue existiendo hasta correr 2026-10-31-menu-simple-limpieza.sql).
-- Si algún título tiene más de 16 caracteres, el paso 4 falla y no se aplica
-- nada: acortarlo desde el admin y volver a correrla.
-- No agrega columnas; los tipos ya incluyen la RPC nueva.
-- =============================================================================

BEGIN;

-- 1. Las secciones sin número van al final, de la más vieja a la más nueva
WITH base AS (
  SELECT COALESCE(MAX(orden), 0) AS maximo FROM paneles_categoria
), sin_orden AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY creado_en, id) AS posicion
  FROM paneles_categoria
  WHERE orden IS NULL
)
UPDATE paneles_categoria p
SET orden = base.maximo + sin_orden.posicion
FROM sin_orden, base
WHERE p.id = sin_orden.id;

-- 2. Dentro de cada sección: primero las cards actuales, sin empates de orden
WITH nuevo_orden AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY panel_id ORDER BY es_card DESC, orden, id) - 1 AS posicion
  FROM paneles_categoria_items
)
UPDATE paneles_categoria_items i
SET orden = nuevo_orden.posicion
FROM nuevo_orden
WHERE i.id = nuevo_orden.id;

-- 3. Borrar un producto quita su elección como imagen, en vez de bloquearse
ALTER TABLE paneles_categoria_items_productos
  DROP CONSTRAINT IF EXISTS paneles_categoria_items_productos_producto_id_fkey;
ALTER TABLE paneles_categoria_items_productos
  ADD CONSTRAINT paneles_categoria_items_productos_producto_id_fkey
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE;

COMMENT ON CONSTRAINT paneles_categoria_items_productos_producto_id_fkey ON paneles_categoria_items_productos IS 'CASCADE: si se borra el producto, la categoría vuelve a la imagen automática';

-- 4. Título corto para que la barra de la tienda no se desarme
ALTER TABLE paneles_categoria DROP CONSTRAINT IF EXISTS paneles_categoria_titulo_largo_check;
ALTER TABLE paneles_categoria
  ADD CONSTRAINT paneles_categoria_titulo_largo_check CHECK (char_length(titulo) <= 16);

-- 5. Máximo 5 secciones activas
CREATE OR REPLACE FUNCTION fn_validar_max_paneles_activos() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado = 'activo' AND (TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM 'activo') THEN
    IF (SELECT COUNT(*) FROM paneles_categoria WHERE estado = 'activo' AND id <> NEW.id) >= 5 THEN
      RAISE EXCEPTION 'Ya hay 5 secciones activas en el menú. Pausá una antes de activar otra.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_max_paneles_activos ON paneles_categoria;
CREATE TRIGGER trg_validar_max_paneles_activos
  BEFORE INSERT OR UPDATE ON paneles_categoria
  FOR EACH ROW EXECUTE FUNCTION fn_validar_max_paneles_activos();

-- 6. Imagen automática de las categorías (misma definición que rpc.sql)
CREATE OR REPLACE FUNCTION public.imagenes_categorias_menu(p_categoria_ids uuid[])
RETURNS TABLE (
  categoria_id uuid,
  producto_id uuid,
  imagen_url text,
  imagen_miniatura_url text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT elegidos.categoria_id, elegidos.producto_id, elegidos.imagen_url, elegidos.imagen_miniatura_url
  FROM (
    SELECT pc.categoria_id,
           p.id AS producto_id,
           p.imagen_url,
           p.imagen_miniatura_url,
           ROW_NUMBER() OVER (
             PARTITION BY pc.categoria_id
             ORDER BY p.destacado DESC, p.creado_en DESC, p.id
           ) AS posicion
    FROM producto_categorias pc
    JOIN productos p ON p.id = pc.producto_id
    WHERE pc.categoria_id = ANY (p_categoria_ids)
      AND p.estado = 'disponible'
      AND p.imagen_url IS NOT NULL
  ) AS elegidos
  WHERE elegidos.posicion <= 2
  ORDER BY elegidos.categoria_id, elegidos.posicion;
$$;

REVOKE ALL ON FUNCTION public.imagenes_categorias_menu(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.imagenes_categorias_menu(uuid[]) TO anon, authenticated;

COMMIT;
