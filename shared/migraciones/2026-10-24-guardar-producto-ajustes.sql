-- =============================================================================
-- Migración incremental 2026-10-24 — Ajustes de la auditoría de la fase 1
--
-- guardar_producto (misma firma):
--   - un producto con variantes necesita al menos una (antes se podía guardar
--     sin ninguna y quedaba imposible de reservar);
--   - rechaza ids de variante repetidos;
--   - al pasar a producto simple borra sus variantes.
--
-- Se puede correr en cualquier momento (el admin publicado no usa esta RPC).
-- Idempotente. No cambia columnas: no hace falta regenerar tipos.
-- =============================================================================

BEGIN;

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
  IF v_tiene_variantes AND jsonb_array_length(v_variantes) = 0 THEN
    RAISE EXCEPTION 'Agregá al menos una variante o desmarcá "Tiene variantes".';
  END IF;
  -- Un mismo id dos veces haría que la última versión pise a la anterior sin aviso
  IF (SELECT count(e->>'id') <> count(DISTINCT e->>'id')
      FROM jsonb_array_elements(v_variantes) AS e
      WHERE NULLIF(e->>'id', '') IS NOT NULL) THEN
    RAISE EXCEPTION 'Hay variantes repetidas.';
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
  ELSE
    -- Pasó a producto simple: sus variantes ya no se usan
    DELETE FROM producto_variantes WHERE producto_id = v_id;
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
