-- =============================================================================
-- Migración incremental 2026-10-23 — Tarea 1.4 (variantes sin borrado + snapshot)
--
-- Para una instancia que YA tiene datos. Correr entero, una sola vez, en el
-- SQL Editor de Supabase (es idempotente: se puede repetir sin daño).
-- Orden obligatorio: primero esta migración, después el deploy del admin
-- (el admin nuevo llama a guardar_producto, que el viejo no usa).
--
-- 1. pedido_items.nombre_variante + backfill
-- 2. crear_pedido_completo guarda nombre_variante (misma firma)
-- 3. guardar_producto (nueva): producto + variantes por id + categorías
--
-- Después: regenerar tipos con
--   supabase gen types typescript --linked > shared/src/supabase/database.types.ts
-- (en Windows, verificar que quede en UTF-8) y redeployar la Edge Function:
--   supabase functions deploy enviar-notificacion-pedido
-- =============================================================================

BEGIN;

-- ── 1. Columna y backfill ─────────────────────────────────────────────────────
ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS nombre_variante text;
COMMENT ON COLUMN pedido_items.nombre_variante IS
  'Snapshot del nombre de la variante al momento de la compra. NULL si el producto no tiene variantes.';

-- Backfill: solo se recupera el nombre de los items cuya variante todavía existe.
UPDATE pedido_items pi
SET nombre_variante = v.nombre_variante
FROM producto_variantes v
WHERE v.id = pi.variante_id
  AND pi.nombre_variante IS NULL;


