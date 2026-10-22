-- =============================================================================
-- Auditoría 2026-10 — Correcciones de base de datos
--
-- NO CORRER hasta revisar los resultados de diagnostico.sql.
-- Todo es incremental e idempotente (CREATE OR REPLACE / DROP ... IF EXISTS).
-- Correr bloque por bloque en el SQL Editor. Después de aplicarlo, trasladar
-- los cambios a shared/rpc.sql y shared/rls.sql para que la fuente quede igual.
-- =============================================================================


-- ── C1. crear_pedido_completo: precio y usuario del lado del servidor ────────
--
-- Antes: el total se calculaba con el precio_unitario que manda el navegador
-- (se podía comprar todo a $1) y usuario_id venía del parámetro p_usuario_id
-- (se podían colgar pedidos en la cuenta de otro). Ahora:
--   - el precio sale de producto_variantes.precio o productos.precio_base;
--   - usuario_id = auth.uid() (p_usuario_id se mantiene en la firma para no
--     romper el client actual, pero se ignora);
--   - se validan formato y largo de nombre/teléfono/email y cantidades;
--   - freno anti-spam simple: máx. 3 pedidos por teléfono cada 10 minutos.
--
-- Producción tiene además una versión vieja de 4 parámetros (sin
-- p_usuario_id) con el mismo bug de precio, invocable por /rpc. Se elimina.
-- El client actual siempre manda p_usuario_id, así que usa la de 5.
--
-- ⚠ Este bloque se corre ENTERO de una vez (los comentarios "-- 1.", "-- 2."…
--   están dentro de la función, no son bloques aparte).

-- ▼▼▼ C1 — COPIAR DESDE ACÁ ▼▼▼
DROP FUNCTION IF EXISTS public.crear_pedido_completo(text, text, text, jsonb);

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
-- ▲▲▲ C1 — HASTA ACÁ ▲▲▲
--
-- De acá en adelante, cada bloque C2…C8 se corre entero (desde su título
-- "── Cn." hasta el título del siguiente).


-- ── C2. sucursales: RLS apagado → cualquiera con la anon key puede escribir ──

ALTER TABLE sucursales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura pública de sucursales" ON sucursales;
DROP POLICY IF EXISTS "Gestión completa para administradores" ON sucursales;

CREATE POLICY "Lectura pública de sucursales"
  ON sucursales FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Gestión completa para administradores"
  ON sucursales FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ── C3. productos: asegurar que no quede la policy USING (true) de schema.sql
--        y alinear la lectura pública con lo que el client espera (sin_stock
--        se muestra en la tienda, aunque no se puede comprar).

DROP POLICY IF EXISTS "Gestión completa para administradores" ON productos;
DROP POLICY IF EXISTS "Lectura pública de productos disponibles" ON productos;

CREATE POLICY "Lectura pública de productos disponibles"
  ON productos FOR SELECT
  TO anon, authenticated
  USING (estado IN ('disponible', 'sin_stock'));

CREATE POLICY "Gestión completa para administradores"
  ON productos FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Variantes de productos sin stock: visibles (para mostrar precios), aunque
-- la RPC sigue rechazando la compra porque el producto no está 'disponible'.
DROP POLICY IF EXISTS "Lectura pública de variantes disponibles" ON producto_variantes;

CREATE POLICY "Lectura pública de variantes disponibles"
  ON producto_variantes FOR SELECT
  TO anon, authenticated
  USING (
    estado = 'disponible'
    AND EXISTS (
      SELECT 1 FROM productos
      WHERE productos.id = producto_id
      AND productos.estado IN ('disponible', 'sin_stock')
    )
  );


-- ── C4. clientes: el usuario solo puede editar nombre, apellido y teléfono
--        (hoy puede cambiar también su email del perfil y el admin vería otro).

REVOKE UPDATE ON clientes FROM anon, authenticated;
GRANT UPDATE (nombre, apellido, telefono) ON clientes TO authenticated;

-- Largos máximos (NOT VALID: no revisa filas viejas, sí las nuevas/editadas)
ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_largos_check;
ALTER TABLE clientes ADD CONSTRAINT clientes_largos_check CHECK (
  char_length(nombre) <= 80 AND char_length(apellido) <= 80
  AND (telefono IS NULL OR telefono ~ '^[0-9]{8,15}$')
) NOT VALID;


-- ── C5. admins: que nadie (salvo service_role) pueda tocar la tabla vía API ──

REVOKE ALL ON admins FROM anon, authenticated;


-- ── C6. Funciones SECURITY DEFINER: sacar el EXECUTE implícito a PUBLIC ─────

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Trigger function: no debe poder llamarse por /rpc
REVOKE ALL ON FUNCTION public.handle_new_cliente() FROM PUBLIC, anon, authenticated;

-- Solo la usa pg_cron (job 1, corre como postgres)
REVOKE ALL ON FUNCTION public.limpiar_mensaje_alerta_vencido() FROM PUBLIC, anon, authenticated;


-- ── C7. Storage: limitar tamaño y tipos del bucket (sin SVG ni HTML) ────────

UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/webp', 'image/jpeg', 'image/png']
WHERE id = 'imagenes-productos';


-- ── C8. Privilegios de tabla que la API nunca necesita ───────────────────────
--
-- anon/authenticated tienen TRUNCATE, TRIGGER y REFERENCES en todas las
-- tablas (default de Supabase). TRUNCATE no pasa por RLS. PostgREST no lo
-- expone, pero no hay motivo para dejarlo: si algún día aparece otra vía de
-- SQL con esos roles, borra tablas enteras.

REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- pedidos y pedido_items solo se escriben vía RPC (SECURITY DEFINER) o por
-- el admin con UPDATE: anon no necesita nada directo sobre ellas.
REVOKE INSERT, UPDATE, DELETE ON pedidos, pedido_items FROM anon;
REVOKE INSERT, DELETE ON pedidos FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON pedido_items FROM authenticated;


-- ── C9. Mi Cuenta: el cliente no ve los pedidos que el admin eliminó ────────
--
-- El borrado es lógico (pedidos.eliminado). Sin esto, un pedido eliminado le
-- quedaba al cliente como "Pendiente" para siempre. Bloque completo de una vez.

DROP POLICY IF EXISTS "Lectura de pedidos propios para clientes" ON pedidos;
CREATE POLICY "Lectura de pedidos propios para clientes"
  ON pedidos FOR SELECT
  TO authenticated
  USING (auth.uid() = usuario_id AND NOT eliminado);

DROP POLICY IF EXISTS "Lectura de items de pedidos propios para clientes" ON pedido_items;
CREATE POLICY "Lectura de items de pedidos propios para clientes"
  ON pedido_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pedidos
      WHERE pedidos.id = pedido_items.pedido_id
      AND pedidos.usuario_id = auth.uid()
      AND NOT pedidos.eliminado
    )
  );


-- ── Verificación final (correr al terminar) ──────────────────────────────────

SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'sucursales';

SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args, p.proacl
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('crear_pedido_completo', 'is_admin', 'handle_new_cliente', 'limpiar_mensaje_alerta_vencido');

SELECT id, file_size_limit, allowed_mime_types FROM storage.buckets;
