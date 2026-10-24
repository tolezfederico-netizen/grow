-- =============================================================================
-- Migración incremental 2026-10-23 — Tarea 1.8 (miniatura de la imagen)
--
-- Para una instancia que YA tiene datos. Correr entero en el SQL Editor de
-- Supabase (idempotente). Orden: primero esta migración, después el deploy
-- del admin (guarda imagen_miniatura_url a través de guardar_producto).
--
-- 1. productos.imagen_miniatura_url
-- 2. guardar_producto guarda la miniatura (misma firma)
--
-- Después: regenerar tipos con
--   supabase gen types typescript --linked > shared/src/supabase/database.types.ts
-- =============================================================================

BEGIN;

-- ── 1a. Miniatura de la imagen de producto ───────────────────────────────────
-- El admin sube dos versiones WebP: grande (1000 px) en imagen_url y miniatura
-- (400 px) acá. Las imágenes anteriores quedan con NULL y la tienda usa la grande.
ALTER TABLE productos ADD COLUMN IF NOT EXISTS imagen_miniatura_url text;
COMMENT ON COLUMN productos.imagen_miniatura_url IS
  'Miniatura de 400 px (WebP) para tarjetas y listas. NULL en imágenes subidas antes de que existiera: la tienda usa imagen_url.';


-- ── 2. guardar_producto ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guardar_producto(
  p_datos jsonb,
  p_variantes jsonb,
  p_categoria_ids uuid[],
  p_producto_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid := p_producto_id;
  v_tiene_variantes boolean := coalesce((p_datos->>'tiene_variantes')::boolean, false);
  v_variantes jsonb := coalesce(p_variantes, '[]'::jsonb);
  v_variante jsonb;
  v_variante_id uuid;
  v_nombre_variante text;
  v_precio numeric;
  v_ids_conservados uuid[] := '{}';
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede guardar productos.';
  END IF;
  IF p_categoria_ids IS NULL OR cardinality(p_categoria_ids) = 0 THEN
    RAISE EXCEPTION 'Debés seleccionar al menos una categoría.';
  END IF;
  IF jsonb_typeof(v_variantes) <> 'array' THEN
    RAISE EXCEPTION 'Variantes inválidas.';
  END IF;

  -- 1. Producto
  IF v_id IS NULL THEN
    INSERT INTO productos (nombre, descripcion, especificaciones, imagen_url, imagen_miniatura_url, tiene_variantes, precio_base)
    VALUES (
      p_datos->>'nombre',
      p_datos->>'descripcion',
      p_datos->>'especificaciones',
      p_datos->>'imagen_url',
      p_datos->>'imagen_miniatura_url',
      v_tiene_variantes,
      (p_datos->>'precio_base')::numeric
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE productos
    SET nombre           = p_datos->>'nombre',
        descripcion      = p_datos->>'descripcion',
        especificaciones = p_datos->>'especificaciones',
        imagen_url       = p_datos->>'imagen_url',
        imagen_miniatura_url = p_datos->>'imagen_miniatura_url',
        tiene_variantes  = v_tiene_variantes,
        precio_base      = (p_datos->>'precio_base')::numeric
    WHERE id = v_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Producto no encontrado.';
    END IF;
  END IF;

  -- 2. Variantes, sincronizadas por id
  IF v_tiene_variantes THEN
    FOR v_variante IN SELECT * FROM jsonb_array_elements(v_variantes)
    LOOP
      v_variante_id := NULLIF(v_variante->>'id', '')::uuid;
      v_nombre_variante := btrim(coalesce(v_variante->>'nombre_variante', ''));
      v_precio := (v_variante->>'precio')::numeric;

      IF v_nombre_variante = '' THEN
        RAISE EXCEPTION 'Cada variante necesita un nombre.';
      END IF;
      IF v_precio IS NULL OR v_precio <= 0 THEN
        RAISE EXCEPTION 'El precio de la variante "%" debe ser mayor a 0.', v_nombre_variante;
      END IF;

      IF v_variante_id IS NOT NULL THEN
        UPDATE producto_variantes
        SET nombre_variante = v_nombre_variante,
            precio          = v_precio,
            estado          = v_variante->>'estado'
        WHERE id = v_variante_id
          AND producto_id = v_id;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'La variante "%" no pertenece a este producto.', v_nombre_variante;
        END IF;
      ELSE
        INSERT INTO producto_variantes (producto_id, nombre_variante, precio, estado)
        VALUES (v_id, v_nombre_variante, v_precio, v_variante->>'estado')
        RETURNING id INTO v_variante_id;
      END IF;

      v_ids_conservados := v_ids_conservados || v_variante_id;
    END LOOP;

    DELETE FROM producto_variantes
    WHERE producto_id = v_id
      AND NOT (id = ANY (v_ids_conservados));
  END IF;

  -- 3. Categorías
  DELETE FROM producto_categorias
  WHERE producto_id = v_id
    AND NOT (categoria_id = ANY (p_categoria_ids));

  INSERT INTO producto_categorias (producto_id, categoria_id)
  SELECT v_id, c FROM unnest(p_categoria_ids) AS c
  ON CONFLICT DO NOTHING;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.guardar_producto(jsonb, jsonb, uuid[], uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guardar_producto(jsonb, jsonb, uuid[], uuid) TO authenticated;

COMMIT;


-- Verificación (correr aparte):
--   SELECT count(*) FILTER (WHERE imagen_miniatura_url IS NULL) AS sin_miniatura, count(*) FROM productos;
