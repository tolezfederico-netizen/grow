-- =============================================================================
-- Grow — Funciones RPC (Remote Procedure Calls)
--
-- Las funciones con SECURITY DEFINER se ejecutan con los permisos del
-- propietario de la función (el usuario que corrió el schema.sql), NO con
-- los del rol que la invoca. Esto permite que el rol anon (visitante público)
-- realice operaciones que sus políticas RLS no le permitirían directamente,
-- como insertar pedido_items o leer el pedido recién creado.
-- =============================================================================

-- ── crear_pedido_completo ──────────────────────────────────────────────────
-- Crea un pedido y sus items en una sola transacción atómica.
-- Valida datos de contacto y disponibilidad de productos/variantes, toma el
-- precio del catálogo (nunca el que manda el navegador), asigna el pedido al
-- usuario de la sesión (auth.uid()) y devuelve el pedido creado con su id.
-- p_usuario_id se conserva en la firma por compatibilidad pero se ignora.
--
-- Uso desde el cliente:
--   supabase.rpc('crear_pedido_completo', {
--     p_cliente_nombre: string,
--     p_cliente_telefono: string,
--     p_cliente_email: string,
--     p_items: [{ producto_id, variante_id?, cantidad }]
--   })
-- ──────────────────────────────────────────────────────────────────────────

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


-- ── guardar_producto ───────────────────────────────────────────────────────
-- Crea o edita un producto con sus variantes y categorías en una sola
-- transacción: si algo falla no queda nada a medias.
-- Las variantes se sincronizan por id: las que llegan con id se actualizan
-- (conservan su id, así los carritos abiertos y el historial siguen valiendo),
-- las que llegan sin id se crean y las que ya no vienen se borran. Si el
-- producto no tiene variantes, las existentes no se tocan.
-- SECURITY INVOKER: corre con los permisos del admin, así que RLS sigue
-- aplicando; el chequeo de is_admin() solo da un mensaje claro.
--
-- Uso desde el admin:
--   supabase.rpc('guardar_producto', {
--     p_datos: { nombre, descripcion, especificaciones, imagen_url,
--                tiene_variantes, precio_base },
--     p_variantes: [{ id?, nombre_variante, precio, estado }],
--     p_categoria_ids: string[],
--     p_producto_id?: string                 -- sin id = producto nuevo
--   })  → id del producto
-- ──────────────────────────────────────────────────────────────────────────

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


-- ── limpiar_mensaje_alerta_vencido (pg_cron) ──────────────────────────────
-- Borra mensaje_alerta cuando vence mensaje_alerta_expira_en. La ejecuta un
-- job de pg_cron cada minuto (corre como postgres); nadie más la necesita.
-- AlertaBanner también oculta el mensaje vencido del lado del cliente, para
-- cubrir los segundos entre el vencimiento y la próxima corrida del job.
--
-- Requiere la extensión pg_cron (Database → Extensions en el dashboard).
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.limpiar_mensaje_alerta_vencido()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE configuracion_tienda
  SET mensaje_alerta = NULL,
      mensaje_alerta_expira_en = NULL
  WHERE singleton = true
    AND mensaje_alerta_expira_en IS NOT NULL
    AND mensaje_alerta_expira_en <= now();
END;
$$;

REVOKE ALL ON FUNCTION public.limpiar_mensaje_alerta_vencido() FROM PUBLIC, anon, authenticated;

-- Solo en una instancia nueva (en producción el job ya existe: jobid 1).
SELECT cron.schedule(
  'limpiar-mensaje-alerta-vencido',
  '* * * * *',
  'SELECT public.limpiar_mensaje_alerta_vencido();'
);
