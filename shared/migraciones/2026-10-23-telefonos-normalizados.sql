-- =============================================================================
-- Migración incremental 2026-10-23 — Tarea 1.5 (teléfonos normalizados)
--
-- Para una instancia que YA tiene datos. Correr en el SQL Editor de Supabase.
--
-- ORDEN: conviene correrla después de desplegar la tienda y el admin nuevos
-- (el admin viejo antepone 54 a los teléfonos y armaría links de WhatsApp
-- incorrectos con los ya normalizados). La RPC nueva acepta también los 10
-- dígitos que manda la tienda vieja y los completa con 549, así que el orden
-- no rompe reservas.
--
-- 1. Normaliza los teléfonos existentes a 549 + área + número (pedidos,
--    clientes y configuracion_tienda). Los que no se pueden normalizar (por
--    ejemplo, sin código de área) quedan como están: revisalos con la consulta
--    de verificación del final y corregilos a mano o desde el admin.
-- 2. crear_pedido_completo exige el formato 549… y habla de "reserva".
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.normalizar_telefono_ar(t text) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  d text := regexp_replace(coalesce(t, ''), '\D', '', 'g');
  cortos text[] := ARRAY['220','221','223','230','236','237','249','260','261','263','264',
    '266','280','291','294','297','298','299','336','341','342','343','345','348','351',
    '353','358','362','364','370','376','379','380','381','383','385','387','388'];
  largo int;
BEGIN
  IF d ~ '^549[0-9]{10}$' THEN RETURN d; END IF;          -- ya normalizado
  IF d ~ '^54[0-9]{10}$' THEN RETURN '549' || substr(d, 3); END IF;  -- 54 sin el 9
  d := regexp_replace(d, '^0+', '');                       -- 0 del área
  IF d ~ '^[0-9]{12}$' THEN                                -- área + 15 + número
    largo := CASE WHEN d LIKE '11%' THEN 2
                  WHEN left(d, 3) = ANY (cortos) THEN 3
                  ELSE 4 END;
    IF substr(d, largo + 1, 2) = '15' THEN
      d := left(d, largo) || substr(d, largo + 3);
    END IF;
  END IF;
  IF d ~ '^[0-9]{10}$' AND d !~ '^15' THEN RETURN '549' || d; END IF;
  RETURN NULL;                                             -- no se puede normalizar
END;
$$;

-- ── 1. Normalizar teléfonos existentes ────────────────────────────────────────
-- Sin tocar actualizado_en de las reservas viejas: se apaga ese trigger solo
-- durante este UPDATE (el de transición de estado no se dispara: el estado no cambia).
ALTER TABLE pedidos DISABLE TRIGGER trigger_pedidos_actualizado;

UPDATE pedidos
SET cliente_telefono = pg_temp.normalizar_telefono_ar(cliente_telefono)
WHERE pg_temp.normalizar_telefono_ar(cliente_telefono) IS NOT NULL
  AND cliente_telefono IS DISTINCT FROM pg_temp.normalizar_telefono_ar(cliente_telefono);

ALTER TABLE pedidos ENABLE TRIGGER trigger_pedidos_actualizado;

UPDATE clientes
SET telefono = pg_temp.normalizar_telefono_ar(telefono)
WHERE telefono IS NOT NULL
  AND pg_temp.normalizar_telefono_ar(telefono) IS NOT NULL
  AND telefono IS DISTINCT FROM pg_temp.normalizar_telefono_ar(telefono);

UPDATE configuracion_tienda
SET telefono = pg_temp.normalizar_telefono_ar(telefono)
WHERE pg_temp.normalizar_telefono_ar(telefono) IS NOT NULL
  AND telefono IS DISTINCT FROM pg_temp.normalizar_telefono_ar(telefono);


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
  v_telefono text := regexp_replace(coalesce(p_cliente_telefono, ''), '[^0-9]', '', 'g');
  v_email text := lower(btrim(coalesce(p_cliente_email, '')));
BEGIN
  -- 1. Datos de contacto
  IF char_length(v_nombre) NOT BETWEEN 3 AND 120 THEN
    RAISE EXCEPTION 'Nombre inválido.';
  END IF;
  -- Formato internacional argentino: 549 + código de área + número (13 dígitos).
  -- Compatibilidad: una tienda anterior a la normalización manda área + número
  -- (10 dígitos); se completa con 549 en lugar de rechazar la reserva.
  IF v_telefono ~ '^[0-9]{10}$' AND v_telefono !~ '^(0|15)' THEN
    v_telefono := '549' || v_telefono;
  END IF;
  IF v_telefono !~ '^549[0-9]{10}$' THEN
    RAISE EXCEPTION 'Teléfono inválido: ingresá código de área sin 0 y número sin 15.';
  END IF;
  IF char_length(v_email) > 254
     OR v_email !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' THEN
    RAISE EXCEPTION 'Email inválido.';
  END IF;

  -- 2. Items
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La reserva debe tener al menos un producto.';
  END IF;
  IF jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'La reserva tiene demasiados productos.';
  END IF;

  -- 3. Anti-spam
  IF (SELECT count(*) FROM pedidos
      WHERE cliente_telefono = v_telefono
        AND creado_en > now() - interval '10 minutes') >= 3 THEN
    RAISE EXCEPTION 'Demasiadas reservas seguidas. Esperá unos minutos.';
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

COMMIT;


-- =============================================================================
-- Verificación (correr aparte, después): teléfonos que quedaron sin normalizar
-- =============================================================================
-- SELECT 'pedidos' AS tabla, cliente_telefono AS telefono, count(*) FROM pedidos
--   WHERE cliente_telefono !~ '^549[0-9]{10}$' GROUP BY 1, 2
-- UNION ALL
-- SELECT 'clientes', telefono, count(*) FROM clientes
--   WHERE telefono IS NOT NULL AND telefono !~ '^549[0-9]{10}$' GROUP BY 1, 2
-- UNION ALL
-- SELECT 'configuracion_tienda', telefono, 1 FROM configuracion_tienda
--   WHERE telefono !~ '^549[0-9]{10}$';
