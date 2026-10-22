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
    ELSE
      IF v_variante_id IS NOT NULL THEN
        RAISE EXCEPTION 'El producto "%" no tiene variantes.', v_producto.nombre;
      END IF;
      v_precio := v_producto.precio_base;
    END IF;

    v_total := v_total + v_cantidad * v_precio;
    v_items_validados := v_items_validados || jsonb_build_object(
      'producto_id', v_producto.id,
      'variante_id', v_variante_id,
      'cantidad', v_cantidad,
      'precio_unitario', v_precio,
      'nombre_producto', v_producto.nombre
    );
  END LOOP;

  -- 5. Insertar el pedido (usuario = sesión real, nunca el parámetro)
  INSERT INTO pedidos (cliente_nombre, cliente_telefono, cliente_email, usuario_id, total)
  VALUES (v_nombre, v_telefono, v_email, auth.uid(), v_total)
  RETURNING id INTO v_pedido_id;

  INSERT INTO pedido_items (pedido_id, producto_id, variante_id, cantidad, precio_unitario, nombre_producto)
  SELECT v_pedido_id,
         (i->>'producto_id')::uuid,
         (i->>'variante_id')::uuid,
         (i->>'cantidad')::integer,
         (i->>'precio_unitario')::numeric,
         i->>'nombre_producto'
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
