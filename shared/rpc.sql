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
-- Valida disponibilidad de productos/variantes, calcula el total
-- del lado del servidor, y devuelve el pedido creado con su id.
--
-- Uso desde el cliente:
--   supabase.rpc('crear_pedido_completo', {
--     p_cliente_nombre: string,
--     p_cliente_telefono: string,
--     p_cliente_email: string,
--     p_items: [{ producto_id, variante_id?, cantidad, precio_unitario }]
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
BEGIN
  -- 1. Validar que el array de items no esté vacío
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El pedido debe contener al menos un producto.';
  END IF;

  -- 2. Validar cada item y calcular el total
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- 2a. Verificar que el producto exista y esté disponible
    SELECT id, nombre, estado INTO v_producto
    FROM productos
    WHERE id = (v_item->>'producto_id')::uuid;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Producto no encontrado: %', (v_item->>'producto_id');
    END IF;

    IF v_producto.estado != 'disponible' THEN
      RAISE EXCEPTION 'El producto "%" no está disponible en este momento.', v_producto.nombre;
    END IF;

    -- 2b. Si el item tiene variante, verificar que exista,
    --     pertenezca al producto y esté disponible
    IF (v_item->>'variante_id') IS NOT NULL THEN
      SELECT pv.id, pv.nombre_variante, pv.precio, pv.estado, pv.producto_id INTO v_variante
      FROM producto_variantes pv
      WHERE pv.id = (v_item->>'variante_id')::uuid;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Variante no encontrada: %', (v_item->>'variante_id');
      END IF;

      IF v_variante.producto_id != (v_item->>'producto_id')::uuid THEN
        RAISE EXCEPTION 'La variante "%" no pertenece al producto especificado.', v_variante.nombre_variante;
      END IF;

      IF v_variante.estado != 'disponible' THEN
        RAISE EXCEPTION 'La variante "%" no está disponible en este momento.', v_variante.nombre_variante;
      END IF;
    END IF;

    -- 2c. Acumular el total (cantidad × precio_unitario)
    v_total := v_total + (
      ((v_item->>'cantidad')::numeric) * ((v_item->>'precio_unitario')::numeric)
    );
  END LOOP;

  -- 3. Insertar el pedido (estado fijo 'pendiente', total calculado)
  INSERT INTO pedidos (cliente_nombre, cliente_telefono, cliente_email, usuario_id, total)
  VALUES (p_cliente_nombre, p_cliente_telefono, p_cliente_email, p_usuario_id, v_total)
  RETURNING id INTO v_pedido_id;

  -- 4. Insertar todos los items en una sola operación
  --    nombre_producto se resuelve desde productos.nombre al momento de la inserción
  INSERT INTO pedido_items (pedido_id, producto_id, variante_id, cantidad, precio_unitario, nombre_producto)
  SELECT
    v_pedido_id,
    (item->>'producto_id')::uuid,
    NULLIF(item->>'variante_id', '')::uuid,
    (item->>'cantidad')::integer,
    (item->>'precio_unitario')::numeric,
    p.nombre
  FROM jsonb_array_elements(p_items) AS item
  JOIN productos p ON p.id = (item->>'producto_id')::uuid;

  -- 5. Devolver el pedido creado como jsonb
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

-- Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.crear_pedido_completo TO anon;
GRANT EXECUTE ON FUNCTION public.crear_pedido_completo TO authenticated;