-- ── 2. crear_pedido_completo ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.crear_pedido_completo(
  p_cliente_nombre text,
  p_cliente_telefono text,
  p_cliente_email text,
  p_items jsonb,
  p_usuario_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido_id uuid;
  v_total numeric := 0;
  v_item jsonb;
  v_producto record;
  v_variante record;
  v_cantidad integer;
  v_precio numeric;
  v_variante_id uuid;
  v_nombre_variante text;
  v_items_validados jsonb := '[]'::jsonb;
  v_nombre text := btrim(coalesce(p_cliente_nombre, ''));
  v_telefono text := btrim(coalesce(p_cliente_telefono, ''));
  v_email text := lower(btrim(coalesce(p_cliente_email, '')));
BEGIN
  -- 1. Datos de contacto
  IF char_length(v_nombre) NOT BETWEEN 3 AND 120 THEN
    RAISE EXCEPTION 'Nombre inválido.';
  END IF;
  IF v_telefono !~ '^[0-9]{8,15}$' THEN
    RAISE EXCEPTION 'Teléfono inválido.';
  END IF;
  IF char_length(v_email) > 254
     OR v_email !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' THEN
    RAISE EXCEPTION 'Email inválido.';
  END IF;

  -- 2. Items
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El pedido debe contener al menos un producto.';
  END IF;
  IF jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'El pedido tiene demasiados productos.';
  END IF;

  -- 3. Anti-spam
  IF (SELECT count(*) FROM pedidos
      WHERE cliente_telefono = v_telefono
        AND creado_en > now() - interval '10 minutes') >= 3 THEN
    RAISE EXCEPTION 'Demasiados pedidos seguidos. Esperá unos minutos.';
  END IF;

  -- 4. Validar cada item con el precio real de catálogo
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_cantidad := (v_item->>'cantidad')::integer;
    IF v_cantidad IS NULL OR v_cantidad NOT BETWEEN 1 AND 999 THEN
      RAISE EXCEPTION 'Cantidad inválida.';
    END IF;

    SELECT id, nombre, estado, tiene_variantes, precio_base INTO v_producto
    FROM productos
    WHERE id = (v_item->>'producto_id')::uuid;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Producto no encontrado.';
    END IF;
    IF v_producto.estado <> 'disponible' THEN
      RAISE EXCEPTION 'El producto "%" no está disponible en este momento.', v_producto.nombre;
    END IF;

    v_variante_id := NULLIF(v_item->>'variante_id', '')::uuid;

    IF v_producto.tiene_variantes THEN
      IF v_variante_id IS NULL THEN
        RAISE EXCEPTION 'Elegí una variante para "%".', v_producto.nombre;
      END IF;

      SELECT id, nombre_variante, precio, estado, producto_id INTO v_variante
      FROM producto_variantes
      WHERE id = v_variante_id;

      IF NOT FOUND OR v_variante.producto_id <> v_producto.id THEN
        RAISE EXCEPTION 'Variante inválida para "%".', v_producto.nombre;
      END IF;
      IF v_variante.estado <> 'disponible' THEN
        RAISE EXCEPTION 'La variante "%" no está disponible en este momento.', v_variante.nombre_variante;
      END IF;

      v_precio := v_variante.precio;
      v_nombre_variante := v_variante.nombre_variante;
    ELSE
      IF v_variante_id IS NOT NULL THEN
        RAISE EXCEPTION 'El producto "%" no tiene variantes.', v_producto.nombre;
      END IF;
      v_precio := v_producto.precio_base;
      v_nombre_variante := NULL;
    END IF;

    v_total := v_total + v_cantidad * v_precio;
    v_items_validados := v_items_validados || jsonb_build_object(
      'producto_id', v_producto.id,
      'variante_id', v_variante_id,
      'cantidad', v_cantidad,
      'precio_unitario', v_precio,
      'nombre_producto', v_producto.nombre,
      'nombre_variante', v_nombre_variante
    );
  END LOOP;

  -- 5. Insertar el pedido (usuario = sesión real, nunca el parámetro)
  INSERT INTO pedidos (cliente_nombre, cliente_telefono, cliente_email, usuario_id, total)
  VALUES (v_nombre, v_telefono, v_email, auth.uid(), v_total)
  RETURNING id INTO v_pedido_id;

  INSERT INTO pedido_items (pedido_id, producto_id, variante_id, cantidad, precio_unitario, nombre_producto, nombre_variante)
  SELECT v_pedido_id,
         (i->>'producto_id')::uuid,
         (i->>'variante_id')::uuid,
         (i->>'cantidad')::integer,
         (i->>'precio_unitario')::numeric,
         i->>'nombre_producto',
         i->>'nombre_variante'
  FROM jsonb_array_elements(v_items_validados) AS i;

  RETURN (
    SELECT jsonb_build_object(
      'id', id,
      'cliente_nombre', cliente_nombre,
      'cliente_telefono', cliente_telefono,
      'cliente_email', cliente_email,
      'estado', estado,
      'total', total,
      'creado_en', creado_en,
      'usuario_id', usuario_id
    )
    FROM pedidos
    WHERE id = v_pedido_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.crear_pedido_completo(text, text, text, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crear_pedido_completo(text, text, text, jsonb, uuid) TO anon, authenticated;


-- ── 3. guardar_producto ───────────────────────────────────────────────────────
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
    INSERT INTO productos (nombre, descripcion, especificaciones, imagen_url, tiene_variantes, precio_base)
    VALUES (
      p_datos->>'nombre',
      p_datos->>'descripcion',
      p_datos->>'especificaciones',
      p_datos->>'imagen_url',
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


-- =============================================================================
-- Verificación (correr aparte, después del COMMIT)
-- =============================================================================
-- Items con variante y sin nombre (variante borrada antes de esta migración;
-- no se puede recuperar):
--   SELECT count(*) FROM pedido_items WHERE variante_id IS NULL AND nombre_variante IS NULL;
--   SELECT count(*) FROM pedido_items WHERE variante_id IS NOT NULL AND nombre_variante IS NULL;  -- debe dar 0
--
-- Funciones y permisos:
--   SELECT p.proname, p.prosecdef, pg_get_function_identity_arguments(p.oid)
--   FROM pg_proc p WHERE p.proname IN ('crear_pedido_completo', 'guardar_producto');
--   SELECT grantee, privilege_type FROM information_schema.routine_privileges
--   WHERE routine_name = 'guardar_producto';  -- solo authenticated (y el owner)
